import { useState, useEffect, useRef } from 'react'
import { 
  Search, Shield, Activity, Calendar, FileText, Settings, AlertTriangle, 
  CheckCircle, Plus, Upload, Send, RefreshCw, BarChart2, User, Landmark, 
  MapPin, PlusCircle, ArrowUpRight, Download, CheckCircle2, Clock, XCircle, LogOut, Trash2, Leaf, Heart
} from 'lucide-react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import CurrentVisitIntake from './components/CurrentVisitIntake.jsx'
import AyushClinicalDashboard from './components/AyushClinicalDashboard.jsx'
import AyusevaLogin from './components/AyusevaLogin.jsx'

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:8000"

const formatToIndianDate = (text) => {
  if (!text) return '';
  const str = String(text);
  return str.replace(/\b(\d{4})[-:]\s*(\d{2})[-:]\s*(\d{2})\b/g, '$3-$2-$1');
};

const parseRawPythonOrJson = (str) => {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  const cleanStr = trimmed.replace(/^[-*\d.]+\s*/, '').trim();
  
  if ((cleanStr.startsWith('{') && cleanStr.endsWith('}')) || (cleanStr.startsWith('[') && cleanStr.endsWith(']'))) {
    try {
      const sanitized = cleanStr
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, 'null')
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false');
      return JSON.parse(sanitized);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const parseMedicationItem = (item) => {
  if (!item) return { name: 'N/A', dosage: 'N/A', frequency: 'N/A' };
  
  if (typeof item === 'object') {
    return {
      name: item.name || item.Name || 'N/A',
      dosage: item.dosage || item.Dosage || 'N/A',
      frequency: item.frequency || item.Frequency || 'N/A',
      source: item.source || item.Source || ''
    };
  }
  
  if (typeof item === 'string') {
    const parsed = parseRawPythonOrJson(item);
    if (parsed && typeof parsed === 'object') {
      return {
        name: parsed.name || parsed.Name || 'N/A',
        dosage: parsed.dosage || parsed.Dosage || 'N/A',
        frequency: parsed.frequency || parsed.Frequency || 'N/A',
        source: parsed.source || parsed.Source || ''
      };
    }
    return {
      name: item,
      dosage: 'N/A',
      frequency: 'N/A'
    };
  }
  
  return { name: 'N/A', dosage: 'N/A', frequency: 'N/A' };
};

const parseActiveProblemItem = (item) => {
  if (!item) return '';
  if (typeof item === 'object') {
    return item.name || item.diagnosis || item.problem || JSON.stringify(item);
  }
  if (typeof item === 'string') {
    const parsed = parseRawPythonOrJson(item);
    if (parsed && typeof parsed === 'object') {
      return parsed.name || parsed.diagnosis || parsed.problem || JSON.stringify(parsed);
    }
    return item;
  }
  return String(item);
};

const renderParsedDataReact = (data, idx) => {
  if (!data) return null;
  
  if (Array.isArray(data)) {
    return (
      <div key={idx} className="space-y-1 mt-1">
        {data.map((item, subIdx) => renderParsedDataReact(item, subIdx))}
      </div>
    );
  }
  
  if (typeof data === 'object') {
    const getField = (keys) => {
      for (const k of keys) {
        const foundKey = Object.keys(data).find(ok => ok.toLowerCase() === k.toLowerCase());
        if (foundKey) return data[foundKey];
      }
      return null;
    };
    
    const dateVal = formatToIndianDate(getField(['date', 'time', 'record_date']));
    const eventVal = getField(['event', 'diagnosis', 'title', 'name']);
    
    const detailsList = [];
    Object.entries(data).forEach(([k, v]) => {
      const kl = k.toLowerCase();
      if (!['date', 'time', 'record_date', 'event', 'diagnosis', 'title', 'name'].includes(kl)) {
        if (v !== null && v !== undefined && String(v).trim()) {
          const cleanK = k.replace(/_/g, ' ').replace(/key findings/gi, 'findings');
          detailsList.push(`${cleanK}: ${formatToIndianDate(String(v))}`);
        }
      }
    });
    
    const detailsStr = detailsList.join(', ');
    
    return (
      <div key={idx} className="text-xs text-slate-700 leading-relaxed font-normal py-0.5">
        {dateVal && <strong className="text-slate-800 font-bold">{dateVal}: </strong>}
        {eventVal && <span className="font-semibold text-slate-700">{eventVal}</span>}
        {detailsStr && <span className="text-slate-600">{eventVal ? `: ${detailsStr}` : detailsStr}</span>}
      </div>
    );
  }
  
  return <p key={idx} className="text-xs text-slate-655 leading-relaxed py-0.5">{String(data)}</p>;
};

const renderParsedDataHTML = (data) => {
  if (!data) return '';
  
  if (Array.isArray(data)) {
    return data.map(item => renderParsedDataHTML(item)).join('');
  }
  
  if (typeof data === 'object') {
    const getField = (keys) => {
      for (const k of keys) {
        const foundKey = Object.keys(data).find(ok => ok.toLowerCase() === k.toLowerCase());
        if (foundKey) return data[foundKey];
      }
      return null;
    };
    
    const dateVal = formatToIndianDate(getField(['date', 'time', 'record_date']));
    const eventVal = getField(['event', 'diagnosis', 'title', 'name']);
    
    const detailsList = [];
    Object.entries(data).forEach(([k, v]) => {
      const kl = k.toLowerCase();
      if (!['date', 'time', 'record_date', 'event', 'diagnosis', 'title', 'name'].includes(kl)) {
        if (v !== null && v !== undefined && String(v).trim()) {
          const cleanK = k.replace(/_/g, ' ').replace(/key findings/gi, 'findings');
          detailsList.push(`${cleanK}: ${formatToIndianDate(String(v))}`);
        }
      }
    });
    
    const detailsStr = detailsList.join(', ');
    
    let html = `<div style="font-size: 11px; color: #334155; margin: 3px 0; line-height: 1.5;">`;
    if (dateVal) {
      html += `<strong style="color: #1e293b; font-weight: bold;">${dateVal}: </strong>`;
    }
    if (eventVal) {
      html += `<span style="font-weight: 600; color: #334155;">${eventVal}</span>`;
    }
    if (detailsStr) {
      html += `<span style="color: #475569;">${eventVal ? `: ${detailsStr}` : detailsStr}</span>`;
    }
    html += `</div>`;
    return html;
  }
  
  return `<p style="font-size: 11px; color: #334155; margin: 3px 0;">${String(data)}</p>`;
};

const parseInlineDictOrList = (line) => {
  if (typeof line !== 'string') return null;
  const trimmed = line.trim();
  
  const startIdx = trimmed.indexOf('[');
  const startObjIdx = trimmed.indexOf('{');
  
  let jsonStart = -1;
  if (startIdx !== -1 && startObjIdx !== -1) {
    jsonStart = Math.min(startIdx, startObjIdx);
  } else {
    jsonStart = startIdx !== -1 ? startIdx : startObjIdx;
  }
  
  if (jsonStart !== -1) {
    const prefix = trimmed.substring(0, jsonStart).trim().replace(/^[-*\d.]+\s*/, '').trim();
    const possibleJson = trimmed.substring(jsonStart).trim();
    
    const parsed = parseRawPythonOrJson(possibleJson);
    if (parsed) {
      return { prefix, parsed };
    }
  }
  return null;
};

const renderInlineParsedReact = (prefix, parsed, idx) => {
  if (!parsed) return null;
  const cleanPrefix = prefix ? prefix.replace(/:$/, '').trim() : '';
  
  const formatObj = (item) => {
    if (typeof item === 'object' && item !== null) {
      const name = item.name || item.Name || '';
      const dosage = item.dosage || item.Dosage || '';
      const frequency = item.frequency || item.Frequency || '';
      
      const parts = [name, dosage, frequency].map(p => String(p).trim()).filter(Boolean);
      return parts.join(' — ');
    }
    return String(item);
  };
  
  if (Array.isArray(parsed)) {
    return (
      <div key={idx} className="text-xs text-slate-705 leading-relaxed font-normal py-0.5">
        {cleanPrefix && <strong className="text-slate-800 font-bold block mb-0.5">{cleanPrefix}:</strong>}
        <div className="pl-3 space-y-0.5">
          {parsed.map((item, subIdx) => (
            <div key={subIdx}>
              • {formatObj(item)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (typeof parsed === 'object') {
    return (
      <div key={idx} className="text-xs text-slate-705 leading-relaxed font-normal py-0.5">
        {cleanPrefix && <strong className="text-slate-800 font-bold">{cleanPrefix}: </strong>}
        {Object.entries(parsed).map(([k, v], subIdx) => (
          <span key={subIdx} className="mr-2">
            <strong className="capitalize text-slate-800">{k.replace(/_/g, ' ')}:</strong> {formatToIndianDate(String(v))}
          </span>
        ))}
      </div>
    );
  }
  
  return (
    <div key={idx} className="text-xs text-slate-705 leading-relaxed py-0.5">
      {cleanPrefix && <strong className="text-slate-800 font-bold">{cleanPrefix}: </strong>}
      {String(parsed)}
    </div>
  );
};

const renderInlineParsedHTML = (prefix, parsed) => {
  if (!parsed) return '';
  const cleanPrefix = prefix ? prefix.replace(/:$/, '').trim() : '';
  
  const formatObj = (item) => {
    if (typeof item === 'object' && item !== null) {
      const name = item.name || item.Name || '';
      const dosage = item.dosage || item.Dosage || '';
      const frequency = item.frequency || item.Frequency || '';
      
      const parts = [name, dosage, frequency].map(p => String(p).trim()).filter(Boolean);
      return parts.join(' — ');
    }
    return String(item);
  };
  
  if (Array.isArray(parsed)) {
    let html = `<div style="font-size: 11px; color: #334155; margin: 3px 0; line-height: 1.5;">`;
    if (cleanPrefix) {
      html += `<strong style="color: #1e293b; display: block; margin-bottom: 2px;">${cleanPrefix}:</strong>`;
    }
    html += `<div style="padding-left: 10px;">`;
    parsed.forEach(item => {
      html += `<div>&bull; ${formatObj(item)}</div>`;
    });
    html += `</div></div>`;
    return html;
  }
  
  if (typeof parsed === 'object') {
    let html = `<div style="font-size: 11px; color: #334155; margin: 3px 0; line-height: 1.5;">`;
    if (cleanPrefix) {
      html += `<strong style="color: #1e293b; font-weight: bold;">${cleanPrefix}: </strong>`;
    }
    Object.entries(parsed).forEach(([k, v]) => {
      html += `<span style="margin-right: 8px;"><strong style="text-transform: capitalize; color: #334155;">${k.replace(/_/g, ' ')}:</strong> ${formatToIndianDate(String(v))}</span>`;
    });
    html += `</div>`;
    return html;
  }
  
  return `<div style="font-size: 11px; color: #334155; margin: 3px 0;"><strong>${cleanPrefix}:</strong> ${String(parsed)}</div>`;
};

const getTodayIndianDate = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getFileUrl = (path) => {
  if (!path) return '#'
  const cleanPath = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '')
  return `${BASE_URL}/${cleanPath}`
}

const parseSections = (summary) => {
  if (typeof summary !== 'string') return [];
  const lines = summary.split('\n').map(l => l.trim()).filter(Boolean);
  
  const isHeading = (line) => {
    const clean = line.replace(/[*#]/g, '').trim();
    if (!clean) return false;
    
    const commonHeadings = [
      'overview', 'clinical progression', 'clinical: progression', 
      'current status', 'diagnoses directory', 'active prescription profile', 
      'lab vitals progression', 'treatment plan', 'recommendations', 
      'past history', 'history of present illness', 'clinical alert warnings',
      'clinical summary', 'active diagnoses', 'active prescriptions', 'lab progression'
    ];
    if (commonHeadings.includes(clean.toLowerCase())) {
      return true;
    }
    if (/(summary|profile|directory|progression|timeline)$/i.test(clean)) {
      return true;
    }
    if (clean === clean.toUpperCase() && /[A-Z]/.test(clean) && clean.length > 2 && clean.length < 50) {
      return true;
    }
    if (line.trim().startsWith('#')) {
      return true;
    }
    return false;
  };

  const sections = [];
  let currentSection = { heading: null, items: [] };

  lines.forEach(line => {
    if (isHeading(line)) {
      if (currentSection.heading || currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { heading: line.replace(/[*#:]/g, '').trim(), items: [] };
    } else {
      currentSection.items.push(line);
    }
  });

  if (currentSection.heading || currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections;
};
const formatPDFSummary = (summary) => {
  if (!summary) return '';
  
  if (typeof summary === 'string') {
    const parsed = parseRawPythonOrJson(summary);
    if (parsed) {
      return renderParsedDataHTML(parsed);
    }
  }

  if (Array.isArray(summary)) {
    return summary.map(item => `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 8px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px; color: #0f766e;">
          <span>${formatToIndianDate(item.date || item.Date || 'N/A')}</span>
          <span>${item.event || item.Event || 'Event'}</span>
        </div>
        ${item.findings ? `<div><strong>Findings:</strong> ${formatToIndianDate(item.findings)}</div>` : ''}
        ${item.treatment ? `<div><strong>Treatment:</strong> ${formatToIndianDate(item.treatment)}</div>` : ''}
        ${item.explanation ? `<div><strong>Notes:</strong> ${formatToIndianDate(item.explanation)}</div>` : ''}
      </div>
    `).join('');
  }

  if (typeof summary === 'string') {
    const sections = parseSections(summary);
    return sections.map(section => {
      let html = '';
      if (section.heading) {
        html += `
          <div style="font-size: 11px; font-weight: bold; color: #0f766e; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 3px; margin-top: 14px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${section.heading}
          </div>
        `;
      }
      if (section.items.length > 0) {
        html += `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; font-size: 11px; line-height: 1.6; color: #334155;">
        `;
        section.items.forEach(line => {
          const inlineParsed = parseInlineDictOrList(line);
          if (inlineParsed && inlineParsed.prefix) {
            html += renderInlineParsedHTML(inlineParsed.prefix, inlineParsed.parsed);
            return;
          }
          const parsedLine = parseRawPythonOrJson(line);
          if (parsedLine) {
            html += renderParsedDataHTML(parsedLine);
            return;
          }
          const isBullet = line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line);
          const cleanLine = formatToIndianDate(line.replace(/^[-*\d.]+\s*/, '').trim());
          
          if (isBullet) {
            const match = cleanLine.match(/^(.*?)(\s+[-—]+\s*|\s*[-—]+\s+|:\s+)(.*?)$/);
            if (match && match[1] && match[3] && match[1].length < 40) {
              const label = match[1].replace(/[*#]/g, '').trim();
              const details = match[3].replace(/[*#]/g, '').trim();
              html += `
                <div style="margin: 4px 0;">
                  <strong>${label}:</strong> ${details}
                </div>
              `;
            } else {
              html += `
                <div style="margin: 4px 0;">
                  &bull; ${cleanLine}
                </div>
              `;
            }
          } else {
            html += `
              <p style="margin: 6px 0;">
                ${cleanLine}
              </p>
            `;
          }
        });
        html += `
          </div>
        `;
      }
      return html;
    }).join('');
  }
  return summary;
};

const renderClinicalSummary = (summary) => {
  if (!summary) return null;

  // Pre-parse stringified objects/arrays
  if (typeof summary === 'string') {
    const parsed = parseRawPythonOrJson(summary);
    if (parsed) {
      return renderParsedDataReact(parsed, 0);
    }
  }

  if (typeof summary === 'object' && summary !== null && !Array.isArray(summary)) {
    return (
      <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
        {Object.entries(summary).map(([key, val]) => (
          <div key={key} className="text-xs text-slate-655 leading-relaxed">
            <strong className="text-teal-755 capitalize text-teal-850">{key.replace(/_/g, ' ').replace(/SUMMARY/gi, 'Summary')}:</strong>{' '}
            {typeof val === 'object' && val !== null ? (
              <div className="pl-3 mt-1 space-y-1">
                {Object.entries(val).map(([sk, sv]) => (
                  <div key={sk}>
                    <strong className="text-slate-700 capitalize">{sk}:</strong> {formatToIndianDate(String(sv))}
                  </div>
                ))}
              </div>
            ) : formatToIndianDate(String(val))}
          </div>
        ))}
      </div>
    );
  }
  
  if (Array.isArray(summary)) {
    return (
      <div className="space-y-2.5">
        {summary.map((item, idx) => (
          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
              <span className="text-[11px] font-bold text-teal-750 bg-teal-50 px-2 py-0.5 rounded">
                {formatToIndianDate(item.date || item.Date || 'N/A')}
              </span>
              <span className="text-[11px] font-bold text-slate-800">
                {item.event || item.Event || 'Medical Event'}
              </span>
            </div>
            {item.findings && (
              <div className="text-xs text-slate-600">
                <strong>Findings:</strong> {formatToIndianDate(item.findings)}
              </div>
            )}
            {item.treatment && (
              <div className="text-xs text-slate-600">
                <strong>Treatment/Change:</strong> {formatToIndianDate(item.treatment)}
              </div>
            )}
            {item.explanation && (
              <div className="text-xs text-slate-600">
                <strong>Clinical Notes:</strong> {formatToIndianDate(item.explanation)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof summary === 'string') {
    const sections = parseSections(summary);
    
    return (
      <div className="space-y-3">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-2">
            {section.heading && (
              <h4 className="text-xs font-bold uppercase tracking-wider mt-3 mb-1.5 pb-1 border-b border-teal-100/60 flex items-center gap-1.5 text-teal-850">
                {section.heading}
              </h4>
            )}
            {section.items.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                {section.items.map((line, lIdx) => {
                  const inlineParsed = parseInlineDictOrList(line);
                  if (inlineParsed && inlineParsed.prefix) {
                    return renderInlineParsedReact(inlineParsed.prefix, inlineParsed.parsed, lIdx);
                  }
                  const parsedLine = parseRawPythonOrJson(line);
                  if (parsedLine) {
                    return renderParsedDataReact(parsedLine, lIdx);
                  }
                  
                  const isBullet = line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line);
                  const cleanLine = formatToIndianDate(line.replace(/^[-*\d.]+\s*/, '').trim());
                  
                  if (isBullet) {
                    const match = cleanLine.match(/^(.*?)(\s+[-—]+\s*|\s*[-—]+\s+|:\s+)(.*?)$/);
                    if (match && match[1] && match[3] && match[1].length < 40) {
                      const label = match[1].replace(/[*#]/g, '').trim();
                      const details = match[3].replace(/[*#]/g, '').trim();
                      return (
                        <div key={lIdx} className="text-xs text-slate-705 leading-relaxed">
                          <strong className="text-slate-800 font-bold">{label}:</strong> {details}
                        </div>
                      );
                    }
                    return (
                      <div key={lIdx} className="text-xs text-slate-655 leading-relaxed">
                        • {cleanLine}
                      </div>
                    );
                  }
                  
                  return (
                    <p key={lIdx} className="text-xs text-slate-650 leading-relaxed font-normal">
                      {cleanLine}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
      {formatToIndianDate(summary)}
    </p>
  );
};
const downloadBriefPDF = (patient, brief) => {
  if (!patient || !brief) return;
  const printWindow = window.open('', '_blank');
  const printContent = `
    <html>
    <head>
      <title>AyuSeva ${brief.selected_context ? brief.selected_context + ' ' : ''}Clinical Summary - ${patient.name || 'N/A'}</title>
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
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Longitudinal Clinical Brief & CDSS Summary ${brief.selected_context ? `(Context: ${brief.selected_context})` : `(Mode: ${brief.summary_type.toUpperCase()})`}</div>
        </div>
        <div class="date">Report Generated: ${getTodayIndianDate()}</div>
      </div>
      <div class="patient-info">
        <div><strong>Patient Name:</strong> ${patient.name || 'N/A'}</div>
        <div><strong>Patient UID:</strong> ${patient.id}</div>
        <div><strong>Date of Birth:</strong> ${formatToIndianDate(patient.dob) || 'N/A'}</div>
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
      <div class="section-title">${brief.selected_context ? `${brief.selected_context} Summary` : 'Clinical Summary'}</div>
      <div class="summary-text">${formatPDFSummary(brief.clinical_summary)}</div>
      
      <div class="section-title">Active Diagnoses</div>
      <ul style="font-size: 13px; color: #334155; margin-left: 20px; padding: 0;">
        ${brief.active_problems.map(p => `<li style="margin-bottom: 4px;">${parseActiveProblemItem(p)}</li>`).join('')}
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
          ${brief.current_medications && brief.current_medications.length > 0 ? brief.current_medications.map(item => {
            const m = parseMedicationItem(item);
            return `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.dosage}</td>
                <td>${m.frequency}</td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No active medications found in EMR.</td></tr>'}
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
  // Toast & Notifications System
  const [toasts, setToasts] = useState([]);
  
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const alert = (message) => {
    const msgLower = String(message).toLowerCase();
    let type = 'success';
    if (msgLower.includes('error') || msgLower.includes('fail') || msgLower.includes('unable') || msgLower.includes('please') || msgLower.includes('invalid') || msgLower.includes('cancellation')) {
      type = 'error';
    } else if (msgLower.includes('warning') || msgLower.includes('alert') || msgLower.includes('first')) {
      type = 'warning';
    }
    showToast(message, type);
  };

  // Authentication & Layout States
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || null) // null | 'admin' | 'patient'
  const [adminUsername, setAdminUsername] = useState(() => localStorage.getItem('adminUsername') || '')
  const [adminView, setAdminView] = useState(() => {
    const hash = window.location.hash
    if (hash && hash.startsWith('#/')) {
      const parts = hash.substring(2).split('/')
      const validAdminViews = ['overview', 'medikiosk', 'ayush', 'register', 'patients', 'patient-profile', 'records', 'emergency', 'settings']
      if (parts[0] === 'admin' && validAdminViews.includes(parts[1])) {
        return parts[1]
      }
    }
    return 'overview'
  }) // 'overview' | 'register' | 'patients' | 'patient-profile' | 'emergency' | 'records' | 'settings'

  const [patientRecordsPage, setPatientRecordsPage] = useState(1)

  // Predefined Admin logins
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginPatientId, setLoginPatientId] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginTab, setLoginTab] = useState('admin') // 'admin' | 'patient'
  
  // Patient / Clinical State
  const [patientId, setPatientId] = useState('') // For patient search inputs
  const [activePatient, setActivePatient] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [clinicalBrief, setClinicalBrief] = useState(null)
  const [claims, setClaims] = useState([])
  const [allPatients, setAllPatients] = useState([])
  
  // Registration Form State
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regDob, setRegDob] = useState('')
  const [regHasInsurance, setRegHasInsurance] = useState('NO')
  const [regInsuranceFile, setRegInsuranceFile] = useState(null)
  const [newlyRegisteredPatient, setNewlyRegisteredPatient] = useState(null)

  // Global Activity Feed (Admin only)
  const [globalRecords, setGlobalRecords] = useState([])
  const [globalRecordsLoading, setGlobalRecordsLoading] = useState(false)

  // Patient / Record Deletion Modals
  const [showDeletePatientModal, setShowDeletePatientModal] = useState(false)
  const [showDeleteRecordModal, setShowDeleteRecordModal] = useState(null) // holds the record object to delete
  const [selectedRecordForView, setSelectedRecordForView] = useState(null) // holds the record object to view in detail modal
  const [showActionsMenu, setShowActionsMenu] = useState(false) // holds actions dropdown state
  const [showChartModal, setShowChartModal] = useState(false) // holds lab trends chart modal state
  
  // Insurance State hooks
  const [insuranceData, setInsuranceData] = useState({ active_policy: null, previous_policies: [] })
  const [insuranceLoading, setInsuranceLoading] = useState(false)
  const [insuranceUploading, setInsuranceUploading] = useState(false)
  const [archiveConfirmPolicyId, setArchiveConfirmPolicyId] = useState(null)
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false)
  const [deleteConfirmPolicyId, setDeleteConfirmPolicyId] = useState(null)

  // Cashless Claims State hooks
  const [activeClaim, setActiveClaim] = useState(null)
  const [isCreatingClaim, setIsCreatingClaim] = useState(false)
  const [claimInitializing, setClaimInitializing] = useState(false)
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  
  // Preventive checkups State hooks
  const [checkups, setCheckups] = useState([])
  const [checkupsLoading, setCheckupsLoading] = useState(false)
  const [activePreviewEmail, setActivePreviewEmail] = useState(null)

  // Personal Documents State hooks
  const [personalDocs, setPersonalDocs] = useState([])
  const [personalDocsUsage, setPersonalDocsUsage] = useState(0) // In bytes
  const [personalDocsLimit, setPersonalDocsLimit] = useState(2 * 1024 * 1024 * 1024) // 2 GB
  const [personalDocsLoading, setPersonalDocsLoading] = useState(false)
  const [personalDocsUploading, setPersonalDocsUploading] = useState(false)
  const [personalDocsError, setPersonalDocsError] = useState(null)

  // UI status states
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [claimDispatchStatus, setClaimDispatchStatus] = useState(null)
  const [preventiveBookingStatus, setPreventiveBookingStatus] = useState(null)
  const [activeSpecialty, setActiveSpecialty] = useState('General')
  const [activeSummaryMode, setActiveSummaryMode] = useState('complete')
  const [clinicalContexts, setClinicalContexts] = useState([])
  const [selectedContextId, setSelectedContextId] = useState(null)
  const [contextsLoaded, setContextsLoaded] = useState(false)
  const [currentVisitReason, setCurrentVisitReason] = useState('')
  const [showExcludedHistory, setShowExcludedHistory] = useState(false)
  const [showSummarySelector, setShowSummarySelector] = useState(false)
  const [downloadingSummary, setDownloadingSummary] = useState(false)
  const [briefLoading, setBriefLoading] = useState(false)
  const patientLoadSeq = useRef(0)
  const activeUidRef = useRef(null)
  
  // Active test selection for chart
  const [selectedChartTest, setSelectedChartTest] = useState('')
  const [patientsSearchQuery, setPatientsSearchQuery] = useState('')

  const isHistoryUpdate = useRef(false)
  const isFirstRender = useRef(true)

  // Load all patients on mount & initialize history state
  useEffect(() => {
    fetchPatientsList()
    
    const savedRole = localStorage.getItem('userRole')
    const savedPatientUid = localStorage.getItem('patientUid')
    
    let initialRole = null
    let initialView = 'overview'
    let initialPatientId = null

    // Parse current URL hash
    const hash = window.location.hash
    let hashRole = null
    let hashView = null
    let hashPatientId = null

    if (hash && hash.startsWith('#/')) {
      const parts = hash.substring(2).split('/')
      if (parts[0]) hashRole = parts[0]
      if (parts[1]) hashView = parts[1]
      if (parts[2]) hashPatientId = parts[2]
    }

    if (savedRole === 'admin') {
      initialRole = 'admin'
      setUserRole('admin')
      
      // Validate views for admin
      const validAdminViews = ['overview', 'medikiosk', 'ayush', 'register', 'patients', 'patient-profile', 'records', 'emergency', 'settings', 'insurance']
      if (hashRole === 'admin' && validAdminViews.includes(hashView)) {
        initialView = hashView
        setAdminView(hashView)
        if ((hashView === 'patient-profile' || hashView === 'insurance' || hashView === 'medikiosk' || hashView === 'ayush') && hashPatientId) {
          initialPatientId = hashPatientId
          fetchPatientData(hashPatientId)
        }
      } else {
        initialView = 'overview'
        setAdminView('overview')
      }
      fetchGlobalRecords()
    } else if (savedRole === 'patient' && savedPatientUid) {
      initialRole = 'patient'
      setUserRole('patient')
      
      // Validate views for patient
      const validPatientViews = ['overview', 'current-intake', 'records', 'documents', 'insurance']
      if (hashRole === 'patient' && validPatientViews.includes(hashView)) {
        initialView = hashView
        setAdminView(hashView)
      } else {
        initialView = 'overview'
        setAdminView('overview')
      }
      initialPatientId = savedPatientUid
      handlePatientRestore(savedPatientUid)
    } else {
      // Not logged in or invalid session
      setUserRole(null)
      initialRole = 'login'
      initialView = 'overview'
    }

    if (!window.history.state) {
      window.history.replaceState(
        { role: initialRole, view: initialView, patientId: initialPatientId },
        '',
        `#/${initialRole || 'login'}/${initialView}${initialPatientId ? `/${initialPatientId}` : ''}`
      );
    }
  }, [])

  // Push state to browser history on layout/patient state changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    
    if (isHistoryUpdate.current) {
      isHistoryUpdate.current = false
      return
    }
    
    const stateObj = { role: userRole, view: adminView, patientId: activePatient?.id }
    const hash = `#/${userRole || 'login'}/${adminView}${activePatient ? `/${activePatient.id}` : ''}`
    
    let shouldReplace = false
    const previousState = window.history.state
    if (previousState && previousState.role === userRole) {
      const sidebarViews = ['register', 'patients', 'records', 'emergency', 'settings']
      const isPrevSidebar = sidebarViews.includes(previousState.view)
      const isCurrentSidebar = sidebarViews.includes(adminView)
      
      if (isPrevSidebar && isCurrentSidebar) {
        shouldReplace = true
      }
    }
    
    if (!window.history.state || 
        window.history.state.view !== adminView || 
        window.history.state.role !== userRole || 
        window.history.state.patientId !== activePatient?.id) {
      if (shouldReplace) {
        window.history.replaceState(stateObj, '', hash)
      } else {
        window.history.pushState(stateObj, '', hash)
      }
    }
  }, [adminView, userRole, activePatient?.id])

  // Listen to popstate event for back/forward navigation
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state
      if (state) {
        isHistoryUpdate.current = true
        setUserRole(state.role)
        setAdminView(state.view)
        if (state.patientId) {
          fetchPatientData(state.patientId)
        } else {
          clearPatientScopedState()
        }
      } else {
        // Fallback to default
        const savedRole = localStorage.getItem('userRole')
        if (savedRole === 'admin') {
          isHistoryUpdate.current = true
          setUserRole('admin')
          setAdminView('overview')
        } else if (savedRole === 'patient') {
          const savedPatientUid = localStorage.getItem('patientUid')
          if (savedPatientUid) {
            isHistoryUpdate.current = true
            handlePatientRestore(savedPatientUid)
          }
        } else {
          isHistoryUpdate.current = true
          setUserRole(null)
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Auto-fetch details if adminView is changed to overview or records
  useEffect(() => {
    if (userRole === 'admin' && (adminView === 'overview' || adminView === 'records')) {
      fetchGlobalRecords()
    }
  }, [adminView, userRole])

  const fetchPatientsList = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/patients/`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setAllPatients(data)
        } else {
          console.warn("Expected array of patients, got:", data)
          setAllPatients([])
        }
      }
    } catch (err) {
      console.error("Failed to load patients list:", err)
    }
  }

  const fetchGlobalRecords = async () => {
    setGlobalRecordsLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/records/`)
      if (res.ok) {
        const data = await res.json()
        setGlobalRecords(data)
      }
    } catch (err) {
      console.error("Failed to load global records list:", err)
    } finally {
      setGlobalRecordsLoading(false)
    }
  }

  const clearPatientScopedState = () => {
    setActivePatient(null)
    setTimeline([])
    setClaims([])
    setClinicalBrief(null)
    setClinicalContexts([])
    setSelectedContextId(null)
    setContextsLoaded(false)
    setClaimDispatchStatus(null)
    setPreventiveBookingStatus(null)
    setActiveSummaryMode('complete')
    setCurrentVisitReason('')
    setShowExcludedHistory(false)
    setSelectedChartTest('')
    setShowSummarySelector(false)
    setDownloadingSummary(false)
    setBriefLoading(false)
    setActiveClaim(null)
    setIsCreatingClaim(false)
    setClaimInitializing(false)
    setClaimSubmitting(false)
  }

  // Restore Patient Session from localStorage
  const handlePatientRestore = async (uid) => {
    setLoading(true)
    try {
      await fetchPatientData(uid)
      setUserRole('patient')
    } catch (err) {
      console.error("Failed to restore patient session:", err)
      handleLogout()
    } finally {
      setLoading(false)
    }
  }

  const fetchPatientInsurance = async (uid) => {
    if (!uid) return
    setInsuranceLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/insurance/patient/${uid}`)
      if (!res.ok) throw new Error("Failed to fetch insurance data")
      const data = await res.json()
      setInsuranceData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setInsuranceLoading(false)
    }
  }

  const fetchCheckups = async (uid) => {
    if (!uid) return
    setCheckupsLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/insurance/patient/${uid}/checkups`)
      if (!res.ok) throw new Error("Failed to fetch checkups")
      const data = await res.json()
      setCheckups(data.checkups || [])
    } catch (err) {
      console.error("Error fetching checkups:", err)
    } finally {
      setCheckupsLoading(false)
    }
  }

  const scheduleCheckupSlot = async (policyId, slotNum, date) => {
    if (!activePatient) return
    setCheckupsLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/insurance/policy/${policyId}/checkup/${slotNum}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_date: date })
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to schedule checkup")
      }
      await fetchCheckups(activePatient.id)
    } catch (err) {
      alert("Scheduling Error: " + err.message)
    } finally {
      setCheckupsLoading(false)
    }
  }

  const simulateCheckupNotification = async (checkupId) => {
    if (!activePatient) return
    setCheckupsLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/insurance/checkup/${checkupId}/simulate-notification`, {
        method: "POST"
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to simulate notification")
      }
      const data = await res.json()
      setActivePreviewEmail(data.email)
      await fetchCheckups(activePatient.id)
    } catch (err) {
      alert("Simulation Error: " + err.message)
    } finally {
      setCheckupsLoading(false)
    }
  }

  const cancelCheckupSlot = async (checkupId) => {
    if (!activePatient) return
    setCheckupsLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/insurance/checkup/${checkupId}/cancel`, {
        method: "POST"
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to cancel checkup")
      }
      await fetchCheckups(activePatient.id)
    } catch (err) {
      alert("Cancellation Error: " + err.message)
    } finally {
      setCheckupsLoading(false)
    }
  }

  const fetchPersonalDocs = async (uid) => {
    if (!uid) return
    setPersonalDocsLoading(true)
    setPersonalDocsError(null)
    try {
      const res = await fetch(`${BASE_URL}/api/personal-documents/patient/${uid}`)
      if (!res.ok) throw new Error("Failed to fetch personal documents")
      const data = await res.json()
      setPersonalDocs(data.documents || [])
      setPersonalDocsUsage(data.total_usage_bytes || 0)
      setPersonalDocsLimit(data.storage_limit_bytes || 2 * 1024 * 1024 * 1024)
    } catch (err) {
      console.error(err)
      setPersonalDocsError(err.message)
    } finally {
      setPersonalDocsLoading(false)
    }
  }

  const uploadPersonalDoc = async (file) => {
    if (!activePatient || !file) return
    setPersonalDocsUploading(true)
    setPersonalDocsError(null)
    
    // Client-side quick check
    if (personalDocsUsage + file.size > personalDocsLimit) {
      setPersonalDocsError("The 2 GB personal storage limit would be exceeded.")
      setPersonalDocsUploading(false)
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("patient_id", activePatient.id)

    try {
      const res = await fetch(`${BASE_URL}/api/personal-documents/upload`, {
        method: "POST",
        body: formData
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to upload document")
      }
      // Reload documents and usage
      await fetchPersonalDocs(activePatient.id)
    } catch (err) {
      console.error(err)
      setPersonalDocsError(err.message)
    } finally {
      setPersonalDocsUploading(false)
    }
  }

  const deletePersonalDoc = async (docId) => {
    if (!activePatient) return
    setPersonalDocsLoading(true)
    setPersonalDocsError(null)
    try {
      const res = await fetch(`${BASE_URL}/api/personal-documents/${docId}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error("Failed to delete document")
      // Reload documents
      await fetchPersonalDocs(activePatient.id)
    } catch (err) {
      console.error(err)
      setPersonalDocsError(err.message)
    } finally {
      setPersonalDocsLoading(false)
    }
  }

  const fetchPatientData = async (uid) => {
    if (!uid) {
      clearPatientScopedState()
      setPatientId('')
      setLoading(false)
      return
    }
    const seq = ++patientLoadSeq.current
    activeUidRef.current = uid
    setLoading(true)
    clearPatientScopedState()
    
    try {
      const headers = {
        'X-User-Role': userRole || 'admin',
        'X-Patient-UID': uid || ''
      }

      // 1. Fetch Timeline (this patient only)
      const timelineRes = await fetch(`${BASE_URL}/api/patients/${uid}/timeline`, { headers })
      if (seq !== patientLoadSeq.current) return
      if (!timelineRes.ok) {
        throw new Error(`Patient ${uid} not found`)
      }
      const timelineData = await timelineRes.json()
      if (seq !== patientLoadSeq.current) return
      setActivePatient(timelineData.patient)
      setTimeline(timelineData.timeline)
      setPatientId(uid)

      // 2. Fetch auto-detected clinical contexts for this patient only
      const ctxRes = await fetch(`${BASE_URL}/api/patients/${uid}/clinical-contexts`, { headers })
      if (seq !== patientLoadSeq.current) return
      let nextMode = 'complete'
      let nextContextId = null
      let nextContexts = []
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json()
        nextContexts = ctxData.contexts || []
        nextContextId = ctxData.default_context_id || (nextContexts.length === 1 ? nextContexts[0].id : null)
        if (nextContextId) {
          nextMode = 'disease'
        }
      }
      setClinicalContexts(nextContexts)
      setSelectedContextId(nextContextId)
      setActiveSummaryMode(nextMode)
      setContextsLoaded(true)

      // 3. Fetch Active Claims
      const claimsRes = await fetch(`${BASE_URL}/api/claims/patient/${uid}`)
      if (seq !== patientLoadSeq.current) return
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json()
        setClaims(claimsData || [])
      } else {
        setClaims([])
      }
      
      // 4. Fetch Insurance Profile
      await fetchPatientInsurance(uid)
      
      // 5. Fetch Personal Documents
      await fetchPersonalDocs(uid)
      
      // 6. Fetch Preventive Checkups
      await fetchCheckups(uid)
      
      // Update patient lookup list in background
      fetchPatientsList()
    } catch (err) {
      if (seq !== patientLoadSeq.current) return
      alert("Error: " + err.message)
      clearPatientScopedState()
      fetchPatientsList()
      throw err
    } finally {
      if (seq === patientLoadSeq.current) {
        setLoading(false)
      }
    }
  }

  const fetchBriefOnly = async (uid, mode, specialty, disease, reason, seq = patientLoadSeq.current) => {
    const timer = setTimeout(() => {
      if (seq === patientLoadSeq.current && activeUidRef.current === uid) {
        setBriefLoading(true)
      }
    }, 250)

    try {
      let url = `${BASE_URL}/api/patients/${uid}/brief?summary_type=${mode}&specialty=${specialty}`
      if (disease && mode === 'disease') url += `&disease_focus=${encodeURIComponent(disease)}`
      if (reason && mode === 'current_visit') url += `&current_visit_reason=${encodeURIComponent(reason)}`
      
      if (userRole === 'patient') {
        url += `&generate_if_missing=false`
      }
      
      const headers = {
        'X-User-Role': userRole || 'admin',
        'X-Patient-UID': uid || ''
      }
      
      const briefRes = await fetch(url, { headers })
      clearTimeout(timer)
      if (seq !== patientLoadSeq.current || activeUidRef.current !== uid) return
      if (briefRes.ok) {
        const briefData = await briefRes.json()
        if (seq !== patientLoadSeq.current || activeUidRef.current !== uid) return
        setClinicalBrief(briefData)
        setBriefLoading(false)
      } else {
        const errData = await briefRes.json()
        console.error("Failed to load clinical brief:", errData.detail)
        // If it's a 404 from the patient portal, represent the missing state cleanly
        if (briefRes.status === 404) {
          setClinicalBrief({
            clinical_summary: errData.detail || "The clinical summary has not been generated by the hospital admin yet.",
            active_problems: [],
            current_medications: [],
            warnings: [],
            treatment_gaps: [],
            relevance_metrics: [],
            clinical_contexts: [],
            selected_context: null
          })
        }
        setBriefLoading(false)
      }
    } catch (err) {
      clearTimeout(timer)
      console.error("Failed to load clinical brief:", err)
      if (seq === patientLoadSeq.current && activeUidRef.current === uid) {
        setBriefLoading(false)
      }
    }
  }

  const applyClinicalContext = (context) => {
    if (!activePatient?.id || !context) return
    setSelectedContextId(context.id)
    setActiveSummaryMode('disease')
    setShowExcludedHistory(false)
  }

  const handleGenerateAndDownloadSummary = async (mode, disease = '') => {
    if (!activePatient?.id) return
    setDownloadingSummary(true)
    try {
      let url = `${BASE_URL}/api/patients/${activePatient.id}/brief?summary_type=${mode}&specialty=General`
      if (mode === 'disease' && disease) {
        url += `&disease_focus=${encodeURIComponent(disease)}`
      }
      if (userRole === 'patient') {
        url += `&generate_if_missing=false`
      }
      
      const headers = {
        'X-User-Role': userRole || 'admin',
        'X-Patient-UID': activePatient.id || ''
      }
      
      const res = await fetch(url, { headers })
      if (res.ok) {
        const briefData = await res.json()
        downloadBriefPDF(activePatient, briefData)
        setShowSummarySelector(false)
      } else {
        const errData = await res.json()
        alert(errData.detail || "Failed to retrieve clinical summary.")
      }
    } catch (err) {
      console.error("Failed to download summary:", err)
      alert("Error: " + err.message)
    } finally {
      setDownloadingSummary(false)
    }
  }

  // Refetch brief when the active patient, context, or summary mode changes
  useEffect(() => {
    if (!activePatient?.id || !contextsLoaded) return
    
    // Safeguard: Ensure the selectedContextId belongs to the current patient's clinical contexts
    const selected = clinicalContexts.find(c => c.id === selectedContextId)
    
    // If summary mode is disease-focused but selected context is not yet loaded/resolved,
    // suppress execution until states synchronize.
    if (activeSummaryMode === 'disease' && !selected) {
      console.log("[REACT STATE GUARD] Suppressing brief fetch: selectedContextId is stale.");
      return
    }

    const disease = activeSummaryMode === 'disease' ? (selected?.label || '') : ''
    fetchBriefOnly(activePatient.id, activeSummaryMode, activeSpecialty, disease, currentVisitReason)
  }, [activePatient?.id, activeSummaryMode, activeSpecialty, currentVisitReason, contextsLoaded, selectedContextId])

  // Handle Patient Registration
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!regName || !regPhone || !regDob) {
      alert("Please fill in all registration fields.")
      return
    }
    if (regHasInsurance === 'YES' && !regInsuranceFile) {
      alert("Please select an insurance document to upload.")
      return
    }
    setLoading(true)
    try {
      // 1. Register Patient
      const res = await fetch(`${BASE_URL}/api/patients/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          dob: regDob,
          insurer: ""
        })
      })
      if (!res.ok) throw new Error("Failed to register patient")
      
      let newPatient = await res.json()
      
      // 2. Upload Insurance Policy Document if YES
      if (regHasInsurance === 'YES' && regInsuranceFile) {
        const formData = new FormData()
        formData.append("file", regInsuranceFile)
        formData.append("patient_id", newPatient.id)
        
        const uploadRes = await fetch(`${BASE_URL}/api/records/upload-insurance`, {
          method: 'POST',
          body: formData
        })
        if (!uploadRes.ok) {
          const errorMsg = await uploadRes.text()
          throw new Error("Failed to parse and save insurance policy: " + errorMsg)
        }
        const uploadData = await uploadRes.json()
        newPatient.policy_details = uploadData.policy_details
      }
      
      setNewlyRegisteredPatient(newPatient)
      
      // Reset registration form
      setRegName('')
      setRegPhone('')
      setRegDob('')
      setRegHasInsurance('NO')
      setRegInsuranceFile(null)
      
      // Update patient lists
      fetchPatientsList()
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

  // Delete Patient profile
  const handleDeletePatient = async (uid) => {
    if (!uid) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/patients/${uid}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const errDetail = await res.json()
        throw new Error(errDetail.detail || "Deletion failed")
      }
      alert(`Patient profile ${uid} and associated timeline records permanently deleted.`)
      setShowDeletePatientModal(false)
      clearPatientScopedState()
      fetchPatientsList()
      setAdminView('patients')
    } catch (err) {
      alert("Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Delete EMR Record
  const handleDeleteRecord = async (recordId) => {
    if (!recordId) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/records/${recordId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const errDetail = await res.json()
        throw new Error(errDetail.detail || "Deletion failed")
      }
      alert("Medical record deleted successfully.")
      setShowDeleteRecordModal(null)
      if (activePatient?.id) {
        fetchPatientData(activePatient.id)
      }
    } catch (err) {
      alert("Error: " + err.message)
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

    const filteredData = rawData.filter(d => 
      d.testName.includes(selectedChartTest.toLowerCase()) || 
      selectedChartTest.toLowerCase().includes(d.testName)
    )

    return filteredData
  }

  const getAvailableTestNames = () => {
    const names = new Set()
    timeline.forEach(record => {
      const results = record.parsed_json?.lab_results
      if (results && Array.isArray(results)) {
        results.forEach(test => {
          if (test.test_name) names.add(test.test_name)
        })
      }
    })
    const arr = Array.from(names)
    // Auto-select first test if none selected
    if (arr.length > 0 && !selectedChartTest) {
      setSelectedChartTest(arr[0])
    }
    return arr
  }

  // Authentication submission handlers
  const handleAdminLoginSubmit = (e) => {
    e.preventDefault()
    setLoginError('')
    if ((loginUsername === 'admin1' && loginPassword === 'password123') ||
        (loginUsername === 'admin2' && loginPassword === 'password456')) {
      setUserRole('admin')
      setAdminUsername(loginUsername)
      setAdminView('overview')
      localStorage.setItem('userRole', 'admin')
      localStorage.setItem('adminUsername', loginUsername)
      fetchGlobalRecords()
    } else {
      setLoginError("Invalid Admin credentials. Use admin1 / password123.")
    }
  }

  const handlePatientLoginSubmit = async (e) => {
    e.preventDefault()
    if (!loginPatientId) {
      setLoginError("Please enter a valid Patient UID.")
      return
    }
    setLoading(true)
    setLoginError('')
    try {
      const res = await fetch(`${BASE_URL}/api/patients/${loginPatientId.toUpperCase()}`)
      if (!res.ok) {
        throw new Error("Patient ID not found in database. Please ask hospital admin to register.")
      }
      const data = await res.json()
      
      await fetchPatientData(data.id)
      
      setUserRole('patient')
      localStorage.setItem('userRole', 'patient')
      localStorage.setItem('patientUid', data.id)
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setUserRole(null)
    setAdminUsername('')
    clearPatientScopedState()
    localStorage.removeItem('userRole')
    localStorage.removeItem('adminUsername')
    localStorage.removeItem('patientUid')
    setLoginUsername('')
    setLoginPassword('')
    setLoginPatientId('')
    setLoginError('')
    setAdminView('overview')
  }

  // Render Login page if not authenticated
  if (userRole === null) {
    const demoPatientId = allPatients.length > 0 ? allPatients[0].id : 'CARE-000000'
    const demoPatientName = allPatients.length > 0 ? allPatients[0].name : 'No Patient Registered Yet'

    const handleQuickPatientLogin = async () => {
      if (allPatients.length > 0) {
        setLoginPatientId(demoPatientId)
        setLoading(true)
        try {
          await fetchPatientData(demoPatientId)
          setUserRole('patient')
          localStorage.setItem('userRole', 'patient')
          localStorage.setItem('patientUid', demoPatientId)
        } catch (err) {
          setLoginError(err.message)
        } finally {
          setLoading(false)
        }
      } else {
        setLoginError("No patients registered yet. Please log in as Admin to register a patient first.")
      }
    }

    return (
      <AyusevaLogin
        loginTab={loginTab}
        setLoginTab={setLoginTab}
        loginUsername={loginUsername}
        setLoginUsername={setLoginUsername}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginPatientId={loginPatientId}
        setLoginPatientId={setLoginPatientId}
        loginError={loginError}
        setLoginError={setLoginError}
        loading={loading}
        handleAdminLoginSubmit={handleAdminLoginSubmit}
        handlePatientLoginSubmit={handlePatientLoginSubmit}
        demoPatientId={demoPatientId}
        demoPatientName={demoPatientName}
        onQuickPatientLogin={handleQuickPatientLogin}
      />
    )
  }

  // Render Patient Portal layout
  if (userRole === 'patient') {
    return (
      <div className="bg-[#F2FBFA] text-[#071A2A] font-sans min-h-screen flex">
        {/* Persisted Sidebar for Patient */}
        <nav className="bg-[#0D3435] text-slate-200 w-72 flex flex-col h-screen fixed left-0 top-0 py-6 px-4 border-r border-[#15615D]/60 z-50 animate-in fade-in slide-in-from-left duration-200">
          <div className="mb-6 px-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-[#08A99D] p-1.5 rounded-lg text-white">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-base text-white leading-none">AyuSeva Portal</h1>
                <p className="text-[10px] text-[#A0B3BD] mt-1 uppercase font-bold tracking-wider">Patient Personal Vault</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0E3837] px-3 py-2.5 rounded-xl border border-[#15615D]/80 mb-6 shrink-0 flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2DD4BF] animate-pulse"></div>
            <span className="text-white font-semibold truncate">
              Patient: {activePatient?.name || "Loading..."}
            </span>
          </div>

          {/* Sidebar Nav Items */}
          <div className="flex-1 overflow-y-auto space-y-1">
            <button 
              onClick={() => setAdminView('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'overview' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <Activity className={`w-4 h-4 ${adminView === 'overview' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Dashboard / Overview
            </button>
            <button 
              onClick={() => setAdminView('current-intake')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'current-intake' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <Clock className={`w-4 h-4 ${adminView === 'current-intake' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Current Visit Intake
            </button>
            <button 
              onClick={() => setAdminView('records')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'records' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <FileText className={`w-4 h-4 ${adminView === 'records' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Health Records
            </button>
            <button 
              onClick={() => setAdminView('documents')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'documents' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <FileText className={`w-4 h-4 ${adminView === 'documents' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Personal Documents
            </button>
            <button 
              onClick={() => setAdminView('insurance')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'insurance' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <Shield className={`w-4 h-4 ${adminView === 'insurance' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Insurance
            </button>
          </div>

          {/* Sidebar Footer Logout */}
          <div className="mt-auto pt-4 border-t border-white/10 shrink-0">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer text-left text-rose-400/90"
            >
              <LogOut className="w-4 h-4" /> Logout Session
            </button>
          </div>
        </nav>

        {/* Main Workspace for Patient */}
        <main className="ml-72 flex-1 flex flex-col h-screen overflow-hidden bg-[#F2FBFA]">
          {/* Top Header */}
          <header className="bg-white border-b border-[#DCE8E8] h-16 flex justify-between items-center px-8 shrink-0 z-40">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-[#071A2A] text-[17px] tracking-tight capitalize">
                {adminView === 'overview' ? 'Personal E-Health Portal' : adminView === 'current-intake' ? 'Current Visit Intake' : adminView === 'records' ? 'My Complete Health Records' : adminView === 'documents' ? 'Personal Documents' : 'My Health Insurance'}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {loading && <RefreshCw className="w-4 h-4 text-[#08A99D] animate-spin" />}
              {activePatient && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-bold leading-tight text-[#071A2A]">{activePatient.name}</p>
                    <p className="text-[10.5px] text-[#71869A] font-mono mt-0.5">UID: {activePatient.id}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#08A99D] text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase">
                    {activePatient.name ? activePatient.name.substring(0, 2) : "PT"}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Scrollable Work Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#F2FBFA]">
            {activePatient ? (
              <>
                {adminView === 'overview' && (
                  <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
                    {/* Patient Welcome Hero */}
                    <div className="bg-[#15615D] text-white rounded-2xl p-6 shadow-sm border border-[#15615D] relative z-10 overflow-hidden">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                          <span className="text-[10px] bg-[#0D3435]/60 text-[#99F6E4] border border-[#2DD4BF]/30 font-bold tracking-wider px-2 py-0.5 rounded uppercase">Patient E-Health Portal</span>
                          <h2 className="text-xl font-bold mt-2">Welcome Back, {activePatient.name || "AyuSeva User"}!</h2>
                          <p className="text-xs text-white/80 mt-1 max-w-md leading-relaxed">
                            Access your unified health timeline, track cashless claims, and view insurance checkup benefits.
                          </p>
                          {clinicalBrief && (
                            <div className="relative">
                              <button 
                                onClick={() => setShowSummarySelector(!showSummarySelector)}
                                disabled={downloadingSummary}
                                className="mt-4 flex items-center gap-2 bg-[#08A99D] hover:bg-[#079388] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 w-fit disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                              >
                                {downloadingSummary ? (
                                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                                ) : (
                                  <FileText className="w-4.5 h-4.5" />
                                )}
                                {downloadingSummary ? "Generating Summary..." : "Print / Download Clinical Summary"}
                              </button>

                              {showSummarySelector && (
                                <div className="absolute left-0 mt-2 bg-white border border-[#DCE8E8] rounded-xl shadow-xl p-4 w-72 z-50 space-y-3 text-[#071A2A] animate-in fade-in slide-in-from-top-2 duration-150">
                                  <div className="flex justify-between items-center border-b border-[#DCE8E8] pb-1.5">
                                    <span className="text-[10px] font-bold text-[#71869A] uppercase tracking-wider">Choose Summary</span>
                                    <button 
                                      onClick={() => setShowSummarySelector(false)}
                                      className="text-[#71869A] hover:text-[#071A2A] text-xs font-bold cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="space-y-1.5">
                                    <button
                                      onClick={() => handleGenerateAndDownloadSummary('complete')}
                                      disabled={downloadingSummary}
                                      className="w-full text-left bg-[#F2FBFA] hover:bg-[#E6F7F4] border border-[#DCE8E8] rounded-lg p-2 flex flex-col transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      <span className="text-xs font-bold text-[#071A2A]">Complete History</span>
                                      <span className="text-[9px] text-[#71869A] mt-0.5">Full health timeline summary</span>
                                    </button>
                                    <button
                                      onClick={() => handleGenerateAndDownloadSummary('recent')}
                                      disabled={downloadingSummary}
                                      className="w-full text-left bg-[#F2FBFA] hover:bg-[#E6F7F4] border border-[#DCE8E8] rounded-lg p-2 flex flex-col transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      <span className="text-xs font-bold text-[#071A2A]">Recent Updates</span>
                                      <span className="text-[9px] text-[#71869A] mt-0.5">Recent clinical changes & medication updates</span>
                                    </button>
                                    {clinicalContexts.length > 0 && (
                                      <div className="border-t border-[#DCE8E8] pt-2 space-y-1.5">
                                        <span className="text-[8px] font-bold text-[#71869A] uppercase tracking-wider block">Conditions</span>
                                        {clinicalContexts.map(ctx => (
                                          <button
                                            key={ctx.id}
                                            onClick={() => handleGenerateAndDownloadSummary('disease', ctx.label)}
                                            disabled={downloadingSummary}
                                            className="w-full text-left bg-[#F2FBFA] hover:bg-[#E6F7F4] border border-[#DCE8E8] rounded-lg p-2 flex flex-col transition-all cursor-pointer disabled:opacity-50"
                                          >
                                            <span className="text-xs font-bold text-[#08A99D]">{ctx.label} Focus</span>
                                            <span className="text-[9px] text-[#71869A] mt-0.5">Longitudinal {ctx.label} summary</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Coverage card info */}
                        <div className="bg-[#0D3435]/70 border border-[#2DD4BF]/30 p-4 rounded-xl text-left shrink-0">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-[#99F6E4]">Active Insurance coverage</span>
                          <p className="text-sm font-bold text-white mt-1">
                            {activePatient.policy_details?.insurer ? `${activePatient.policy_details.insurer} Policy` : "No Insurance Policy"}
                          </p>
                          <div className="flex items-center gap-6 mt-2 text-xs">
                            <div>
                              <span className="text-[9px] text-white/70 block">Coverage Limit</span>
                              <span className="font-bold text-[#99F6E4]">
                                {activePatient.policy_details?.coverage_limit ? `₹${activePatient.policy_details.coverage_limit.toLocaleString()}` : "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-white/70 block">Policy Number</span>
                              <span className="font-mono text-white/90">{activePatient.policy_details?.policy_number || "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grid content */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-350">
                      {/* Left: Trend Chart */}
                      {timeline.length > 0 && getAvailableTestNames().length > 0 ? (
                        <div className="bg-white border border-[#DCE8E8] rounded-xl p-5 shadow-sm flex flex-col justify-between">
                          <div className="flex justify-between items-center mb-4">
                            <div>
                              <h3 className="text-sm font-bold text-[#071A2A] flex items-center gap-1.5">
                                <BarChart2 className="w-4.5 h-4.5 text-[#08A99D]" /> Vitals & Biomarker Trends
                              </h3>
                            </div>
                            <select 
                              value={selectedChartTest}
                              onChange={(e) => setSelectedChartTest(e.target.value)}
                              className="text-[11px] bg-[#F2FBFA] border border-[#DCE8E8] rounded px-2 py-1 focus:outline-none focus:border-[#08A99D] font-semibold text-[#071A2A]"
                            >
                              {getAvailableTestNames().map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="h-48 w-full text-[10px] font-medium">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={getBiomarkerChartData()} margin={{ top: 5, right: 15, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
                                <XAxis dataKey="date" stroke="#A0B3BD" tickSize={4} />
                                <YAxis stroke="#A0B3BD" />
                                <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px', border: '1px solid #DCE8E8' }} />
                                <Line 
                                  name={`${selectedChartTest}`}
                                  type="monotone" 
                                  dataKey="value" 
                                  stroke="#08A99D" 
                                  strokeWidth={2.5} 
                                  dot={{ strokeWidth: 1.5, r: 3 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : null}

                      {/* Right: Recent Health Records */}
                      <div className={timeline.length > 0 && getAvailableTestNames().length > 0 ? "" : "lg:col-span-2"}>
                        <div className="bg-white border border-[#DCE8E8] rounded-xl p-5 shadow-sm h-full flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-4 border-b border-[#DCE8E8] pb-2">
                              <h3 className="text-sm font-bold text-[#071A2A] flex items-center gap-1.5">
                                <FileText className="w-4.5 h-4.5 text-[#08A99D]" /> Recent Health Records
                              </h3>
                              <button 
                                onClick={() => setAdminView('records')}
                                className="text-xs font-bold text-[#08A99D] hover:text-[#067a71] cursor-pointer flex items-center gap-0.5"
                              >
                                View All →
                              </button>
                            </div>
                            <div className="space-y-2">
                              {timeline.length > 0 ? (
                                timeline.slice(0, 5).map(r => (
                                  <div key={r.id} className="flex justify-between items-center gap-4 py-2 border-b border-[#DCE8E8] last:border-b-0 last:pb-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                                        r.record_type === "Prescription" ? "bg-[#E6F7F4] border-[#99F6E4] text-[#08A99D]" :
                                        r.record_type === "Lab Report" ? "bg-[#FFF7E6] border-[#FFE0A3] text-[#D97706]" : "bg-[#EEF2F6] border-[#DCE8E8] text-[#071A2A]"
                                      }`}>
                                        {r.record_type}
                                      </span>
                                      <div className="min-w-0">
                                        <h4 className="text-xs font-semibold text-[#071A2A] truncate">
                                          {r.parsed_json?.diagnoses?.join(", ") || r.parsed_json?.hospital_name || "Parsed Clinical Entry"}
                                        </h4>
                                        <p className="text-[9px] text-[#71869A] font-mono">Record ID: #{r.id} | Date: {formatToIndianDate(r.date) || "N/A"}</p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      {r.file_path && (
                                        <a 
                                          href={getFileUrl(r.file_path)} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="border border-[#DCE8E8] hover:bg-[#F2FBFA] text-[#071A2A] px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                        >
                                          <Download className="w-3 h-3" /> File
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-[#71869A] py-6 text-center">No documents present in health timeline.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {adminView === 'records' && (
                  <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
                    <div className="bg-white border border-[#DCE8E8] rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-4 border-b border-[#DCE8E8] pb-3">
                        <div>
                          <h3 className="text-base font-bold text-[#071A2A] flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#08A99D]" /> Complete Medical History
                          </h3>
                          <p className="text-xs text-[#71869A] mt-0.5">Unified health timeline containing all prescriptions, labs and clinical files</p>
                        </div>
                        <span className="text-xs bg-[#E6F7F4] text-[#08A99D] border border-[#99F6E4] px-2.5 py-1 rounded-lg font-mono font-bold">
                          Total: {timeline.length} Records
                        </span>
                      </div>

                      <div className="space-y-3">
                        {timeline.length > 0 ? (
                          <>
                            {/* Records List */}
                            <div className="divide-y divide-[#DCE8E8]">
                              {timeline
                                .slice((patientRecordsPage - 1) * 10, patientRecordsPage * 10)
                                .map(r => (
                                  <div key={r.id} className="flex justify-between items-center gap-4 py-3 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                                        r.record_type === "Prescription" ? "bg-[#E6F7F4] border-[#99F6E4] text-[#08A99D]" :
                                        r.record_type === "Lab Report" ? "bg-[#FFF7E6] border-[#FFE0A3] text-[#D97706]" : "bg-[#EEF2F6] border-[#DCE8E8] text-[#071A2A]"
                                      }`}>
                                        {r.record_type}
                                      </span>
                                      <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-[#071A2A] truncate">
                                          {r.parsed_json?.diagnoses?.join(", ") || r.parsed_json?.hospital_name || "Parsed Clinical Entry"}
                                        </h4>
                                        <p className="text-[10px] text-[#71869A] mt-0.5 font-mono">Record ID: #{r.id} | Date: {formatToIndianDate(r.date) || "N/A"}</p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      {r.file_path && (
                                        <a 
                                          href={getFileUrl(r.file_path)} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="border border-[#DCE8E8] hover:bg-[#F2FBFA] text-[#071A2A] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                        >
                                          <Download className="w-3.5 h-3.5" /> View/Download File
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {timeline.length > 10 && (
                              <div className="flex justify-between items-center border-t border-[#DCE8E8] pt-4 mt-4">
                                <button
                                  onClick={() => setPatientRecordsPage(p => Math.max(1, p - 1))}
                                  disabled={patientRecordsPage === 1}
                                  className="border border-[#DCE8E8] hover:bg-[#F2FBFA] text-[#071A2A] px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer font-bold"
                                >
                                  ← Previous
                                </button>
                                <span className="text-xs text-[#71869A] font-medium">
                                  Page {patientRecordsPage} of {Math.ceil(timeline.length / 10)}
                                </span>
                                <button
                                  onClick={() => setPatientRecordsPage(p => Math.min(Math.ceil(timeline.length / 10), p + 1))}
                                  disabled={patientRecordsPage >= Math.ceil(timeline.length / 10)}
                                  className="border border-[#DCE8E8] hover:bg-[#F2FBFA] text-[#071A2A] px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer font-bold"
                                >
                                  Next →
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-10 bg-[#F2FBFA] border border-[#DCE8E8] rounded-xl">
                            <FileText className="w-12 h-12 text-[#A0B3BD] mx-auto mb-2.5" />
                            <h4 className="text-xs font-bold text-[#071A2A]">No Health Records Available</h4>
                            <p className="text-[11px] text-[#71869A] mt-1 max-w-xs mx-auto leading-normal">
                              Your clinical files will appear here once they are generated or uploaded by hospital administrators.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {adminView === 'documents' && (
                  <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in duration-200">
                    {/* Vault Header Card */}
                    <div className="bg-white border border-[#DCE8E8] rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-[#DCE8E8] pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-[#071A2A] flex items-center gap-2">
                            <FileText className="w-4.5 h-4.5 text-[#08A99D]" /> Personal Documents Vault
                          </h3>
                          <p className="text-[11px] text-[#71869A] mt-0.5">
                            A private secure space to store personal records. Completely isolated from hospital database logs and clinical contexts.
                          </p>
                        </div>
                        <span className="text-xs bg-[#E6F7F4] text-[#08A99D] border border-[#99F6E4] px-2.5 py-0.5 rounded font-mono font-bold">
                          {personalDocs.length} Personal Files
                        </span>
                      </div>

                      {/* Storage + Upload Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {/* Left: Storage progress */}
                        <div className="p-3 bg-[#F2FBFA] border border-[#DCE8E8] rounded-xl flex flex-col justify-center space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-[#71869A]">Storage Capacity</span>
                            <span className="text-[#071A2A]">
                              {(() => {
                                const formatBytes = (b) => {
                                  if (b === 0) return '0 Bytes'
                                  const k = 1024
                                  const sizes = ['Bytes', 'KB', 'MB', 'GB']
                                  const i = Math.floor(Math.log(b) / Math.log(k))
                                  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
                                }
                                  return `${formatBytes(personalDocsUsage)} / ${formatBytes(personalDocsLimit)} used`
                              })()}
                            </span>
                          </div>
                          <div className="w-full bg-[#DCE8E8] rounded-full h-2 overflow-hidden border border-[#DCE8E8]">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                (personalDocsUsage / personalDocsLimit) > 0.9 ? 'bg-rose-500' : 'bg-[#08A99D]'
                              }`}
                              style={{ width: `${Math.min(100, (personalDocsUsage / personalDocsLimit) * 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Right: Upload Box */}
                        <div className="p-3 bg-[#F2FBFA] border border-[#DCE8E8] rounded-xl flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-[11px] font-bold text-[#071A2A]">Upload Document</h4>
                            <p className="text-[9px] text-[#71869A] mt-0.5 truncate">PDF or Images up to 2 GB limit</p>
                          </div>
                          <div className="shrink-0">
                            <input 
                              type="file" 
                              id="personal-doc-upload-input"
                              className="hidden" 
                              disabled={personalDocsUploading || personalDocsLoading}
                              onChange={async (e) => {
                                const file = e.target.files[0]
                                if (file) {
                                  await uploadPersonalDoc(file)
                                }
                                e.target.value = '' // Clear input
                              }}
                            />
                            <label 
                              htmlFor="personal-doc-upload-input"
                              className={`bg-[#08A99D] hover:bg-[#079388] text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
                                (personalDocsUploading || personalDocsLoading) ? 'opacity-50 pointer-events-none' : ''
                              }`}
                            >
                              {personalDocsUploading ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3.5 h-3.5" /> Upload File
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Error Message */}
                      {personalDocsError && (
                        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-[10px] font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{personalDocsError}</span>
                        </div>
                      )}
                    </div>

                    {/* Files List Card */}
                    <div className="bg-white border border-[#DCE8E8] rounded-xl p-4 shadow-sm space-y-3">
                      <h4 className="text-xs font-bold text-[#071A2A]">My Personal Document Archives</h4>
                      
                      {personalDocs.length > 0 ? (
                        <div className="overflow-y-auto max-h-[300px] border border-[#DCE8E8] rounded-lg">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-[#DCE8E8] bg-[#F2FBFA] text-[#71869A] font-bold text-[10px] uppercase sticky top-0 z-10">
                                <th className="py-2 px-3">File Name</th>
                                <th className="py-2 px-3">File Type</th>
                                <th className="py-2 px-3">Size</th>
                                <th className="py-2 px-3">Upload Date</th>
                                <th className="py-2 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#DCE8E8]">
                              {personalDocs.map(d => (
                                <tr key={d.id} className="hover:bg-[#F2FBFA]/60">
                                  <td className="py-2 px-3 font-semibold text-[#071A2A] max-w-xs truncate" title={d.file_name}>
                                    {d.file_name}
                                  </td>
                                  <td className="py-2 px-3 text-[#71869A] font-mono text-[10px] uppercase">
                                    {d.file_type ? d.file_type.split('/')[1] || d.file_type : 'UNKNOWN'}
                                  </td>
                                  <td className="py-2 px-3 text-[#71869A] font-mono">
                                    {(() => {
                                      const b = d.file_size
                                      if (b === 0) return '0 Bytes'
                                      const k = 1024
                                      const sizes = ['Bytes', 'KB', 'MB', 'GB']
                                      const i = Math.floor(Math.log(b) / Math.log(k))
                                      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
                                    })()}
                                  </td>
                                  <td className="py-2 px-3 text-[#71869A]">
                                    {new Date(d.created_at).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <div className="flex justify-end items-center gap-1.5">
                                      <a 
                                        href={getFileUrl(d.file_path)} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="border border-[#DCE8E8] hover:bg-[#F2FBFA] text-[#071A2A] px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                                      >
                                        <Download className="w-3 h-3" /> View / Download
                                      </a>
                                      <button 
                                        onClick={() => deletePersonalDoc(d.id)}
                                        disabled={personalDocsLoading}
                                        className="border border-rose-100 hover:bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 bg-[#F2FBFA] border border-[#DCE8E8] rounded-xl">
                          <FileText className="w-8 h-8 text-[#A0B3BD] mx-auto mb-2 animate-pulse" />
                          <h5 className="text-[11px] font-bold text-[#071A2A]">Your Vault is Empty</h5>
                          <p className="text-[10px] text-[#71869A] mt-0.5 max-w-xs mx-auto leading-normal">
                            No personal files uploaded yet. Select files using the upload panel.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {adminView === 'insurance' && (
                  <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
                    {/* Top Alert/Status if no active policy */}
                    {!insuranceData?.active_policy && (
                      <div className="bg-[#FFF7E6] border border-[#FFE0A3] rounded-xl p-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 animate-bounce" />
                        <div>
                          <h4 className="text-xs font-bold text-[#D97706]">No Active Insurance Policy Registered</h4>
                          <p className="text-[10px] text-[#71869A] mt-0.5">
                            Please upload your health insurance policy document to enable cashless claim scaffolding and preventive wellness benefits.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Main Insurance Dashboard Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left: Policy Overview & Details (Col 8) */}
                      <div className="lg:col-span-8 space-y-6">
                        
                        {/* Policy Overview */}
                        {insuranceData?.active_policy ? (
                          <div className="bg-white border border-[#DCE8E8] rounded-xl p-5 shadow-sm space-y-4 relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#08A99D]"></div>
                            
                            <div className="flex justify-between items-start border-b border-[#DCE8E8] pb-3">
                              <div>
                                <span className="text-[9px] bg-[#E6F7F4] text-[#08A99D] border border-[#99F6E4] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active Policy</span>
                                <h3 className="text-base font-bold text-[#071A2A] mt-1">{insuranceData.active_policy.insurer}</h3>
                                <p className="text-[10px] text-[#71869A] mt-0.5">Policy Number: <span className="font-mono font-bold text-[#071A2A]">{insuranceData.active_policy.policy_number}</span></p>
                                {insuranceData.active_policy.insurer_email && (
                                  <p className="text-[10px] text-[#71869A] mt-0.5">Contact Email: <span className="font-mono font-bold text-[#071A2A]">{insuranceData.active_policy.insurer_email}</span></p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-[#71869A] uppercase font-bold tracking-wider block">Coverage Limit</span>
                                <span className="text-lg font-extrabold text-[#08A99D]">
                                  {insuranceData.active_policy.sum_insured ? `₹${insuranceData.active_policy.sum_insured.toLocaleString()}` : "N/A"}
                                </span>
                              </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-[9px] text-[#71869A] block font-semibold uppercase">Policyholder Name</span>
                                <span className="font-semibold text-[#071A2A]">{insuranceData.active_policy.policyholder_name || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#71869A] block font-semibold uppercase">Patient Member ID</span>
                                <span className="font-semibold text-[#071A2A]">{insuranceData.active_policy.member_id || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#71869A] block font-semibold uppercase">Policy Type</span>
                                <span className="font-semibold text-[#071A2A]">{insuranceData.active_policy.policy_type || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#71869A] block font-semibold uppercase">Validity Period</span>
                                <span className="font-semibold text-[#071A2A]">
                                  {insuranceData.active_policy.start_date || "N/A"} to {insuranceData.active_policy.end_date || "N/A"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#71869A] block font-semibold uppercase">Annual Premium</span>
                                <span className="font-semibold text-[#071A2A]">
                                  {insuranceData.active_policy.premium ? `₹${insuranceData.active_policy.premium.toLocaleString()}` : "N/A"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#71869A] block font-semibold uppercase">Wellness checkups</span>
                                <span className="font-semibold text-[#071A2A]">
                                  {insuranceData.active_policy.checkups_per_year !== null ? `${insuranceData.active_policy.checkups_per_year} Free/Year` : "N/A"}
                                </span>
                              </div>
                            </div>

                            {/* Benefits & Limitations */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#DCE8E8] text-xs">
                              <div>
                                <h4 className="text-[10px] font-bold text-[#071A2A] uppercase tracking-wide mb-1.5">Benefits Covered</h4>
                                {insuranceData.active_policy.benefits_coverage && insuranceData.active_policy.benefits_coverage.length > 0 ? (
                                  <ul className="list-disc list-inside space-y-1 text-[#71869A]">
                                    {insuranceData.active_policy.benefits_coverage.map((b, i) => (
                                      <li key={i} className="truncate">{b}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[#71869A]">No specific benefits listed.</p>
                                )}
                              </div>
                              <div>
                                <h4 className="text-[10px] font-bold text-[#071A2A] uppercase tracking-wide mb-1.5">Exclusions / Limitations</h4>
                                {insuranceData.active_policy.conditions_limitations && insuranceData.active_policy.conditions_limitations.length > 0 ? (
                                  <ul className="list-disc list-inside space-y-1 text-[#71869A]">
                                    {insuranceData.active_policy.conditions_limitations.map((c, i) => (
                                      <li key={i} className="truncate">{c}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[#71869A]">No exclusions/co-pays listed.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white border border-[#DCE8E8] rounded-xl p-8 text-center space-y-3 shadow-sm">
                            <Shield className="w-12 h-12 text-[#A0B3BD] mx-auto animate-pulse" />
                            <h3 className="text-base font-bold text-[#071A2A]">No Insurance Registered</h3>
                            <p className="text-xs text-[#71869A] max-w-xs mx-auto leading-normal">
                              Upload your medical insurance card or policy PDF below. AyuSeva's AI engine will extract coverage data for cashless checkouts.
                            </p>
                          </div>
                        )}

                        {/* Left Column Part 2: Insurance Claims Portal */}
                        <div className="bg-white border border-[#DCE8E8] rounded-xl p-5 shadow-sm space-y-4">
                          <div className="flex justify-between items-center border-b border-[#DCE8E8] pb-3">
                            <div>
                              <h4 className="text-xs font-bold text-[#071A2A] flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-[#08A99D] shrink-0" /> Insurance Claims Portal
                              </h4>
                              <p className="text-[10px] text-[#71869A] mt-0.5">
                                Submit and monitor cashless pre-authorizations or reimbursement claims for hospital stays and clinical care.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Cashless Claims card */}
                            <div className="bg-[#F2FBFA] border border-[#DCE8E8] rounded-xl p-4 space-y-3 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                              <div className="space-y-1.5">
                                <span className="text-[9px] bg-[#E6F7F4] text-[#08A99D] border border-[#99F6E4] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Cashless Settlement</span>
                                <h5 className="text-xs font-bold text-[#071A2A]">Cashless Hospitalization Claims</h5>
                                <p className="text-[10px] text-[#71869A] leading-normal">
                                  Direct cashless processing at network provider hospitals. Submit your discharge summary, doctor logs, and estimate sheets for instant AI pre-authorization approvals.
                                </p>
                              </div>
                              <div className="pt-2 border-t border-[#DCE8E8] flex justify-between items-center mt-auto">
                                <span className="text-[9px] font-bold text-[#71869A] font-mono uppercase">Status: Ready to Build</span>
                                <span className="text-[9px] bg-[#EEF2F6] text-[#71869A] border border-[#DCE8E8] px-2 py-0.5 rounded font-bold uppercase font-mono">Coming Soon</span>
                              </div>
                            </div>

                            {/* Reimbursement Claims card */}
                            <div className="bg-[#F2FBFA] border border-[#DCE8E8] rounded-xl p-4 space-y-3 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                              <div className="space-y-1.5">
                                <span className="text-[9px] bg-[#EEF2F6] text-[#071A2A] border border-[#DCE8E8] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Refund Claim</span>
                                <h5 className="text-xs font-bold text-[#071A2A]">Post-Treatment Reimbursement Claims</h5>
                                <p className="text-[10px] text-[#71869A] leading-normal">
                                  Refund request for diagnostics, medication, and consultations. Upload scan receipts, doctor prescriptions, pharmacy bills, and claim forms.
                                </p>
                              </div>
                              <div className="pt-2 border-t border-[#DCE8E8] flex justify-between items-center mt-auto">
                                <span className="text-[9px] font-bold text-[#71869A] font-mono uppercase">Status: Ready to Build</span>
                                <span className="text-[9px] bg-[#EEF2F6] text-[#71869A] border border-[#DCE8E8] px-2 py-0.5 rounded font-bold uppercase font-mono">Coming Soon</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions & Current Document (Col 4) */}
                      <div className="lg:col-span-4 space-y-6">
                        
                        {/* Manage Document Actions */}
                        <div className="bg-white border border-[#DCE8E8] rounded-xl p-5 shadow-sm space-y-4">
                          <h3 className="text-xs font-bold text-[#071A2A] uppercase tracking-wider border-b border-[#DCE8E8] pb-2">Policy Documents</h3>
                          
                          {/* File Preview Link */}
                          {insuranceData?.active_policy?.file_path ? (
                            <div className="bg-[#F2FBFA] border border-[#DCE8E8] rounded-lg p-3 text-xs space-y-3">
                              <div className="flex items-center gap-2 text-[#071A2A]">
                                <FileText className="w-5 h-5 text-[#08A99D] shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#071A2A] truncate">Policy Document File</p>
                                  <p className="text-[9px] text-[#71869A] uppercase">PDF / Image Document</p>
                                </div>
                              </div>
                              <a 
                                href={getFileUrl(insuranceData.active_policy.file_path)} 
                                target="_blank" 
                                rel="noreferrer"
                                className="w-full bg-[#EEF2F6] hover:bg-[#DCE8E8] text-[#071A2A] py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> View / Download Document
                              </a>
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#71869A] italic">No document file uploaded yet.</p>
                          )}

                          {/* Upload / Replace Action */}
                          <div className="space-y-2">
                            <input 
                              type="file" 
                              id="patient-insurance-upload-input"
                              className="hidden" 
                              disabled={insuranceUploading || loading}
                              onChange={async (e) => {
                                const file = e.target.files[0]
                                if (!file) return
                                setInsuranceUploading(true)
                                const formData = new FormData()
                                formData.append("file", file)
                                try {
                                  const res = await fetch(`${BASE_URL}/api/insurance/patient/${activePatient.id}/upload`, {
                                    method: 'POST',
                                    body: formData
                                  })
                                  if (!res.ok) {
                                    const errData = await res.json()
                                    throw new Error(errData.detail || "Failed to upload insurance policy")
                                  }
                                  alert("Insurance Policy uploaded and parsed successfully!")
                                  fetchPatientData(activePatient.id) // Refetch patient data & insurance
                                } catch (err) {
                                  alert("Upload Error: " + err.message)
                                } finally {
                                  setInsuranceUploading(false)
                                  e.target.value = "" // clear file input
                                }
                              }}
                            />
                            <label 
                              htmlFor="patient-insurance-upload-input"
                              className={`w-full bg-[#08A99D] hover:bg-[#079388] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                                (insuranceUploading || loading) ? 'opacity-50 pointer-events-none' : ''
                              }`}
                            >
                              {insuranceUploading ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading & Parsing...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3.5 h-3.5" /> {insuranceData?.active_policy ? "Replace Insurance Document" : "Upload Insurance Document"}
                                </>
                              )}
                            </label>
                          </div>

                          {/* Remove Action */}
                          {insuranceData?.active_policy && (
                            <div className="pt-2 border-t border-[#DCE8E8]">
                              {archiveConfirmPolicyId === insuranceData.active_policy.id ? (
                                <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 space-y-2">
                                  <p className="text-[10px] text-rose-800 leading-normal font-semibold">
                                    Are you sure you want to remove this active insurance policy from your account? This action cannot be undone.
                                  </p>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={async () => {
                                        setLoading(true)
                                        try {
                                          const res = await fetch(`${BASE_URL}/api/insurance/policy/${insuranceData.active_policy.id}/archive`, {
                                            method: 'POST'
                                          })
                                          if (!res.ok) throw new Error("Failed to archive policy")
                                          setArchiveConfirmPolicyId(null)
                                          alert("Insurance policy archived successfully.")
                                          fetchPatientData(activePatient.id) // Refetch
                                        } catch (err) {
                                          alert("Error: " + err.message)
                                        } finally {
                                          setLoading(false)
                                        }
                                      }}
                                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                      Confirm Remove
                                    </button>
                                    <button 
                                      onClick={() => setArchiveConfirmPolicyId(null)}
                                      className="flex-1 bg-[#EEF2F6] hover:bg-[#DCE8E8] text-[#071A2A] py-1.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setArchiveConfirmPolicyId(insuranceData.active_policy.id)}
                                  className="w-full border border-rose-100 hover:bg-rose-50 text-rose-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Remove Current Insurance
                                </button>
                              )}
                            </div>
                          )}

                        </div>

                        {/* Right Column Part 2: Preventive Care Benefits */}
                        <div className="bg-white border border-[#DCE8E8] rounded-xl p-4 shadow-sm space-y-3">
                          <div className="flex justify-between items-center border-b border-[#DCE8E8] pb-2">
                            <div>
                              <h4 className="text-xs font-bold text-[#071A2A] flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-[#08A99D] shrink-0" /> Preventive Care Benefits
                              </h4>
                              <p className="text-[10px] text-[#71869A] mt-0.5">
                                Schedule your free annual health checkups covered by your active policy.
                              </p>
                            </div>
                          </div>

                          {insuranceData?.active_policy ? (
                            <div className="space-y-3">
                              {/* Summary metrics grid */}
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="py-1.5 px-1 bg-[#F2FBFA] border border-[#DCE8E8] rounded-lg">
                                  <span className="text-[7.5px] text-[#71869A] block font-bold uppercase tracking-wider">Total Entitled</span>
                                  <span className="text-[11px] font-extrabold text-[#071A2A]">{insuranceData.active_policy.checkups_per_year || 0} Checkups</span>
                                </div>
                                <div className="py-1.5 px-1 bg-[#FFECEF] border border-[#FFCCD3] rounded-lg">
                                  <span className="text-[7.5px] text-[#E11D48] block font-bold uppercase tracking-wider">Used (Locked)</span>
                                  <span className="text-[11px] font-extrabold text-[#E11D48]">
                                    {checkups.filter(c => c.is_locked).length} Checkups
                                  </span>
                                </div>
                                <div className="py-1.5 px-1 bg-[#E6F7F4] border border-[#99F6E4] rounded-lg">
                                  <span className="text-[7.5px] text-[#08A99D] block font-bold uppercase tracking-wider">Remaining</span>
                                  <span className="text-[11px] font-extrabold text-[#08A99D]">
                                    {Math.max(0, (insuranceData.active_policy.checkups_per_year || 0) - checkups.filter(c => c.is_locked).length)} Slots
                                  </span>
                                </div>
                              </div>

                              {/* Slots mapping */}
                              <div className="space-y-2">
                                {checkups.length > 0 ? (
                                  checkups.map((slot) => {
                                    const isAvailable = slot.status === "AVAILABLE"
                                    const isScheduled = slot.status === "SCHEDULED"
                                    const isSent = slot.status === "SENT"
                                    const isFailed = slot.status === "FAILED"

                                    return (
                                      <div key={slot.checkup_number} className="bg-[#F2FBFA] border border-[#DCE8E8] rounded-lg py-2.5 px-3 flex flex-col justify-between gap-3">
                                        <div className="space-y-0.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[11px] font-bold text-[#071A2A]">Checkup #{slot.checkup_number}</span>
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                                              isSent ? 'bg-[#FFECEF] text-[#E11D48] border-[#FFCCD3]' :
                                              isFailed ? 'bg-[#FFF7E6] text-[#D97706] border-[#FFE0A3]' :
                                              isScheduled ? 'bg-[#E6F7F4] text-[#08A99D] border-[#99F6E4]' :
                                              'bg-[#EEF2F6] text-[#71869A] border-[#DCE8E8]'
                                            }`}>
                                              {isSent ? "Notification Sent — Locked" : 
                                               isFailed ? "Notification Failed — Retry Pending" :
                                               isScheduled ? "Scheduled — Notification Pending" : 
                                               "Available"}
                                            </span>
                                          </div>
                                          
                                          {isAvailable && (
                                            <p className="text-[9px] text-[#71869A]">Schedule your free wellness health checkup.</p>
                                          )}
                                          
                                          {!isAvailable && (
                                            <div className="grid grid-cols-2 gap-x-3 text-[10px] mt-0.5">
                                              <div>
                                                <span className="text-[#71869A] block text-[8px] uppercase font-semibold">Appointment Date</span>
                                                <span className="font-semibold text-[#071A2A]">{slot.scheduled_date}</span>
                                              </div>
                                              <div>
                                                <span className="text-[#71869A] block text-[8px] uppercase font-semibold">Notification Date</span>
                                                <span className="font-semibold text-[#071A2A]">{slot.notification_date}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          {isAvailable && (
                                            <div className="flex items-center gap-1.5 w-full">
                                              <input 
                                                type="date" 
                                                id={`schedule-date-${slot.checkup_number}`}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="bg-white border border-[#DCE8E8] rounded px-2 py-0.5 text-[11px] h-7 text-[#071A2A] focus:outline-none focus:ring-1 focus:ring-[#08A99D] w-full"
                                              />
                                              <button
                                                onClick={() => {
                                                  const dateInput = document.getElementById(`schedule-date-${slot.checkup_number}`);
                                                  if (dateInput && dateInput.value) {
                                                    scheduleCheckupSlot(slot.policy_id, slot.checkup_number, dateInput.value);
                                                  } else {
                                                    alert("Please select a valid date first.");
                                                  }
                                                }}
                                                className="bg-[#08A99D] hover:bg-[#079388] text-white px-2.5 py-1 rounded-md text-[10px] font-semibold h-7 transition-all shadow-sm cursor-pointer"
                                              >
                                                Schedule
                                              </button>
                                            </div>
                                          )}

                                          {(isScheduled || isFailed) && (
                                            <div className="flex items-center gap-1.5 flex-wrap w-full">
                                              <input 
                                                type="date" 
                                                id={`reschedule-date-${slot.checkup_number}`}
                                                defaultValue={slot.scheduled_date}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="bg-white border border-[#DCE8E8] rounded px-2 py-0.5 text-[11px] h-7 text-[#071A2A] focus:outline-none focus:ring-1 focus:ring-[#08A99D] w-full"
                                              />
                                              <div className="flex gap-1.5 w-full">
                                                <button
                                                  onClick={() => {
                                                    const dateInput = document.getElementById(`reschedule-date-${slot.checkup_number}`);
                                                    if (dateInput && dateInput.value) {
                                                      scheduleCheckupSlot(slot.policy_id, slot.checkup_number, dateInput.value);
                                                    }
                                                  }}
                                                  className="bg-[#EEF2F6] hover:bg-[#DCE8E8] text-[#071A2A] px-2.5 py-1 rounded-md text-[10px] font-semibold h-7 flex-1 transition-all shadow-sm cursor-pointer text-center text-ellipsis overflow-hidden whitespace-nowrap"
                                                >
                                                  Change
                                                </button>
                                                <button
                                                  onClick={() => simulateCheckupNotification(slot.id)}
                                                  className="bg-[#0D3435] hover:bg-[#15615D] text-white px-2.5 py-1 rounded-md text-[10px] font-semibold h-7 flex-1 transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1"
                                                  title="Preview simulated email template"
                                                >
                                                  <Send className="w-2.5 h-2.5" /> [Dev] Preview
                                                </button>
                                                <button
                                                  onClick={() => cancelCheckupSlot(slot.id)}
                                                  className="border border-rose-100 hover:bg-rose-50 text-rose-650 px-2.5 py-1 rounded-md text-[10px] font-semibold h-7 transition-all shadow-sm cursor-pointer"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {isSent && (
                                            <div className="text-[10px] text-[#08A99D] italic font-semibold flex items-center gap-1 p-0.5">
                                              <CheckCircle2 className="w-3.5 h-3.5 text-[#08A99D] shrink-0" />
                                              <span>Sent — Locked</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })
                                ) : (
                                  <p className="text-[10px] text-[#71869A] italic">No checkup slots eligible under active policy.</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-[#71869A] italic">No active insurance policy registered. Scheduling options will appear here once an insurance document is uploaded.</p>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                )}

                {adminView === 'current-intake' && (
                  <CurrentVisitIntake
                    mode="patient"
                    patient={activePatient}
                    allPatients={allPatients}
                    onSelectPatient={fetchPatientData}
                    onBack={() => setAdminView('overview')}
                    showToast={showToast}
                    baseUrl={BASE_URL}
                  />
                )}
              </>
            ) : (
              <div className="bg-white border border-[#DCE8E8] rounded-2xl p-12 shadow-sm text-center max-w-md mx-auto">
                <RefreshCw className="w-12 h-12 text-[#08A99D] mx-auto mb-4 animate-spin" />
                <h3 className="text-base font-bold text-[#071A2A]">Synchronizing Vault Session</h3>
                <p className="text-xs text-[#71869A] mt-1">Loading timeline history...</p>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // Helper renderers for Hospital Admin Sub-Views
  const renderAdminOverview = () => {
    const recentPatients = allPatients.slice(-5).reverse()
    const recentActivity = globalRecords.slice(0, 5)

    return (
      <div className="space-y-3.5">
        {/* Welcome Section */}
        <div className="bg-[#15615D] text-white rounded-2xl py-3 px-5 shadow-sm border border-[#15615D] flex justify-between items-center relative overflow-hidden">
          {/* Exact Decorative Concentric Arcs, Glowing Pulse, & Botanical Sprig */}
          <svg className="absolute right-0 top-0 bottom-0 h-full w-[440px] pointer-events-none overflow-hidden" viewBox="0 0 440 80" fill="none">
            <defs>
              <filter id="heroPulseGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
              </filter>
            </defs>

            {/* Faint corner arc at bottom-left */}
            <circle cx="20" cy="85" r="55" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {/* Concentric Arc 1 (Outer Arc) */}
            <path
              d="M 90,85 C 130,20 220,-8 340,5 C 380,10 415,22 440,35"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              fill="none"
            />

            {/* Concentric Arc 2 (Inner Arc Passing Through Leaf & Over Button) */}
            <path
              d="M 125,85 C 160,42 225,18 315,20 C 365,21 405,38 435,55"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
              fill="none"
            />

            {/* Glowing Pulse / Streak Along the Inner Arc */}
            <path
              d="M 192,43 C 203,38 215,34 227,31"
              stroke="#2DD4BF"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.45"
              filter="url(#heroPulseGlow)"
              fill="none"
            />
            <path
              d="M 194,42 C 203,38 214,34 225,31"
              stroke="#99F6E4"
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.85"
              fill="none"
            />
            <path
              d="M 197,41 C 205,37 213,34 221,32"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.95"
              fill="none"
            />
            {/* Illuminated Center Dot on the Arc */}
            <circle cx="209" cy="36" r="5" fill="#2DD4BF" opacity="0.45" filter="url(#heroPulseGlow)" />
            <circle cx="209" cy="36" r="1.6" fill="#FFFFFF" />

            {/* Botanical 5-Leaflet Sprig */}
            <g transform="translate(182, 39) rotate(22) scale(0.92)">
              {/* Slender stem */}
              <path d="M 0,10 L 0,-30" stroke="#2DD4BF" strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
              {/* Lower Pair of Leaflets */}
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -3) rotate(-55)" fill="#2DD4BF" opacity="0.65" />
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -3) rotate(55)" fill="#2DD4BF" opacity="0.65" />
              {/* Upper Pair of Leaflets */}
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -14) rotate(-46)" fill="#2DD4BF" opacity="0.72" />
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -14) rotate(46)" fill="#2DD4BF" opacity="0.72" />
              {/* Terminal Tip Leaflet */}
              <path d="M 0,0 C -3.2,-4 -3.8,-9.5 0,-15 C 3.8,-9.5 3.2,-4 0,0 Z" transform="translate(0, -28) rotate(2)" fill="#2DD4BF" opacity="0.82" />
            </g>
          </svg>

          <div className="relative z-10">
            <h2 className="text-base font-bold text-white">Welcome, Admin User ({adminUsername})</h2>
            <p className="text-xs text-white/80 mt-0.5">Manage intake, search clinic directories, and audit cashless insurance pre-authorizations.</p>
          </div>
          <div className="relative z-10 bg-[#0E3837]/50 hover:bg-[#0E3837]/70 border border-[#2DD4BF]/40 text-white text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-sm shadow-sm shrink-0 cursor-default">
            <Activity className="w-3.5 h-3.5 text-[#2DD4BF]" /> 
            <span className="font-bold text-white text-[13px] tracking-tight">SQLite Active</span>
          </div>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#DCE8E8] p-2.5 px-3.5 rounded-xl shadow-sm flex items-center gap-3">
            <div className="p-2 bg-[#E6F7F4] rounded-lg text-[#08A99D] shrink-0">
              <User className="w-5.5 h-5.5" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-[#A0B3BD] block font-semibold">Total Patients</span>
              <span className="text-xl font-bold text-[#071A2A] leading-none">{allPatients.length}</span>
            </div>
          </div>
          <div className="bg-white border border-[#DCE8E8] p-2.5 px-3.5 rounded-xl shadow-sm flex items-center gap-3">
            <div className="p-2 bg-[#FFF7E6] rounded-lg text-[#D97706] shrink-0">
              <FileText className="w-5.5 h-5.5" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-[#A0B3BD] block font-semibold">Total Records</span>
              <span className="text-xl font-bold text-[#071A2A] leading-none">{globalRecords.length}</span>
            </div>
          </div>
          <div className="bg-white border border-[#DCE8E8] p-2.5 px-3.5 rounded-xl shadow-sm flex items-center gap-3">
            <div className="p-2 bg-[#FFECEF] rounded-lg text-[#E02424] shrink-0">
              <Heart className="w-5.5 h-5.5" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-[#A0B3BD] block font-semibold">Emergency Alerts</span>
              <span className="text-xl font-bold text-[#071A2A] leading-none">3</span>
            </div>
          </div>
          <div className="bg-white border border-[#DCE8E8] p-2.5 px-3.5 rounded-xl shadow-sm flex items-center gap-3">
            <div className="p-2 bg-[#EEF2F6] rounded-lg text-[#6366F1] shrink-0">
              <Landmark className="w-5.5 h-5.5" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-[#A0B3BD] block font-semibold">Active Claims</span>
              <span className="text-xl font-bold text-[#071A2A] leading-none">
                {globalRecords.filter(r => r.parsed_json?.surgery_advised).length}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div>
          <h3 className="text-xs font-bold text-[#71869A] mb-2 uppercase tracking-wider">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => { setNewlyRegisteredPatient(null); setAdminView('register'); }}
              className="bg-white border border-[#DCE8E8] hover:border-[#08A99D] p-3 rounded-xl shadow-sm hover:shadow transition-all text-left flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full border border-[#08A99D] flex items-center justify-center shrink-0 text-[#08A99D] group-hover:bg-[#E6F7F4] transition-colors">
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-[#071A2A] group-hover:text-[#08A99D] text-xs">Register New Patient</h4>
                <p className="text-[10px] text-[#71869A] mt-0.5 leading-normal">Generate local UIDs & log insurance details.</p>
              </div>
            </button>
            <button 
              onClick={() => setAdminView('patients')}
              className="bg-white border border-[#DCE8E8] hover:border-[#08A99D] p-3 rounded-xl shadow-sm hover:shadow transition-all text-left flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full border border-[#08A99D] flex items-center justify-center shrink-0 text-[#08A99D] group-hover:bg-[#E6F7F4] transition-colors">
                <Search className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-[#071A2A] group-hover:text-[#08A99D] text-xs">Search Patient File</h4>
                <p className="text-[10px] text-[#71869A] mt-0.5 leading-normal">Find patient profiles by name or UID.</p>
              </div>
            </button>
            <button 
              onClick={() => setAdminView('emergency')}
              className="bg-white border border-[#DCE8E8] hover:border-[#E02424] p-3 rounded-xl shadow-sm hover:shadow transition-all text-left flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full border border-[#E02424] flex items-center justify-center shrink-0 text-[#E02424] group-hover:bg-[#FFECEF] transition-colors">
                <Heart className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-[#071A2A] group-hover:text-[#E02424] text-xs">Emergency Transfer Alerts</h4>
                <p className="text-[10px] text-[#71869A] mt-0.5 leading-normal">Dispatch records to trauma centers.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Registered Patients & Latest Activities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Patients */}
          <div className="bg-white border border-[#DCE8E8] rounded-xl p-3.5 shadow-sm">
            <h3 className="text-sm font-bold text-[#071A2A] mb-3 flex items-center justify-between">
              <span>Recently Registered Patients</span>
              <button onClick={() => setAdminView('patients')} className="text-xs text-[#08A99D] font-bold hover:underline cursor-pointer">View All</button>
            </h3>
            {recentPatients.length > 0 ? (
              <div className="divide-y divide-[#DCE8E8]/60">
                {recentPatients.map(p => (
                  <div key={p.id} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-xs font-bold text-[#071A2A]">{p.name || 'Unnamed Patient'}</h4>
                      <span className="text-[10px] text-[#71869A] mt-0.5 block font-mono">{p.id}</span>
                    </div>
                    <button 
                      onClick={() => { fetchPatientData(p.id); setAdminView('patient-profile'); }}
                      className="border border-[#DCE8E8] hover:bg-[#F2FBFA] text-[#071A2A] px-3 py-1 rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      Open File
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A0B3BD] py-6 text-center">No patients registered in database yet.</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-[#DCE8E8] rounded-xl p-3.5 shadow-sm">
            <h3 className="text-sm font-bold text-[#071A2A] mb-3 flex items-center justify-between">
              <span>Latest Medical Activity</span>
              <button onClick={() => setAdminView('records')} className="text-xs text-[#08A99D] font-bold hover:underline cursor-pointer">View Feed</button>
            </h3>
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-[#DCE8E8]/60">
                {recentActivity.map(r => (
                  <div key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        r.record_type === 'Prescription' ? 'bg-[#E6F7F4] border-[#E6F7F4] text-[#08A99D]' :
                        r.record_type === 'Lab Report' ? 'bg-[#FFF7E6] border-[#FFF7E6] text-[#D97706]' : 'bg-[#F2FBFA] border-[#DCE8E8] text-[#71869A]'
                      }`}>
                        {r.record_type}
                      </span>
                      <span className="text-[9px] text-[#71869A] font-mono">{formatToIndianDate(r.date) || 'N/A'}</span>
                    </div>
                    <p className="text-xs font-bold text-[#071A2A] mt-1">
                      Uploaded file for {r.patient_name} <span className="font-mono text-[10px] text-[#71869A] font-normal">({r.patient_id})</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A0B3BD] py-6 text-center">No records uploaded yet.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderAdminRegister = () => {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-1.5">
            <PlusCircle className="w-5 h-5 text-teal-600" /> Register Patient in Care Network
          </h2>

          {newlyRegisteredPatient ? (
            /* Registration Success screen */
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Patient Registered Successfully!</h3>
                <p className="text-xs text-slate-400 mt-1">A secure patient record is created in SQLite.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-sm mx-auto space-y-2">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Local UID</span>
                  <span className="text-base font-mono font-bold text-teal-700 bg-teal-50/50 border border-teal-150 px-2 py-0.5 rounded select-all">
                    {newlyRegisteredPatient.id}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</span>
                  <span className="text-sm font-semibold text-slate-800">{newlyRegisteredPatient.name}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Policy Number</span>
                  <span className="text-xs font-mono font-medium text-slate-600">{newlyRegisteredPatient.policy_details?.policy_number || 'N/A'}</span>
                </div>
              </div>

              <div className="pt-4 flex gap-3 max-w-sm mx-auto">
                <button 
                  onClick={() => {
                    fetchPatientData(newlyRegisteredPatient.id)
                    setNewlyRegisteredPatient(null)
                    setAdminView('patient-profile')
                  }}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Open Patient Profile
                </button>
                <button 
                  onClick={() => setNewlyRegisteredPatient(null)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Register Another
                </button>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Full Name</label>
                <input 
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-850 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Phone Number</label>
                  <input 
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    type="tel"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-850 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Date of Birth</label>
                  <input 
                    required
                    value={regDob}
                    onChange={(e) => setRegDob(e.target.value)}
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-teal-500 text-slate-750"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Do you have health insurance?</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                    <input 
                      type="radio" 
                      name="regHasInsurance" 
                      value="YES"
                      checked={regHasInsurance === 'YES'} 
                      onChange={() => setRegHasInsurance('YES')}
                      className="accent-teal-600"
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                    <input 
                      type="radio" 
                      name="regHasInsurance" 
                      value="NO"
                      checked={regHasInsurance === 'NO'} 
                      onChange={() => setRegHasInsurance('NO')}
                      className="accent-teal-600"
                    />
                    No
                  </label>
                </div>
              </div>

              {regHasInsurance === 'YES' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <label className="text-xs font-semibold text-slate-500 block">Upload Insurance Document</label>
                  <input 
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setRegInsuranceFile(e.target.files[0])}
                    className="text-xs text-slate-600 block w-full focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-slate-200 file:bg-white file:text-slate-700 file:font-semibold hover:file:bg-slate-50 file:cursor-pointer"
                  />
                  {regInsuranceFile && (
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                      ✓ Insurance document uploaded
                    </span>
                  )}
                </div>
              )}
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate UID & Save Profile
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  const renderAdminPatients = () => {
    const filteredPatients = allPatients.filter(p => 
      p.id.toLowerCase().includes(patientsSearchQuery.toLowerCase()) ||
      (p.name && p.name.toLowerCase().includes(patientsSearchQuery.toLowerCase()))
    )

    return (
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              value={patientsSearchQuery}
              onChange={(e) => setPatientsSearchQuery(e.target.value)}
              placeholder="Search patients by name or UID..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-850"
            />
          </div>
          <button 
            onClick={() => { setNewlyRegisteredPatient(null); setAdminView('register'); }}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Register Patient
          </button>
        </div>

        {/* Patients Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {filteredPatients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Local UID</th>
                    <th className="px-6 py-3.5">Patient Name</th>
                    <th className="px-6 py-3.5">Contact Phone</th>
                    <th className="px-6 py-3.5">Date of Birth</th>
                    <th className="px-6 py-3.5">Insurer Network</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPatients.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono font-bold text-teal-750">{p.id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{p.name || 'N/A'}</td>
                      <td className="px-6 py-4">{p.phone || 'N/A'}</td>
                      <td className="px-6 py-4">{formatToIndianDate(p.dob) || 'N/A'}</td>
                      <td className="px-6 py-4">{p.policy_details?.insurer || 'N/A'}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => { fetchPatientData(p.id); setAdminView('patient-profile'); }}
                          className="bg-primary-dark hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold transition-all text-[11px] shadow-sm cursor-pointer"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Patients Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {patientsSearchQuery ? "No registered patient records match your search filter." : "Get started by registering a new patient on the care network."}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderAdminPatientProfile = () => {
    if (!activePatient) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <Activity className="w-12 h-12 text-slate-350 mx-auto mb-3 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-800">Synchronizing Patient Brief</h3>
          <p className="text-xs text-slate-400 mt-1">Retrieving health records from SQLite...</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Back and Header Bar */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setAdminView('patients')}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            ← Back to Patient Directory
          </button>
          
          <div className="flex items-center gap-2 relative">
            {clinicalBrief && (
              <button 
                onClick={() => downloadBriefPDF(activePatient, clinicalBrief)}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> Print Summary Report
              </button>
            )}
            
            {/* Actions Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                Actions <span className="text-[10px]">▼</span>
              </button>
              
              {showActionsMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowActionsMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 origin-top-right">
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowDeletePatientModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Patient Profile
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Patient Grid Details */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Demographics, Upload, & Deletion (Col 4) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Demographics Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-teal-600"></div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Patient Profile</span>
              <h2 className="text-lg font-bold text-slate-800 leading-tight mb-2.5">{activePatient.name || "UID Registered"}</h2>
              
              <div className="space-y-1.5 text-xs text-slate-700 pb-3 border-b border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Local UID:</span>
                  <span className="font-mono font-bold">{activePatient.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date of Birth:</span>
                  <span>{formatToIndianDate(activePatient.dob) || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone Number:</span>
                  <span>{activePatient.phone || "N/A"}</span>
                </div>
              </div>

              {/* Insurance Profile Section */}
              <div className="mt-2.5 pt-0.5">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Insurance Profile</span>
                {activePatient.policy_details?.insurer ? (
                  <div className="bg-teal-50/50 border border-teal-150 rounded-xl p-2 space-y-1.5">
                    <div>
                      <span className="text-[8px] uppercase font-bold text-teal-800 block leading-none">Insurer</span>
                      <span className="text-xs font-bold text-slate-800 block mt-0">{activePatient.policy_details.insurer}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 border-t border-teal-100 pt-1 text-xs">
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-450 block leading-none">Policy No.</span>
                        <span className="font-mono font-bold text-slate-700 block mt-0">{activePatient.policy_details.policy_number || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-450 block leading-none">Coverage</span>
                        <span className="font-bold text-slate-700 block mt-0">
                          {activePatient.policy_details.coverage_limit ? `₹${activePatient.policy_details.coverage_limit.toLocaleString()}` : "N/A"}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setAdminView('insurance')}
                      className="w-full bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 hover:border-teal-300 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" /> Manage Insurance
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-center space-y-1">
                    <span className="text-xs font-semibold text-slate-500 block">No Active Insurance Profile</span>
                    <button 
                      onClick={() => setAdminView('insurance')}
                      className="mx-auto bg-white hover:bg-slate-100 text-slate-700 border border-slate-250 py-1 px-3 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" /> Create Insurance Profile
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Records */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5 uppercase tracking-wider text-slate-500">
                <Upload className="w-4 h-4 text-slate-500" /> Ingest Medical Records
              </h3>
              <label className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${uploading ? 'bg-teal-50/20 border-teal-200 cursor-not-allowed' : 'border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-slate-100/50'}`}>
                {uploading ? (
                  <>
                    <svg className="animate-spin h-8 w-8 text-teal-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs font-semibold text-slate-600">
                      AI Engine Reading...
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-teal-600 mb-2 transition-colors" />
                    <span className="text-xs font-semibold text-slate-600">
                      Upload Clinical File
                    </span>
                  </>
                )}
                <span className="text-[10px] text-slate-400 mt-1">Accepts PDFs or photos</span>
                
                <input 
                  type="file" 
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden" 
                  accept="application/pdf,image/*"
                />
              </label>
              <p className="text-[9px] text-slate-400 mt-2 text-center leading-normal">
                Uploaded file parses via AI and binds strictly under patient UID: <span className="font-mono font-bold text-slate-600">{activePatient.id}</span>
              </p>
            </div>
          </div>
          {/* Center Column: Clinical Context & CDSS (Col 5) */}
          <div className="xl:col-span-5 space-y-6">
            
            {/* Clinical Brief Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center shrink-0 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800">AI Clinical Summary & CDSS</h3>
                <div className="flex items-center gap-2">
                  {clinicalBrief && (
                    <button
                      onClick={() => downloadBriefPDF(activePatient, clinicalBrief)}
                      className="flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-700 px-2.5 py-1 rounded text-[11px] font-bold border border-teal-100 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Summary
                    </button>
                  )}
                  {briefLoading && <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />}
                </div>
              </div>

              {timeline.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                  <Activity className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No clinical context compiled yet.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Drop a prescription or report to construct summaries.</p>
                </div>
              ) : clinicalBrief ? (
                <div className="space-y-4">
                  {/* Clinical Context chips */}
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Detected Conditions</span>
                    {clinicalContexts.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {clinicalContexts.map(ctx => (
                          <button
                            key={ctx.id}
                            onClick={() => applyClinicalContext(ctx)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all select-none cursor-pointer border ${
                              selectedContextId === ctx.id && activeSummaryMode === 'disease'
                                ? 'bg-teal-600 border-teal-600 text-white shadow-sm font-bold'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                            }`}
                          >
                            {ctx.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 px-0.5">
                        No chronic clinical conditions identified in EMR.
                      </p>
                    )}
                  </div>

                  {/* Summary Mode Tab selector */}
                  <div className="bg-slate-50 border border-slate-200 p-1 rounded-lg space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-1">Summary Views</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'complete', label: 'Complete History' },
                        { id: 'recent', label: 'Recent Updates' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => {
                            setActiveSummaryMode(mode.id);
                            setSelectedContextId(null);
                          }}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all select-none cursor-pointer border ${
                            activeSummaryMode === mode.id 
                              ? 'bg-teal-600 border-teal-600 text-white shadow-sm font-bold' 
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[240px] overflow-y-auto pr-2">
                  {/* CDSS Allergy Warning box */}
                  {clinicalBrief.warnings && clinicalBrief.warnings.length > 0 ? (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-lg p-3 space-y-1.5">
                      {clinicalBrief.warnings.map((w, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-rose-905 font-bold text-rose-900">{w.type}:</strong> {w.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg p-2.5 flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>No active drug-allergy or duplicates conflicts detected.</span>
                    </div>
                  )}

                  {/* Clinical Brief Summary Text */}
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {activeSummaryMode === 'disease' && selectedContextId
                        ? `${(clinicalContexts.find(c => c.id === selectedContextId)?.label || 'Condition')} Progression Brief`
                        : 'Visit Summary Brief'}
                    </span>
                    {renderClinicalSummary(clinicalBrief.clinical_summary)}
                  </div>

                  {/* Active Diagnoses List */}
                  {clinicalBrief.active_problems && clinicalBrief.active_problems.length > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Diagnoses Directory</span>
                      <div className="flex flex-wrap gap-1.5">
                        {clinicalBrief.active_problems.map((p, idx) => (
                          <span key={idx} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                            {parseActiveProblemItem(p)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prescriptions Table */}
                  {clinicalBrief.current_medications && clinicalBrief.current_medications.length > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Prescription Profile</span>
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
                            {clinicalBrief.current_medications.map((item, idx) => {
                              const m = parseMedicationItem(item);
                              return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-mono font-medium text-slate-700">{m.name}</td>
                                  <td className="px-3 py-2 text-slate-500">{m.dosage}</td>
                                  <td className="px-3 py-2 text-slate-500">{m.frequency}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Biomarker Trend plots inside Profile */}
                  {getAvailableTestNames().length > 0 && (
                    <div className="pt-3.5 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lab Vitals Progression</span>
                        <span className="bg-teal-50 border border-teal-100 text-teal-700 text-[8px] font-bold px-1.5 py-0.2 rounded-full">
                          {getAvailableTestNames().length} Trends Available
                        </span>
                      </div>
                      <button 
                        onClick={() => setShowChartModal(true)}
                        className="text-[10px] font-bold text-teal-655 text-teal-600 hover:text-teal-750 transition-colors flex items-center gap-1 cursor-pointer bg-slate-50 border border-slate-200 px-2 py-0.5 rounded shadow-sm"
                      >
                        View Trends
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-400">Loading brief metrics...</p>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Claims, Timeline & Deletion Confirmation (Col 3) */}
          <div className="xl:col-span-3 space-y-6">
            


            {/* Preventive Care Scheduler */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/10 rounded-bl-full -mr-8 -mt-8"></div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider text-slate-500 mb-1">Preventive Health</h3>
              <p className="text-[11px] text-slate-500 mb-3 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" /> Annual Examination Scheduler
              </p>
              <button 
                onClick={() => handleTriggerPreventive(activePatient.id)}
                disabled={loading}
                className="w-full border border-teal-600 hover:bg-teal-50 text-teal-650 py-2 rounded-lg text-xs font-bold transition-colors relative z-10 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Schedule Home Lab Draw
              </button>
              {preventiveBookingStatus && (
                <div className={`mt-3 p-2.5 rounded text-[10px] leading-normal border relative z-10 ${
                  preventiveBookingStatus.status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                  preventiveBookingStatus.status === 'sending' ? 'bg-amber-50 border-amber-100 text-amber-805' : 'bg-rose-50 border-rose-100 text-rose-805'
                }`}>
                  {preventiveBookingStatus.msg}
                </div>
              )}
            </div>

            {/* Medical Timeline & Record Deletion */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <FileText className="w-4 h-4 text-slate-500" /> Patient Medical Records
              </h3>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {timeline.length > 0 ? (
                  timeline.map(r => (
                    <div 
                      key={r.id}
                      onClick={() => setSelectedRecordForView(r)}
                      className="flex justify-between items-center bg-white hover:bg-slate-50 border border-slate-200 rounded-lg p-2.5 shadow-sm transition-all cursor-pointer relative pl-5 group"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${
                        r.record_type === "Prescription" ? "bg-teal-500" :
                        r.record_type === "Lab Report" ? "bg-amber-500" : "bg-slate-400"
                      }`}></div>
                      
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>{r.record_type === "Prescription" ? "📜 Prescription" : "🔬 Lab Report"}</span>
                          <span>•</span>
                          <span className="font-mono">{formatToIndianDate(r.date) || 'N/A'}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-850 truncate mt-0.5" title={r.parsed_json?.diagnoses?.join(", ") || r.parsed_json?.hospital_name}>
                          {r.parsed_json?.diagnoses?.join(", ") || r.parsed_json?.hospital_name || "Parsed Clinical Entry"}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowDeleteRecordModal(r); }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors focus:outline-none cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Delete this record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center bg-white border border-slate-100 rounded-lg">
                    No documents present in patient timeline.
                  </p>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Record Deletion Confirmation Modal Overlay */}
        {showDeleteRecordModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-3 text-rose-605 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-bold text-slate-805 text-sm text-slate-800">Delete Medical Record</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to delete record <span className="font-mono font-bold text-slate-700">#{showDeleteRecordModal.id}</span> ({showDeleteRecordModal.record_type})? This will permanently remove the parsed data and stored file.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDeleteRecord(showDeleteRecordModal.id)}
                  disabled={loading}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Yes, Delete Record
                </button>
                <button 
                  onClick={() => setShowDeleteRecordModal(null)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-755 text-slate-700 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record Detail Modal Overlay */}
        {selectedRecordForView && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-teal-400">
                    {selectedRecordForView.record_type === "Prescription" ? "📜 Prescription Detail" : "🔬 Lab Report Detail"}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Record ID: #{selectedRecordForView.id} | Date: {formatToIndianDate(selectedRecordForView.date) || "N/A"}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedRecordForView(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-800 text-xs">
                {/* General Source details */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Source Filename</span>
                    <span className="font-mono text-slate-700 truncate block mt-0.5" title={selectedRecordForView.file_path}>
                      {selectedRecordForView.file_path ? selectedRecordForView.file_path.split('/').pop().split('\\').pop() : 'Direct Upload'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Upload Timestamp</span>
                    <span className="text-slate-700 block mt-0.5">
                      {new Date(selectedRecordForView.created_at).toLocaleString() || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Dynamic Render based on type */}
                {selectedRecordForView.record_type === "Prescription" ? (
                  <div className="space-y-4">
                    {/* Diagnoses */}
                    <div>
                      <h4 className="font-bold mb-1.5 uppercase tracking-wider text-[9px] text-slate-400">Diagnoses</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRecordForView.parsed_json?.diagnoses?.map((d, idx) => (
                          <span key={idx} className="bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded font-medium">
                            {d}
                          </span>
                        )) || <span className="text-slate-400">No diagnoses parsed</span>}
                      </div>
                    </div>

                    {/* Medications */}
                    <div>
                      <h4 className="font-bold mb-1.5 uppercase tracking-wider text-[9px] text-slate-400">Medications</h4>
                      {selectedRecordForView.parsed_json?.medications && selectedRecordForView.parsed_json.medications.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
                              <tr>
                                <th className="px-3 py-2">Medication</th>
                                <th className="px-3 py-2">Dosage</th>
                                <th className="px-3 py-2">Frequency</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedRecordForView.parsed_json.medications.map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-mono font-medium text-slate-700">{m.name}</td>
                                  <td className="px-3 py-2 text-slate-500">{m.dosage || 'N/A'}</td>
                                  <td className="px-3 py-2 text-slate-500">{m.frequency || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No medications found in this prescription</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Lab Results Table */}
                    <div>
                      <h4 className="font-bold mb-1.5 uppercase tracking-wider text-[9px] text-slate-400">Lab Results / Biomarkers</h4>
                      {selectedRecordForView.parsed_json?.test_results && selectedRecordForView.parsed_json.test_results.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
                              <tr>
                                <th className="px-3 py-2">Test / Biomarker</th>
                                <th className="px-3 py-2">Value</th>
                                <th className="px-3 py-2">Reference Range</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedRecordForView.parsed_json.test_results.map((t, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-medium text-slate-700">{t.name}</td>
                                  <td className="px-3 py-2 font-mono font-bold text-teal-700">
                                    {t.value} {t.unit || ''}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500 font-mono">{t.reference_range || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No lab values parsed from this report</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Generic Notes */}
                {selectedRecordForView.parsed_json?.notes && (
                  <div>
                    <h4 className="font-bold mb-1 uppercase tracking-wider text-[9px] text-slate-400">Clinical Notes</h4>
                    <p className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-655 leading-relaxed font-mono text-[11px]">
                      {selectedRecordForView.parsed_json.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                {selectedRecordForView.file_path ? (
                  <a 
                    href={getFileUrl(selectedRecordForView.file_path)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> View Original Document
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Direct Manual Entry (No Attachment)</span>
                )}
                
                <button 
                  onClick={() => setSelectedRecordForView(null)}
                  className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Patient Profile Deletion Confirmation Modal Overlay */}
        {showDeletePatientModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-bold text-slate-800 text-sm">Delete Patient Profile</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to delete patient <span className="font-mono font-bold text-slate-700">{activePatient.id}</span> ({activePatient.name})? 
                This will permanently delete the patient profile and all associated medical records. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDeletePatient(activePatient.id)}
                  disabled={loading}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Delete Permanently
                </button>
                <button 
                  onClick={() => setShowDeletePatientModal(false)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lab Trends Chart Modal Overlay */}
        {showChartModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl w-full flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-teal-400">
                    🔬 Lab Vital Progression Trends
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Longitudinal tracking of patient vital biomarkers
                  </p>
                </div>
                <button 
                  onClick={() => setShowChartModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-650 font-bold text-slate-700">Biomarker Trend Metric:</span>
                  <select 
                    value={selectedChartTest}
                    onChange={(e) => setSelectedChartTest(e.target.value)}
                    className="text-xs bg-white border border-slate-250 rounded px-2.5 py-1 focus:outline-none focus:border-teal-500 font-bold text-slate-755 text-slate-700"
                  >
                    {getAvailableTestNames().map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="h-64 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getBiomarkerChartData()} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                      <Line 
                        name={`${selectedChartTest}`}
                        type="monotone" 
                        dataKey="value" 
                        stroke="#0d9488" 
                        strokeWidth={2.5} 
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end shrink-0">
                <button 
                  onClick={() => setShowChartModal(false)}
                  className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Close Trends
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Prototype Simulated Email Preview Modal */}
        {activePreviewEmail && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="bg-slate-900 text-slate-100 px-5 py-4 flex justify-between items-center border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <Send className="w-4.5 h-4.5 text-teal-400 shrink-0" /> [PROTOTYPE] Simulated Email Dispatch
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Verification sandbox simulation showing generated email draft parameters.
                  </p>
                </div>
                <button 
                  onClick={() => setActivePreviewEmail(null)}
                  className="text-slate-400 hover:text-slate-100 transition-colors font-bold text-lg p-1.5 focus:outline-none cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Email Metadata */}
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 text-xs space-y-1">
                <p><span className="font-bold text-slate-500">To:</span> <span className="font-mono text-slate-700">{activePreviewEmail.recipient}</span></p>
                <p><span className="font-bold text-slate-500">Subject:</span> <span className="font-semibold text-slate-800">{activePreviewEmail.subject}</span></p>
              </div>

              {/* Email Body */}
              <div className="p-5 overflow-y-auto flex-1 font-mono text-[11px] text-slate-655 bg-slate-50/50 whitespace-pre-wrap leading-relaxed border-b border-slate-150">
                {activePreviewEmail.body}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-white flex justify-end">
                <button 
                  onClick={() => setActivePreviewEmail(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderAdminEmergency = () => {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center space-y-3">
        <MapPin className="w-12 h-12 text-rose-600 mx-auto animate-bounce" />
        <h3 className="text-base font-bold text-slate-850">Emergency Referral Center</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
          This module handles automated emergency transfer summaries and sends parsed FHIR records to receiving clinics in real-time.
        </p>
        <span className="inline-block bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 rounded text-[11px] font-mono font-bold">
          Feature Coming Soon
        </span>
      </div>
    )
  }

  const renderAdminRecords = () => {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Activity className="w-4.5 h-4.5 text-slate-500" /> Global Activity Logs (Medical Records Feed)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Showing chronological ingestion events across all patients registered on AyuSeva.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {globalRecordsLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-teal-600 mx-auto mb-2 animate-spin" />
              <p className="text-xs text-slate-400">Fetching activity logs from SQLite...</p>
            </div>
          ) : globalRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Record ID</th>
                    <th className="px-6 py-3.5">Patient UID</th>
                    <th className="px-6 py-3.5">Patient Name</th>
                    <th className="px-6 py-3.5">Record Type</th>
                    <th className="px-6 py-3.5">Report Date</th>
                    <th className="px-6 py-3.5">Source File</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-707 text-slate-700">
                  {globalRecords.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono text-slate-550">#{r.id}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-teal-750">{r.patient_id}</td>
                      <td className="px-6 py-4 font-bold text-slate-850 text-slate-800">{r.patient_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.record_type === 'Prescription' ? 'bg-teal-50 border-teal-100 text-teal-700' :
                          r.record_type === 'Lab Report' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-650'
                        }`}>
                          {r.record_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">{formatToIndianDate(r.date) || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-450 truncate max-w-[150px] font-mono text-[10.5px]" title={r.file_path}>
                        {r.file_path ? r.file_path.split('/').pop().split('\\').pop() : 'Direct Upload'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => { fetchPatientData(r.patient_id); setAdminView('patient-profile'); }}
                          className="border border-slate-200 hover:bg-slate-50 text-slate-705 px-2.5 py-1 rounded font-bold transition-all text-[11px] cursor-pointer shadow-sm text-slate-700"
                        >
                          Open Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Activity Logged</h3>
              <p className="text-xs text-slate-400 mt-1">Upload records in patient profiles to generate activity logs.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const handleInitCashlessClaim = async (contextLabel) => {
    setClaimInitializing(true)
    try {
      const res = await fetch(`${BASE_URL}/api/claims/patient/${activePatient.id}/cashless/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinical_context: contextLabel })
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to initialize cashless claim")
      }
      const newClaim = await res.json()
      setActiveClaim(newClaim)
      setIsCreatingClaim(false)
      
      // Refresh claims list
      const claimsRes = await fetch(`${BASE_URL}/api/claims/patient/${activePatient.id}`)
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json()
        setClaims(claimsData)
      }
    } catch (err) {
      alert("Error: " + err.message)
    } finally {
      setClaimInitializing(false)
    }
  }

  const handleSaveClaimDetails = async (updatedClaim) => {
    try {
      const res = await fetch(`${BASE_URL}/api/claims/${updatedClaim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedure_name: updatedClaim.procedure_name,
          estimated_cost: updatedClaim.estimated_cost,
          status: updatedClaim.status,
          selected_records: updatedClaim.selected_records,
          generated_form_data: updatedClaim.generated_form_data,
          email_preview: updatedClaim.email_preview,
          insurer_response: updatedClaim.insurer_response
        })
      })
      if (!res.ok) throw new Error("Failed to save claim details")
      const saved = await res.json()
      setActiveClaim(saved)
      setClaims(prev => prev.map(c => c.id === saved.id ? saved : c))
    } catch (err) {
      console.error("Failed to save claim draft:", err)
    }
  }

  const handleFormChange = (field, value) => {
    setActiveClaim(prev => {
      const nextForm = { ...prev.generated_form_data, [field]: value }
      const next = { ...prev, generated_form_data: nextForm }
      if (field === 'treatment_procedure') {
        next.procedure_name = value
      }
      if (field === 'estimated_cost') {
        const floatCost = parseFloat(value)
        next.estimated_cost = isNaN(floatCost) ? null : floatCost
      }
      return next
    })
  }

  const handleEmailChange = (field, value) => {
    setActiveClaim(prev => {
      const nextEmail = { ...prev.email_preview, [field]: value }
      return { ...prev, email_preview: nextEmail }
    })
  }

  const handleToggleRecord = (recordId) => {
    setActiveClaim(prev => {
      const isSelected = prev.selected_records?.includes(recordId)
      const nextSelected = isSelected 
        ? prev.selected_records.filter(id => id !== recordId)
        : [...(prev.selected_records || []), recordId]
      return { ...prev, selected_records: nextSelected }
    })
  }

  const handleUploadSupportingDocument = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeClaim) return
    
    // Auto-save form fields to backend first so no changes are lost
    await handleSaveClaimDetails(activeClaim)
    
    const formData = new FormData()
    formData.append("file", file)
    
    try {
      const res = await fetch(`${BASE_URL}/api/claims/${activeClaim.id}/supporting-document`, {
        method: "POST",
        body: formData
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to upload supporting document")
      }
      const data = await res.json()
      setActiveClaim(prev => ({
        ...prev,
        supporting_documents: data.supporting_documents
      }))
      setClaims(prev => prev.map(c => c.id === activeClaim.id ? { ...c, supporting_documents: data.supporting_documents } : c))
    } catch (err) {
      alert("Error uploading supporting document: " + err.message)
    }
  }

  const handleRemoveSupportingDocument = async (filePath) => {
    if (!activeClaim) return
    try {
      const res = await fetch(`${BASE_URL}/api/claims/${activeClaim.id}/supporting-document?file_path=${encodeURIComponent(filePath)}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to remove supporting document")
      }
      const data = await res.json()
      setActiveClaim(prev => ({
        ...prev,
        supporting_documents: data.supporting_documents
      }))
      setClaims(prev => prev.map(c => c.id === activeClaim.id ? { ...c, supporting_documents: data.supporting_documents } : c))
    } catch (err) {
      alert("Error removing supporting document: " + err.message)
    }
  }

  const handleSendCashlessClaim = async () => {
    if (!activeClaim) return
    setClaimSubmitting(true)
    try {
      // First save current state
      await handleSaveClaimDetails(activeClaim)
      
      const res = await fetch(`${BASE_URL}/api/claims/${activeClaim.id}/submit`, {
        method: "POST"
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to submit pre-auth claim")
      }
      const data = await res.json()
      alert("Cashless Pre-Authorization Claim successfully sent to TPA: " + data.tpa_email)
      
      // Fetch updated details from database (will be "Sent")
      const detailRes = await fetch(`${BASE_URL}/api/claims/${activeClaim.id}`)
      if (detailRes.ok) {
        const updated = await detailRes.json()
        setActiveClaim(updated)
        setClaims(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
    } catch (err) {
      alert("Submission Error: " + err.message)
      // Refresh claim state to reflect failure (Failed status)
      const detailRes = await fetch(`${BASE_URL}/api/claims/${activeClaim.id}`)
      if (detailRes.ok) {
        const updated = await detailRes.json()
        setActiveClaim(updated)
        setClaims(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
    } finally {
      setClaimSubmitting(false)
    }
  }

  const handleSimulateResponse = async (status, comments) => {
    if (!activeClaim) return
    try {
      const res = await fetch(`${BASE_URL}/api/claims/${activeClaim.id}/simulate-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, insurer_response: comments })
      })
      if (!res.ok) throw new Error("Simulation failed")
      const updated = await res.json()
      setActiveClaim(updated)
      setClaims(prev => prev.map(c => c.id === updated.id ? updated : c))
      alert(`Simulation completed. Claim is now: ${status}`)
    } catch (err) {
      alert("Error: " + err.message)
    }
  }

  const getAIExplanation = (recordId) => {
    const recordsExplanationList = activeClaim?.policy_check_details?.relevant_records || []
    const match = recordsExplanationList.find(r => r.record_id === recordId)
    return match ? match.explanation : "No analysis details provided."
  }

  const renderContextSelection = () => {
    return (
      <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div>
          <h4 className="text-xs font-bold text-slate-800">Select Clinical Context</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Select the specific clinical context or treatment episode for which the cashless claim is being filed.
          </p>
        </div>

        {claimInitializing ? (
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-teal-600 bg-teal-50/50 border border-teal-100 p-6 rounded-lg">
            <RefreshCw className="w-4 h-4 animate-spin" />
            AI Reasoning Engine auditing policy coverages and selecting relevant EMR records...
          </div>
        ) : (
          <>
            {clinicalContexts && clinicalContexts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {clinicalContexts.map((ctx) => (
                  <button
                    key={ctx.id}
                    onClick={() => handleInitCashlessClaim(ctx.label)}
                    className="border border-slate-200 bg-white hover:bg-slate-100 p-3 rounded-lg text-left transition-all hover:border-teal-500 cursor-pointer group flex flex-col justify-between h-20"
                  >
                    <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 line-clamp-1">{ctx.label}</div>
                    <div className="flex justify-between items-center w-full mt-2">
                      <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded uppercase font-semibold">
                        {ctx.kind.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {formatToIndianDate(ctx.latest_date) || 'N/A'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-white border border-slate-150 rounded-lg text-slate-450 text-xs">
                No clinical contexts detected for this patient. Please upload medical records first.
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={() => setIsCreatingClaim(false)}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const renderClaimWorkspace = () => {
    const isSent = activeClaim.status === 'Sent'
    const isApproved = activeClaim.status === 'Approved'
    const isRejected = activeClaim.status === 'Rejected'
    const isLocked = isSent || isApproved || isRejected
    const hasActivePolicy = insuranceData && insuranceData.active_policy
    const active_policy = insuranceData?.active_policy
    const insurerEmail = activeClaim.email_preview?.recipient || insuranceData.active_policy?.insurer_email || 'tpa-claims-sandbox@ayuseva.com'

    return (
      <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in fade-in duration-200">
        
        {/* Workspace Title & Info */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-3 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800">
                Cashless Claim Workspace: {activeClaim.clinical_context}
              </h4>
              <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                activeClaim.status === 'Sent' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                activeClaim.status === 'Approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                activeClaim.status === 'Rejected' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                activeClaim.status === 'Failed' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                {activeClaim.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-450 mt-0.5 font-mono">
              Draft ID: CLAIM-{activeClaim.id} | Created: {formatToIndianDate(activeClaim.created_at?.split('T')[0] || activeClaim.created_at)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSaveClaimDetails(activeClaim)}
              disabled={isLocked || claimSubmitting}
              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => { setActiveClaim(null); }}
              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Close Workspace
            </button>
          </div>
        </div>

        {/* Missing Info Box */}
        {activeClaim.missing_info && activeClaim.missing_info.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-850 flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[9px] text-amber-700 block">Missing Information</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {activeClaim.missing_info.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-55/10 border border-emerald-250 text-emerald-850 rounded-xl p-3 text-xs flex items-start gap-2 leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[9px] text-emerald-700 block">Audit Checklist Complete</span>
              <p className="mt-0.5 text-emerald-700">All required documents and treatment details identified in EMR context records.</p>
            </div>
          </div>
        )}

        {/* Workspace Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Form & Checklist */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Pre-filled Cashless Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <span className="text-[9px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                Pre-Authorization Cashless Form
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Patient Name</label>
                  <input
                    disabled
                    value={activePatient.name || ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Patient UID</label>
                  <input
                    disabled
                    value={activePatient.id || ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Diagnosis (Context Specific)</label>
                  <input
                    disabled={isLocked}
                    value={activeClaim.generated_form_data?.diagnosis || ''}
                    onChange={(e) => handleFormChange('diagnosis', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Advised Treatment/Procedure</label>
                  <input
                    disabled={isLocked}
                    value={activeClaim.generated_form_data?.treatment_procedure || ''}
                    onChange={(e) => handleFormChange('treatment_procedure', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Proposed Admission Date</label>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={activeClaim.generated_form_data?.admission_date && activeClaim.generated_form_data.admission_date !== "Not available in current records" ? activeClaim.generated_form_data.admission_date : ''}
                    onChange={(e) => handleFormChange('admission_date', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={activeClaim.generated_form_data?.estimated_cost && activeClaim.generated_form_data.estimated_cost !== "Not available in current records" ? activeClaim.generated_form_data.estimated_cost : ''}
                    onChange={(e) => handleFormChange('estimated_cost', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Clinical Findings Summary</label>
                <textarea
                  disabled={isLocked}
                  rows={2}
                  value={activeClaim.generated_form_data?.clinical_findings || ''}
                  onChange={(e) => handleFormChange('clinical_findings', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 leading-normal"
                />
              </div>
            </div>

            {/* EMR Document Checklist */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <span className="text-[9px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                Document Attachments Checklist
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">
                AI has pre-selected records matching this clinical context. Check/uncheck documents to modify the claim packet.
              </p>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {timeline && timeline.length > 0 ? (
                  timeline.map((r) => {
                    const isAttached = activeClaim.selected_records?.includes(r.id)
                    const aiExplanation = getAIExplanation(r.id)
                    const isHighRelevance = (activeClaim?.policy_check_details?.relevant_records || [])
                      .find(item => item.record_id === r.id)?.relevance === 'High'

                    return (
                      <div key={r.id} className="border border-slate-100 hover:bg-slate-50/50 rounded-lg p-2.5 flex items-start gap-2.5 text-xs">
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={isAttached}
                          onChange={() => handleToggleRecord(r.id)}
                          className="mt-1 accent-teal-600 cursor-pointer h-4 w-4"
                        />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800">{r.record_type}</span>
                            <span className="text-[8px] font-mono text-slate-400">({formatToIndianDate(r.date) || 'N/A'})</span>
                            {isHighRelevance ? (
                              <span className="text-[8px] bg-teal-50 text-teal-600 font-bold px-1.5 py-0.2 rounded uppercase">
                                High Relevance
                              </span>
                            ) : (
                              <span className="text-[8px] bg-slate-100 text-slate-450 font-medium px-1.5 py-0.2 rounded uppercase">
                                Low Relevance
                              </span>
                            )}
                          </div>
                          <p className="text-[9.5px] text-slate-500 leading-normal">
                            <strong className="text-teal-700">AI Analysis:</strong> {aiExplanation}
                          </p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-4">No medical records uploaded for this patient.</p>
                )}
              </div>

              {/* Manually added supporting documents */}
              {activeClaim.supporting_documents && activeClaim.supporting_documents.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                    Manually Attached Supporting Documents
                  </span>
                  <div className="space-y-1.5">
                    {activeClaim.supporting_documents.map((doc, idx) => (
                      <div key={idx} className="border border-teal-100 bg-teal-50/20 rounded-lg p-2.5 flex items-center justify-between gap-2.5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-teal-700 text-[8px] bg-teal-50 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            Manually Added
                          </span>
                          <span className="font-medium text-slate-800 truncate">{doc.file_name}</span>
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSupportingDocument(doc.file_path)}
                            className="text-[10px] text-red-500 hover:text-red-700 hover:underline shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Supporting Document trigger button */}
              {!isLocked && (
                <div className="pt-1.5">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-350 rounded-lg cursor-pointer text-xs text-slate-600 hover:text-slate-800 transition-colors font-medium">
                    <svg className="w-3.5 h-3.5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Add Supporting Document</span>
                    <input
                      type="file"
                      onChange={handleUploadSupportingDocument}
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                  </label>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Policy Check & Email Preview */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* AI Policy Check */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <span className="text-[9px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                AI Insurance Policy Check
              </span>
              
              <div className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Carrier:</span>
                  <span className="font-bold text-teal-400">{active_policy?.insurer}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Pre-Auth Eligibility:</span>
                  <span className={`font-bold uppercase ${
                    activeClaim.policy_check_status === 'Appears Eligible' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>{activeClaim.policy_check_status}</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-normal border-t border-slate-700/60 pt-2 mt-1 italic">
                  {activeClaim.policy_check_details?.coverage_summary || "Policy coverage details evaluated by AI."}
                </p>
              </div>

              {activeClaim.policy_check_details?.exclusions_found && activeClaim.policy_check_details.exclusions_found.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-xs text-rose-800">
                  <span className="font-bold text-[8.5px] uppercase tracking-wider block text-rose-700">Excluded Under Policy Rules</span>
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[9.5px]">
                    {activeClaim.policy_check_details.exclusions_found.map((e, idx) => <li key={idx}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Email Preview Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <span className="text-[9px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                Covering Email Preview
              </span>
              
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Insurer TPA Email</label>
                  <input
                    disabled
                    value={insurerEmail}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-650"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Subject</label>
                  <input
                    disabled={isLocked}
                    value={activeClaim.email_preview?.subject || ''}
                    onChange={(e) => handleEmailChange('subject', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Covering Body</label>
                  <textarea
                    disabled={isLocked}
                    rows={4}
                    value={activeClaim.email_preview?.body || ''}
                    onChange={(e) => handleEmailChange('body', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 leading-normal"
                  />
                </div>
              </div>

              {!isLocked && (
                <button
                  onClick={handleSendCashlessClaim}
                  disabled={claimSubmitting}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {claimSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Cashless Claim Package
                </button>
              )}
            </div>

            {/* Simulated Insurer responses (for prototype) */}
            {isSent && (
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                <span className="text-[9px] text-slate-550 uppercase font-bold tracking-wider block">
                  Simulate Insurer / TPA Response
                </span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  In sandbox environment, simulate response feedback events back to the hospital.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSimulateResponse("Approved", "Pre-authorization approved for ₹" + (activeClaim.estimated_cost || 0).toLocaleString() + ". Authorization ID: AUTH-" + Math.floor(Math.random()*90000+10000))}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded text-[10.5px] cursor-pointer text-center"
                  >
                    Simulate Approve
                  </button>
                  <button
                    onClick={() => handleSimulateResponse("Rejected", "Pre-authorization rejected. Condition is subject to a 24-month waiting period for pre-existing diseases.")}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 rounded text-[10.5px] cursor-pointer text-center"
                  >
                    Simulate Reject
                  </button>
                  <button
                    onClick={() => handleSimulateResponse("Additional Information Required", "TPA Request: Please provide preoperative MRI imaging scans and diagnostic blood reports.")}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 rounded text-[10.5px] cursor-pointer text-center"
                  >
                    Simulate Add Info
                  </button>
                  <button
                    onClick={() => handleSimulateResponse("Partially Approved", "Approved for ₹" + ((activeClaim.estimated_cost || 0)*0.7).toLocaleString() + ". Remaining 30% subject to patient co-pay clause.")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded text-[10.5px] cursor-pointer text-center"
                  >
                    Simulate Co-pay
                  </button>
                </div>
              </div>
            )}

            {/* Insurer comments display */}
            {activeClaim.insurer_response && (
              <div className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs space-y-1">
                <span className="font-bold text-[8.5px] uppercase tracking-wider text-teal-400 block">Insurer Feedback Comments</span>
                <p className="font-mono text-[10px] leading-relaxed text-slate-300">
                  {activeClaim.insurer_response}
                </p>
              </div>
            )}

          </div>

        </div>

      </div>
    )
  }

  const renderClaimsHistory = () => {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider text-slate-500">
            Claims History
          </h4>
        </div>

        {claims && claims.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10.5px] uppercase">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Clinical Context</th>
                  <th className="px-4 py-2.5">Procedure</th>
                  <th className="px-4 py-2.5">Estimated Cost</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-[10.5px] text-slate-450">
                      {formatToIndianDate(c.created_at?.split('T')[0] || c.created_at) || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-850">{c.clinical_context || 'N/A'}</td>
                    <td className="px-4 py-3 text-slate-650">{c.procedure_name || 'N/A'}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">
                      {c.estimated_cost ? `₹${c.estimated_cost.toLocaleString()}` : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                        c.status === 'Sent' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                        c.status === 'Approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                        c.status === 'Rejected' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                        c.status === 'Failed' ? 'bg-amber-50 border-amber-100 text-amber-705' :
                        'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setActiveClaim(c)}
                        className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-500 text-slate-700 hover:text-teal-600 font-bold px-2 py-1 rounded text-[10px] cursor-pointer shadow-sm transition-all"
                      >
                        Manage
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Delete this claim permanently from history?")) {
                            try {
                              const res = await fetch(`${BASE_URL}/api/claims/${c.id}`, { method: "DELETE" })
                              if (res.ok) {
                                setClaims(prev => prev.filter(item => item.id !== c.id))
                              }
                            } catch (e) {
                              console.error(e)
                            }
                          }
                        }}
                        className="border border-rose-100 hover:bg-rose-50 text-rose-600 p-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center justify-center"
                        title="Delete claim"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-450">
            <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold">No cashless claims history recorded.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Click Create Cashless Claim to initialize a pre-authorization query.</p>
          </div>
        )}
      </div>
    )
  }

  const renderAdminInsurance = () => {
    if (!activePatient) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <Activity className="w-12 h-12 text-slate-350 mx-auto mb-3 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-800">Loading Patient Profile</h3>
          <p className="text-xs text-slate-400 mt-1">Retrieving health records from SQLite...</p>
        </div>
      )
    }

    const { active_policy, previous_policies } = insuranceData

    const handleNewPolicyUpload = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      setInsuranceUploading(true)
      const formData = new FormData()
      formData.append("file", file)
      try {
        const res = await fetch(`${BASE_URL}/api/insurance/patient/${activePatient.id}/upload`, {
          method: 'POST',
          body: formData
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || "Failed to upload insurance policy")
        }
        alert("Insurance Policy uploaded and parsed successfully!")
        fetchPatientData(activePatient.id) // Refetch patient data & insurance
      } catch (err) {
        alert("Upload Error: " + err.message)
      } finally {
        setInsuranceUploading(false)
        e.target.value = "" // clear file input
      }
    }

    const handleArchivePolicy = async () => {
      if (!archiveConfirmPolicyId) return
      setLoading(true)
      try {
        const res = await fetch(`${BASE_URL}/api/insurance/policy/${archiveConfirmPolicyId}/archive`, {
          method: 'POST'
        })
        if (!res.ok) throw new Error("Failed to archive policy")
        setArchiveConfirmPolicyId(null)
        fetchPatientData(activePatient.id) // Refetch patient data & insurance
      } catch (err) {
        alert("Archive Error: " + err.message)
      } finally {
        setLoading(false)
      }
    }

    const handleDeletePolicy = async (policyId) => {
      setLoading(true)
      try {
        const res = await fetch(`${BASE_URL}/api/insurance/policy/${policyId}`, {
          method: 'DELETE'
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || "Failed to delete policy")
        }
        alert("Insurance policy record permanently deleted.")
        setDeleteConfirmPolicyId(null)
        fetchPatientData(activePatient.id) // Refetch patient data & insurance
      } catch (err) {
        alert("Delete Error: " + err.message)
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="space-y-4">
        {/* Patient Header */}
        <div className="bg-white border border-slate-200 rounded-xl py-2.5 px-4 shadow-sm flex justify-between items-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-teal-600"></div>
          <div>
            <span className="text-[9px] bg-teal-100 text-teal-800 font-bold tracking-wider px-2 py-0.5 rounded uppercase">
              Patient Account
            </span>
            <h2 className="text-xl font-bold text-slate-800 mt-0.5">{activePatient.name}</h2>
            <p className="text-xs text-slate-450 font-mono mt-0">Local UID: {activePatient.id}</p>
          </div>
          <button 
            onClick={() => setAdminView('patient-profile')}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            ← Back to Patient Profile
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Active Policy and History */}
          <div className="xl:col-span-8 space-y-6">
            
            {/* Active Policy Overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-teal-600" /> Active Policy Overview
                </h3>
                {active_policy ? (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold tracking-wide px-2.5 py-0.5 rounded-full uppercase">
                    Active
                  </span>
                ) : (
                  <span className="text-[9px] bg-slate-150 text-slate-500 border border-slate-200 font-bold tracking-wide px-2.5 py-0.5 rounded-full uppercase">
                    No Insurance
                  </span>
                )}
              </div>

              {active_policy ? (
                <div className="space-y-3">
                  {/* Carrier Card styling */}
                  <div className="bg-gradient-to-br from-teal-950 to-slate-900 text-white rounded-xl p-3.5 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-gradient-to-l from-teal-500/25 to-transparent pointer-events-none rounded-r-xl"></div>
                    <span className="text-[8px] bg-teal-500/30 text-teal-300 font-bold tracking-wider px-2 py-0.5 rounded uppercase">
                      Carrier Details
                    </span>
                    <h4 className="text-base font-bold mt-1">{active_policy.insurer}</h4>
                    <p className="text-[10px] text-teal-400 font-medium mt-0.5">{active_policy.policy_type || "Standard Health Plan"}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 border-t border-teal-800/40 pt-2.5 text-xs">
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">Policy Number</span>
                        <span className="font-mono font-bold text-slate-100 block mt-0.5">{active_policy.policy_number || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">Sum Insured</span>
                        <span className="font-bold text-slate-100 block mt-0.5">
                          {active_policy.sum_insured ? `₹${active_policy.sum_insured.toLocaleString()}` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">Start Date</span>
                        <span className="font-medium text-slate-100 block mt-0.5">{formatToIndianDate(active_policy.start_date) || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">Expiry Date</span>
                        <span className="font-medium text-slate-100 block mt-0.5">{formatToIndianDate(active_policy.end_date) || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Explicit Policy fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-slate-400 block border-b border-slate-200 pb-0.5">
                        Holder & Member Info
                      </span>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Policyholder:</span>
                        <span className="font-bold text-slate-800">{active_policy.policyholder_name || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Insured Member:</span>
                        <span className="font-semibold text-slate-800">{active_policy.patient_name || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Member ID:</span>
                        <span className="font-mono text-slate-800">{active_policy.member_id || "N/A"}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-slate-400 block border-b border-slate-200 pb-0.5">
                        Coverage & Cost
                      </span>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Premium Cost:</span>
                        <span className="font-bold text-slate-800">
                          {active_policy.premium ? `₹${active_policy.premium.toLocaleString()}` : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Preventive Copay:</span>
                        <span className="font-semibold text-slate-800">
                          {active_policy.preventive_eligible ? "100% Free Checkups" : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Checkups / Year:</span>
                        <span className="font-semibold text-slate-800">
                          {active_policy.checkups_per_year !== null ? `${active_policy.checkups_per_year} Sessions` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Policy Highlights / Exclusions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-teal-800 block">Benefits & Coverages</span>
                      {active_policy.benefits_coverage && active_policy.benefits_coverage.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-slate-650">
                          {active_policy.benefits_coverage.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      ) : (
                        <p className="text-slate-400 italic">No benefits coverage highlights extracted.</p>
                      )}
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-rose-800 block">Notable Exclusions & Limits</span>
                      {active_policy.conditions_limitations && active_policy.conditions_limitations.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-slate-650">
                          {active_policy.conditions_limitations.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      ) : (
                        <p className="text-slate-400 italic">No limitations/exclusions extracted.</p>
                      )}
                    </div>
                  </div>

                  {/* Document and Actions */}
                  <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => window.open(`${BASE_URL}/${active_policy.file_path}`, '_blank')}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Open Original Policy Document
                      </button>
                    </div>
                    <button 
                      onClick={() => setArchiveConfirmPolicyId(active_policy.id)}
                      className="border border-rose-200 hover:bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                    >
                      Archive & Deactivate Policy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
                  <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-slate-800">No Active Policy Uploaded</h4>
                  <p className="text-[10px] text-slate-450 mt-1 max-w-xs mx-auto leading-normal">
                    This patient has no registered insurance coverage. Upload a policy document to initiate their profile.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Upload and History */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Upload New Policy */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-slate-500">
                <Upload className="w-3.5 h-3.5 text-slate-500" /> Upload New Policy
              </h3>
              
              <p className="text-[10px] text-slate-400 leading-normal">
                Add a new policy document for this patient. This will transition the active policy to expired history.
              </p>

              <label className="border-2 border-dashed border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-slate-100/50 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-teal-600 mb-1 transition-colors" />
                <span className="text-xs font-semibold text-slate-600">
                  {insuranceUploading ? "AI Engine Reading..." : "+ Upload New Policy"}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">PDF, PNG, or JPEG formats</span>
                
                <input 
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={insuranceUploading}
                  onChange={handleNewPolicyUpload}
                  className="hidden"
                />
              </label>

              {insuranceUploading && (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-teal-600 bg-teal-50/50 border border-teal-100 p-2.5 rounded-lg">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Reading insurance document...
                </div>
              )}
            </div>

            {/* Recent Policy History */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Policy History
                </h3>
                {previous_policies && previous_policies.length > 3 && (
                  <button 
                    onClick={() => setShowAllHistoryModal(true)}
                    className="text-[10px] text-teal-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    View All &rarr;
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {previous_policies && previous_policies.length > 0 ? (
                  previous_policies.slice(0, 3).map((p) => (
                    <div key={p.id} className="border border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-lg p-2.5 flex justify-between items-center gap-2 text-[10px]">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 truncate max-w-[80px]">{p.insurer}</span>
                          <span className="text-[7.5px] bg-slate-100 border border-slate-200 text-slate-500 font-bold px-1.5 py-0.2 rounded uppercase">
                            {p.status}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 truncate font-mono">
                          No: {p.policy_number || "N/A"} | Cov: {p.sum_insured ? `₹${p.sum_insured.toLocaleString()}` : "N/A"}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {formatToIndianDate(p.start_date) || "N/A"} to {formatToIndianDate(p.end_date) || "N/A"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => window.open(`${BASE_URL}/${p.file_path}`, '_blank')}
                          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-bold h-6 cursor-pointer"
                        >
                          Doc
                        </button>
                        {p.status !== 'Active' && active_policy?.id !== p.id && (
                          <button 
                            onClick={() => setDeleteConfirmPolicyId(p.id)}
                            className="border border-rose-105 hover:bg-rose-50 text-rose-600 p-1 rounded text-[9px] font-bold h-6 flex items-center justify-center cursor-pointer border-rose-100"
                            title="Delete policy permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-400 italic py-1 text-center">No historical policies on file.</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Delete / Archive Policy Confirmation Modal Overlay */}
        {archiveConfirmPolicyId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-6 h-6" />
              </div>
              
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Remove this active insurance policy?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  This will remove the policy from the patient's active records. It will move to historical policies.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleArchivePolicy}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Confirm Archive
                </button>
                <button 
                  onClick={() => setArchiveConfirmPolicyId(null)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Policy Confirmation Modal Overlay */}
        {deleteConfirmPolicyId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xl max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Delete Historical Policy?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  This will <span className="font-bold text-rose-600">permanently delete</span> the policy record (ID: {deleteConfirmPolicyId}) and its associated data from SQLite. This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => handleDeletePolicy(deleteConfirmPolicyId)}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Confirm Delete
                </button>
                <button 
                  onClick={() => setDeleteConfirmPolicyId(null)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View All History Modal Overlay */}
        {showAllHistoryModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl max-w-2xl w-full space-y-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600" /> Complete Policy History
                </h3>
                <button 
                  onClick={() => setShowAllHistoryModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold border border-slate-200 hover:bg-slate-100 p-1.5 rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                {previous_policies && previous_policies.length > 0 ? (
                  previous_policies.map((p) => (
                    <div key={p.id} className="border border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{p.insurer}</span>
                          <span className="text-[8px] bg-slate-100 border border-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase">
                            {p.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Policy No: <span className="font-semibold text-slate-700">{p.policy_number || "N/A"}</span> | Coverage: <span className="font-bold text-slate-700">{p.sum_insured ? `₹${p.sum_insured.toLocaleString()}` : "N/A"}</span>
                        </p>
                        <p className="text-[10px] text-slate-450">
                          Period: {formatToIndianDate(p.start_date) || "N/A"} → {formatToIndianDate(p.end_date) || "N/A"}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => window.open(`${BASE_URL}/${p.file_path}`, '_blank')}
                          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                        >
                          View Doc
                        </button>
                        {p.status !== 'Active' && active_policy?.id !== p.id && (
                          <button 
                            onClick={() => setDeleteConfirmPolicyId(p.id)}
                            className="border border-rose-100 hover:bg-rose-50 text-rose-600 p-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center h-8 w-8"
                            title="Delete policy permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-6">No historical records on file.</p>
                )}
              </div>
              
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowAllHistoryModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Insurance Claims Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4 mt-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-teal-600" /> Insurance Claims Portal
            </h3>
            {active_policy && !isCreatingClaim && !activeClaim && (
              <button
                onClick={() => setIsCreatingClaim(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer"
              >
                + Create Cashless Claim
              </button>
            )}
          </div>

          {!active_policy ? (
            <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded-xl text-slate-450 text-xs">
              <Shield className="w-8 h-8 text-slate-350 mx-auto mb-2" />
              <p className="font-bold">No Active Policy Found</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Please upload and activate an insurance policy to initiate a cashless pre-auth claim query.</p>
            </div>
          ) : (
            <>
              {/* CREATING CLAIM FLOW: SELECT CLINICAL CONTEXT */}
              {isCreatingClaim && renderContextSelection()}

              {/* VIEW / EDIT ACTIVE CLAIM WORKSPACE */}
              {activeClaim && renderClaimWorkspace()}

              {/* HISTORICAL / CURRENT CLAIMS LIST (if not actively editing or creating) */}
              {!isCreatingClaim && !activeClaim && renderClaimsHistory()}
            </>
          )}
        </div>
      </div>
    )
  }

  const renderAdminSettings = () => {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center space-y-3">
        <Settings className="w-12 h-12 text-slate-400 mx-auto animate-spin duration-1000" />
        <h3 className="text-base font-bold text-slate-850">Console Settings</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
          Configure API connection parameters, local database triggers, and insurance SMTP servers.
        </p>
        <span className="inline-block bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 rounded text-[11px] font-mono font-bold">
          Settings Coming Soon
        </span>
      </div>
    )
  }

  // Main Render for Hospital Admin
  return (
    <div className="bg-[#F2FBFA] text-[#071A2A] font-sans min-h-screen flex">
      {/* Persisted Sidebar */}
      <nav className="bg-gradient-to-b from-[#0D3435] to-[#0E3837] text-[#A0B3BD] w-72 flex flex-col h-screen fixed left-0 top-0 py-6 px-4 border-r border-[#0D3435] z-50 select-none">
        <div className="mb-6 px-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="border border-[#08A99D]/30 bg-[#08A99D]/10 p-1.5 rounded-lg text-[#08A99D] shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white leading-none">AyuSeva Console</h1>
              <p className="text-[10px] text-[#71869A] mt-1 uppercase font-bold tracking-wider">Hospital Desk Admin</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl mb-6 shrink-0 flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-[#08A99D] animate-pulse"></div>
          <span className="text-white/80 font-semibold truncate text-xs">Session ID: {adminUsername}</span>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto space-y-1 relative z-10">
          <button 
            onClick={() => setAdminView('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'overview' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            <Activity className={`w-4 h-4 ${adminView === 'overview' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Overview / Dashboard
          </button>
          <button 
            onClick={() => setAdminView('patients')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'patients' || adminView === 'patient-profile' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            <User className={`w-4 h-4 ${adminView === 'patients' || adminView === 'patient-profile' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Patients Directory
          </button>
          <button 
            onClick={() => setAdminView('records')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'records' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            <FileText className={`w-4 h-4 ${adminView === 'records' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Medical Records Feed
          </button>
          <button 
            onClick={() => setAdminView('medikiosk')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'medikiosk' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            <Clock className={`w-4 h-4 ${adminView === 'medikiosk' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> MediKiosk Intake
          </button>
          <button 
            onClick={() => setAdminView('ayush')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'ayush' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            <Leaf className={`w-4 h-4 ${adminView === 'ayush' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> AYUSH Assessment
          </button>
          <button 
            onClick={() => setAdminView('emergency')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'emergency' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            <MapPin className={`w-4 h-4 ${adminView === 'emergency' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Emergency Referral
          </button>
          <button 
            onClick={() => setAdminView('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${adminView === 'settings' ? 'bg-[#08A99D]/15 border border-[#08A99D]/30 text-white font-bold shadow-sm' : 'text-[#A0B3BD] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            <Settings className={`w-4 h-4 ${adminView === 'settings' ? 'text-[#08A99D]' : 'text-[#A0B3BD]'}`} /> Settings
          </button>
        </div>

        {/* Sidebar Bottom Decoration & Branding */}
        <div className="mt-auto pt-4 relative shrink-0 overflow-hidden">
          {/* Completed Semicircles & Subdued Botanical Sprig */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden" viewBox="0 0 256 120" fill="none">
            <defs>
              <filter id="sidebarPulseGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
              </filter>
            </defs>

            {/* Complete Semicircular Concentric Arcs Radiating Across the Sidebar */}
            <circle cx="10" cy="125" r="65" stroke="rgba(8, 169, 157, 0.16)" strokeWidth="1" fill="none" />
            <circle cx="10" cy="125" r="105" stroke="rgba(8, 169, 157, 0.20)" strokeWidth="1" fill="none" />
            <circle cx="10" cy="125" r="150" stroke="rgba(8, 169, 157, 0.22)" strokeWidth="1" fill="none" />
            <circle cx="10" cy="125" r="195" stroke="rgba(8, 169, 157, 0.15)" strokeWidth="1" fill="none" />
            <circle cx="10" cy="125" r="240" stroke="rgba(8, 169, 157, 0.08)" strokeWidth="1" fill="none" />

            {/* Subtle Glowing Pulse Along the Arc */}
            <path
              d="M 140,53 C 148,59 157,66 166,73"
              stroke="#2DD4BF"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.22"
              filter="url(#sidebarPulseGlow)"
              fill="none"
            />
            <path
              d="M 143,55 C 150,61 158,67 164,72"
              stroke="#99F6E4"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.38"
              fill="none"
            />
            <circle cx="154" cy="64" r="3.5" fill="#2DD4BF" opacity="0.25" filter="url(#sidebarPulseGlow)" />
            <circle cx="154" cy="64" r="1.4" fill="#FFFFFF" opacity="0.6" />

            {/* Botanical 5-Leaflet Sprig (Same position, size, shape, color; reduced opacity for subtlety) */}
            <g transform="translate(154, 64) rotate(35) scale(0.92)" opacity="0.28">
              {/* Slender stem */}
              <path d="M 0,8 L 0,-28" stroke="#2DD4BF" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              {/* Lower Pair of Leaflets */}
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -3) rotate(-55)" fill="#2DD4BF" opacity="0.8" />
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -3) rotate(55)" fill="#2DD4BF" opacity="0.8" />
              {/* Upper Pair of Leaflets */}
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -13) rotate(-46)" fill="#2DD4BF" opacity="0.85" />
              <path d="M 0,0 C -3.5,-4 -4.2,-9 0,-14 C 4.2,-9 3.5,-4 0,0 Z" transform="translate(0, -13) rotate(46)" fill="#2DD4BF" opacity="0.85" />
              {/* Terminal Tip Leaflet */}
              <path d="M 0,0 C -3.2,-4 -3.8,-9.5 0,-15 C 3.8,-9.5 3.2,-4 0,0 Z" transform="translate(0, -26) rotate(2)" fill="#2DD4BF" opacity="0.9" />
            </g>
          </svg>

          <div className="relative z-10 mb-3 px-2">
            <p className="text-[11px] text-[#71869A] font-medium leading-tight">Connected Care</p>
            <p className="text-[11px] text-[#71869A] font-medium leading-tight">for a Healthier Tomorrow</p>
          </div>
          <div className="border-t border-white/10 pt-3 relative z-10">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer text-left text-rose-400/90"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Right Area */}
      <main className="ml-72 flex-1 flex flex-col h-screen overflow-hidden bg-[#F2FBFA]">
        {/* Top Header */}
        <header className="bg-white border-b border-[#DCE8E8] h-16 flex justify-between items-center px-8 shrink-0 z-40">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-[#071A2A] text-[17px] tracking-tight">
              {adminView === 'patient-profile' ? 'Patient Medical Brief Profile' : adminView === 'insurance' ? 'Patient Insurance Management' : adminView === 'medikiosk' ? 'Hospital MediKiosk Station' : adminView === 'ayush' ? 'AYUSH Clinical Assessment & Longitudinal Registry' : `Hospital Admin Area: ${adminView === 'overview' ? 'Overview' : adminView}`}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {loading && <RefreshCw className="w-4 h-4 text-[#08A99D] animate-spin" />}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold leading-tight text-[#071A2A]">Triage Desk Admin</p>
                <p className="text-[10.5px] text-[#71869A] mt-0.5">{adminUsername === 'admin1' ? 'Shift Desk A' : 'Shift Desk B'}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#08A99D] text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase">
                {adminUsername.substring(0, 2)}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Work Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F2FBFA]">
          {adminView === 'overview' && renderAdminOverview()}
          {adminView === 'medikiosk' && (
            <CurrentVisitIntake
              mode="kiosk"
              patient={activePatient}
              allPatients={allPatients}
              onSelectPatient={fetchPatientData}
              onBack={() => setAdminView('overview')}
              showToast={showToast}
              baseUrl={BASE_URL}
            />
          )}
          {adminView === 'ayush' && (
            <AyushClinicalDashboard
              patient={activePatient}
              allPatients={allPatients}
              onSelectPatient={fetchPatientData}
              onBack={() => setAdminView('overview')}
              showToast={showToast}
            />
          )}
          {adminView === 'register' && renderAdminRegister()}
          {adminView === 'patients' && renderAdminPatients()}
          {adminView === 'patient-profile' && renderAdminPatientProfile()}
          {adminView === 'emergency' && renderAdminEmergency()}
          {adminView === 'records' && renderAdminRecords()}
          {adminView === 'settings' && renderAdminSettings()}
          {adminView === 'insurance' && renderAdminInsurance()}
        </div>
      </main>

      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          
          return (
            <div 
              key={toast.id} 
              className={`pointer-events-auto bg-white border rounded-xl p-3 shadow-lg flex items-start gap-2.5 transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in ${
                isError ? 'border-rose-100' : 'border-slate-200'
              }`}
            >
              {isError ? (
                <div className="bg-rose-50 p-1.5 rounded-lg text-rose-600 shrink-0">
                  <XCircle className="w-4 h-4" />
                </div>
              ) : isWarning ? (
                <div className="bg-amber-50 p-1.5 rounded-lg text-amber-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="bg-teal-50 p-1.5 rounded-lg text-teal-600 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-xs font-semibold text-slate-800 leading-tight capitalize">
                  {toast.type}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                  {toast.message}
                </p>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 shrink-0 text-[10px] font-bold p-0.5 cursor-pointer"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

    </div>
  )
}

export default App
