import io
import wave
import requests
from typing import Dict, Any, Optional, List
from app.config import settings
from app.services.languages import get_language

SARVAM_STT_ENDPOINT = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_ENDPOINT = "https://api.sarvam.ai/text-to-speech"
MAX_CHUNK_DURATION_SEC = 24  # Sarvam limit is 30s; 24s provides a safe buffer for audio transcription

# Validated speakers for Sarvam bulbul:v3
VALID_SPEAKERS = [
    "priya", "aditya", "ritu", "ashutosh", "neha", "rahul", 
    "pooja", "rohan", "simran", "kavya", "amit", "dev", 
    "ishita", "shreya", "ratan", "varun", "manan", "sumit", "roopa"
]

def _split_wav_bytes(wav_bytes: bytes, chunk_duration_sec: int = MAX_CHUNK_DURATION_SEC) -> List[bytes]:
    """
    Splits long WAV audio bytes into <= chunk_duration_sec segments to bypass
    Sarvam's 30-second duration limit.
    """
    try:
        in_buf = io.BytesIO(wav_bytes)
        with wave.open(in_buf, 'rb') as rwf:
            channels = rwf.getnchannels()
            sampwidth = rwf.getsampwidth()
            rate = rwf.getframerate()
            total_frames = rwf.getnframes()
            duration = total_frames / rate if rate > 0 else 0
            if duration <= chunk_duration_sec:
                return [wav_bytes]

            frames_per_chunk = int(chunk_duration_sec * rate)
            chunks = []
            pos = 0
            while pos < total_frames:
                read_count = min(frames_per_chunk, total_frames - pos)
                frames = rwf.readframes(read_count)
                pos += read_count

                out_buf = io.BytesIO()
                with wave.open(out_buf, 'wb') as wwf:
                    wwf.setnchannels(channels)
                    wwf.setsampwidth(sampwidth)
                    wwf.setframerate(rate)
                    wwf.writeframes(frames)
                chunks.append(out_buf.getvalue())
            return chunks
    except Exception as e:
        print(f"[speech.py] Unable to parse/split WAV frames: {e}")
        return [wav_bytes]

def _transcribe_single_chunk(
    audio_bytes: bytes,
    content_type: str = "audio/wav",
    language_code: str = "hi-IN",
    model: str = "saaras:v3"
) -> Dict[str, Any]:
    """
    Internal single-chunk transcription with fallback from saaras:v3 to saarika:v2.5.
    """
    api_key = settings.SARVAM_API_KEY
    if not api_key:
        raise ValueError("SARVAM_API_KEY is not configured in backend settings.")

    lang_meta = get_language(language_code)
    ext = "webm" if "webm" in content_type.lower() else "wav" if "wav" in content_type.lower() else "mp3" if "mp3" in content_type.lower() else "audio"
    filename = f"intake_audio.{ext}"

    headers = {
        'api-subscription-key': api_key
    }

    models_to_try = [model]
    if model != "saarika:v2.5":
        models_to_try.append("saarika:v2.5")

    last_error = None
    for target_model in models_to_try:
        files = [
            ('file', (filename, io.BytesIO(audio_bytes), content_type))
        ]
        data = {
            'model': target_model,
            'language_code': language_code
        }

        try:
            response = requests.post(
                SARVAM_STT_ENDPOINT,
                headers=headers,
                data=data,
                files=files,
                timeout=30
            )
            if response.status_code == 200:
                res_data = response.json()
                transcript = res_data.get("transcript", "")
                detected_lang = res_data.get("language_code", language_code)

                return {
                    "transcript": transcript.strip(),
                    "language_code": detected_lang,
                    "language_name": lang_meta.get("name", language_code),
                    "provider": "sarvam",
                    "model": target_model
                }
            else:
                last_error = f"Sarvam API Error ({response.status_code}): {response.text}"
                print(f"[speech.py] Model {target_model} failed: {last_error}")
        except requests.RequestException as req_err:
            last_error = f"Request failed to Sarvam AI STT ({target_model}): {req_err}"
            print(f"[speech.py] {last_error}")

    raise RuntimeError(last_error or "Speech-to-text processing failed with Sarvam API.")

def transcribe_audio_sarvam(
    audio_bytes: bytes,
    content_type: str = "audio/wav",
    language_code: str = "hi-IN",
    model: str = "saaras:v3"
) -> Dict[str, Any]:
    """
    Transcribes spoken Indian regional audio via Sarvam AI API without duration limits.
    If the audio is a WAV file exceeding 24 seconds, it is automatically chunked and
    stitched together seamlessly.
    """
    is_wav = "wav" in content_type.lower() or audio_bytes.startswith(b"RIFF")
    if is_wav:
        chunks = _split_wav_bytes(audio_bytes, chunk_duration_sec=MAX_CHUNK_DURATION_SEC)
    else:
        chunks = [audio_bytes]

    if len(chunks) == 1:
        return _transcribe_single_chunk(
            audio_bytes=chunks[0],
            content_type=content_type,
            language_code=language_code,
            model=model
        )

    # Multi-chunk transcription
    print(f"[speech.py] Audio exceeds single segment limit. Processing {len(chunks)} chunks sequentially.")
    transcripts = []
    lang_info = get_language(language_code)
    last_model = model

    for idx, chunk in enumerate(chunks):
        res = _transcribe_single_chunk(
            audio_bytes=chunk,
            content_type="audio/wav",
            language_code=language_code,
            model=model
        )
        if res.get("transcript"):
            transcripts.append(res["transcript"])
        last_model = res.get("model", last_model)

    return {
        "transcript": " ".join(transcripts).strip(),
        "language_code": language_code,
        "language_name": lang_info.get("name", language_code),
        "provider": "sarvam",
        "model": last_model,
        "chunks_processed": len(chunks)
    }

def synthesize_speech_sarvam(
    text: str,
    language_code: str = "hi-IN",
    speaker: Optional[str] = None,
    model: str = "bulbul:v3"
) -> Dict[str, Any]:
    """
    Synthesizes speech audio from text using Sarvam AI Text-to-Speech API.
    Dynamically resolves the speaker based on request, language preference, or defaults.
    Returns base64 WAV audio for immediate playback in the patient's language.
    Gracefully degrades with error reporting if TTS is unavailable.
    """
    clean_text = (text or "").strip()
    if not clean_text:
        return {
            "has_audio": False,
            "audio_base64": None,
            "error": "Empty text provided for speech synthesis."
        }

    api_key = settings.SARVAM_API_KEY
    if not api_key:
        return {
            "has_audio": False,
            "audio_base64": None,
            "error": "SARVAM_API_KEY not configured."
        }

    # Resolve speaker dynamically
    resolved_speaker = speaker
    if not resolved_speaker or resolved_speaker not in VALID_SPEAKERS:
        lang_meta = get_language(language_code)
        resolved_speaker = lang_meta.get("preferred_speaker", "priya")
    if resolved_speaker not in VALID_SPEAKERS:
        resolved_speaker = "priya"

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "inputs": [clean_text],
        "target_language_code": language_code,
        "speaker": resolved_speaker,
        "model": model,
        "pitch": 0,
        "pace": 1.0,
        "loudness": 1.5,
        "speech_sample_rate": 16000,
        "enable_preprocessing": True
    }

    try:
        response = requests.post(SARVAM_TTS_ENDPOINT, headers=headers, json=payload, timeout=20)
        if response.status_code == 200:
            res_data = response.json()
            audios = res_data.get("audios", [])
            if audios and len(audios) > 0 and audios[0]:
                return {
                    "has_audio": True,
                    "audio_base64": audios[0],
                    "format": "wav",
                    "mime_type": "audio/wav",
                    "speaker": resolved_speaker,
                    "language_code": language_code,
                    "model": model
                }
            else:
                return {
                    "has_audio": False,
                    "audio_base64": None,
                    "error": "No audio returned in Sarvam TTS response."
                }
        else:
            err_msg = f"Sarvam TTS Error ({response.status_code}): {response.text}"
            print(f"[speech.py] {err_msg}")
            return {
                "has_audio": False,
                "audio_base64": None,
                "error": err_msg
            }
    except Exception as e:
        err_msg = f"Failed to connect to Sarvam TTS: {str(e)}"
        print(f"[speech.py] {err_msg}")
        return {
            "has_audio": False,
            "audio_base64": None,
            "error": err_msg
        }
