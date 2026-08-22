"""
Derive Clinical Context chips from a single patient's structured records.

Contexts are never hard-coded as a disease list. Labels come from parsed
diagnoses. Heuristics only decide whether an event is a meaningful ongoing
condition, a connected episode, or a resolved trivial illness.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional


# Category language — used to classify an extracted phrase, not to decide
# which named diseases the UI is allowed to show.
_SYMPTOM_PHRASES = {
    "fever", "pyrexia", "high fever", "low grade fever", "cough", "dry cough",
    "sore throat", "throat pain", "headache", "fatigue", "tiredness", "weakness",
    "body ache", "bodyache", "myalgia", "cold", "runny nose", "sneezing",
    "nausea", "vomiting", "diarrhea", "diarrhoea", "chills", "malaise",
    "loss of appetite", "body pain", "abdominal pain", "joint pain",
}

_TRIVIAL_ACUTE_PHRASES = {
    "viral fever", "viral illness", "viral infection", "flu", "influenza",
    "common cold", "uri", "upper respiratory tract infection",
    "upper respiratory infection", "acute gastroenteritis", "food poisoning",
}

_CHRONICITY_HINTS = (
    "chronic", "type 1", "type 2", "type-1", "type-2", "t1dm", "t2dm",
    "essential hypertension", "ongoing", "long standing", "longstanding",
)

# Link investigations/meds onto an *existing* diagnosis cluster.
# Never used to invent a context from a lab value alone.
_ASSOCIATION_HINTS = (
    (("hba1c", "glucose", "fbs", "ppbs", "rbs", "metformin", "insulin",
      "glimepiride", "gliclazide", "dapagliflozin", "empagliflozin"),
     ("diabetes", "dm", "t2dm", "t1dm", "hyperglycemia")),
    (("amlodipine", "telmisartan", "losartan", "enalapril", " ramipril",
      "blood pressure", "bp systolic", "hypertension"),
     ("hypertension", "htn", "blood pressure")),
    (("methotrexate", "hydroxychloroquine", "sulfasalazine", "tofacitinib",
      "rheumatoid", "uric acid", "allopurinol"),
     ("arthritis", "rheumatoid", "gout", "osteoarthritis")),
    (("fever", "pyrexia", "widal", "typhidot", "ceftriaxone", "azithromycin"),
     ("typhoid", "enteric fever", "salmonella", "malaria", "dengue", "sepsis")),
    (("inhaler", "salbutamol", "budesonide", "montelukast", "spirometry"),
     ("asthma", "copd", "bronchial")),
)


def _parse_date(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _norm(text: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() or ch.isspace() else " " for ch in (text or ""))
    return " ".join(cleaned.split())


def _display_label(text: str) -> str:
    raw = " ".join((text or "").strip().split())
    if not raw:
        return "Condition"
    ignore = {"acute", "chronic", "ch", "dx", "c/o", "likely", "probable", "suspected"}
    words = [w for w in raw.replace(".", " ").split() if w.lower().strip(".") not in ignore]
    label = " ".join(words) or raw
    return label[:1].upper() + label[1:]


def _normalize_context_label_and_id(norm_diag: str) -> tuple[str, str]:
    words = norm_diag.split()
    if "diabetes" in words or "dm" in words or "diabetic" in words or "t2dm" in words or "t1dm" in words:
        return "Diabetes", "diabetes"
    if "hypertension" in words or "htn" in words or "bp" in words or "blood pressure" in norm_diag:
        return "Hypertension", "hypertension"
    if "arthritis" in words or "osteoarthritis" in words or "gout" in words:
        return "Arthritis", "arthritis"
    if "typhoid" in words or "enteric" in words:
        return "Typhoid", "typhoid"
    if "asthma" in words:
        return "Asthma", "asthma"
    label = _display_label(norm_diag)
    return label, norm_diag.replace(" ", "-")


def _is_symptom(norm: str) -> bool:
    return norm in _SYMPTOM_PHRASES or any(norm == s or norm.endswith(" " + s) for s in _SYMPTOM_PHRASES)


def _is_trivial_acute(norm: str) -> bool:
    if _is_symptom(norm):
        return True
    return any(p in norm for p in _TRIVIAL_ACUTE_PHRASES)


def _has_chronicity_language(norm: str) -> bool:
    return any(h in norm for h in _CHRONICITY_HINTS)


def _short_duration(duration: Any) -> bool:
    if not duration:
        return False
    text = _norm(str(duration))
    if any(k in text for k in ("continuous", "ongoing", "lifelong", "indefinite", "long term", "long-term", "chronic")):
        return False
    if "month" in text or "year" in text or "week" in text:
        return "week" in text and any(n in text for n in ("1 ", "one ", "2 ", "two "))
    if "day" in text:
        return True
    return False


def _ongoing_duration(duration: Any) -> bool:
    if not duration:
        return False
    text = _norm(str(duration))
    return any(k in text for k in ("continuous", "ongoing", "lifelong", "indefinite", "long term", "chronic"))


def _names_related(a: str, b: str) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    if a in b or b in a:
        return True
    aw, bw = set(a.split()), set(b.split())
    stop = {"acute", "chronic", "the", "and", "with", "of", "left", "right"}
    aw, bw = aw - stop, bw - stop
    if not aw or not bw:
        return False
    overlap = aw & bw
    return bool(overlap) and (overlap == aw or overlap == bw or len(overlap) >= 2)


def _hint_tokens_for(norm: str) -> set[str]:
    tokens = set()
    for findings, conditions in _ASSOCIATION_HINTS:
        if any(c in norm for c in conditions):
            tokens.update(findings)
            tokens.update(conditions)
    tokens.update(norm.split())
    return tokens


def _blob_has_token(blob: str, tok: str) -> bool:
    if not tok or len(tok) < 3:
        return False
    return f" {tok} " in f" {blob} "


def _can_absorb_symptom(symptom: dict, diagnosis: dict) -> bool:
    """Link a prodrome (e.g. fever) to a later diagnosis only when related."""
    s = symptom["norm"]
    d = diagnosis["norm"]
    if _names_related(s, d):
        return True
    d_hints = _hint_tokens_for(d)
    if _blob_has_token(" ".join(d_hints), s) or any(_blob_has_token(" ".join(d_hints), t) for t in s.split()):
        return True
    if s in d_hints:
        return True
    return False


def _record_blob(record: dict) -> str:
    parsed = record.get("parsed_json") or {}
    parts = []
    for d in parsed.get("diagnoses") or []:
        parts.append(str(d))
    for m in parsed.get("medications") or []:
        if isinstance(m, dict):
            parts.append(str(m.get("name") or ""))
        else:
            parts.append(str(m))
    for lab in parsed.get("lab_results") or []:
        if isinstance(lab, dict):
            parts.append(str(lab.get("test_name") or ""))
    return _norm(" ".join(parts))


def _extract_labels(parsed: dict) -> list[tuple[str, str]]:
    """Return (raw, normalized) diagnosis/symptom labels from a parsed record."""
    labels = []
    seen = set()
    for raw in parsed.get("diagnoses") or []:
        if not raw or not str(raw).strip():
            continue
        text = str(raw).strip()
        norm = _norm(text)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        labels.append((text, norm))
    return labels


def detect_clinical_contexts(
    records: list[dict],
    current_visit_reason: Optional[str] = None,
    reference_date: Optional[datetime] = None,
) -> dict:
    """
    Build clinical-context chips from one patient's records only.

    `records` must already be scoped to a single patient by the caller.
    """
    if not records:
        return {"contexts": [], "default_context_id": None}

    dated = []
    for r in records:
        dt = _parse_date(r.get("date")) or _parse_date(r.get("created_at"))
        dated.append({**r, "_dt": dt})

    known_dates = [r["_dt"] for r in dated if r["_dt"]]
    now = reference_date or (max(known_dates) if known_dates else datetime.utcnow())

    clusters: list[dict] = []

    def find_cluster(norm: str) -> Optional[dict]:
        norm_label, norm_id = _normalize_context_label_and_id(norm)
        for c in clusters:
            if c.get("context_id") == norm_id:
                return c
            if _names_related(norm, c["norm"]) or any(_names_related(norm, a) for a in c["aliases"]):
                return c
        return None

    # Pass 1: cluster explicit diagnoses/symptoms
    for rec in dated:
        parsed = rec.get("parsed_json") or {}
        rid = rec.get("id")
        labels = _extract_labels(parsed)
        meds = parsed.get("medications") or []
        has_ongoing_med = any(_ongoing_duration(m.get("duration") if isinstance(m, dict) else None) for m in meds)
        has_short_med = any(_short_duration(m.get("duration") if isinstance(m, dict) else None) for m in meds)

        for raw, norm in labels:
            norm_label, norm_id = _normalize_context_label_and_id(norm)
            cluster = find_cluster(norm)
            if cluster is None:
                cluster = {
                    "context_id": norm_id,
                    "label": norm_label,
                    "norm": norm,
                    "raw_labels": [raw],
                    "aliases": {norm},
                    "record_ids": [],
                    "dates": [],
                    "symptom_only": _is_symptom(norm) and not _has_chronicity_language(norm),
                    "trivial_language": _is_trivial_acute(norm),
                    "chronic_language": _has_chronicity_language(norm),
                    "confirmed": not _is_symptom(norm),
                    "suspected": any(k in norm for k in ("suspected", "probable", "likely", "possible")),
                    "short_meds": False,
                    "ongoing_meds": False,
                    "precursor_ids": [],
                }
                clusters.append(cluster)
            else:
                cluster["raw_labels"].append(raw)
                cluster["aliases"].add(norm)
                if len(norm) > len(cluster["norm"]) and not _is_symptom(norm):
                    cluster["norm"] = norm
                if not _is_symptom(norm):
                    cluster["confirmed"] = True
                    cluster["symptom_only"] = False
                if _has_chronicity_language(norm):
                    cluster["chronic_language"] = True
                if _is_trivial_acute(norm):
                    cluster["trivial_language"] = True

            if rid not in cluster["record_ids"]:
                cluster["record_ids"].append(rid)
            if rec["_dt"]:
                cluster["dates"].append(rec["_dt"])
            cluster["short_meds"] = cluster["short_meds"] or has_short_med
            cluster["ongoing_meds"] = cluster["ongoing_meds"] or has_ongoing_med

    # Pass 2: absorb temporally connected symptom episodes into a later diagnosis
    # e.g. Fever (10 Aug) → Typhoid (18 Aug)
    diagnosis_clusters = [c for c in clusters if c["confirmed"] and not c["symptom_only"]]
    symptom_clusters = [c for c in clusters if c["symptom_only"] or (c["trivial_language"] and not c["chronic_language"])]

    for symptom in symptom_clusters:
        s_dates = symptom["dates"] or []
        if not s_dates:
            continue
        s_last = max(s_dates)
        s_first = min(s_dates)
        best = None
        best_gap = None
        for diag in diagnosis_clusters:
            if diag is symptom:
                continue
            d_dates = diag["dates"] or []
            if not d_dates:
                continue
            d_first = min(d_dates)
            if not _can_absorb_symptom(symptom, diag):
                continue
            # Symptom starts before or around the diagnosis, within 21 days
            gap = (d_first - s_last).days
            if -3 <= gap <= 21 or (s_first <= d_first and (d_first - s_first).days <= 21):
                if best_gap is None or abs(gap) < abs(best_gap):
                    best = diag
                    best_gap = gap
        if best:
            for rid in symptom["record_ids"]:
                if rid not in best["record_ids"]:
                    best["record_ids"].append(rid)
                    best["precursor_ids"].append(rid)
            best["dates"].extend(symptom["dates"])
            symptom["_absorbed"] = True

    # Pass 3: attach related labs/prescriptions that never named the diagnosis
    for rec in dated:
        rid = rec.get("id")
        blob = _record_blob(rec)
        if not blob:
            continue
        for cluster in diagnosis_clusters:
            if rid in cluster["record_ids"]:
                continue
            hints = _hint_tokens_for(cluster["norm"])
            if any(_blob_has_token(blob, tok) for tok in hints):
                cluster["record_ids"].append(rid)

    contexts = []
    for cluster in clusters:
        if cluster.get("_absorbed"):
            continue

        dates = cluster["dates"]
        span_days = (max(dates) - min(dates)).days if len(dates) >= 2 else 0
        last = max(dates) if dates else None
        first = min(dates) if dates else None
        recurring = span_days >= 21 or len({d.date() for d in dates}) >= 2 and span_days >= 14

        is_trivial = (cluster["symptom_only"] or cluster["trivial_language"]) and not cluster["chronic_language"]
        is_confirmed_disease = cluster["confirmed"] and not cluster["symptom_only"]

        if is_trivial and not is_confirmed_disease:
            # Isolated/resolved viral illness or symptom — keep in timeline only
            continue
        if cluster["suspected"] and not cluster["ongoing_meds"] and not recurring:
            continue
        if not is_confirmed_disease:
            continue

        if cluster["chronic_language"] or cluster["ongoing_meds"] or recurring:
            kind = "chronic_ongoing"
        elif cluster["short_meds"] and last and (now - last) > timedelta(days=21) and not recurring:
            kind = "acute_resolved"
        elif last and (now - last) <= timedelta(days=30):
            kind = "acute_active"
        elif cluster["short_meds"] or (last and (now - last) > timedelta(days=45) and not recurring):
            kind = "acute_resolved"
        else:
            kind = "chronic_ongoing"

        # Trivial language that somehow stayed confirmed (e.g. "viral fever") —
        # still exclude unless it progressed via a different cluster.
        if cluster["trivial_language"] and not cluster["chronic_language"] and kind == "acute_resolved":
            continue
        if cluster["trivial_language"] and _is_trivial_acute(cluster["norm"]) and not any(
            not _is_trivial_acute(_norm(x)) and not _is_symptom(_norm(x)) for x in cluster["raw_labels"]
        ):
            continue

        preferred_raw = cluster["raw_labels"][-1]
        for raw in reversed(cluster["raw_labels"]):
            n = _norm(raw)
            if not _is_symptom(n) and not _is_trivial_acute(n):
                preferred_raw = raw
                break

        context_id = cluster.get("context_id") or cluster["norm"].replace(" ", "-")[:80]
        label = cluster.get("label") or _display_label(preferred_raw)
        contexts.append({
            "id": context_id,
            "label": label,
            "kind": kind,
            "record_ids": [i for i in cluster["record_ids"] if i is not None],
            "related_record_ids": [i for i in cluster.get("precursor_ids") or [] if i is not None],
            "first_date": first.strftime("%Y-%m-%d") if first else None,
            "latest_date": last.strftime("%Y-%m-%d") if last else None,
            "reason": _reason_for(kind, cluster, recurring),
        })

    contexts = _dedupe_contexts(contexts)
    default_id = _select_default(contexts, current_visit_reason)
    return {"contexts": contexts, "default_context_id": default_id}


def _reason_for(kind: str, cluster: dict, recurring: bool) -> str:
    if kind == "chronic_ongoing":
        if recurring:
            return "Condition appears across multiple encounters."
        if cluster["ongoing_meds"]:
            return "Ongoing treatment recorded."
        return "Confirmed ongoing condition in the medical record."
    if kind == "acute_active":
        return "Recent confirmed diagnosis or active treatment episode."
    return "Named clinical episode retained as a focused context."


def _dedupe_contexts(contexts: list[dict]) -> list[dict]:
    by_id = {}
    for ctx in contexts:
        existing = by_id.get(ctx["id"])
        if not existing:
            by_id[ctx["id"]] = ctx
            continue
        ids = list(dict.fromkeys(existing["record_ids"] + ctx["record_ids"]))
        related = list(dict.fromkeys(existing["related_record_ids"] + ctx["related_record_ids"]))
        existing["record_ids"] = ids
        existing["related_record_ids"] = related
        if (ctx.get("latest_date") or "") > (existing.get("latest_date") or ""):
            existing["latest_date"] = ctx["latest_date"]
            existing["label"] = ctx["label"]
            existing["kind"] = ctx["kind"]
    return list(by_id.values())


def _select_default(contexts: list[dict], current_visit_reason: Optional[str]) -> Optional[str]:
    if not contexts:
        return None
    if len(contexts) == 1:
        return contexts[0]["id"]

    reason = _norm(current_visit_reason or "")
    if reason:
        for ctx in contexts:
            if ctx["id"].replace("-", " ") in reason or _norm(ctx["label"]) in reason:
                return ctx["id"]

    rank = {"acute_active": 0, "chronic_ongoing": 1, "acute_resolved": 2}
    sorted_ctx = sorted(
        contexts,
        key=lambda c: (
            rank.get(c["kind"], 9),
            -(datetime.strptime(c["latest_date"], "%Y-%m-%d").timestamp() if c.get("latest_date") else 0),
        ),
    )
    return sorted_ctx[0]["id"]


def records_for_context(records: list[dict], context: Optional[dict]) -> list[dict]:
    """Return records relevant to a context, plus any allergy-bearing records."""
    if not context:
        return records
    keep = set(context.get("record_ids") or []) | set(context.get("related_record_ids") or [])
    label = _norm(context.get("label") or "")
    if not keep and label:
        keep = {r.get("id") for r in records if label and label in _record_blob(r)}
    focused = []
    for r in records:
        parsed = r.get("parsed_json") or {}
        allergies = parsed.get("allergies") or []
        if r.get("id") in keep or allergies:
            focused.append(r)
    return focused
