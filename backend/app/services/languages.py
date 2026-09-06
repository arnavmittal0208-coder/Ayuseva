"""
Declarative Multilingual Language Registry for AyuSeva Voice Intake.
Provider-driven by Sarvam API capabilities and extensible without code changes to core clinical workflows.
"""

from typing import List, Dict, Optional, Any

# Dynamic provider-driven language registry
SUPPORTED_LANGUAGES: List[Dict[str, Any]] = [
    {
        "code": "hi-IN",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "is_popular": True,
        "preferred_speaker": "priya",
        "initial_greeting": "नमस्ते। कृपया बताइए कि आज आपको क्या परेशानी या लक्षण हो रहे हैं?"
    },
    {
        "code": "en-IN",
        "name": "English",
        "native_name": "English",
        "is_popular": True,
        "preferred_speaker": "aditya",
        "initial_greeting": "Hello. Please describe the symptoms or health concerns you are experiencing today."
    },
    {
        "code": "pa-IN",
        "name": "Punjabi",
        "native_name": "ਪੰਜਾਬੀ",
        "is_popular": True,
        "preferred_speaker": "priya",
        "initial_greeting": "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੱਸੋ ਕਿ ਅੱਜ ਤੁਹਾਨੂੰ ਕੀ ਸਮੱਸਿਆ ਜਾਂ ਲੱਛਣ ਆ ਰਹੇ ਹਨ?"
    },
    {
        "code": "kn-IN",
        "name": "Kannada",
        "native_name": "ಕನ್ನಡ",
        "is_popular": True,
        "preferred_speaker": "priya",
        "initial_greeting": "ನಮಸ್ಕಾರ. ದಯವಿಟ್ಟು ಇಂದು ನೀವು ಯಾವ ಆರೋಗ್ಯ ಸಮಸ್ಯೆಯನ್ನು ಎದುರಿಸುತ್ತಿದ್ದೀರಿ ಎಂದು ತಿಳಿಸಿ."
    },
    {
        "code": "bn-IN",
        "name": "Bengali",
        "native_name": "বাংলা",
        "is_popular": True,
        "preferred_speaker": "priya",
        "initial_greeting": "নমস্কার। অনুগ্রহ করে বলুন আজ আপনার কী শারীরিক সমস্যা বা লক্ষণ দেখা দিচ্ছে।"
    },
    {
        "code": "mr-IN",
        "name": "Marathi",
        "native_name": "मराठी",
        "is_popular": False,
        "preferred_speaker": "priya",
        "initial_greeting": "नमस्कार. कृपया सांगा की आज तुम्हाला काय त्रास किंवा लक्षणे जाणवत आहेत."
    },
    {
        "code": "gu-IN",
        "name": "Gujarati",
        "native_name": "ગુજરાતી",
        "is_popular": False,
        "preferred_speaker": "priya",
        "initial_greeting": "નમસ્તે. કૃપા કરીને જણાવો કે આજે તમને શું તકલીફ અથવા લક્ષણો જણાય છે."
    },
    {
        "code": "ta-IN",
        "name": "Tamil",
        "native_name": "தமிழ்",
        "is_popular": False,
        "preferred_speaker": "priya",
        "initial_greeting": "வணக்கம். இன்று உங்களுக்கு என்ன உடல்நல பிரச்சனைகள் உள்ளன என்று தயவுசெய்து கூறுங்கள்."
    },
    {
        "code": "te-IN",
        "name": "Telugu",
        "native_name": "తెలుగు",
        "is_popular": False,
        "preferred_speaker": "priya",
        "initial_greeting": "నమస్కారం. ఈ రోజు మీరు ఎదుర్కొంటున్న ఆరోగ్య సమస్యలు లేదా లక్షణాలను దయచేసి చెప్పండి."
    },
    {
        "code": "ml-IN",
        "name": "Malayalam",
        "native_name": "മലയാളം",
        "is_popular": False,
        "preferred_speaker": "priya",
        "initial_greeting": "നമസ്കാരം. ഇന്ന് നിങ്ങൾക്ക് എന്തെങ്കിലും ആരോഗ്യ പ്രശ്നങ്ങളോ ബുദ്ധിമുട്ടുകളോ ഉണ്ടെങ്കിൽ ദയവായി പറയുക."
    },
    {
        "code": "od-IN",
        "name": "Odia",
        "native_name": "ଓଡ଼ିଆ",
        "is_popular": False,
        "preferred_speaker": "priya",
        "initial_greeting": "ନମସ୍କାର। ଆଜି ଆପଣଙ୍କୁ କ'ଣ ସ୍ୱାସ୍ଥ୍ୟ ସମସ୍ୟା କିମ୍ବା ଲକ୍ଷଣ ହେଉଛି ଦୟାକରି କୁହନ୍ତୁ।"
    }
]

LANGUAGE_MAP: Dict[str, Dict[str, Any]] = {lang["code"]: lang for lang in SUPPORTED_LANGUAGES}

def get_supported_languages() -> List[Dict[str, Any]]:
    """Returns all configured Sarvam-supported languages."""
    return SUPPORTED_LANGUAGES

def get_popular_languages() -> List[Dict[str, Any]]:
    """Returns languages flagged as popular for client UI priority buttons."""
    return [lang for lang in SUPPORTED_LANGUAGES if lang.get("is_popular", False)]

def get_other_languages() -> List[Dict[str, Any]]:
    """Returns remaining languages for searchable selector dropdown."""
    return [lang for lang in SUPPORTED_LANGUAGES if not lang.get("is_popular", False)]

def get_language(code: Optional[str]) -> Dict[str, Any]:
    """Resolves language metadata by language code with default fallback to English."""
    if not code:
        return LANGUAGE_MAP["en-IN"]
    return LANGUAGE_MAP.get(code, {
        "code": code,
        "name": code,
        "native_name": code,
        "is_popular": False,
        "preferred_speaker": "priya",
        "initial_greeting": "Please describe the symptoms you are experiencing today."
    })

def get_initial_greeting(code: Optional[str]) -> str:
    """Returns conversational opening greeting in patient's selected tongue."""
    lang = get_language(code)
    return lang.get("initial_greeting", "Hello. Please tell me what symptoms you are experiencing today.")
