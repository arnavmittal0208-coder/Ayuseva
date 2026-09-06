import pytest
from app.services.clinical_intake_ai import process_live_conversation_turn

def test_natural_narration_primary_source_stops_unnecessary_questions():
    """
    Requirement: The patient's natural narration is the PRIMARY source.
    If the narration communicates the situation (complaint + duration + associated symptom),
    the AI should conclude immediately without asking follow-up questions.
    """
    history = [
        {"role": "assistant", "content": "नमस्ते, आज आप कैसा महसूस कर रहे हैं? अपनी समस्या बताएं।"},
        {"role": "user", "content": "मुझे 3 दिन से सूखी खांसी और हल्का बुखार है।"}
    ]
    res = process_live_conversation_turn(history, "hi-IN")
    assert res["is_complete"] is True
    assert "धन्यवाद" in res["next_question"] or "नोट कर ली" in res["next_question"]


def test_semantic_sufficiency_no_word_count():
    """
    Requirement: DO NOT use word-count thresholds.
    A short statement can be sufficient if it clearly communicates the current situation.
    A short statement lacking critical info (e.g. only symptom, no duration) asks 1 focused follow-up.
    """
    # 1. Short statement that IS clinically sufficient (complaint + duration)
    hist_sufficient = [
        {"role": "assistant", "content": "नमस्ते, क्या परेशानी है?"},
        {"role": "user", "content": "कल से पेट दर्द है।"}
    ]
    res_sufficient = process_live_conversation_turn(hist_sufficient, "hi-IN")
    assert res_sufficient["is_complete"] is True
    assert "धन्यवाद" in res_sufficient["next_question"] or "नोट कर ली" in res_sufficient["next_question"]

    # 2. Short statement missing critical duration asks ONE concise question
    hist_incomplete = [
        {"role": "assistant", "content": "नमस्ते, क्या परेशानी है?"},
        {"role": "user", "content": "मुझे बहुत तेज सिरदर्द है।"}
    ]
    res_incomplete = process_live_conversation_turn(hist_incomplete, "hi-IN")
    assert res_incomplete["is_complete"] is False
    assert any(w in res_incomplete["next_question"] for w in ["कब", "दिन", "how long", "लक्षण", "परेशानी", "?"])

    # 3. Patient answers with a very short 3-word answer -> semantically sufficient, concludes immediately
    hist_incomplete.append({"role": "assistant", "content": res_incomplete["next_question"]})
    hist_incomplete.append({"role": "user", "content": "आज सुबह से।"})
    res_after_answer = process_live_conversation_turn(hist_incomplete, "hi-IN")
    assert res_after_answer["is_complete"] is True
    assert "धन्यवाद" in res_after_answer["next_question"] or "नोट कर ली" in res_after_answer["next_question"]


def test_repetition_prevention_on_already_provided():
    """
    Requirement: The AI must never repeat a question if information is already provided.
    If duration is already stated, it must NEVER ask duration.
    If fever is already stated, it must NEVER ask fever.
    """
    history = [
        {"role": "assistant", "content": "Hello, what brings you in today?"},
        {"role": "user", "content": "I have been having a severe migraine since yesterday."}
    ]
    res = process_live_conversation_turn(history, "en-IN")
    # Duration 'since yesterday' is already provided
    assert res["is_complete"] is True or ("how long" not in res["next_question"].lower() and "when" not in res["next_question"].lower())


def test_denial_memory_never_repeats():
    """
    Requirement: If the patient explicitly denied a symptom (e.g. 'No fever' or 'नहीं, सांस में कोई दिक्कत नहीं'),
    the AI must remember it and NEVER ask about it again.
    """
    history = [
        {"role": "assistant", "content": "नमस्ते, क्या समस्या है?"},
        {"role": "user", "content": "दो दिन से जुकाम है।"},
        {"role": "assistant", "content": "क्या आपको बुखार या सांस लेने में भी कोई परेशानी है?"},
        {"role": "user", "content": "नहीं, ऐसा कुछ नहीं है।"}
    ]
    res = process_live_conversation_turn(history, "hi-IN")
    assert res["is_complete"] is True
    assert "धन्यवाद" in res["next_question"] or "नोट कर ली" in res["next_question"]


def test_empty_structured_fields_do_not_force_questions():
    """
    Requirement: An empty structured field does NOT automatically mean you should ask a question.
    Intake should not act like a questionnaire interrogating triggers, severity, changes.
    """
    history = [
        {"role": "assistant", "content": "Hello, how can I help you today?"},
        {"role": "user", "content": "I have had a mild cough for 3 days."}
    ]
    res = process_live_conversation_turn(history, "en-IN")
    # Even though triggers, severity, associated symptoms are not explicitly stated, intake is complete
    assert res["is_complete"] is True
    assert "thank you" in res["next_question"].lower() or "noted" in res["next_question"].lower()
