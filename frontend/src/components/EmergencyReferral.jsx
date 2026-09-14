import React, { useState, useEffect } from 'react';
import { 
  MapPin, Shield, AlertTriangle, CheckCircle2, Clock, 
  RefreshCw, User, FileText, ArrowRight, Download, Send, 
  ChevronRight, Check, X, Search, Building2, Phone, Mail, 
  FileCheck, Stethoscope, AlertCircle, ArrowLeft, Eye, CheckSquare, Square
} from 'lucide-react';

export default function EmergencyReferral({
  patient = null,
  allPatients = [],
  onSelectPatient = () => {},
  onBack = null,
  showToast = () => {},
  baseUrl = 'http://localhost:8000'
}) {
  // Step navigation: 1: Select Patient/Context -> 2: Review Handoff & Records -> 3: Receiving Info & Reason -> 4: Package Preview & Actions
  const [activeStep, setActiveStep] = useState(1);

  // Patient selection state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(patient);
  const [clinicalContexts, setClinicalContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState(null);
  const [loadingContexts, setLoadingContexts] = useState(false);

  // Referral preparation package state (from /api/referrals/prepare)
  const [preparedPackage, setPreparedPackage] = useState(null);
  const [preparingPackage, setPreparingPackage] = useState(false);
  const [includeCurrentSituation, setIncludeCurrentSituation] = useState(true);
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [showAllRecords, setShowAllRecords] = useState(false);

  // Receiving hospital & transfer details
  const [receivingHospital, setReceivingHospital] = useState('');
  const [receivingDepartment, setReceivingDepartment] = useState('');
  const [receivingDoctor, setReceivingDoctor] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [urgency, setUrgency] = useState('Emergency'); // Emergency | Urgent | Routine
  const [referralReason, setReferralReason] = useState('');
  const [notes, setNotes] = useState('');

  // Referral persistence & action state
  const [activeReferral, setActiveReferral] = useState(null);
  const [savingReferral, setSavingReferral] = useState(false);
  const [sharingReferral, setSharingReferral] = useState(false);
  const [referralHistory, setReferralHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'

  // Update selected patient when parent patient prop changes
  useEffect(() => {
    if (patient) {
      setSelectedPatient(patient);
    }
  }, [patient]);

  // Fetch clinical contexts when selectedPatient changes
  useEffect(() => {
    if (!selectedPatient?.id) {
      setClinicalContexts([]);
      setSelectedContextId(null);
      setPreparedPackage(null);
      return;
    }
    fetchPatientContexts(selectedPatient.id);
    fetchReferralHistory(selectedPatient.id);
  }, [selectedPatient?.id]);

  const fetchPatientContexts = async (uid) => {
    setLoadingContexts(true);
    try {
      const res = await fetch(`${baseUrl}/api/patients/${uid}/clinical-contexts`, {
        headers: { 'X-Patient-UID': uid }
      });
      if (res.ok) {
        const data = await res.json();
        const ctxs = data.contexts || [];
        setClinicalContexts(ctxs);
        if (ctxs.length > 0) {
          // Auto select primary or first context
          setSelectedContextId(ctxs[0].id);
        } else {
          setSelectedContextId(null);
        }
      } else {
        setClinicalContexts([]);
      }
    } catch (err) {
      console.error("Error fetching clinical contexts:", err);
      setClinicalContexts([]);
    } finally {
      setLoadingContexts(false);
    }
  };

  const fetchReferralHistory = async (uid) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${baseUrl}/api/referrals/patient/${uid}`, {
        headers: { 'X-Patient-UID': uid }
      });
      if (res.ok) {
        const data = await res.json();
        setReferralHistory(data || []);
      } else {
        setReferralHistory([]);
      }
    } catch (err) {
      console.error("Error fetching referral history:", err);
      setReferralHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Prepare context-aware clinical handoff package
  const handlePreparePackage = async (contextIdToUse = selectedContextId) => {
    if (!selectedPatient?.id) {
      showToast("Please select a patient first.", "warning");
      return;
    }
    setPreparingPackage(true);
    try {
      const res = await fetch(`${baseUrl}/api/referrals/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Patient-UID': selectedPatient.id
        },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          clinical_context_id: contextIdToUse
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to prepare referral package");
      }

      const data = await res.json();
      setPreparedPackage(data);

      // By default, select all context-relevant records
      const relevantIds = (data.available_records || [])
        .filter(r => r.is_context_relevant)
        .map(r => r.id);
      setSelectedRecordIds(relevantIds);

      // Pre-fill suggested reason if currently empty
      if (!referralReason && data.suggested_referral_reason) {
        setReferralReason(data.suggested_referral_reason);
      }

      setActiveStep(2);
    } catch (err) {
      showToast(err.message || "Failed to prepare referral data", "error");
    } finally {
      setPreparingPackage(false);
    }
  };

  // Toggle record selection
  const toggleRecordSelection = (recId) => {
    setSelectedRecordIds(prev => 
      prev.includes(recId) ? prev.filter(id => id !== recId) : [...prev, recId]
    );
  };

  // Select all context records
  const selectAllContextRecords = () => {
    if (!preparedPackage?.available_records) return;
    const contextIds = preparedPackage.available_records
      .filter(r => r.is_context_relevant)
      .map(r => r.id);
    setSelectedRecordIds(contextIds);
  };

  // Save / Finalize Referral Package
  const handleCreateReferral = async (targetStatus = "Prepared") => {
    if (!selectedPatient?.id) {
      showToast("Select a patient to proceed.", "warning");
      return null;
    }
    if (!receivingHospital.trim()) {
      showToast("Please specify the receiving hospital name.", "warning");
      return null;
    }
    if (!referralReason.trim()) {
      showToast("Please enter a referral reason for the handoff team.", "warning");
      return null;
    }

    setSavingReferral(true);
    try {
      const payload = {
        patient_id: selectedPatient.id,
        clinical_context_id: preparedPackage?.clinical_context?.id || selectedContextId || null,
        clinical_context_name: preparedPackage?.clinical_context?.name || "General Referral",
        referring_hospital: "AyuSeva Medical Network Hospital",
        receiving_hospital: receivingHospital.trim(),
        receiving_department: receivingDepartment.trim() || null,
        receiving_doctor: receivingDoctor.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        referral_reason: referralReason.trim(),
        urgency: urgency,
        status: targetStatus,
        include_current_situation: includeCurrentSituation,
        selected_record_ids: selectedRecordIds,
        package_data: preparedPackage
      };

      const res = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Patient-UID': selectedPatient.id
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Could not save referral package");
      }

      const data = await res.json();
      setActiveReferral(data.referral);
      showToast("Referral package prepared successfully!", "success");
      fetchReferralHistory(selectedPatient.id);
      setActiveStep(4);
      return data.referral;
    } catch (err) {
      showToast(err.message || "Failed to create referral", "error");
      return null;
    } finally {
      setSavingReferral(false);
    }
  };

  // Download Standardized Referral PDF
  const handleDownloadPDF = async (referralId = activeReferral?.id) => {
    if (!referralId) {
      const created = await handleCreateReferral("Prepared");
      if (!created?.id) return;
      referralId = created.id;
    }

    try {
      showToast("Generating standardized referral PDF...", "info");
      const res = await fetch(`${baseUrl}/api/referrals/${referralId}/pdf`, {
        headers: {
          'X-Patient-UID': selectedPatient?.id || ''
        }
      });
      if (!res.ok) throw new Error("Could not download PDF");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AyuSeva_Emergency_Referral_${selectedPatient?.id || 'Patient'}_${referralId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Referral PDF downloaded successfully", "success");
    } catch (err) {
      showToast("Failed to download referral PDF: " + err.message, "error");
    }
  };

  // Share Referral Package via Email with actual document attachments
  const handleShareReferral = async () => {
    let refId = activeReferral?.id;
    if (!refId) {
      const created = await handleCreateReferral("Prepared");
      if (!created?.id) return;
      refId = created.id;
    }

    const emailToSend = contactEmail.trim();
    if (!emailToSend) {
      showToast("Please provide a valid receiving hospital email to transmit the handoff package.", "warning");
      return;
    }

    setSharingReferral(true);
    try {
      const res = await fetch(`${baseUrl}/api/referrals/${refId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Patient-UID': selectedPatient?.id || ''
        },
        body: JSON.stringify({
          recipient_email: emailToSend,
          notes: notes.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to dispatch referral handoff package");
      }

      const data = await res.json();
      showToast(`Handoff package sent to ${emailToSend} with ${data.attachments_count || 0} attachments!`, "success");
      
      // Refresh active referral and history
      if (activeReferral) {
        setActiveReferral(prev => ({ ...prev, status: 'Shared', shared_at: new Date().toISOString() }));
      }
      if (selectedPatient?.id) {
        fetchReferralHistory(selectedPatient.id);
      }
    } catch (err) {
      showToast(err.message || "Failed to share referral", "error");
    } finally {
      setSharingReferral(false);
    }
  };

  // Filter patients by search query
  const filteredPatients = allPatients.filter(p => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Title Bar */}
      <div className="bg-white border border-[#DCE8E8] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-2 rounded-xl">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#071A2A] tracking-tight">Emergency Clinical Referral</h1>
                <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Live Handoff
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Context-aware emergency handoff: filters and compiles only relevant records for receiving clinicians.
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher: New Referral vs Referral History */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'new'
                ? 'bg-[#08A99D] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            New Referral
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#08A99D] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Referral History ({referralHistory.length})
          </button>
        </div>
      </div>

      {/* VIEW: REFERRAL HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white border border-[#DCE8E8] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-850">Referral History for {selectedPatient ? selectedPatient.name : 'Selected Patient'}</h2>
              <p className="text-xs text-slate-400">Past emergency handoff packages generated and shared.</p>
            </div>
            {selectedPatient && (
              <span className="text-xs font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg">
                UID: {selectedPatient.id}
              </span>
            )}
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#08A99D]" />
              Loading past referrals...
            </div>
          ) : referralHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No past referrals recorded for this patient.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {referralHistory.map(ref => (
                <div key={ref.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 p-3 rounded-xl transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase ${
                        ref.urgency === 'Emergency' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        ref.urgency === 'Urgent' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {ref.urgency}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">
                        To: {ref.receiving_hospital}
                      </h3>
                      {ref.receiving_department && (
                        <span className="text-xs text-slate-500 font-medium">({ref.receiving_department})</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ref.status === 'Shared' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ref.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      <strong className="text-slate-700">Context:</strong> {ref.clinical_context_name} | <strong className="text-slate-700">Reason:</strong> {ref.referral_reason}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span>Created: {ref.created_at ? new Date(ref.created_at).toLocaleString('en-IN') : 'N/A'}</span>
                      {ref.contact_email && <span>Email: {ref.contact_email}</span>}
                      {ref.selected_record_ids?.length > 0 && (
                        <span>{ref.selected_record_ids.length} Attached Record(s)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownloadPDF(ref.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    {ref.status !== 'Shared' && ref.contact_email && (
                      <button
                        onClick={() => {
                          setActiveReferral(ref);
                          setContactEmail(ref.contact_email || '');
                          handleShareReferral();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#08A99D] hover:bg-[#078C82] text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: NEW REFERRAL FLOW */}
      {activeTab === 'new' && (
        <div className="space-y-6">
          {/* Multi-step progress indicator */}
          <div className="bg-white border border-[#DCE8E8] rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
              <div 
                onClick={() => setActiveStep(1)}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeStep === 1 
                    ? 'bg-[#08A99D]/10 text-[#08A99D] border border-[#08A99D]/30' 
                    : activeStep > 1 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-slate-400 bg-slate-50'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px]">1</span>
                <span>Select Patient & Context</span>
              </div>

              <div 
                onClick={() => preparedPackage && setActiveStep(2)}
                className={`p-2.5 rounded-xl transition-all ${preparedPackage ? 'cursor-pointer' : 'opacity-50'} flex items-center justify-center gap-2 ${
                  activeStep === 2 
                    ? 'bg-[#08A99D]/10 text-[#08A99D] border border-[#08A99D]/30' 
                    : activeStep > 2 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-slate-400 bg-slate-50'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px]">2</span>
                <span>Review Handoff & Records</span>
              </div>

              <div 
                onClick={() => preparedPackage && setActiveStep(3)}
                className={`p-2.5 rounded-xl transition-all ${preparedPackage ? 'cursor-pointer' : 'opacity-50'} flex items-center justify-center gap-2 ${
                  activeStep === 3 
                    ? 'bg-[#08A99D]/10 text-[#08A99D] border border-[#08A99D]/30' 
                    : activeStep > 3 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-slate-400 bg-slate-50'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px]">3</span>
                <span>Receiving Details & Reason</span>
              </div>

              <div 
                onClick={() => activeReferral && setActiveStep(4)}
                className={`p-2.5 rounded-xl transition-all ${activeReferral ? 'cursor-pointer' : 'opacity-50'} flex items-center justify-center gap-2 ${
                  activeStep === 4 
                    ? 'bg-[#08A99D]/10 text-[#08A99D] border border-[#08A99D]/30' 
                    : 'text-slate-400 bg-slate-50'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px]">4</span>
                <span>Preview, PDF & Share</span>
              </div>
            </div>
          </div>

          {/* STEP 1: SELECT PATIENT & CLINICAL CONTEXT */}
          {activeStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Patient Selection Column */}
              <div className="lg:col-span-1 bg-white border border-[#DCE8E8] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#08A99D]" /> 1. Select Patient
                  </h2>
                  <span className="text-[11px] text-slate-400">{allPatients.length} registered</span>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, UID, phone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#08A99D]"
                  />
                </div>

                {/* Patient list */}
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {filteredPatients.map(p => {
                    const isSelected = selectedPatient?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPatient(p);
                          onSelectPatient(p.id);
                        }}
                        className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#08A99D]/10 border-[#08A99D] shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{p.name || 'Unnamed Patient'}</span>
                          <span className="font-mono text-[10px] text-slate-400">{p.id}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                          <span>DOB: {p.dob || 'N/A'}</span>
                          <span>{p.phone || 'No phone'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {filteredPatients.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No patients match your search.
                    </div>
                  )}
                </div>
              </div>

              {/* Context Selection Column */}
              <div className="lg:col-span-2 bg-white border border-[#DCE8E8] rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-[#08A99D]" /> 2. Select Active Clinical Context
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Context-aware handoff extracts records specifically relevant to this condition.
                    </p>
                  </div>
                  {selectedPatient && (
                    <div className="bg-teal-50 border border-teal-200 text-teal-800 px-3 py-1 rounded-xl text-xs font-bold">
                      Selected: {selectedPatient.name} ({selectedPatient.id})
                    </div>
                  )}
                </div>

                {!selectedPatient ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <User className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    Please choose a patient on the left to see their active clinical contexts.
                  </div>
                ) : loadingContexts ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#08A99D]" />
                    Retrieving clinical contexts for {selectedPatient.name}...
                  </div>
                ) : clinicalContexts.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-800 text-xs space-y-3">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> No specific clinical contexts found
                    </div>
                    <p>
                      This patient currently has no indexed multi-record clinical contexts. You can still initiate a comprehensive emergency handoff with all patient records.
                    </p>
                    <button
                      onClick={() => handlePreparePackage(null)}
                      disabled={preparingPackage}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all cursor-pointer text-xs"
                    >
                      {preparingPackage ? "Preparing..." : "Proceed with Complete Record Handoff →"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {clinicalContexts.map(ctx => {
                        const isSelected = selectedContextId === ctx.id;
                        return (
                          <div
                            key={ctx.id}
                            onClick={() => setSelectedContextId(ctx.id)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#08A99D]/10 border-[#08A99D] shadow-sm ring-1 ring-[#08A99D]'
                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  ctx.kind === 'cardiac' ? 'bg-rose-100 text-rose-700' :
                                  ctx.kind === 'pulmonary' ? 'bg-blue-100 text-blue-700' :
                                  ctx.kind === 'endocrine' ? 'bg-amber-100 text-amber-700' :
                                  'bg-teal-100 text-teal-700'
                                }`}>
                                  {ctx.kind || 'Clinical'}
                                </span>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-[#08A99D]" />
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-slate-800">{ctx.name}</h3>
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {ctx.description || "Identified longitudinal clinical progression on file."}
                              </p>
                            </div>

                            <div className="mt-4 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                              <span>Indexed: {ctx.created_at ? new Date(ctx.created_at).toLocaleDateString() : 'Active'}</span>
                              <span className="font-bold text-slate-600">Select Context →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={() => handlePreparePackage(selectedContextId)}
                        disabled={preparingPackage}
                        className="px-6 py-2.5 bg-[#08A99D] hover:bg-[#078C82] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {preparingPackage ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Preparing Handoff Package...
                          </>
                        ) : (
                          <>
                            Prepare Clinical Handoff Package <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW HANDOFF & CONTEXT-RELEVANT RECORDS */}
          {activeStep === 2 && preparedPackage && (
            <div className="space-y-6">
              {/* Product Differentiator Highlight Banner */}
              <div className="bg-gradient-to-r from-[#0D3435] to-[#15615D] text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#08A99D] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                      Context Isolation
                    </span>
                    <h2 className="text-base font-bold">
                      {preparedPackage.clinical_context?.name || "General Clinical Records"}
                    </h2>
                  </div>
                  <p className="text-xs text-teal-100/90 mt-1">
                    {preparedPackage.records_count?.total_patient_records || 0} total records exist on file for this patient —{' '}
                    <strong className="text-white underline">
                      {selectedRecordIds.length} records selected
                    </strong>{' '}
                    for this emergency referral handoff.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveStep(1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  >
                    ← Switch Context
                  </button>
                  <button
                    onClick={() => setActiveStep(3)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#08A99D] hover:bg-[#078C82] text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    Continue to Receiving Info →
                  </button>
                </div>
              </div>

              {/* Clinical Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Current Situation & History */}
                <div className="space-y-6">
                  {/* Current Situation Card (from Visit Intake) */}
                  <div className="bg-white border border-[#DCE8E8] rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#08A99D]" /> Current Visit Situation
                      </h3>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeCurrentSituation}
                          onChange={(e) => setIncludeCurrentSituation(e.target.checked)}
                          className="rounded text-[#08A99D] focus:ring-[#08A99D]"
                        />
                        Include in Handoff
                      </label>
                    </div>

                    {preparedPackage.current_situation ? (
                      <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>Chief Complaint: {preparedPackage.current_situation.chief_complaint || 'Not specified'}</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {preparedPackage.current_situation.recorded_at ? new Date(preparedPackage.current_situation.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                          </span>
                        </div>
                        {preparedPackage.current_situation.hpi && (
                          <p className="text-slate-600 leading-relaxed">{preparedPackage.current_situation.hpi}</p>
                        )}
                        {preparedPackage.current_situation.vitals && (
                          <div className="pt-2 border-t border-teal-100/60 flex flex-wrap gap-2 text-[11px]">
                            {Object.entries(preparedPackage.current_situation.vitals).map(([k, v]) => (
                              <span key={k} className="bg-white px-2 py-0.5 rounded border border-teal-200/60 text-slate-700 font-medium">
                                <strong>{k}:</strong> {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Not available in records (No current visit intake recorded today).
                      </p>
                    )}
                  </div>

                  {/* Clinical Progression & History */}
                  <div className="bg-white border border-[#DCE8E8] rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Stethoscope className="w-4 h-4 text-[#08A99D]" /> Context Progression & History
                    </h3>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {preparedPackage.clinical_progression?.length > 0 ? (
                        preparedPackage.clinical_progression.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-700">
                              <span>{item.date || 'Past Record'}</span>
                              <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded">{item.record_type}</span>
                            </div>
                            <p className="text-slate-600">{item.summary}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">Not available in records</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Medications, Allergies & Investigations */}
                <div className="space-y-6">
                  {/* Active Context Medications */}
                  <div className="bg-white border border-[#DCE8E8] rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <FileText className="w-4 h-4 text-[#08A99D]" /> Context Medications
                    </h3>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {preparedPackage.medications?.length > 0 ? (
                        preparedPackage.medications.map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                            <div>
                              <strong className="text-slate-800">{m.name}</strong>
                              <span className="text-slate-500 ml-2">({m.dosage})</span>
                            </div>
                            <span className="text-slate-500 font-mono text-[11px]">{m.frequency}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">Not available in records</p>
                      )}
                    </div>
                  </div>

                  {/* Allergies & Clinical Warnings */}
                  <div className="bg-white border border-[#DCE8E8] rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Allergies & Safety Findings
                    </h3>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-700">Allergies: </span>
                        {preparedPackage.allergies?.length > 0 ? (
                          <span className="text-rose-600 font-semibold">{preparedPackage.allergies.join(', ')}</span>
                        ) : (
                          <span className="text-slate-400 italic">Not available in records</span>
                        )}
                      </div>

                      {preparedPackage.warnings?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {preparedPackage.warnings.map((w, idx) => (
                            <div key={idx} className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg text-xs flex items-start gap-2">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <strong>{w.type || 'Warning'}: </strong>{w.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Relevant Investigations */}
                  <div className="bg-white border border-[#DCE8E8] rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Stethoscope className="w-4 h-4 text-[#08A99D]" /> Key Investigations on File
                    </h3>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {preparedPackage.investigations?.length > 0 ? (
                        preparedPackage.investigations.map((inv, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                            <span className="font-medium text-slate-700">{inv.test_name}</span>
                            <span className="font-bold text-slate-900">{inv.result} {inv.unit || ''}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">Not available in records</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supporting Document Selection Section */}
              <div className="bg-white border border-[#DCE8E8] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileCheck className="w-4.5 h-4.5 text-[#08A99D]" /> Context-Relevant Supporting Documents
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Selected documents will be compiled and physically attached to the referral handoff email.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectAllContextRecords}
                      className="text-xs font-bold text-[#08A99D] hover:underline cursor-pointer"
                    >
                      Select Context Records
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setShowAllRecords(!showAllRecords)}
                      className="text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      {showAllRecords ? "Hide Unrelated Records" : "View All Patient Records"}
                    </button>
                  </div>
                </div>

                {/* Record Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(preparedPackage.available_records || [])
                    .filter(r => showAllRecords || r.is_context_relevant)
                    .map(record => {
                      const isChecked = selectedRecordIds.includes(record.id);
                      return (
                        <div
                          key={record.id}
                          onClick={() => toggleRecordSelection(record.id)}
                          className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer flex items-start gap-3 ${
                            isChecked
                              ? 'bg-teal-50/50 border-[#08A99D] shadow-sm'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-[#08A99D]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-800 truncate" title={record.file_name}>
                                {record.file_name}
                              </span>
                              {record.is_context_relevant ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                  Context Match
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                  Other Record
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1">{record.summary}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>{record.date || 'No date'}</span>
                              <span className="uppercase">{record.record_type}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    <strong>{selectedRecordIds.length}</strong> document(s) queued for handoff attachment.
                  </span>

                  <button
                    onClick={() => setActiveStep(3)}
                    className="px-6 py-2.5 bg-[#08A99D] hover:bg-[#078C82] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    Configure Receiving Details <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RECEIVING HOSPITAL DETAILS & REFERRAL REASON */}
          {activeStep === 3 && (
            <div className="bg-white border border-[#DCE8E8] rounded-2xl p-6 shadow-sm space-y-6 max-w-4xl mx-auto">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-850 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#08A99D]" /> Receiving Facility & Transfer Details
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Specify the destination hospital, clinical contact, and reason for transfer.
                </p>
              </div>

              {/* Urgency Level Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Urgency Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { level: 'Emergency', desc: 'Immediate acute transfer (Cath lab / ICU)', color: 'border-rose-300 bg-rose-50/60 text-rose-800' },
                    { level: 'Urgent', desc: 'Transfer within 24 hours', color: 'border-amber-300 bg-amber-50/60 text-amber-800' },
                    { level: 'Routine', desc: 'Elective or scheduled evaluation', color: 'border-blue-300 bg-blue-50/60 text-blue-800' }
                  ].map(u => (
                    <button
                      key={u.level}
                      type="button"
                      onClick={() => setUrgency(u.level)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        urgency === u.level 
                          ? `${u.color} ring-2 ring-current shadow-sm font-bold` 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold">{u.level}</div>
                      <div className="text-[11px] opacity-80 mt-0.5">{u.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Receiving Hospital Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Receiving Hospital Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. All India Institute of Medical Sciences (AIIMS)"
                    value={receivingHospital}
                    onChange={(e) => setReceivingHospital(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-[#08A99D]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Receiving Department / Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. Department of Cardiology / Cath Lab"
                    value={receivingDepartment}
                    onChange={(e) => setReceivingDepartment(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-[#08A99D]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Receiving Doctor / Consultant (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. A. Sharma (On-call Interventionalist)"
                    value={receivingDoctor}
                    onChange={(e) => setReceivingDoctor(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-[#08A99D]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Receiving Phone / Hotline</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 11 2658 8500"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-[#08A99D]"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-bold text-slate-700">Receiving Doctor / Hospital Handoff Email *</label>
                  <input
                    type="email"
                    placeholder="e.g. emergency.triage@hospital.org"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-[#08A99D]"
                  />
                  <p className="text-[11px] text-slate-400">
                    The finalized referral PDF along with all {selectedRecordIds.length} selected medical record attachments will be emailed here.
                  </p>
                </div>
              </div>

              {/* Referral Reason Text Area */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Reason for Referral & Clinical Handoff Note *</label>
                  {preparedPackage?.suggested_referral_reason && (
                    <button
                      type="button"
                      onClick={() => setReferralReason(preparedPackage.suggested_referral_reason)}
                      className="text-[11px] font-bold text-[#08A99D] hover:underline cursor-pointer"
                    >
                      Restore Suggested Draft
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  placeholder="Explain why the patient is being transferred and immediate interventions required..."
                  value={referralReason}
                  onChange={(e) => setReferralReason(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#08A99D] text-xs leading-relaxed"
                />
              </div>

              {/* Navigation buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  ← Back to Records
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateReferral("Prepared")}
                  disabled={savingReferral}
                  className="px-6 py-2.5 bg-[#08A99D] hover:bg-[#078C82] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingReferral ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Finalizing Package...
                    </>
                  ) : (
                    <>
                      Review Referral Package <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: PACKAGE PREVIEW, PDF DOWNLOAD & DISPATCH */}
          {activeStep === 4 && (
            <div className="bg-white border border-[#DCE8E8] rounded-2xl p-6 shadow-sm space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-850">Referral Package Ready for Handoff</h2>
                    <p className="text-xs text-slate-500">
                      Standardized clinical transfer summary prepared for {receivingHospital}.
                    </p>
                  </div>
                </div>

                <span className={`text-xs font-bold px-3 py-1 rounded-lg uppercase ${
                  urgency === 'Emergency' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {urgency} Priority
                </span>
              </div>

              {/* Package Summary Box */}
              <div className="bg-[#F2FBFA] border border-teal-200/70 rounded-2xl p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-teal-200/50 pb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Patient Name</span>
                    <strong className="text-slate-800 text-sm">{selectedPatient?.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Patient UID</span>
                    <strong className="font-mono text-slate-800">{selectedPatient?.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Clinical Context</span>
                    <strong className="text-teal-800">{preparedPackage?.clinical_context?.name || "General"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Receiving Facility</span>
                    <strong className="text-slate-800">{receivingHospital}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <strong className="text-slate-700 block">Referral Reason & Immediate Clinical Action:</strong>
                  <p className="bg-white p-3 rounded-xl border border-teal-100 text-slate-700 leading-relaxed">
                    {referralReason}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Attached Records: <strong>{selectedRecordIds.length}</strong> context-relevant files</span>
                  <span>Recipient Email: <strong>{contactEmail || 'Not specified'}</strong></span>
                </div>
              </div>

              {/* Action Buttons: PDF Download & Email Share */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(activeReferral?.id)}
                  className="p-4 rounded-xl border-2 border-[#08A99D] hover:bg-teal-50 text-[#08A99D] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" /> Download Standardized Referral PDF
                </button>

                <button
                  type="button"
                  onClick={handleShareReferral}
                  disabled={sharingReferral || !contactEmail.trim()}
                  className="p-4 rounded-xl bg-[#08A99D] hover:bg-[#078C82] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {sharingReferral ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching Referral Package...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send Referral via Email with Attachments
                    </>
                  )}
                </button>
              </div>

              {/* Step Navigation Back */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  ← Edit Details
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('history');
                    setActiveStep(1);
                  }}
                  className="text-xs font-bold text-[#08A99D] hover:underline cursor-pointer"
                >
                  View in Referral History →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
