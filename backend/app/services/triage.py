"""
Deterministic rule-based emergency triage screening for AyuSeva.
Evaluates patient-reported complaints and narration for life-threatening acute symptoms.
Screening indicator only — NOT an AI diagnosis.
"""

from typing import List, Dict, Any, Optional

RED_FLAG_PATTERNS = [
    {
        "category": "Cardiovascular / Acute Coronary Syndrome",
        "description": "Retrosternal chest pain, crushing/radiating discomfort",
        "keywords": [
            "chest pain", "chest tightness", "crushing chest", "radiating to arm", "radiating to left arm",
            "radiating to jaw", "heart attack", "छाती में दर्द", "सीने में दर्द", "छाती में जकड़न",
            "ಎದೆ ನೋವು", "ਛਾਤੀ ਵਿੱਚ ਦਰਦ", "நெஞ்சு வலி", "గుండె నొప్పి", "বুকে ব্যথা", "छातीत दुखणे"
        ]
    },
    {
        "category": "Respiratory / Acute Dyspnea",
        "description": "Severe breathing difficulty, choking, or hemoptysis",
        "keywords": [
            "shortness of breath at rest", "breathlessness at rest", "cannot breathe", "can't breathe", "choking",
            "gasping for air", "coughing blood", "hemoptysis", "सांस फूलना", "सांस लेने में बहुत तकलीफ",
            "ಉಸಿರಾಟದ ತೊಂದರೆ", "ਸਾਹ ਲੈਣ ਵਿੱਚ ਮੁਸ਼ਕਲ", "மூச்சுத்திணறல்", "శ్వాస ఆడకపోవడం", "শ্বাসকষ্ট"
        ]
    },
    {
        "category": "Neurological / FAST Stroke Protocol",
        "description": "Sudden facial asymmetry, unilateral weakness, or acute aphasia/slurred speech",
        "keywords": [
            "facial droop", "slurred speech", "slurring speech", "arm weakness", "sudden paralysis",
            "one side weak", "loss of speech", "can't speak suddenly", "stroke", "मुंह टेढ़ा", "आवाज़ लड़खड़ाना",
            "लकवा", "ಒಂದು ಬದಿಯ ದೌರ್ಬಲ್ಯ", "ਲਕਵਾ", "பக்கவாதம்", "పక్షవాతం", "মুখ বেঁকে যাওয়া"
        ]
    },
    {
        "category": "Systemic / Meningeal / Severe Hemorrhage",
        "description": "Severe acute hemorrhage, high fever with neck rigidity or altered consciousness",
        "keywords": [
            "stiff neck and fever", "neck stiffness and fever", "unconscious", "loss of consciousness",
            "severe blood loss", "vomiting blood", "uncontrolled bleeding", "गले में अकड़न और बुखार",
            "बेहोशी", "खून की उल्टी", "తీవ్రమైన రక్తస్రావం", "இரத்தப்போக்கு"
        ]
    }
]

import re

def _is_negated_match(text: str, kw: str) -> bool:
    """
    Checks if all occurrences of kw in text are negated (e.g. 'denies chest pain', 'no chest pain').
    Returns True only if every mention of kw is negated.
    """
    kw_esc = re.escape(kw)
    neg_prefix_pattern = re.compile(
        rf'\b(?:no|denies|denied|denies any|without|negative for|rules out|free of|not having)\s+(?:any\s+)?(?:other\s+)?{kw_esc}',
        re.IGNORECASE
    )
    neg_suffix_pattern = re.compile(
        rf'{kw_esc}\s+(?:नहीं|ਨਹੀਂ|ਇಲ್ಲ|இல்லை|లేదు)',
        re.IGNORECASE
    )
    compound_neg_pattern = re.compile(
        rf'\b(?:denies|denied|no)\s+[^.;\n]+?\b(?:and|or|,)\s+(?:any\s+)?{kw_esc}',
        re.IGNORECASE
    )

    matches = list(re.finditer(rf'\b{kw_esc}\b' if kw.isascii() else kw_esc, text, re.IGNORECASE))
    if not matches:
        return False

    for m in matches:
        start, end = m.start(), m.end()
        window_start = max(0, start - 60)
        window_end = min(len(text), end + 20)
        snippet = text[window_start:window_end]

        if neg_prefix_pattern.search(snippet) or neg_suffix_pattern.search(snippet) or compound_neg_pattern.search(snippet):
            continue
        return False

    return True


def evaluate_emergency_triage(
    raw_narration: str = "",
    translated_narration: str = "",
    chief_complaints: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Deterministically screens clinical texts for red-flag triggers.
    Runs rule-based checks across raw transcript, translated clinical text, and complaints.
    Ignores symptoms that are explicitly negated (e.g. 'patient denies chest pain').
    """
    combined_text = f"{raw_narration or ''} {translated_narration or ''} {' '.join(chief_complaints or [])}"
    triggered_flags: List[str] = []

    for pattern in RED_FLAG_PATTERNS:
        for kw in pattern["keywords"]:
            if kw.lower() in combined_text.lower():
                # Verify that the keyword is not explicitly negated in context
                if _is_negated_match(combined_text, kw):
                    continue
                flag_text = f"{pattern['category']} — {pattern['description']}"
                if flag_text not in triggered_flags:
                    triggered_flags.append(flag_text)
                break

    is_emergency = len(triggered_flags) > 0

    return {
        "triage_priority": "priority_red_flag" if is_emergency else "routine",
        "triage_flags": triggered_flags,
        "is_emergency": is_emergency,
        "disclaimer": "This is a preliminary screening/triage indicator, NOT an AI diagnosis. The absence of a red-flag alert does NOT guarantee that an acute medical emergency is absent."
    }
