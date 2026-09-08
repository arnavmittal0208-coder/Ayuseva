import React from 'react';
import { Shield, User, AlertTriangle, RefreshCw } from 'lucide-react';

export default function AyusevaLogin({
  loginTab,
  setLoginTab,
  loginUsername,
  setLoginUsername,
  loginPassword,
  setLoginPassword,
  loginPatientId,
  setLoginPatientId,
  loginError,
  setLoginError,
  loading,
  handleAdminLoginSubmit,
  handlePatientLoginSubmit,
  demoPatientId,
  demoPatientName,
  onQuickPatientLogin,
}) {
  const isPatient = loginTab === 'patient';

  return (
    <div className="ayuseva-login-root">
      <style>{`
        .ayuseva-login-root {
          --ivory: #F4FBFA;
          --ivory-dim: #F0FBFA;
          --forest: #0D9488;
          --forest-deep: #0F766E;
          --ink: #111827;
          --brass: #14B8A6;
          --brass-soft: #99F6E4;
          --sage: #CCFBF1;
          --line: #E5E7EB;
          --navy: #153F39;
          --navy-deep: #0E2A32;

          box-sizing: border-box;
          margin: 0;
          padding: 0;
          height: 100vh;
          height: 100dvh;
          width: 100%;
          background: linear-gradient(135deg, #FFFFFF 0%, #F2FBFA 55%, #E8F7F5 100%);
          color: var(--ink);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        .ayuseva-login-root * {
          box-sizing: border-box;
        }

        .login-screen {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          width: 100%;
          height: 100vh;
          height: 100dvh;
        }

        /* ---------- Left: brand panel ---------- */
        .login-brand {
          background:
            radial-gradient(circle at 85% 10%, rgba(45,212,191,0.12), transparent 45%),
            linear-gradient(175deg, var(--navy) 0%, var(--navy-deep) 100%);
          color: var(--ivory);
          padding: clamp(20px, 4vh, 44px) clamp(28px, 4vw, 52px) clamp(16px, 3vh, 28px);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          min-height: 0;
        }

        .login-brand::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 64px);
          pointer-events: none;
        }

        .brand-mark {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 0 0 auto;
        }

        .brand-mark svg {
          width: 26px;
          height: 26px;
          flex-shrink: 0;
        }

        .brand-mark span {
          font-family: 'Fraunces', serif;
          font-size: 19px;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: var(--ivory);
        }

        .brand-copy {
          max-width: 420px;
          margin-top: clamp(10px, 2.4vh, 22px);
          position: relative;
          z-index: 1;
          flex: 0 0 auto;
        }

        .brand-copy h1 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: clamp(20px, 2.6vw, 29px);
          line-height: 1.22;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
          color: var(--ivory);
        }

        .brand-copy p {
          font-size: clamp(12.5px, 1.1vw, 14px);
          line-height: 1.55;
          color: rgba(244, 251, 250, 0.7);
          margin: 0;
          max-width: 400px;
        }

        /* ---- Hero illustration ---- */
        .login-hero {
          position: relative;
          margin-top: clamp(10px, 2vh, 20px);
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-card {
          position: relative;
          width: min(100%, 78vh, 380px);
          aspect-ratio: 1/1;
          max-height: 100%;
          background: var(--ivory-dim);
          border-radius: 20px;
          box-shadow: 0 24px 50px -18px rgba(0,0,0,0.4);
        }

        .login-illus {
          position: absolute;
          inset: 0;
          opacity: 0;
          visibility: hidden;
          transition: opacity .45s ease, visibility .45s ease;
        }

        .login-illus.is-active {
          opacity: 1;
          visibility: visible;
        }

        .login-illus svg {
          width: 100%;
          height: 100%;
          display: block;
          border-radius: 20px;
        }

        /* gentle professional float */
        .illus-figure {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: figure-float 4.5s ease-in-out infinite;
        }

        @keyframes figure-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .illus-pen-arm {
          transform-box: fill-box;
          transform-origin: 90% 15%;
          animation: pen-write 2.6s ease-in-out infinite;
        }

        @keyframes pen-write {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-4deg); }
        }

        .illus-phone-glow {
          animation: glow-pulse 2.8s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .illus-figure, .illus-pen-arm, .illus-phone-glow {
            animation: none !important;
          }
        }

        .hero-badge {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--ivory);
          border-radius: 11px;
          padding: 8px 12px;
          box-shadow: 0 14px 26px -10px rgba(0,0,0,0.4);
          transition: opacity .4s ease, transform .4s ease;
          z-index: 2;
        }

        .hero-badge .b-icon {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--forest);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .hero-badge .b-icon svg {
          width: 12px;
          height: 12px;
          stroke: var(--brass-soft);
        }

        .hero-badge .b-text .num {
          font-family: 'Fraunces', serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          line-height: 1.15;
          white-space: nowrap;
        }

        .hero-badge .b-text .lbl {
          font-size: 9.5px;
          color: #6B7280;
          line-height: 1.2;
          margin-top: 1px;
          white-space: nowrap;
        }

        .badge-1 { top: -14px; right: -16px; }
        .badge-2 { bottom: 18px; left: -20px; }

        .brand-foot {
          font-size: 11.5px;
          color: rgba(244, 251, 250, 0.4);
          margin-top: clamp(10px, 2vh, 18px);
          padding-top: 14px;
          border-top: 1px solid rgba(244, 251, 250, 0.12);
          position: relative;
          z-index: 1;
          flex: 0 0 auto;
        }

        /* ---------- Right: form panel ---------- */
        .login-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(16px, 3vh, 40px) clamp(24px, 3vw, 48px);
          min-height: 0;
          background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 55%);
        }

        .form-wrap {
          width: 100%;
          max-width: 370px;
        }

        .form-wrap > .heading {
          margin-bottom: clamp(16px, 3vh, 26px);
        }

        .form-wrap h2 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: clamp(21px, 2.4vh, 26px);
          margin: 0 0 5px;
          color: var(--ink);
        }

        .form-wrap .sub {
          font-size: 13.5px;
          color: #6B7280;
        }

        .segmented {
          display: flex;
          gap: 26px;
          border-bottom: 1px solid var(--line);
          margin-bottom: clamp(14px, 2.8vh, 24px);
        }

        .seg-btn {
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #6B7280;
          padding: 0 0 10px;
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: color .15s ease;
        }

        .seg-btn svg {
          width: 14px;
          height: 14px;
          opacity: 0.75;
        }

        .seg-btn.is-active {
          color: var(--forest);
        }

        .seg-btn.is-active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: var(--brass);
        }

        .field {
          margin-bottom: clamp(12px, 2.4vh, 18px);
        }

        .field label {
          display: block;
          font-size: 12.5px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }

        .field input {
          width: 100%;
          padding: 11px 13px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: #F9FAFB;
          color: var(--ink);
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease;
        }

        .field input::placeholder {
          color: #9CA3AF;
        }

        .field input:focus {
          border-color: var(--brass);
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.16);
        }

        .row-between {
          display: flex;
          justify-content: flex-end;
          margin: -6px 0 clamp(14px, 2.6vh, 20px);
        }

        .row-between a {
          font-size: 12.5px;
          color: var(--forest);
          text-decoration: none;
          border-bottom: 1px solid rgba(13, 148, 136, 0.35);
          cursor: pointer;
        }

        .btn-primary {
          width: 100%;
          padding: 12px 0;
          background: var(--forest);
          color: var(--ivory);
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition: background .15s ease, opacity .15s ease;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--forest-deep);
        }

        .btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .btn-primary svg {
          width: 15px;
          height: 15px;
        }

        .login-error-card {
          background: #FDF2F2;
          border: 1px solid #F8B4B4;
          color: #9B1C1C;
          border-radius: 6px;
          padding: 9px 12px;
          font-size: 12px;
          margin-bottom: 16px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.4;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: clamp(16px, 3vh, 28px) 0 clamp(12px, 2.2vh, 18px);
        }

        .login-divider .line {
          flex: 1;
          height: 1px;
          background: var(--line);
        }

        .login-divider span {
          font-size: 11.5px;
          color: #9CA3AF;
          white-space: nowrap;
        }

        .sandbox-row {
          display: flex;
          gap: 10px;
        }

        .chip {
          flex: 1;
          padding: 9px 8px;
          border: 1px solid var(--line);
          background: transparent;
          border-radius: 6px;
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: border-color .15s ease, color .15s ease, background-color .15s ease;
          text-align: center;
        }

        .chip:hover {
          border-color: var(--brass);
          color: var(--forest);
          background-color: #F9FAFB;
        }

        .chip-patient {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }

        .chip-patient .patient-sub {
          font-size: 10px;
          color: #6B7280;
          font-family: monospace;
        }

        .env-note {
          text-align: center;
          font-size: 11.5px;
          color: #9CA3AF;
          margin-top: clamp(14px, 2.6vh, 22px);
        }

        @media (max-width: 880px) {
          .login-screen {
            grid-template-columns: 1fr;
            height: 100vh;
            height: 100dvh;
          }
          .login-brand {
            display: none;
          }
          .login-panel {
            padding: 24px 20px;
          }
        }

        :focus-visible {
          outline: 2px solid var(--brass);
          outline-offset: 2px;
        }
      `}</style>

      <div className="login-screen">
        {/* ================= Left Brand Panel ================= */}
        <div className="login-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 3L27 7.5V15C27 22.2 22.4 27.6 16 29.5C9.6 27.6 5 22.2 5 15V7.5L16 3Z" stroke="#99F6E4" strokeWidth="1.4" />
              <path d="M16 10V20M11 15H21" stroke="#99F6E4" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>AyuSeva</span>
          </div>

          <div className="brand-copy">
            <h1>One connected record for every step of care.</h1>
            <p>
              AyuSeva's multilingual AI links patient intake, clinical records, AYUSH assessments and cashless claims into a single verified thread — shared by hospitals and patients alike.
            </p>
          </div>

          <div className="login-hero">
            <div className="hero-card">
              {/* Admin / Doctor Illustration */}
              <div className={`login-illus ${!isPatient ? 'is-active' : ''}`} id="illus-admin">
                <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                  <rect width="400" height="400" fill="#F0FBFA" />
                  <circle cx="205" cy="185" r="150" fill="#CCFBF1" opacity="0.55" />
                  <circle cx="330" cy="70" r="26" fill="#99F6E4" opacity="0.4" />
                  <circle cx="45" cy="330" r="16" fill="#0D9488" opacity="0.12" />

                  <g className="illus-figure">
                    <path d="M60 400 C60 330 130 300 200 300 C270 300 340 330 340 400 Z" fill="#0D9488" />
                    <path d="M95 400 C90 320 120 260 145 245 L165 268 L200 250 L235 268 L255 245 C280 260 310 320 305 400 Z" fill="#FBF8F2" />
                    <path d="M165 268 L200 250 L192 320 Z" fill="#E4DCC8" />
                    <path d="M235 268 L200 250 L208 320 Z" fill="#E4DCC8" />
                    <path d="M180 252 L200 275 L220 252 L215 240 L185 240 Z" fill="#CCFBF1" />
                    <path d="M195 258 L205 258 L212 300 L200 320 L188 300 Z" fill="#14B8A6" />
                    <path d="M150 258 C140 300 150 330 175 335 C190 337 198 325 196 312" fill="none" stroke="#0D9488" strokeWidth="5" strokeLinecap="round" />
                    <path d="M250 258 C260 300 250 330 225 335" fill="none" stroke="#0D9488" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="197" cy="313" r="8" fill="#0D9488" />
                    <rect x="187" y="215" width="26" height="35" rx="10" fill="#EBB98C" />
                    <ellipse cx="200" cy="175" rx="46" ry="50" fill="#F2C9A6" />
                    <path d="M154 170 C150 120 175 95 200 95 C225 95 250 120 246 170 C244 145 225 150 200 148 C175 150 156 145 154 170 Z" fill="#2A2622" />
                    <ellipse cx="152" cy="180" rx="7" ry="11" fill="#F2C9A6" />
                    <ellipse cx="248" cy="180" rx="7" ry="11" fill="#F2C9A6" />
                    <circle cx="183" cy="178" r="4.5" fill="#111827" />
                    <circle cx="217" cy="178" r="4.5" fill="#111827" />
                    <path d="M174 166 q9 -6 18 0" stroke="#2A2622" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M208 166 q9 -6 18 0" stroke="#2A2622" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M182 197 q18 16 36 0" stroke="#8A4A32" strokeWidth="4" fill="none" strokeLinecap="round" />

                    <g className="illus-pen-arm">
                      <path d="M120 400 C108 350 118 300 148 278 C158 290 168 300 165 312 C150 330 140 355 148 400 Z" fill="#FBF8F2" />
                      <ellipse cx="150" cy="278" rx="14" ry="16" fill="#F2C9A6" />
                      <rect x="140" y="250" width="6" height="40" rx="3" fill="#14B8A6" transform="rotate(18 143 270)" />
                    </g>
                  </g>
                </svg>

                <div className="hero-badge badge-1">
                  <div className="b-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                      <path d="M12 2 4 5.5V11c0 5 3.4 9 8 10 4.6-1 8-5 8-10V5.5L12 2Z" />
                    </svg>
                  </div>
                  <div className="b-text">
                    <div className="num">48 hrs</div>
                    <div className="lbl">avg. claim approval</div>
                  </div>
                </div>
                <div className="hero-badge badge-2">
                  <div className="b-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                      <path d="M4 4h16v12H7l-3 3z" />
                    </svg>
                  </div>
                  <div className="b-text">
                    <div className="num">1 record</div>
                    <div className="lbl">shared across hospitals</div>
                  </div>
                </div>
              </div>

              {/* Patient Illustration */}
              <div className={`login-illus ${isPatient ? 'is-active' : ''}`} id="illus-patient">
                <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                  <rect width="400" height="400" fill="#F0FBFA" />
                  <circle cx="205" cy="185" r="150" fill="#99F6E4" opacity="0.35" />
                  <circle cx="330" cy="70" r="26" fill="#CCFBF1" opacity="0.5" />
                  <circle cx="45" cy="330" r="16" fill="#0D9488" opacity="0.12" />

                  <g className="illus-figure">
                    <path d="M60 400 C60 330 130 300 200 300 C270 300 340 330 340 400 Z" fill="#0D9488" />
                    <path d="M100 400 C96 325 122 268 160 252 L200 268 L240 252 C278 268 304 325 300 400 Z" fill="#CCFBF1" />
                    <path d="M178 258 L200 278 L222 258 L216 246 L184 246 Z" fill="#F4FBFA" />
                    <rect x="187" y="215" width="26" height="35" rx="10" fill="#EBB98C" />
                    <ellipse cx="200" cy="175" rx="46" ry="50" fill="#F2C9A6" />
                    <path d="M152 178 C146 120 172 92 200 92 C230 92 254 122 250 178 C252 130 224 118 200 118 C176 118 150 132 152 178 Z" fill="#3A2E23" />
                    <path d="M150 175 C146 210 150 250 158 275 L172 270 C165 240 164 205 168 178 Z" fill="#3A2E23" />
                    <path d="M250 175 C254 210 250 250 242 275 L228 270 C235 240 236 205 232 178 Z" fill="#3A2E23" />
                    <ellipse cx="152" cy="182" rx="7" ry="11" fill="#F2C9A6" />
                    <ellipse cx="248" cy="182" rx="7" ry="11" fill="#F2C9A6" />
                    <circle cx="183" cy="180" r="4.5" fill="#111827" />
                    <circle cx="217" cy="180" r="4.5" fill="#111827" />
                    <path d="M175 168 q8 -5 16 0" stroke="#3A2E23" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M209 168 q8 -5 16 0" stroke="#3A2E23" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M183 199 q17 14 34 0" stroke="#8A4A32" strokeWidth="4" fill="none" strokeLinecap="round" />

                    <path d="M225 400 C218 355 224 315 244 296 C258 304 268 316 264 328 C250 344 244 368 250 400 Z" fill="#CCFBF1" />
                    <ellipse cx="252" cy="298" rx="13" ry="15" fill="#F2C9A6" />
                    <rect x="252" y="270" width="30" height="46" rx="6" fill="#0D9488" transform="rotate(8 267 293)" />
                    <rect x="256" y="276" width="22" height="30" rx="2" fill="#F4FBFA" transform="rotate(8 267 291)" className="illus-phone-glow" />
                  </g>
                </svg>

                <div className="hero-badge badge-1">
                  <div className="b-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                      <path d="M4 5h16M4 12h16M4 19h10" />
                    </svg>
                  </div>
                  <div className="b-text">
                    <div className="num">12+ languages</div>
                    <div className="lbl">AI-guided intake</div>
                  </div>
                </div>
                <div className="hero-badge badge-2">
                  <div className="b-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                      <path d="M12 21s-7-4.6-9.5-9C.7 8.4 3 5 6.5 5c2 0 3.3 1 5.5 3.2C14.2 6 15.5 5 17.5 5 21 5 23.3 8.4 21.5 12c-2.5 4.4-9.5 9-9.5 9Z" />
                    </svg>
                  </div>
                  <div className="b-text">
                    <div className="num">Track anytime</div>
                    <div className="lbl">claim &amp; record status</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="brand-foot">AyuSeva Healthcare System · Sandbox environment, local data</div>
        </div>

        {/* ================= Right Form Panel ================= */}
        <div className="login-panel">
          <div className="form-wrap">
            <div className="heading">
              <h2>Sign in</h2>
              <div className="sub">Enter your credentials to continue.</div>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="segmented">
              <button
                className={`seg-btn ${!isPatient ? 'is-active' : ''}`}
                onClick={() => {
                  setLoginTab('admin');
                  setLoginError('');
                }}
                type="button"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 20v-1a6 6 0 0 1 6-6h1M14 4l4 2v3c0 3.3-1.9 5.7-4 6.6C11.9 14.7 10 12.3 10 9V6l4-2Z" />
                </svg>
                Hospital admin
              </button>
              <button
                className={`seg-btn ${isPatient ? 'is-active' : ''}`}
                onClick={() => {
                  setLoginTab('patient');
                  setLoginError('');
                }}
                type="button"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="8" r="3.4" />
                  <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
                </svg>
                Patient
              </button>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="login-error-card">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Form */}
            {!isPatient ? (
              /* Hospital Admin Form */
              <form onSubmit={handleAdminLoginSubmit} id="login-form-admin">
                <div className="field">
                  <label htmlFor="admin-id">Admin ID</label>
                  <input
                    id="admin-id"
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. admin1"
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                <div className="row-between">
                  <a
                    href="#forgot-password"
                    onClick={(e) => {
                      e.preventDefault();
                      setLoginError('Default credentials for sandbox: admin1 / password123 or admin2 / password456.');
                    }}
                  >
                    Forgot password?
                  </a>
                </div>

                <button className="btn-primary" type="submit" id="submit-btn-admin">
                  <Shield className="w-4 h-4" />
                  <span>Sign in as admin</span>
                </button>
              </form>
            ) : (
              /* Patient Form */
              <form onSubmit={handlePatientLoginSubmit} id="login-form-patient">
                <div className="field">
                  <label htmlFor="patient-id">Patient Local UID</label>
                  <input
                    id="patient-id"
                    type="text"
                    required
                    value={loginPatientId}
                    onChange={(e) => setLoginPatientId(e.target.value)}
                    placeholder="e.g. CARE-928104"
                    autoComplete="off"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div className="row-between">
                  <a
                    href="#patient-help"
                    onClick={(e) => {
                      e.preventDefault();
                      setLoginError('Use your registered Patient UID (e.g. CARE-...) or click Sandbox Demo Patient below.');
                    }}
                  >
                    Need assistance?
                  </a>
                </div>

                <button className="btn-primary" type="submit" id="submit-btn-patient" disabled={loading}>
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span>Sign in as patient</span>
                </button>
              </form>
            )}

            {/* Sandbox quick access divider */}
            <div className="login-divider">
              <div className="line"></div>
              <span>Sandbox quick access</span>
              <div className="line"></div>
            </div>

            {/* Sandbox quick access chips */}
            {!isPatient ? (
              <div className="sandbox-row">
                <button
                  className="chip"
                  type="button"
                  onClick={() => {
                    setLoginUsername('admin1');
                    setLoginPassword('password123');
                    setLoginError('');
                  }}
                >
                  Demo admin 1
                </button>
                <button
                  className="chip"
                  type="button"
                  onClick={() => {
                    setLoginUsername('admin2');
                    setLoginPassword('password456');
                    setLoginError('');
                  }}
                >
                  Demo admin 2
                </button>
              </div>
            ) : (
              <div className="sandbox-row">
                <button
                  className="chip chip-patient"
                  type="button"
                  onClick={onQuickPatientLogin}
                >
                  <span>Login as Demo Patient</span>
                  <span className="patient-sub">
                    ({demoPatientName} · {demoPatientId})
                  </span>
                </button>
              </div>
            )}

            <div className="env-note">Local SQLite mode · no data leaves this device</div>
          </div>
        </div>
      </div>
    </div>
  );
}
