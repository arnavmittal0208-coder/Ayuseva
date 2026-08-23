# AyuSeva Project Status & Completed Features Report

This document summarizes the features, layout structures, testing configurations, and background services currently working in AyuSeva.

---

## 1. Core Platform Features & Workflows

### 📂 Multimodal AI Ingestion (MRA Engine)
- **AI-Powered Card/PDF Extraction**: Uploading a scanned medical insurance card or policy PDF automatically triggers extraction via Llama 3.2 Vision / pypdf text parsing.
- **Fields Extracted**: Insurer name, policy number, start/expiry dates, policyholder name, insured member name, member ID, premium cost, sum insured, benefit highlights, and notable exclusions/limitations.
- **Automatic SQLite Schema Migrations**: Backend automatically checks and performs database column additions (like `insurer_email`) on startup.

### 🏥 Clinical Context Agent
- **Chronological Patient Timeline**: Serves structured, sorted health records, diagnostics, and doctor logs.
- **AI Clinical Brief Generation**: Generates specialty-focused patient summaries using free-tier Llama 3.3 NGC endpoints.
- **Biomarker Lab Trends**: Visualizes blood glucose, blood pressure, and key metrics via Recharts.

---

## 2. Insurance & Care Operations

### 🛡️ Active Policy Overview & Actions
- **Dashboard Displays**: Indian-format date representation (DD-MM-YYYY) for policy periods, sum insured details, benefits checklists, and exclusions list.
- **Archiving & Replacement**: Supports uploading a new policy document (which marks the older policy as archived and updates active metadata) or deactivating it manually.

### 🩺 Preventive Care Benefits (Scheduler & Reminders)
- **Dynamic Slot Generation**: Read from the extracted policy data (e.g. `2 free health checkups per policy year`) without hardcoded placeholders.
- **Scheduling Controls**: Patient Portal calendar inputs allow scheduling and changing checkup slot dates.
- **Lockdown Logic**: Checkup slots lock automatically once a reminder email notification is sent (`notification_date = checkup_date - 2 days`).
- **Dev-Preview Simulators**: Developer testing buttons (`[Dev] Preview`) fetch simulated email subjects and body text without executing database writes or locking slots.

### ✉️ Mock Email Safety Registry
- **Pytest/Mock Auto-Detection**: Intercepts `send_html_email` calls during automated testing or when `MOCK_EMAIL` settings are active.
- **Zero-Quota Logging**: Bypasses Resend API quota consumption, saving intended recipient address, subject, and HTML body contents into a global test registry (`sent_emails`) for verification.
- **Intact Production Client**: Production dispatches continue using the real Resend SDK integration.

---

## 3. UI/UX Layout Structures

### 🧑‍⚕️ Hospital Admin Desk (Patient Insurance Management)
- **Patient Account Header**: Shortened height padding (`py-2.5 px-4`), reduced vertical element margins, and closed grid spacing to shift cards upward.
- **Active Policy Overview Compaction**: Shrunk margins, card paddings (`p-6` to `p-4`), grid gaps, list row spacing, and text sizes. Lower boundary aligns with the right column sidebar.
- **Recent Policy History Sidebar**: Expired policies are housed in the right-column sidebar, displaying the latest 3 policies in high-density horizontal rows.
- **View All Modal**: A `"View All →"` button opens a scrollable, overlay modal showing the complete expired policy history.
- **SQLite Permanent Deletion**: Client-side trash icons with confirmation overlays call `DELETE /api/insurance/policy/{policy_id}` to permanently purge archived policies.
- **Active Deletion Safeguard**: Rejects deletion actions on active policies on both frontend and backend.

### 👤 Patient Portal Insurance page
- **Unified 12-Column Grid Row**: Arranged inside Col 8 (Left: Policy details card and Claims card) and Col 4 (Right: Policy Documents card and Preventive Care card) to align column lines and eliminate empty space.
- **Claims Portal Placeholders**: Prepared Cards for *Cashless Hospitalization Claims* and *Post-Treatment Reimbursement Claims* indicating readiness for claims workflows.

---

## 4. Current Services Status

### ⚙️ Running Background Services
- **FastAPI Backend (Port 8000)**: Active and listening under Uvicorn reload processes. Tested responsive via urllib requests.
- **Vite Frontend (Port 5173)**: Active and listening for HMR and compilation.

### 🧪 Automated Integration Tests
- Pytest suite runs verify 13 out of 13 integration tests passing cleanly.

```bash
======================= 13 passed in 0.97s =======================
```
