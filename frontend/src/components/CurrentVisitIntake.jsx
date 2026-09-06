import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, Globe, Printer, CheckCircle2, 
  AlertTriangle, Clock, RefreshCw, Plus, User, ArrowLeft, Shield, 
  FileText, Check, ChevronRight, XCircle, Stethoscope, Sparkles,
  RotateCcw, Send, Play, Pause, ChevronDown, CheckCheck, HelpCircle,
  Headphones, MessageSquare, Flame, HeartPulse, Trash2
} from 'lucide-react';

export default function CurrentVisitIntake({
  mode = 'patient', // 'patient' or 'kiosk'
  patient = null,
  allPatients = [],
  onSelectPatient = () => {},
  onBack = null,
  showToast = () => {},
  baseUrl = 'http://localhost:8000'
}) {
  // Navigation & View states: 'list' | 'intake-session' | 'review' | 'document'
  const [viewState, setViewState] = useState('list');
  const [selectedIntake, setSelectedIntake] = useState(null);
  const [intakesList, setIntakesList] = useState([]);
  const [loadingIntakes, setLoadingIntakes] = useState(false);
  const [showPatientSwitcher, setShowPatientSwitcher] = useState(false);

  // Kiosk patient selection
  const [kioskPatientInput, setKioskPatientInput] = useState('');
  const [kioskPatientSearching, setKioskPatientSearching] = useState(false);

  // Multilingual Configuration
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');

  // Conversational Voice State
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAudioBase64, setCurrentAudioBase64] = useState(null);
  const [quickOptions, setQuickOptions] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState(null);
  const [doctorSummaryEnglish, setDoctorSummaryEnglish] = useState('');
  const [triage, setTriage] = useState(null);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Text input fallback
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedMessage, setTypedMessage] = useState('');

  // Voice Recording & Sarvam STT State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribingStatus, setTranscribingStatus] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // Doctor Verification & Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctorNotesInput, setDoctorNotesInput] = useState('');
  const [verifyingIntake, setVerifyingIntake] = useState(false);
  const [printDirectIntake, setPrintDirectIntake] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handlePrintFromList = (intake, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    // Set direct intake to print WITHOUT navigating away from the list
    setPrintDirectIntake(intake);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleDeleteIntake = async (intakeId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!window.confirm("Are you sure you want to delete this visit intake record? This action cannot be undone.")) {
      return;
    }
    setDeletingId(intakeId);
    try {
      const url = patient?.id 
        ? `${baseUrl}/api/patients/${patient.id}/intakes/${intakeId}`
        : `${baseUrl}/api/intakes/${intakeId}`;
      const res = await fetch(url, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (typeof showToast === 'function') {
          showToast('Visit intake deleted successfully', 'success');
        }
        if (patient?.id) {
          fetchPatientIntakes(patient.id);
        } else {
          setIntakesList(prev => prev.filter(item => item.id !== intakeId));
        }
        if (selectedIntake?.id === intakeId) {
          setSelectedIntake(null);
          setViewState('list');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (typeof showToast === 'function') {
          showToast(errData.detail || 'Failed to delete visit intake', 'error');
        }
      }
    } catch (err) {
      console.error('Error deleting intake:', err);
      if (typeof showToast === 'function') {
        showToast('Network error while deleting visit intake', 'error');
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Lifecycle & Initial Data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchLanguages();
  }, []);

  useEffect(() => {
    if (patient?.id) {
      fetchPatientIntakes(patient.id);
    } else {
      setIntakesList([]);
    }
  }, [patient?.id]);

  const fetchLanguages = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/voice/languages`);
      if (res.ok) {
        const data = await res.json();
        const langs = data.languages || [];
        setSupportedLanguages(langs);
        if (data.default) setSelectedLanguage(data.default);
      }
    } catch (e) {
      console.warn('Failed to load language registry:', e);
    }
  };

  const fetchPatientIntakes = async (patientId) => {
    if (!patientId) return;
    setLoadingIntakes(true);
    try {
      const res = await fetch(`${baseUrl}/api/patients/${patientId}/intakes`);
      if (res.ok) {
        const data = await res.json();
        setIntakesList(data);
      }
    } catch (e) {
      console.error('Error fetching intakes:', e);
    } finally {
      setLoadingIntakes(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Audio Playback Helpers
  // ---------------------------------------------------------------------------
  const playAudio = (base64Wav) => {
    if (!base64Wav) return;
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
      audioPlayerRef.current = audio;
      setIsAudioPlaying(true);
      audio.onended = () => setIsAudioPlaying(false);
      audio.onerror = () => setIsAudioPlaying(false);
      audio.play().catch(e => {
        console.warn('Audio auto-play blocked or failed:', e);
        setIsAudioPlaying(false);
      });
    } catch (err) {
      console.warn('Playback error:', err);
      setIsAudioPlaying(false);
    }
  };

  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsAudioPlaying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Start Conversational Intake Session
  // ---------------------------------------------------------------------------
  const startNewIntake = async (langCode = selectedLanguage) => {
    if (!patient?.id) {
      showToast('Please identify the patient first.', 'warning');
      return;
    }
    stopAudio();
    setConversationHistory([]);
    setIsComplete(false);
    setExtractedEntities(null);
    setDoctorSummaryEnglish('');
    setTriage(null);
    setIsFinalizing(false);
    setQuickOptions([]);
    setTypedMessage('');
    setShowTextInput(false);
    setViewState('intake-session');
    setIsProcessingTurn(true);

    try {
      const res = await fetch(`${baseUrl}/api/patients/${patient.id}/intakes/conversation-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: [],
          language_code: langCode,
          synthesize_audio: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        const initialGreeting = data.next_question || 'Hello. Please describe your symptoms today.';
        setCurrentQuestion(initialGreeting);
        setCurrentAudioBase64(data.audio?.audio_base64 || null);
        setConversationHistory([
          { role: 'assistant', content: initialGreeting }
        ]);
        setQuickOptions(data.quick_options || []);

        if (data.audio?.audio_base64 && autoPlayAudio) {
          playAudio(data.audio.audio_base64);
        }
      } else {
        throw new Error('Could not initiate intake greeting');
      }
    } catch (err) {
      console.warn('Error initiating conversation turn:', err);
      const fallbackQ = "Please describe the symptoms or health concerns you are experiencing today.";
      setCurrentQuestion(fallbackQ);
      setConversationHistory([{ role: 'assistant', content: fallbackQ }]);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Process Patient Response (Voice, Quick Chip, or Typed)
  // ---------------------------------------------------------------------------
  const handlePatientResponse = async (patientSpeechText) => {
    const cleanText = (patientSpeechText || '').trim();
    if (!cleanText || isProcessingTurn) return;

    stopAudio();
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: cleanText }
    ];
    setConversationHistory(updatedHistory);
    setTypedMessage('');
    setIsProcessingTurn(true);

    try {
      const res = await fetch(`${baseUrl}/api/patients/${patient.id}/intakes/conversation-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: updatedHistory,
          language_code: selectedLanguage,
          synthesize_audio: true
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Turn processing failed.');
      }

      const turnData = await res.json();

      if (turnData.next_question) {
        setCurrentQuestion(turnData.next_question);
        setConversationHistory(prev => [
          ...prev,
          { role: 'assistant', content: turnData.next_question }
        ]);
        if (turnData.audio?.audio_base64) {
          setCurrentAudioBase64(turnData.audio.audio_base64);
          if (autoPlayAudio) {
            playAudio(turnData.audio.audio_base64);
          }
        }
      }

      setQuickOptions(turnData.quick_options || []);
      setIsComplete(turnData.is_complete || false);
      setExtractedEntities(turnData.extracted_entities || null);
      setDoctorSummaryEnglish(turnData.doctor_summary_english || '');
      setTriage(turnData.triage || null);

      if (turnData.is_complete) {
        showToast('Sufficient clinical information gathered. Ready for review.', 'success');
      }
    } catch (err) {
      console.error('Conversation turn error:', err);
      showToast(err.message || 'Error processing response. You may review or continue.', 'error');
    } finally {
      setIsProcessingTurn(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Transition to Review & Final Clinical Synthesis (Runs ONCE)
  // ---------------------------------------------------------------------------
  const handleProceedToReview = async () => {
    stopAudio();
    setViewState('review');

    const userStatements = conversationHistory.filter(m => m.role === 'user');

    if (userStatements.length > 0) {
      setIsFinalizing(true);
      try {
        const res = await fetch(`${baseUrl}/api/patients/${patient.id}/intakes/finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_history: conversationHistory,
            language_code: selectedLanguage
          })
        });
        if (res.ok) {
          const finalized = await res.json();
          if (finalized.doctor_summary_english) {
            setDoctorSummaryEnglish(finalized.doctor_summary_english);
          }
          if (finalized.extracted_entities) {
            setExtractedEntities(finalized.extracted_entities);
          }
          if (finalized.triage) {
            setTriage(finalized.triage);
          }
        }
      } catch (err) {
        console.warn('Finalization error:', err);
      } finally {
        setIsFinalizing(false);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Voice Recording & Sarvam STT Audio Conversion
  // ---------------------------------------------------------------------------
  const audioBufferToWavBlob = (buffer) => {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        out.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    out.setUint32(4, length - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true);
    out.setUint16(22, 1, true);
    out.setUint32(24, sampleRate, true);
    out.setUint32(28, sampleRate * 2, true);
    out.setUint16(32, 2, true);
    out.setUint16(34, 16, true);
    writeString(36, 'data');
    out.setUint32(40, length - 44, true);

    const totalChannels = buffer.numberOfChannels;
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < totalChannels; ch++) {
        sum += buffer.getChannelData(ch)[i];
      }
      const sample = Math.max(-1, Math.min(1, sum / totalChannels));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      out.setInt16(offset, int16, true);
      offset += 2;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  };

  const startVoiceRecording = async () => {
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processVoiceAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone access denied:', err);
      showToast('Microphone access failed. You can type directly in the box.', 'warning');
      setShowTextInput(true);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const processVoiceAudio = async (audioBlob) => {
    setTranscribing(true);
    setTranscribingStatus('Preparing voice audio...');
    try {
      let audioChunksToSend = [];
      const CHUNK_DURATION = 24;

      // Direct fast path for recordings within safe single-turn limit (<24s)
      if (recordingSeconds <= CHUNK_DURATION && audioBlob.size < 5 * 1024 * 1024) {
        audioChunksToSend = [audioBlob];
      } else {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const totalDuration = decodedBuffer.duration;

            if (totalDuration > CHUNK_DURATION) {
              const sampleRate = decodedBuffer.sampleRate;
              const framesPerChunk = Math.floor(CHUNK_DURATION * sampleRate);
              let startFrame = 0;

              while (startFrame < decodedBuffer.length) {
                const endFrame = Math.min(startFrame + framesPerChunk, decodedBuffer.length);
                const chunkFrames = endFrame - startFrame;
                const subBuffer = audioCtx.createBuffer(
                  decodedBuffer.numberOfChannels,
                  chunkFrames,
                  sampleRate
                );
                for (let ch = 0; ch < decodedBuffer.numberOfChannels; ch++) {
                  const channelData = decodedBuffer.getChannelData(ch).subarray(startFrame, endFrame);
                  subBuffer.copyToChannel(channelData, ch, 0);
                }
                const wavBlob = audioBufferToWavBlob(subBuffer);
                audioChunksToSend.push(wavBlob);
                startFrame = endFrame;
              }
            } else {
              audioChunksToSend = [audioBufferToWavBlob(decodedBuffer)];
            }
          }
        } catch (decodeErr) {
          console.warn('Audio decoding fallback to raw recording:', decodeErr);
          audioChunksToSend = [audioBlob];
        }
      }

      if (audioChunksToSend.length === 0) {
        audioChunksToSend = [audioBlob];
      }

      const totalParts = audioChunksToSend.length;
      let combinedTranscript = '';

      for (let i = 0; i < totalParts; i++) {
        const chunkBlob = audioChunksToSend[i];
        if (totalParts > 1) {
          setTranscribingStatus(`Transcribing part ${i + 1} of ${totalParts} via Sarvam AI...`);
        } else {
          setTranscribingStatus('Transcribing via Sarvam AI...');
        }

        const formData = new FormData();
        const ext = chunkBlob.type.includes('wav') ? 'wav' : 'webm';
        formData.append('file', chunkBlob, `segment_${i + 1}.${ext}`);
        formData.append('language_code', selectedLanguage);

        const res = await fetch(`${baseUrl}/api/voice/transcribe`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Transcription failed on part ${i + 1}.`);
        }

        const data = await res.json();
        if (data.transcript) {
          combinedTranscript = combinedTranscript ? `${combinedTranscript} ${data.transcript}` : data.transcript;
        }
      }

      const finalTranscript = combinedTranscript.trim();
      if (finalTranscript) {
        await handlePatientResponse(finalTranscript);
      } else {
        showToast('No clear speech was recognized. Please speak closer to the mic.', 'warning');
      }
    } catch (err) {
      console.error('STT error:', err);
      showToast(err.message || 'Voice transcription failed.', 'error');
    } finally {
      setTranscribing(false);
      setTranscribingStatus('');
    }
  };

  // ---------------------------------------------------------------------------
  // Persist Current Visit Intake Snapshot
  // ---------------------------------------------------------------------------
  const handleConfirmSaveIntake = async () => {
    if (!patient?.id) return;
    setIsSubmitting(true);
    try {
      const patientStatements = conversationHistory
        .filter(m => m.role === 'user')
        .map(m => m.content.trim())
        .filter(Boolean)
        .join(' ');

      const payload = {
        patient_language: selectedLanguage,
        raw_narration: patientStatements || 'Patient completed voice intake session.',
        translated_narration: doctorSummaryEnglish,
        doctor_summary_english: doctorSummaryEnglish,
        chief_complaints: extractedEntities?.chief_complaints || [],
        symptom_duration: extractedEntities?.symptom_duration || null,
        severity: extractedEntities?.severity || null,
        recent_changes: extractedEntities?.recent_changes || null,
        additional_notes: extractedEntities?.patient_concerns || null,
        extracted_entities: extractedEntities || {},
        conversation_history: conversationHistory,
        source: mode === 'kiosk' ? 'medikiosk' : 'patient_app'
      };

      const res = await fetch(`${baseUrl}/api/patients/${patient.id}/intakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit intake.');
      }

      const created = await res.json();
      showToast('Current Visit Intake recorded and snapshot created!', 'success');
      await fetchPatientIntakes(patient.id);
      setSelectedIntake(created);
      setViewState('document');
    } catch (err) {
      console.error('Save intake error:', err);
      showToast(err.message || 'Failed to record intake.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Doctor Verification
  // ---------------------------------------------------------------------------
  const handleVerifyIntake = async (intakeId) => {
    if (!patient?.id || !intakeId) return;
    setVerifyingIntake(true);
    try {
      const res = await fetch(`${baseUrl}/api/patients/${patient.id}/intakes/${intakeId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_notes: doctorNotesInput,
          status: 'Reviewed'
        })
      });
      if (!res.ok) throw new Error('Verification failed.');
      const updated = await res.json();
      setSelectedIntake(updated);
      await fetchPatientIntakes(patient.id);
      showToast('Intake successfully verified by clinician.', 'success');
    } catch (err) {
      showToast(err.message || 'Verification error.', 'error');
    } finally {
      setVerifyingIntake(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Language Selector Sub-Component
  // ---------------------------------------------------------------------------
  const popularLangs = supportedLanguages.filter(l => l.is_popular);
  const otherLangs = supportedLanguages.filter(l => !l.is_popular);
  const isSelectedOther = otherLangs.some(l => l.code === selectedLanguage);

  const renderLanguageSelector = () => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-1">
        <Globe className="w-3.5 h-3.5 text-teal-600" /> Language:
      </span>

      {/* Prominent Popular Buttons */}
      {popularLangs.map((lang) => {
        const isSelected = selectedLanguage === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => {
              setSelectedLanguage(lang.code);
              if (viewState === 'intake-session') {
                startNewIntake(lang.code);
              }
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
              isSelected
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span>{lang.native_name}</span>
            <span className="text-[10px] opacity-75 ml-1">({lang.name})</span>
          </button>
        );
      })}

      {/* Other Languages Dropdown */}
      {otherLangs.length > 0 && (
        <div className="relative inline-block">
          <select
            value={isSelectedOther ? selectedLanguage : ''}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedLanguage(e.target.value);
                if (viewState === 'intake-session') {
                  startNewIntake(e.target.value);
                }
              }
            }}
            className={`pl-3 pr-8 py-1.5 rounded-full text-xs font-semibold transition-all border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
              isSelectedOther
                ? 'bg-teal-600 text-white border-teal-600 font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <option value="" disabled={isSelectedOther} className="text-slate-800 bg-white">
              {isSelectedOther ? otherLangs.find(l => l.code === selectedLanguage)?.name : 'Other Languages ▾'}
            </option>
            {otherLangs.map((lang) => (
              <option key={lang.code} value={lang.code} className="text-slate-800 bg-white">
                {lang.native_name} ({lang.name})
              </option>
            ))}
          </select>
          <ChevronDown className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
            isSelectedOther ? 'text-white' : 'text-slate-400'
          }`} />
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // KIOSK IDENTIFICATION SCREEN (If no patient selected in kiosk mode)
  // ---------------------------------------------------------------------------
  if (mode === 'kiosk' && !patient?.id) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden border border-teal-900/40">
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 border border-teal-500/40 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-teal-400" /> MediKiosk Outpatient Reception
              </div>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>
              )}
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              AyuSeva MediKiosk Voice Check-In
            </h2>
            <p className="text-slate-300 text-xs lg:text-sm max-w-2xl leading-relaxed">
              Step up to speak your current visit symptoms in Hindi, English, Punjabi, Kannada, 
              Bengali, Marathi, or your preferred language. MediKiosk clinically understands and 
              structures your situation for the attending doctor.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Identify Patient</h3>
              <p className="text-xs text-slate-400">Enter AyuSeva Patient UID or scan hospital card</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. CARE-928104"
              value={kioskPatientInput}
              onChange={(e) => setKioskPatientInput(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-teal-500 uppercase"
            />
            <button
              onClick={async () => {
                if (!kioskPatientInput.trim()) return;
                setKioskPatientSearching(true);
                try {
                  const res = await fetch(`${baseUrl}/api/patients/${kioskPatientInput.trim()}`);
                  if (!res.ok) throw new Error(`Patient ${kioskPatientInput} not found.`);
                  const data = await res.json();
                  onSelectPatient(data.id);
                  showToast(`Welcome ${data.name}! Kiosk session active.`, 'success');
                } catch (err) {
                  showToast(err.message || 'Patient lookup failed.', 'error');
                } finally {
                  setKioskPatientSearching(false);
                }
              }}
              disabled={kioskPatientSearching || !kioskPatientInput.trim()}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {kioskPatientSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Begin MediKiosk Intake
            </button>
          </div>

          {allPatients && allPatients.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Quick-Pick Available Patients (Kiosk Sandbox Mode)
                </span>
                <span className="text-[10px] text-teal-600 font-semibold">{allPatients.length} Registered Patients</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {allPatients.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPatient(p.id);
                      showToast(`Active patient: ${p.name}`, 'success');
                    }}
                    className="p-3 bg-slate-50 hover:bg-teal-50/50 border border-slate-200 hover:border-teal-300 rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700 truncate">{p.name}</span>
                      <span className="text-[9px] font-mono font-bold text-slate-400">{p.id}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Phone: {p.phone || 'N/A'}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN WORKSPACE
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Top Navigation & Status Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                if (viewState !== 'list') {
                  stopAudio();
                  setViewState('list');
                } else {
                  onBack();
                }
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
              title={viewState !== 'list' ? 'Back to Intakes List' : 'Back to Dashboard'}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}

          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
            mode === 'kiosk' ? 'bg-teal-900 text-teal-300' : 'bg-slate-900 text-teal-400'
          }`}>
            {mode === 'kiosk' ? <Clock className="w-5 h-5" /> : <Stethoscope className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                mode === 'kiosk' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-700'
              }`}>
                {mode === 'kiosk' ? 'MediKiosk Intake Station' : 'Patient Current Visit Intake'}
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs font-mono font-bold text-slate-600">UID: {patient?.id}</span>
            </div>
            <h2 className="text-base font-bold text-slate-800 mt-0.5">
              Current Visit Intake — {patient?.name || 'Active Patient'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewState !== 'list' && (
            <button
              type="button"
              onClick={() => {
                stopAudio();
                setViewState('list');
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Intakes
            </button>
          )}

          {viewState === 'list' && (
            <button
              type="button"
              onClick={() => startNewIntake(selectedLanguage)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Start Voice Intake
            </button>
          )}

          {/* Switch Patient button & dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!allPatients || allPatients.length <= 1) {
                  stopAudio();
                  onSelectPatient(null);
                  setViewState('list');
                } else {
                  setShowPatientSwitcher(prev => !prev);
                }
              }}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Switch to another patient"
            >
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span>Switch Patient</span>
              {allPatients && allPatients.length > 1 && (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showPatientSwitcher && allPatients && allPatients.length > 1 && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center px-1 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Switch Patient</span>
                  <button 
                    type="button"
                    onClick={() => {
                      stopAudio();
                      setShowPatientSwitcher(false);
                      onSelectPatient(null);
                      setViewState('list');
                    }}
                    className="text-[10px] text-teal-600 hover:text-teal-700 font-bold cursor-pointer hover:underline"
                  >
                    Clear / Search UID
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {allPatients.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        stopAudio();
                        setShowPatientSwitcher(false);
                        onSelectPatient(p.id);
                        setViewState('list');
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                        p.id === patient?.id ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200' : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <p className="truncate font-semibold">{p.name || 'Unnamed'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.id}</p>
                      </div>
                      {p.id === patient?.id && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =======================================================================
          VIEW 1: INTAKES LIST (Historical point-in-time snapshots)
         ======================================================================= */}
      {viewState === 'list' && (
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Intakes on File
              </span>
              <span className="text-2xl font-extrabold text-slate-800 mt-1 block">
                {intakesList.length}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Point-in-time clinical snapshots</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Recent Triage Status
              </span>
              <div className="flex items-center gap-2 mt-1">
                {intakesList[0]?.is_emergency ? (
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Emergency Red-Flag
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Routine Screening
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Latest intake safety triage</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Voice & Multilingual AI
              </span>
              <span className="text-xs font-bold text-teal-600 mt-1 block">
                Sarvam STT + TTS Active
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">True multilingual Indian regional support</p>
            </div>
          </div>

          {/* Intakes Feed */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" /> Today's & Historical Visit Intakes
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Append-only visit records. Each entry represents a distinct visit presentation.
                </p>
              </div>

              <button
                onClick={() => fetchPatientIntakes(patient?.id)}
                disabled={loadingIntakes}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                title="Refresh intakes"
              >
                <RefreshCw className={`w-4 h-4 ${loadingIntakes ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingIntakes ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                Loading visit intakes...
              </div>
            ) : intakesList.length > 0 ? (
              <div className="space-y-3">
                {intakesList.map((intake) => {
                  const isRedFlag = intake.is_emergency;
                  return (
                    <div
                      key={intake.id}
                      className={`border rounded-xl p-4 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                        isRedFlag ? 'bg-rose-50/40 border-rose-200' : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {intake.visit_time_formatted} — Visit Intake
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({intake.visit_date_formatted})
                          </span>
                          <span className="text-[9px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                            {intake.source_label}
                          </span>
                          <span className="text-[9px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-semibold">
                            {intake.language_name} ({intake.native_name})
                          </span>
                          {isRedFlag ? (
                            <span className="text-[9px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Red-Flag
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              Routine
                            </span>
                          )}
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                            intake.verification_status === 'Reviewed' 
                              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {intake.verification_status}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {intake.translated_narration || intake.raw_narration}
                        </p>

                        {intake.chief_complaints && intake.chief_complaints.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {intake.chief_complaints.map((c, i) => (
                              <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIntake(intake);
                            setViewState('document');
                          }}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        >
                          View Doctor Sheet
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handlePrintFromList(intake, e)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-teal-400 hover:text-white rounded-lg transition-all shadow-sm flex items-center justify-center cursor-pointer border border-slate-700"
                          title="Print Clipboard Sheet"
                          aria-label="Print Clipboard Sheet"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteIntake(intake.id, e)}
                          disabled={deletingId === intake.id}
                          className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg transition-all shadow-sm flex items-center justify-center cursor-pointer"
                          title="Delete Visit Intake"
                          aria-label="Delete Visit Intake"
                        >
                          {deletingId === intake.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No Visit Intakes Recorded Yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Start your first intake at the MediKiosk or via mobile app to generate a doctor-facing 
                  Current Situation Sheet.
                </p>
                <button
                  onClick={() => startNewIntake(selectedLanguage)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Start First Voice Intake
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 2: CONVERSATIONAL VOICE INTAKE SESSION (Minimal, Voice-First)
         ======================================================================= */}
      {viewState === 'intake-session' && (
        <div className="space-y-6">
          
          {/* Top Bar: Language Picker + Audio Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            {renderLanguageSelector()}

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-600 flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPlayAudio}
                  onChange={(e) => setAutoPlayAudio(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <Headphones className="w-3.5 h-3.5 text-slate-400" />
                <span>Voice Auto-Play</span>
              </label>

              <button
                onClick={handleProceedToReview}
                disabled={conversationHistory.filter(m => m.role === 'user').length === 0}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-40 ${
                  isComplete
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {isComplete ? <CheckCheck className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {isComplete ? 'Review Summary' : 'Review & Conclude'}
              </button>
            </div>
          </div>

          {/* Voice-First Interactive Stage */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 text-white rounded-3xl p-6 lg:p-8 shadow-xl relative overflow-hidden border border-teal-900/40 space-y-6">
            
            {/* AI Prompt / Current Question Box */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 space-y-3 relative">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping"></span>
                  <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">
                    AyuSeva Clinical Voice AI
                  </span>
                </div>

                {currentAudioBase64 && (
                  <button
                    onClick={() => isAudioPlaying ? stopAudio() : playAudio(currentAudioBase64)}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isAudioPlaying ? <Pause className="w-3.5 h-3.5 text-amber-300" /> : <Volume2 className="w-3.5 h-3.5 text-teal-300" />}
                    <span>{isAudioPlaying ? 'Stop Audio' : 'Hear Question'}</span>
                  </button>
                )}
              </div>

              <h3 className="text-lg lg:text-xl font-bold text-slate-50 leading-relaxed">
                {currentQuestion || 'Loading clinical opening greeting...'}
              </h3>

              {/* Status note */}
              {isProcessingTurn && (
                <div className="flex items-center gap-2 text-xs text-teal-300 animate-pulse pt-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>AI is clinically evaluating your symptoms...</span>
                </div>
              )}
            </div>

            {/* Central Voice Recording Stage / Completion Card */}
            {isComplete && !isRecording ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> Sufficient Information Collected
                  </div>
                  <h4 className="text-base font-bold text-white">
                    Current Situation Recorded for Doctor
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                    The intake assistant has documented your current situation. You can review the clinical sheet now, or speak more if you'd like to add any other details.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleProceedToReview}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <span>Review & Save Doctor Sheet</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    disabled={transcribing || isProcessingTurn}
                    className="w-full sm:w-auto px-4 py-3 bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Mic className="w-3.5 h-3.5 text-teal-300" />
                    <span>Speak More / Add Info</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                <div className="relative">
                  {/* Pulse rings when recording */}
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping scale-125 pointer-events-none"></div>
                  )}

                  {isRecording ? (
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="w-24 h-24 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center shadow-2xl shadow-rose-600/50 transition-all active:scale-95 cursor-pointer relative z-10"
                    >
                      <MicOff className="w-9 h-9 animate-bounce" />
                      <span className="text-[10px] font-mono font-bold mt-1">{recordingSeconds}s</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      disabled={transcribing || isProcessingTurn}
                      className="w-24 h-24 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 flex flex-col items-center justify-center shadow-2xl shadow-teal-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer relative z-10"
                    >
                      {transcribing ? (
                        <RefreshCw className="w-9 h-9 animate-spin text-slate-900" />
                      ) : (
                        <Mic className="w-9 h-9" />
                      )}
                      <span className="text-[9px] font-extrabold uppercase tracking-wider mt-1 text-slate-900">
                        {transcribing ? 'Processing' : 'Tap & Speak'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    {isRecording 
                      ? `Listening... Speak in your selected language (${recordingSeconds}s)`
                      : transcribing 
                      ? (transcribingStatus || 'Transcribing with Sarvam AI...') 
                      : 'Tap the microphone and speak your answer naturally'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Continuous speech recognition • Speaks naturally in your language
                  </p>
                </div>

                {/* Dynamic Quick-Touch Choices (Context-aware chips) */}
                {quickOptions && quickOptions.length > 0 && !isRecording && !transcribing && (
                  <div className="space-y-2 pt-2 max-w-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 block">
                      Quick-Touch Options (Tap or Speak):
                    </span>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quickOptions.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePatientResponse(opt)}
                          disabled={isProcessingTurn}
                          className="px-4 py-2 bg-white/10 hover:bg-teal-500 hover:text-slate-950 text-slate-100 rounded-xl text-xs font-semibold border border-white/20 hover:border-teal-400 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Subtle Text Input Toggle & Fallback */}
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => setShowTextInput(prev => !prev)}
                className="text-slate-400 hover:text-teal-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{showTextInput ? 'Hide text typing' : 'Prefer typing instead of speaking?'}</span>
              </button>

              <button
                type="button"
                onClick={() => startNewIntake(selectedLanguage)}
                className="text-slate-400 hover:text-rose-300 flex items-center gap-1 transition-all cursor-pointer text-[11px]"
              >
                <RotateCcw className="w-3 h-3" /> Start Over
              </button>
            </div>

            {/* Expandable Text Input Box */}
            {showTextInput && (
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Type your response in any language or script..."
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && typedMessage.trim()) {
                      handlePatientResponse(typedMessage.trim());
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typedMessage.trim()) {
                      handlePatientResponse(typedMessage.trim());
                    }
                  }}
                  disabled={!typedMessage.trim() || isProcessingTurn}
                  className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            )}

          </div>

          {/* Conversation Transcript Feed */}
          {conversationHistory.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-teal-600" /> Active Conversation Transcript
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {conversationHistory.filter(m => m.role === 'user').length} patient turns
                </span>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {conversationHistory.map((msg, i) => {
                  const isPatient = msg.role === 'user';
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 text-xs ${isPatient ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-md p-3.5 rounded-2xl leading-relaxed ${
                        isPatient
                          ? 'bg-teal-600 text-white rounded-tr-none'
                          : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                      }`}>
                        <span className="text-[9px] font-bold block mb-0.5 opacity-80">
                          {isPatient ? 'You (Patient)' : 'AyuSeva AI'}
                        </span>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* =======================================================================
          VIEW 3: REVIEW & STRUCTURED PREVIEW SCREEN
         ======================================================================= */}
      {viewState === 'review' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
          
          <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
                Clinical Understanding & Verification
              </span>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                Current Visit Intake Summary Review
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review the synthesized English clinical narrative and extracted findings before saving.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setViewState('intake-session')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Continue Speaking
            </button>
          </div>

          {/* Finalizing Progress Banner */}
          {isFinalizing && (
            <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4 flex items-center gap-3 text-teal-900 animate-pulse shadow-sm">
              <RefreshCw className="w-5 h-5 text-teal-600 animate-spin shrink-0" />
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Synthesizing Comprehensive Doctor Clinical Summary
                </h5>
                <p className="text-[11px] text-teal-700 mt-0.5">
                  Analyzing multi-turn context, translating to standardized clinical English, and checking triage rules...
                </p>
              </div>
            </div>
          )}

          {/* Emergency Triage Banner */}
          {triage?.is_emergency && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-rose-900 space-y-2 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
                <h5 className="text-sm font-extrabold tracking-wide uppercase text-rose-700">
                  Emergency Red-Flag Screening Alert
                </h5>
              </div>
              <ul className="list-disc list-inside text-xs font-semibold space-y-0.5 text-rose-800">
                {triage.triage_flags?.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
              <p className="text-[11px] text-rose-700 italic border-t border-rose-200 pt-1.5">
                {triage.disclaimer || 'Immediate clinical evaluation recommended.'}
              </p>
            </div>
          )}

          {/* Doctor-Facing Clinical English Narrative */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 space-y-3 shadow-md border border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Doctor Current Situation Summary (English)
              </span>
              <span className="text-[10px] text-slate-400">Synthesized for attending physician</span>
            </div>
            <p className="text-sm text-slate-100 leading-relaxed font-normal">
              {doctorSummaryEnglish || 'Patient has initiated intake.'}
            </p>
          </div>

          {/* Dynamic Extracted Clinical Entities Grid (Only renders present fields) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-teal-600" /> Extracted Clinical Findings
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              
              {/* Chief Complaints */}
              {extractedEntities?.chief_complaints && extractedEntities.chief_complaints.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Chief Complaints
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedEntities.chief_complaints.map((c, i) => (
                      <span key={i} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold text-xs shadow-xs">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration */}
              {extractedEntities?.symptom_duration && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Onset & Duration
                  </span>
                  <span className="font-bold text-slate-800 text-sm block">
                    {extractedEntities.symptom_duration}
                  </span>
                </div>
              )}

              {/* Severity */}
              {extractedEntities?.severity && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Reported Severity
                  </span>
                  <span className="font-bold text-slate-800 text-sm block">
                    {extractedEntities.severity}
                  </span>
                </div>
              )}

              {/* Associated Symptoms */}
              {extractedEntities?.associated_symptoms && extractedEntities.associated_symptoms.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Associated Symptoms
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extractedEntities.associated_symptoms.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 text-[11px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Changes */}
              {extractedEntities?.recent_changes && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Recent Changes / Meds
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {extractedEntities.recent_changes}
                  </p>
                </div>
              )}

              {/* Triggers or Context */}
              {extractedEntities?.triggers_or_context && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Triggers & Exertion Context
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {extractedEntities.triggers_or_context}
                  </p>
                </div>
              )}

              {/* Patient Concerns */}
              {extractedEntities?.patient_concerns && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Patient Expressed Concerns
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {extractedEntities.patient_concerns}
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* Original Patient Statements */}
          <div className="space-y-1.5 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
              Verbatim Patient Statements ({selectedLanguage})
            </h4>
            <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
              "{conversationHistory.filter(m => m.role === 'user').map(m => m.content).join(' ')}"
            </p>
          </div>

          {/* Confirmation & Save Actions */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewState('intake-session')}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Back to Conversation
            </button>
            <button
              type="button"
              onClick={handleConfirmSaveIntake}
              disabled={isSubmitting || isFinalizing}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting || isFinalizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Snapshot & View Doctor Sheet
            </button>
          </div>

        </div>
      )}

      {/* =======================================================================
          VIEW 4: ONE-PAGE PRINTABLE DOCTOR SHEET
         ======================================================================= */}
      {viewState === 'document' && selectedIntake && (
        <div className="space-y-6">
          
          {/* Action Header (Hidden during Print) */}
          <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewState('list')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Intakes List
              </button>
              <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                Document Generated: {selectedIntake.visit_date_formatted} at {selectedIntake.visit_time_formatted}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteIntake(selectedIntake.id)}
                disabled={deletingId === selectedIntake.id}
                className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="Delete Visit Intake"
              >
                {deletingId === selectedIntake.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Intake
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-teal-400" /> Print Clipboard Sheet
              </button>
            </div>
          </div>

          {/* Printable Sheet */}
          <DoctorClipboardSheet
            intake={selectedIntake}
            doctorNotesInput={doctorNotesInput}
            setDoctorNotesInput={setDoctorNotesInput}
            handleVerifyIntake={handleVerifyIntake}
            verifyingIntake={verifyingIntake}
          />
        </div>
      )}

      {/* Hidden printable container for direct printing from list view without navigating away */}
      {printDirectIntake && viewState !== 'document' && (
        <div className="print-only-target">
          <DoctorClipboardSheet intake={printDirectIntake} />
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable Printable Doctor Clipboard Sheet Component
// ---------------------------------------------------------------------------
function DoctorClipboardSheet({
  intake,
  doctorNotesInput,
  setDoctorNotesInput,
  handleVerifyIntake,
  verifyingIntake
}) {
  if (!intake) return null;

  return (
    <div className="printable-current-situation bg-white border border-slate-200 rounded-3xl p-8 lg:p-10 shadow-lg space-y-5 text-slate-800">
      
      {/* Sheet Header */}
      <div className="border-b-2 border-teal-700 pb-3 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-teal-800 tracking-tight">
              AYUSEVA CLINICAL PLATFORM
            </span>
            <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-bold uppercase">
              Current Visit Intake Sheet
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Point-in-Time Outpatient Triage & Chief Complaints Snapshot
          </p>
        </div>

        <div className="text-right text-xs">
          <p className="font-bold text-slate-800">Visit Date: {intake.visit_date_formatted}</p>
          <p className="text-slate-500 font-mono">Time: {intake.visit_time_formatted}</p>
          <p className="text-[10px] text-teal-700 font-semibold mt-0.5">Source: {intake.source_label}</p>
        </div>
      </div>

      {/* Patient Demographics & Intake Language Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Patient Name</span>
          <span className="font-bold text-slate-800 text-sm">{intake.patient_name}</span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Patient UID</span>
          <span className="font-mono font-bold text-slate-800 text-sm">{intake.patient_id}</span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Phone / DOB</span>
          <span className="font-medium text-slate-700">{intake.patient_phone || 'N/A'} • {intake.patient_dob || 'N/A'}</span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Intake Language</span>
          <span className="font-semibold text-teal-800">{intake.language_name} ({intake.native_name})</span>
        </div>
      </div>

      {/* Triage Banner */}
      <div className={`p-3.5 rounded-xl border-2 flex items-start gap-3 ${
        intake.is_emergency 
          ? 'bg-rose-50 border-rose-300 text-rose-900' 
          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
      }`}>
        {intake.is_emergency ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-0.5 text-xs">
          <span className="font-extrabold uppercase tracking-wider block">
            Triage Screening: {intake.is_emergency ? 'PRIORITY RED-FLAG ALERT' : 'ROUTINE OUTPATIENT SCREENING'}
          </span>
          {intake.triage_flags && intake.triage_flags.length > 0 && (
            <ul className="list-disc list-inside font-semibold space-y-0.5 text-[11px]">
              {intake.triage_flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
          <p className="text-[10px] opacity-80 italic pt-0.5">
            Disclaimer: Deterministic outpatient safety indicator, not an AI diagnosis.
          </p>
        </div>
      </div>

      {/* Doctor-Facing Clinical English Narrative */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-teal-600" /> Current Clinical Situation (Doctor Summary)
        </h4>
        <p className="text-sm text-slate-800 leading-relaxed font-normal bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          {intake.translated_narration || intake.raw_narration}
        </p>
      </div>

      {/* Structured Complaints & Dynamic Entities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {intake.chief_complaints && intake.chief_complaints.length > 0 && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Chief Complaints</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {intake.chief_complaints.map((c, i) => (
                <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-semibold text-[11px]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {intake.symptom_duration && intake.symptom_duration !== 'Not specified' && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Onset & Duration</span>
            <span className="font-bold text-slate-800 text-sm block mt-1">{intake.symptom_duration}</span>
            {intake.severity && (
              <span className="text-[10px] text-slate-500">Severity: {intake.severity}</span>
            )}
          </div>
        )}

        {intake.extracted_entities?.associated_symptoms && intake.extracted_entities.associated_symptoms.length > 0 && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Associated Symptoms</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {intake.extracted_entities.associated_symptoms.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 text-[11px]">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {intake.extracted_entities?.relevant_negatives && intake.extracted_entities.relevant_negatives.length > 0 && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Relevant Negatives (Explicitly Denied)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {intake.extracted_entities.relevant_negatives.map((n, i) => (
                <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 text-[11px]">
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {intake.recent_changes && intake.recent_changes !== 'None reported' && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recent Changes</span>
            <p className="text-slate-700 text-[11px] leading-relaxed">
              {intake.recent_changes}
            </p>
          </div>
        )}

        {intake.additional_notes && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Patient Concerns / Notes</span>
            <p className="text-slate-700 text-[11px] leading-relaxed">
              {intake.additional_notes}
            </p>
          </div>
        )}
      </div>

      {/* Clinician Verification & Signature Section */}
      <div className="pt-3 border-t-2 border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Stethoscope className="w-4 h-4 text-teal-600" /> Attending Physician Verification
          </h4>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            intake.verification_status === 'Reviewed'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}>
            Status: {intake.verification_status}
          </span>
        </div>

        {intake.doctor_notes ? (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Doctor Clinical Notes</span>
            <p className="text-slate-800 font-medium mt-0.5 leading-relaxed">{intake.doctor_notes}</p>
          </div>
        ) : handleVerifyIntake ? (
          <div className="no-print space-y-2">
            <textarea
              rows={2}
              placeholder="Enter doctor clinical review notes and action items..."
              value={doctorNotesInput || ''}
              onChange={(e) => setDoctorNotesInput && setDoctorNotesInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
            />
            <button
              onClick={() => handleVerifyIntake(intake.id)}
              disabled={verifyingIntake}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {verifyingIntake ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Sign & Verify Sheet
            </button>
          </div>
        ) : null}

        <div className="flex justify-between items-end pt-4 text-[10px] text-slate-400">
          <span>AyuSeva Longitudinal Health Record System</span>
          <span className="border-t border-slate-300 pt-1 px-8">Doctor Signature & Stamp</span>
        </div>
      </div>

    </div>
  );
}
