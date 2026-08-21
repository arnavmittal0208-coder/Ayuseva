import { useState, useEffect } from 'react'
import { 
  Search, Shield, Activity, Calendar, FileText, Settings, AlertTriangle, 
  CheckCircle, Plus, Upload, Send, RefreshCw, BarChart2, User, Landmark, 
  MapPin, PlusCircle, ArrowUpRight, Download, CheckCircle2, Clock, XCircle
} from 'lucide-react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const BASE_URL = "http://localhost:8000"

const getFileUrl = (path) => {
  if (!path) return '#'
  const cleanPath = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '')
  return `${BASE_URL}/${cleanPath}`
}

const downloadBriefPDF = (patient, brief) => {
  if (!patient || !brief) return;
  const printWindow = window.open('', '_blank');
  const printContent = `
    <html>
    <head>
      <title>AyuSeva Clinical Summary - ${patient.name || 'N/A'}</title>
      <style>
        body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
        .header { border-bottom: 2px solid #0f766e; padding-bottom: 20px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: bold; color: #0f766e; }
        .date { font-size: 12px; color: #64748b; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 14px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .warning-box { background: #fef2f2; border: 1px solid #fee2e2; color: #991b1b; padding: 15px; border-radius: 8px; margin-bottom: 25px; font-size: 14px; }
        .section-title { font-size: 15px; font-weight: bold; color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .summary-text { font-size: 13px; color: #334155; line-height: 1.6; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        th { background: #f8fafc; font-weight: bold; color: #475569; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">AyuSeva</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Longitudinal Clinical Brief & CDSS Summary</div>
        </div>
        <div class="date">Report Generated: ${new Date().toLocaleDateString()}</div>
      </div>
      <div class="patient-info">
        <div><strong>Patient Name:</strong> ${patient.name || 'N/A'}</div>
        <div><strong>Patient UID:</strong> ${patient.id}</div>
        <div><strong>Date of Birth:</strong> ${patient.dob || 'N/A'}</div>
        <div><strong>Contact Phone:</strong> ${patient.phone || 'N/A'}</div>
      </div>
      ${brief.warnings && brief.warnings.length > 0 ? `
        <div class="warning-box">
          <strong>⚠️ Clinical Alert Warnings:</strong>
          <ul style="margin: 5px 0 0 20px; padding: 0;">
            ${brief.warnings.map(w => `<li><strong>${w.type}:</strong> ${w.message}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="section-title">15-Second Clinical Summary</div>
      <div class="summary-text">${brief.clinical_summary}</div>
      
      <div class="section-title">Active Diagnoses</div>
      <ul style="font-size: 13px; color: #334155; margin-left: 20px; padding: 0;">
        ${brief.active_problems.map(p => `<li style="margin-bottom: 4px;">${p}</li>`).join('')}
      </ul>

      <div class="section-title">Active Prescriptions</div>
      <table>
        <thead>
          <tr>
            <th>Medication Name</th>
            <th>Dosage</th>
            <th>Frequency</th>
          </tr>
        </thead>
        <tbody>
          ${brief.current_medications && brief.current_medications.length > 0 ? brief.current_medications.map(m => `
            <tr>
              <td><strong>${m.name}</strong></td>
              <td>${m.dosage || 'N/A'}</td>
              <td>${m.frequency || 'N/A'}</td>
            </tr>
          `).join('') : '<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No active medications found in EMR.</td></tr>'}
        </tbody>
      </table>

      ${brief.relevance_metrics && brief.relevance_metrics.length > 0 ? `
        <div class="section-title">Relevant Timeline Records</div>
        <ul style="font-size: 13px; color: #334155; margin-left: 20px; padding: 0; list-style-type: square;">
          ${brief.relevance_metrics.filter(r => r.relevance === 'High').map(r => `
            <li style="margin-bottom: 6px;">
              <strong>${r.record_title}</strong>
              <div style="color: #475569; font-size: 11px; margin-top: 2px; font-style: italic;">${r.explanation}</div>
            </li>
          `).join('')}
        </ul>
        <div class="section-title">Excluded / Low-Relevance History</div>
        <ul style="font-size: 13px; color: #64748b; margin-left: 20px; padding: 0; list-style-type: circle;">
          ${brief.relevance_metrics.filter(r => r.relevance === 'Low').map(r => `
            <li style="margin-bottom: 6px;">
              <strong>${r.record_title}</strong>
              <div style="color: #64748b; font-size: 11px; margin-top: 2px; font-style: italic;">${r.explanation}</div>
            </li>
          `).join('')}
        </ul>
      ` : ''}

      <div style="margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        Generated dynamically by AyuSeva Triage & Claim Systems. Citations verified from patient EMR files.
      </div>
      <script>
        window.onload = function() { window.print(); window.close(); }
      </script>
    </body>
    </html>
  `;
  printWindow.document.write(printContent);
  printWindow.document.close();
}

function App() {
  const [activeDashboard, setActiveDashboard] = useState('hospital') // 'hospital' or 'patient'
  
  // Patient / Clinical State
  const [patientId, setPatientId] = useState('')
  const [activePatient, setActivePatient] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [clinicalBrief, setClinicalBrief] = useState(null)
  const [claims, setClaims] = useState([])
  const [allPatients, setAllPatients] = useState([])
  
  // Registration Form State
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regDob, setRegDob] = useState('')
  const [regInsurer, setRegInsurer] = useState('Star Health Insurance')

  // UI status states
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [claimDispatchStatus, setClaimDispatchStatus] = useState(null)
  const [preventiveBookingStatus, setPreventiveBookingStatus] = useState(null)
  const [activeSpecialty, setActiveSpecialty] = useState('General')
  const [activeSummaryMode, setActiveSummaryMode] = useState('complete')
  const [diseaseFocus, setDiseaseFocus] = useState('')
  const [currentVisitReason, setCurrentVisitReason] = useState('')
  const [showExcludedHistory, setShowExcludedHistory] = useState(false)
  
  // Active test selection for chart
  const [selectedChartTest, setSelectedChartTest] = useState('Glucose')

  // Load all patients on mount for quick lookup lists
  useEffect(() => {
    fetchPatientsList()
  }, [])

  // Auto-fetch data if a patient ID is selected/searched
  const fetchPatientsList = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/patients/`)
      if (res.ok) {
        const data = await res.json()
        setAllPatients(data)
      }
    } catch (err) {
      console.error("Failed to load patients list:", err)
    }
  }

  const fetchPatientData = async (uid) => {
    if (!uid) return
    setLoading(true)
    setActivePatient(null)
    setTimeline([])
    setClaims([])
    setClinicalBrief(null)
    setClaimDispatchStatus(null)
    setPreventiveBookingStatus(null)
    setActiveSummaryMode('complete')
    setDiseaseFocus('')
    setCurrentVisitReason('')
    setShowExcludedHistory(false)
    
    try {
      // 1. Fetch Timeline
      const timelineRes = await fetch(`${BASE_URL}/api/patients/${uid}/timeline`)
      if (!timelineRes.ok) {
        throw new Error("Patient not found")
      }
      const timelineData = await timelineRes.json()
      setActivePatient(timelineData.patient)
      setTimeline(timelineData.timeline)
      setPatientId(uid)

      // 2. Fetch AI Brief
      await fetchBriefOnly(uid, activeSummaryMode, activeSpecialty, diseaseFocus, currentVisitReason)

      // 3. Fetch Active Claims
      const claimsRes = await fetch(`${BASE_URL}/api/claims/patient/${uid}`)
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json()
        // If there are claims, audit the first one to get the checklist
        if (claimsData.length > 0) {
          const auditRes = await fetch(`${BASE_URL}/api/claims/${claimsData[0].id}`)
          if (auditRes.ok) {
            const auditData = await auditRes.json()
            setClaims([auditData])
          } else {
            setClaims(claimsData)
          }
        } else {
          setClaims([])
        }
      }
      
      // Update patient lookup list in background
      fetchPatientsList()
    } catch (err) {
      alert("Error: " + err.message)
      setActivePatient(null)
      setTimeline([])
      setClinicalBrief(null)
      setClaims([])
    } finally {
      setLoading(false)
    }
  }

  const fetchBriefOnly = async (uid, mode, specialty, disease, reason) => {
    try {
      let url = `${BASE_URL}/api/patients/${uid}/brief?summary_type=${mode}&specialty=${specialty}`
      if (disease && mode === 'disease') url += `&disease_focus=${encodeURIComponent(disease)}`
      if (reason && mode === 'current_visit') url += `&current_visit_reason=${encodeURIComponent(reason)}`
      
      const briefRes = await fetch(url)
      if (briefRes.ok) {
        const briefData = await briefRes.json()
        setClinicalBrief(briefData)
      } else {
        const errData = await briefRes.json()
        console.error("Failed to load clinical brief:", errData.detail)
      }
    } catch (err) {
      console.error("Failed to load clinical brief:", err)
    }
  }

  // Refetch brief if medical specialty, summary mode, or details change
  useEffect(() => {
    if (activePatient?.id) {
      fetchBriefOnly(activePatient.id, activeSummaryMode, activeSpecialty, diseaseFocus, currentVisitReason)
    }
  }, [activePatient?.id, activeSummaryMode, activeSpecialty, diseaseFocus, currentVisitReason])

  // Handle Patient Registration
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!regName || !regPhone || !regDob) {
      alert("Please fill in all registration fields.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/patients/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          dob: regDob,
          insurer: regInsurer
        })
      })
      if (!res.ok) throw new Error("Failed to register patient")
      
      const newPatient = await res.json()
      alert(`Patient registered successfully!\nUID generated: ${newPatient.id}`)
      
      // Reset registration form
      setRegName('')
      setRegPhone('')
      setRegDob('')
      
      // Auto-load newly created patient
      fetchPatientData(newPatient.id)
    } catch (err) {
      alert("Registration Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle Clinical File Ingestion (Upload)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    if (activePatient?.id) {
      formData.append("patient_id", activePatient.id)
    }

    try {
      const res = await fetch(`${BASE_URL}/api/records/upload`, {
        method: "POST",
        body: formData
      })
      if (!res.ok) {
        const errDetail = await res.json()
        throw new Error(errDetail.detail || "Ingestion failed")
      }
      const data = await res.json()
      alert(`AI Ingestion Complete!\nPatient: ${data.patient_id}\nRecord Type: ${data.parsed_data.record_type}`)
      
      // Load/Refetch patient information
      fetchPatientData(data.patient_id)
    } catch (err) {
      alert("Ingestion Error: " + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Handle Cashless pre-Auth Claims Submission
  const handleSubmitClaim = async (claimId) => {
    if (!claimId) return
    setLoading(true)
    setClaimDispatchStatus({ status: 'sending', msg: 'Compiling files and generating TPA pre-authorization pack...' })
    try {
      const res = await fetch(`${BASE_URL}/api/claims/${claimId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error("Failed to dispatch cashless pre-auth claim")
      const data = await res.json()
      
      setClaimDispatchStatus({
        status: 'success',
        msg: `Claim successfully emailed to TPA (${data.tpa_notified}). CC dispatched to patient.`
      })
      
      // Refetch claims details to update status in EMR
      if (activePatient?.id) {
        const claimsRes = await fetch(`${BASE_URL}/api/claims/patient/${activePatient.id}`)
        if (claimsRes.ok) {
          const claimsData = await claimsRes.json()
          if (claimsData.length > 0) {
            const auditRes = await fetch(`${BASE_URL}/api/claims/${claimsData[0].id}`)
            if (auditRes.ok) {
              const auditData = await auditRes.json()
              setClaims([auditData])
            }
          }
        }
      }
    } catch (err) {
      setClaimDispatchStatus({ status: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Handle Preventive checkup scheduler trigger
  const handleTriggerPreventive = async (uid) => {
    if (!uid) return
    setLoading(true)
    setPreventiveBookingStatus({ status: 'sending', msg: 'Checking policy limits and booking lab collection slots...' })
    try {
      const res = await fetch(`${BASE_URL}/api/claims/patient/${uid}/trigger-preventive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error("Failed to schedule preventive blood draw")
      const data = await res.json()
      setPreventiveBookingStatus({
        status: 'success',
        msg: `Free Annual Checkup scheduled! Lab partner notified (${data.lab_notified}). Patient alerted.`
      })
    } catch (err) {
      setPreventiveBookingStatus({ status: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Process timeline data to construct Recharts diagnostic metrics over time
  const getBiomarkerChartData = () => {
    const rawData = []
    
    // Sort timeline ascending (oldest first) to plot chronologically
    const chronTimeline = [...timeline].reverse()

    chronTimeline.forEach(record => {
      const date = record.date || new Date(record.created_at).toISOString().split('T')[0]
      const results = record.parsed_json?.lab_results
      if (results && Array.isArray(results)) {
        results.forEach(test => {
          // Clean test value to support float parsing
          const cleanVal = parseFloat(String(test.result).replace(/[^\d.]/g, ''))
          if (!isNaN(cleanVal)) {
            rawData.push({
              date,
              testName: test.test_name.toLowerCase(),
              displayName: test.test_name,
              value: cleanVal,
              unit: test.unit || ''
            })
          }
        })
      }
    })

    // Filter for selected test
    const filteredData = rawData.filter(d => 
      d.testName.includes(selectedChartTest.toLowerCase()) || 
      selectedChartTest.toLowerCase().includes(d.testName)
    )

    return filteredData
  }

  // Get active test names present in timeline for selector dropdown
  const getAvailableTestNames = () => {
    const names = new Set(['Glucose', 'HbA1c', 'BP (Systolic)'])
    timeline.forEach(record => {
      const results = record.parsed_json?.lab_results
      if (results && Array.isArray(results)) {
        results.forEach(test => {
          names.add(test.test_name)
        })
      }
    })
    return Array.from(names)
  }

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex">
      
      {/* 1. Global Navigation Sidebar */}
      <nav className="bg-primary-dark text-slate-200 w-72 flex flex-col h-screen fixed left-0 top-0 py-6 px-4 border-r border-slate-800 z-50">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2">
            <div className="bg-teal-600 p-1.5 rounded-lg text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-none">AyuSeva</h1>
              <p className="text-xs text-slate-400 mt-1">Care & Claims Orchestration</p>
            </div>
          </div>
        </div>

        {/* Console Switcher Panel */}
        <div className="mb-6 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          <div className="grid grid-cols-2 gap-1">
            <button 
              onClick={() => setActiveDashboard('hospital')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${activeDashboard === 'hospital' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              🏥 Hospital
            </button>
            <button 
              onClick={() => setActiveDashboard('patient')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${activeDashboard === 'patient' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              👤 Patient
            </button>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto space-y-6">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-2">Navigation</span>
            <ul className="mt-2 space-y-1">
              <li>
                <button 
                  onClick={() => setActiveDashboard('hospital')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeDashboard === 'hospital' ? 'bg-teal-600/10 text-teal-400 font-medium' : 'text-slate-400 hover:bg-slate-950/40 hover:text-slate-100'}`}
                >
                  <Activity className="w-4.5 h-4.5" />
                  Intake Console
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveDashboard('patient')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeDashboard === 'patient' ? 'bg-teal-600/10 text-teal-400 font-medium' : 'text-slate-400 hover:bg-slate-950/40 hover:text-slate-100'}`}
                >
                  <User className="w-4.5 h-4.5" />
                  Patient Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Quick Active Patient Lookup */}
          {allPatients.length > 0 && (
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-2">Recent Patients</span>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                {allPatients.map(p => (
                  <li key={p.id}>
                    <button 
                      onClick={() => fetchPatientData(p.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${patientId === p.id ? 'bg-teal-600/10 text-teal-400 font-medium' : 'text-slate-400 hover:bg-slate-950/40 hover:text-slate-200'}`}
                    >
                      <span className="truncate">{p.name || 'UID Registered'}</span>
                      <span className="font-mono text-[9px] bg-slate-900 px-1 py-0.5 rounded text-slate-500">{p.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-auto pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Local DB: SQLite</span>
          <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded font-bold font-mono">Active</span>
        </div>
      </nav>

      {/* 2. Main Content Area */}
      <main className="ml-72 flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top App Bar */}
        <header className="bg-white border-b border-slate-200 h-16 flex justify-between items-center px-8 shrink-0 z-40">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800 tracking-tight">
              {activeDashboard === 'hospital' ? '🏥 AIIMS Triage Console' : '👤 Patient Longitudinal Health Portal'}
            </span>
            {activePatient && (
              <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-100 flex items-center gap-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-teal-600" /> Active Session: {activePatient.name || activePatient.id}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {activeDashboard === 'hospital' && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <MapPin className="w-3.5 h-3.5" /> Emergency referrals: <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded-full text-[10px]">3</span>
              </span>
            )}
            
            {loading && <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />}
            
            <div className="w-[1px] h-5 bg-slate-200"></div>
            
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-semibold leading-tight text-slate-700">Triage Desk</p>
                <p className="text-[10px] text-slate-400">Dr. Sharma (On Shift)</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                DS
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Workspace */}
        <div className="flex-1 overflow-hidden p-6 bg-slate-50 flex flex-col h-full min-h-0">
          {activeDashboard === 'hospital' ? (
            
            /* =======================================================
               🏥 DASHBOARD: HOSPITAL CLINICAL CONSOLE 
               ======================================================= */
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full min-h-0">
              
              {/* Left Column: Intake & Ingestion */}
              <div className="xl:col-span-4 h-full flex flex-col gap-6 overflow-y-auto pr-1 min-h-0">
                
                {/* Search Panel */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-slate-500" /> Patient UID Search
                  </h2>
                  <div className="flex gap-2">
                    <input 
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && fetchPatientData(patientId)}
                      placeholder="Enter ID (e.g., CARE-492019)"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                    <button 
                      onClick={() => fetchPatientData(patientId)}
                      className="bg-primary-dark hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1"
                    >
                      Search
                    </button>
                  </div>
                </div>

                {/* Patient Register Form */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4 text-slate-500" /> Register New Patient
                  </h2>
                  <form onSubmit={handleRegister} className="space-y-3">
                    <input 
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-teal-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="Phone"
                        type="tel"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-teal-500"
                      />
                      <input 
                        required
                        value={regDob}
                        onChange={(e) => setRegDob(e.target.value)}
                        type="date"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-teal-500 text-slate-500"
                      />
                    </div>
                    <select 
                      value={regInsurer}
                      onChange={(e) => setRegInsurer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-teal-500"
                    >
                      <option>Star Health Insurance</option>
                      <option>HDFC Ergo</option>
                      <option>ICICI Lombard</option>
                      <option>SBI General</option>
                    </select>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      Create Local UID
                    </button>
                  </form>
                </div>

                {/* File Dropzone Upload */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-slate-500" /> Ingest Medical Records
                  </h2>
                  
                  <label className="border-2 border-dashed border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-slate-100/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group">
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-teal-600 mb-2 transition-colors" />
                    <span className="text-xs font-semibold text-slate-600">
                      {uploading ? "AI Engine Reading Document..." : "Upload Clinical File"}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Accepts prescription photos & laboratory PDFs</span>
                    
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden" 
                      accept="application/pdf,image/*"
                    />
                  </label>
                  
                  {activePatient && (
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                      Files will automatically parse and save to patient UID: <span className="font-mono font-bold text-slate-600">{activePatient.id}</span>
                    </p>
                  )}
                </div>

              </div>

              {/* Center Column: Active EMR and Brief */}
              <div className="xl:col-span-5 h-full flex flex-col gap-4 overflow-hidden min-h-0">
                
                {/* EMR Dashboard Profile Card */}
                {activePatient ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex-[3] flex flex-col min-h-0">
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-teal-600"></div>
                    
                    <div className="flex justify-between items-start mb-4 shrink-0">
                      <div>
                        <h2 className="text-xl font-bold text-slate-800 leading-none">{activePatient.name || "UID Registered"}</h2>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{activePatient.id}</span>
                          <span>DOB: {activePatient.dob || "N/A"}</span>
                          <span>Phone: {activePatient.phone || "N/A"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 font-bold text-[10px] uppercase flex items-center gap-1 shrink-0">
                          <CheckCircle className="w-3 h-3 text-teal-600" /> Active Session
                        </span>
                        {clinicalBrief && (
                          <button 
                            onClick={() => downloadBriefPDF(activePatient, clinicalBrief)}
                            className="flex items-center gap-1.5 bg-teal-650 hover:bg-teal-700 text-teal-600 hover:text-white border border-teal-500 hover:border-teal-700 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm shrink-0"
                          >
                            <FileText className="w-3 h-3" /> Print Summary
                          </button>
                        )}
                      </div>
                    </div>

                    {/* AI Clinical Brief */}
                    {clinicalBrief ? (
                      <div className="flex-1 overflow-y-auto pr-1 space-y-4 pt-4 border-t border-slate-100">
                        
                        {/* Summary Mode Selector Tab Group */}
                        <div className="bg-slate-50 border border-slate-200 p-1 rounded-lg space-y-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-1">Clinical Summary Mode</span>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { id: 'complete', label: 'Complete' },
                              { id: 'recent', label: 'Recent' },
                              { id: 'current_visit', label: 'Current Visit' },
                              { id: 'disease', label: 'Disease Specific' },
                              { id: 'specialty', label: 'Specialty Focus' },
                              { id: 'emergency', label: 'Emergency' }
                            ].map(mode => (
                              <button
                                key={mode.id}
                                onClick={() => {
                                  setActiveSummaryMode(mode.id);
                                  if (mode.id === 'specialty' && activeSpecialty === 'General') {
                                    setActiveSpecialty('Cardiology');
                                  }
                                }}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition-all select-none ${
                                  activeSummaryMode === mode.id 
                                    ? 'bg-teal-600 text-white shadow-sm' 
                                    : 'bg-white text-slate-600 hover:text-slate-800 border border-slate-200'
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Current Visit Reason Input (Conditional) */}
                        {activeSummaryMode === 'current_visit' && (
                          <div className="bg-teal-50/50 border border-teal-100/50 rounded-lg p-2.5 space-y-1.5">
                            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Reason for Current Visit</span>
                            <input 
                              type="text" 
                              value={currentVisitReason} 
                              onChange={(e) => setCurrentVisitReason(e.target.value)}
                              placeholder="e.g., Sore throat, routine diabetes checkup, chest pain" 
                              className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-teal-500 text-slate-700"
                            />
                          </div>
                        )}

                        {/* Target Disease Focus Input (Conditional) */}
                        {activeSummaryMode === 'disease' && (
                          <div className="bg-teal-50/50 border border-teal-100/50 rounded-lg p-2.5 space-y-1.5">
                            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Target Disease Focus</span>
                            <input 
                              type="text" 
                              value={diseaseFocus} 
                              onChange={(e) => setDiseaseFocus(e.target.value)}
                              placeholder="e.g., Diabetes, Hypertension, Typhoid, Sore Throat" 
                              className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-teal-500 text-slate-700"
                            />
                          </div>
                        )}

                        {/* Specialty Selector Dropdown (Conditional) */}
                        {activeSummaryMode === 'specialty' && (
                          <div className="flex items-center justify-between bg-teal-50/50 border border-teal-100/50 rounded-lg p-2.5">
                            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Configure Specialty Focus:</span>
                            <select 
                              value={activeSpecialty}
                              onChange={(e) => setActiveSpecialty(e.target.value)}
                              className="text-xs bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-teal-500 text-slate-600 font-medium"
                            >
                              <option>Cardiology</option>
                              <option>Endocrinology</option>
                              <option>Oncology</option>
                              <option>Orthopedics</option>
                              <option>General</option>
                            </select>
                          </div>
                        )}

                        {/* Allergy Warnings */}
                        {clinicalBrief.warnings && clinicalBrief.warnings.length > 0 ? (
                          <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-lg p-3 space-y-1.5">
                            {clinicalBrief.warnings.map((w, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                                <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="text-rose-900 font-bold">{w.type}:</strong> {w.message}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg p-3 flex items-center gap-2 text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No drug allergies or active medication conflicts detected.</span>
                          </div>
                        )}

                        {/* Summary paragraph */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            15-Second Clinical Summary ({activeSummaryMode === 'specialty' ? `${activeSpecialty} View` : activeSummaryMode.replace('_', ' ').toUpperCase()})
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                            {clinicalBrief.clinical_summary}
                          </p>
                        </div>

                        {/* Active Problems */}
                        {clinicalBrief.active_problems && clinicalBrief.active_problems.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Diagnoses</span>
                            <ul className="space-y-1">
                              {clinicalBrief.active_problems.map((p, idx) => (
                                <li key={idx} className="text-xs text-slate-600 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Medications Grid */}
                        {clinicalBrief.current_medications && clinicalBrief.current_medications.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Active Prescriptions</span>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
                                  <tr>
                                    <th className="px-3 py-2">Medication</th>
                                    <th className="px-3 py-2">Dose</th>
                                    <th className="px-3 py-2">Frequency</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {clinicalBrief.current_medications.map((m, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="px-3 py-2 font-mono font-medium text-slate-700">{m.name}</td>
                                      <td className="px-3 py-2 text-slate-500">{m.dosage || 'N/A'}</td>
                                      <td className="px-3 py-2 text-slate-500">{m.frequency || 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Relevance Metrics: Relevant Records */}
                        {clinicalBrief.relevance_metrics && clinicalBrief.relevance_metrics.some(r => r.relevance === 'High') && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Relevant Timeline Records</span>
                            <div className="space-y-1.5">
                              {clinicalBrief.relevance_metrics.filter(r => r.relevance === 'High').map((r, idx) => (
                                <div key={idx} className="bg-emerald-50/20 border border-emerald-100/50 rounded-lg p-2 flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                  <div className="text-xs">
                                    <strong className="text-slate-800 font-semibold block">{r.record_title}</strong>
                                    <span className="text-slate-500 italic text-[11px] block mt-0.5">{r.explanation}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Relevance Metrics: Excluded History */}
                        {clinicalBrief.relevance_metrics && clinicalBrief.relevance_metrics.some(r => r.relevance === 'Low') && (
                          <div className="pt-2 border-t border-slate-100">
                            <button 
                              onClick={() => setShowExcludedHistory(!showExcludedHistory)}
                              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 focus:outline-none w-full text-left"
                            >
                              <span>{showExcludedHistory ? '▼' : '▶'} View Excluded History ({clinicalBrief.relevance_metrics.filter(r => r.relevance === 'Low').length})</span>
                            </button>
                            {showExcludedHistory && (
                              <div className="space-y-1.5 mt-2">
                                {clinicalBrief.relevance_metrics.filter(r => r.relevance === 'Low').map((r, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-start gap-2">
                                    <XCircle className="w-4 h-4 text-slate-450 shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                      <strong className="text-slate-600 font-semibold block">{r.record_title}</strong>
                                      <span className="text-slate-500 italic text-[11px] block mt-0.5">{r.explanation}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-xs text-slate-400 mt-4 text-center">Reading historical EMR to generate brief...</p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
                  <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">No Patient Loaded</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Search for a patient UID above or register a new patient to view clinical EMR files and pre-authorizations.
                  </p>
                </div>
              )}

              {/* Longitudinal Timeline Stack */}
              {activePatient && (
                <div className="flex-[2] flex flex-col min-h-0 overflow-hidden mt-2">
                  <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5 shrink-0">
                    <FileText className="w-4.5 h-4.5 text-slate-500" /> Medical Record Timeline
                  </h3>
                  <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                      {timeline.length > 0 ? (
                        timeline.map(r => (
                          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative pl-6">
                            <div className={`absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl ${
                              r.record_type === "Prescription" ? "bg-teal-600" :
                              r.record_type === "Lab Report" ? "bg-amber-500" : "bg-slate-400"
                            }`}></div>
                            
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                {r.record_type === "Prescription" ? "📜 Prescription" :
                                 r.record_type === "Lab Report" ? "🔬 Laboratory Report" : "📁 Health File"}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-bold">
                                {r.date || "Date N/A"}
                              </span>
                            </div>
                            
                            <p className="text-xs text-slate-500 leading-normal">
                              Parsed medical data: {
                                r.parsed_json?.diagnoses?.join(", ") || 
                                r.parsed_json?.hospital_name || 
                                "Historical clinical details synced under UID."
                              }
                            </p>
                            
                            {/* Visual Citation Verification Anchor */}
                            <div className="mt-2.5 pt-2 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400">
                              <span>Source: {r.file_path ? r.file_path.split('\\').pop() : 'Direct Upload'}</span>
                              <span className="text-[9px] bg-teal-50 text-teal-700 px-1.5 py-0.2 rounded font-bold border border-teal-100">
                                Verify Statement [Record #{r.id}]
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 py-4 text-center bg-white border border-slate-100 rounded-lg">
                          No health timeline documents parsed yet. Drop a file above to begin.
                        </p>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: Pre-Auth & Claims */}
              <div className="xl:col-span-3 h-full flex flex-col gap-6 overflow-y-auto pr-1 min-h-0">
                
                {/* Pre-Auth Audit Checklist */}
                {activePatient && claims.length > 0 ? (
                  claims.map(c => (
                    <div key={c.claim_id || c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-sm font-bold text-slate-800">Surgery Pre-Auth</h3>
                        <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          ₹{c.estimated_cost?.toLocaleString() || "Cost N/A"}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500 font-medium mb-4">Procedure: {c.procedure_name}</p>
                      
                      {/* Document Audit Checklist */}
                      <ul className="space-y-2.5 text-xs text-slate-600">
                        {c.audit_checklist ? (
                          Object.entries(c.audit_checklist).map(([doc, present]) => (
                            <li key={doc} className={`flex items-start gap-2 p-1.5 rounded border transition-colors ${
                              present ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-rose-50/50 border-rose-100 text-rose-800"
                            }`}>
                              {present ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span className="font-semibold">{doc}</span>
                                <p className="text-[9px] text-slate-400 mt-0.2">
                                  {present ? "Document parsed in history" : "Upload missing file to clear pre-auth"}
                                </p>
                              </div>
                            </li>
                          ))
                        ) : (
                          <p className="text-[10px] text-slate-400">Claims audit logs loading...</p>
                        )}
                      </ul>
                      
                      {/* TPA Dispatch Box */}
                      {c.status && (
                        <div className="mt-5 pt-4 border-t border-slate-100">
                          <h4 className="text-xs font-bold text-slate-800 mb-2">TPA Claim Submission</h4>
                          <div className="space-y-2">
                            <input 
                              type="email"
                              placeholder="TPA Insurer Email"
                              defaultValue="claims-tpa@healthinsurance.com"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 focus:outline-none focus:border-teal-500"
                            />
                            
                            <button 
                              onClick={() => handleSubmitClaim(c.claim_id || c.id)}
                              disabled={loading || (c.missing_documents && c.missing_documents.length > 0)}
                              className={`w-full py-2 rounded text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 text-white ${
                                c.status === "Submitted" ? "bg-emerald-600 hover:bg-emerald-700" :
                                (c.missing_documents && c.missing_documents.length > 0) ? "bg-slate-300 cursor-not-allowed" : "bg-primary hover:bg-slate-800"
                              }`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              {c.status === "Submitted" ? "Re-submit Claim Packet" : "Compile & Email Claim"}
                            </button>
                            
                            {/* Claim Status Log Badge */}
                            <div className="flex justify-between items-center text-[10px] pt-1">
                              <span className="text-slate-400">Claims Database Status:</span>
                              <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${
                                c.status === "Submitted" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                              }`}>{c.status}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Display Claim Success Message */}
                      {claimDispatchStatus && (
                        <div className={`mt-3 p-2.5 rounded text-[10px] leading-normal border ${
                          claimDispatchStatus.status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                          claimDispatchStatus.status === 'sending' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                        }`}>
                          {claimDispatchStatus.msg}
                        </div>
                      )}

                    </div>
                  ))
                ) : activePatient ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-center">
                    <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-xs font-bold text-slate-800">No Active Surgery Claims</h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Claims are automatically scaffolded when a surgery-advised document is uploaded to the patient timeline.
                    </p>
                  </div>
                ) : null}

                {/* Preventive Care Scheduler */}
                {activePatient && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/10 rounded-bl-full -mr-8 -mt-8"></div>
                    
                    <h3 className="text-sm font-bold text-slate-800 mb-1 relative z-10">Preventive Care</h3>
                    <p className="text-xs text-slate-500 mb-4 relative z-10 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" /> Free Annual Checkup Due
                    </p>
                    
                    <button 
                      onClick={() => handleTriggerPreventive(activePatient.id)}
                      disabled={loading}
                      className="w-full border-2 border-teal-600 hover:bg-teal-50 text-teal-600 py-2 rounded-lg text-xs font-bold transition-colors relative z-10 shadow-sm disabled:opacity-50"
                    >
                      Schedule Home Sample
                    </button>

                    {/* Booking status alerts */}
                    {preventiveBookingStatus && (
                      <div className={`mt-3 p-2.5 rounded text-[10px] leading-normal border relative z-10 ${
                        preventiveBookingStatus.status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                        preventiveBookingStatus.status === 'sending' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                      }`}>
                        {preventiveBookingStatus.msg}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          ) : (
            
            /* =======================================================
               👤 DASHBOARD: PATIENT PORTAL 
               ======================================================= */
            <div className="space-y-4 h-full flex flex-col overflow-hidden min-h-0">
              
              {/* Patient Welcome Hero */}
              {activePatient ? (
                <div className="bg-primary-dark text-white rounded-2xl p-8 shadow-md relative overflow-hidden">
                  {/* Subtle decorative background shapes */}
                  <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-gradient-to-l from-teal-500/20 to-transparent pointer-events-none"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                    <div>
                      <span className="text-[10px] bg-teal-500/30 text-teal-300 font-bold tracking-wider px-2 py-0.5 rounded uppercase">Patient E-Health Portal</span>
                      <h2 className="text-2xl font-bold mt-2">Welcome Back, {activePatient.name || "AyuSeva User"}!</h2>
                      <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
                        Access your unified health timeline, track cashless claims, and view insurance checkup benefits.
                      </p>
                      {clinicalBrief && (
                        <button 
                          onClick={() => downloadBriefPDF(activePatient, clinicalBrief)}
                          className="mt-4 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 w-fit"
                        >
                          <FileText className="w-4.5 h-4.5" /> Print / Download Clinical Summary
                        </button>
                      )}
                    </div>

                    {/* Coverage card info */}
                    <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-left shrink-0">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Active Insurance coverage</span>
                      <p className="text-sm font-bold text-teal-400 mt-1">Star Health Gold Policy</p>
                      <div className="flex items-center gap-6 mt-2 text-xs">
                        <div>
                          <span className="text-[9px] text-slate-500 block">Coverage Limit</span>
                          <span className="font-bold">₹5,00,000</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block">Policy Number</span>
                          <span className="font-mono">POL-92810398</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
                  <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-slate-800">Please select or search a Patient UID first</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Go to the **Hospital** tab, search for your patient ID (e.g. `CARE-492019`), and then switch back to view your personal dashboard!
                  </p>
                  <button 
                    onClick={() => setActiveDashboard('hospital')}
                    className="mt-4 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    Switch to Hospital View
                  </button>
                </div>
              )}

              {activePatient && (
                <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 overflow-hidden min-h-0">
                  
                  {/* Left Column: Vitals Trends & Checklist (Col 8) */}
                  <div className="xl:col-span-8 h-full flex flex-col gap-6 overflow-y-auto pr-1 min-h-0">
                    
                    {/* Recharts Biomarker Trends */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <BarChart2 className="w-4.5 h-4.5 text-slate-500" /> Lab Test Vitals & Biomarker Trends
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">Chronological test metrics parsed from your uploaded EMR lab files</p>
                        </div>
                        
                        {/* Biomarker Test Selector dropdown */}
                        <div className="flex items-center gap-2">
                          <select 
                            value={selectedChartTest}
                            onChange={(e) => setSelectedChartTest(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 font-semibold text-slate-600"
                          >
                            {getAvailableTestNames().map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Chart Render */}
                      <div className="h-64 w-full text-xs font-medium">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getBiomarkerChartData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" stroke="#94a3b8" tickSize={6} />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Line 
                              name={`${selectedChartTest} Level`}
                              type="monotone" 
                              dataKey="value" 
                              stroke="#0d9488" 
                              strokeWidth={3} 
                              activeDot={{ r: 8 }} 
                              dot={{ strokeWidth: 2, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Patient Timeline View */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                        <FileText className="w-4.5 h-4.5 text-slate-500" /> My Complete Health Records
                      </h3>
                      
                      <div className="space-y-4">
                        {timeline.length > 0 ? (
                          timeline.map(r => (
                            <div key={r.id} className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
                              <div>
                                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mb-1 border ${
                                  r.record_type === "Prescription" ? "bg-teal-50 border-teal-100 text-teal-700" :
                                  r.record_type === "Lab Report" ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-slate-100 border-slate-200 text-slate-700"
                                }`}>
                                  {r.record_type}
                                </span>
                                <h4 className="text-xs font-bold text-slate-800">
                                  {r.parsed_json?.diagnoses?.join(", ") || r.parsed_json?.hospital_name || "Parsed Clinical Entry"}
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Record ID: #{r.id} | Date: {r.date || "N/A"}</p>
                              </div>

                              <div className="flex gap-2">
                                <a 
                                  href={getFileUrl(r.file_path)} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" /> File
                                </a>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 py-6 text-center">No documents present in health timeline.</p>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Claims tracker & Free checkup stats (Col 4) */}
                  <div className="xl:col-span-4 h-full flex flex-col gap-6 overflow-y-auto pr-1 min-h-0">
                    
                    {/* Insurance Cashless Claims Tracker */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <Landmark className="w-4.5 h-4.5 text-slate-500" /> Active Cashless Claim status
                      </h3>
                      
                      {claims.length > 0 ? (
                        claims.map(c => (
                          <div key={c.id} className="space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Advised Procedure</span>
                              <p className="text-xs font-bold text-slate-700 mt-0.5">{c.procedure_name}</p>
                              <span className="text-[9px] font-mono text-slate-400 block mt-1">Estimate: ₹{c.estimated_cost?.toLocaleString()}</span>
                            </div>

                            {/* Claims progress status bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Settlement Progress:</span>
                                <span className="font-semibold text-slate-700">
                                  {c.status === "Submitted" ? "TPA Auditing Request" : "Draft (Pending Files)"}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                <div className={`h-full rounded-full transition-all duration-300 ${
                                  c.status === "Submitted" ? "bg-teal-500 w-2/3" : "bg-amber-400 w-1/3"
                                }`}></div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                                {c.status === "Submitted" ? (
                                  <>
                                    <Clock className="w-3.5 h-3.5 text-teal-600" /> Process within 30 min
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Missing documents
                                  </>
                                )}
                              </span>
                              <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase font-mono ${
                                c.status === "Submitted" ? "bg-teal-50 text-teal-700 border border-teal-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                              }`}>{c.status}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 py-2">No active claims found under your policy.</p>
                      )}
                    </div>

                    {/* Preventive Care Dashboard */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/10 rounded-bl-full -mr-8 -mt-8"></div>
                      <h3 className="text-sm font-bold text-slate-800 mb-2 relative z-10">Preventive Care Benefits</h3>
                      <p className="text-xs text-slate-500 leading-normal mb-4 relative z-10">
                        Your insurance policy covers **2 free annual health examinations**. Schedule your home sample collection slot now:
                      </p>
                      
                      <div className="bg-teal-50/50 border border-teal-100 rounded-lg p-3 mb-4 relative z-10 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-teal-800 uppercase font-bold tracking-wider">Free Checkups Left</span>
                          <p className="text-base font-bold text-teal-700">2 / 2 Sessions</p>
                        </div>
                        <Calendar className="w-8 h-8 text-teal-600 opacity-60" />
                      </div>

                      <button 
                        onClick={() => handleTriggerPreventive(activePatient.id)}
                        disabled={loading}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg text-xs font-bold transition-all relative z-10 shadow-sm disabled:opacity-50"
                      >
                        Schedule Free Blood Draw
                      </button>

                      {preventiveBookingStatus && (
                        <div className={`mt-3 p-2.5 rounded text-[10px] leading-normal border relative z-10 ${
                          preventiveBookingStatus.status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                          preventiveBookingStatus.status === 'sending' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                        }`}>
                          {preventiveBookingStatus.msg}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}
        </div>

      </main>

    </div>
  )
}

export default App
