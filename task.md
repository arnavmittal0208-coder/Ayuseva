# AyuSeva Project Checklist

- `[ ]` **Milestone 1: Project Initialization & Setup**
  - `[ ]` Create backend folder, initialize virtual environment, and write `requirements.txt`
  - `[ ]` Setup backend `main.py` and configuration with `.env` file support
  - `[ ]` Scaffold React frontend folder using `vite`
  - `[ ]` Install frontend dependencies (Tailwind CSS, Lucide icons, Recharts)
  - `[ ]` Setup Tailwind CSS configuration and baseline styling variables

- `[ ]` **Milestone 2: Database Schema & ORM Models**
  - `[ ]` Write `database.py` with SQLAlchemy connection engine (supporting SQLite & PostgreSQL)
  - `[ ]` Write `models.py` with Patient, Record, and Claim schemas
  - `[ ]` Write DB initialization scripts to auto-create tables

- `[ ]` **Milestone 3: AI Document Ingestion Engine (MRA)**
  - `[ ]` Create file upload route in FastAPI backend
  - `[ ]` Implement Google Gemini API integration (Gemini 1.5 Flash) for multimodal document reading
  - `[ ]` Write prompts to extract structured JSON data from reports and prescriptions
  - `[ ]` Implement saving raw files to uploads directory and parsed JSON to PostgreSQL

- `[ ]` **Milestone 4: Clinical Context Agent (Timeline & Brief API)**
  - `[ ]` Build `/patients/{uid}/timeline` endpoint to serve sorted chronological records
  - `[ ]` Build `/patients/{uid}/brief` endpoint to generate specialty-specific summaries
  - `[ ]` Add warning detection for allergies and record contradictions
  - `[ ]` Implement visual citation mapping linking AI summaries back to source PDFs

- `[ ]` **Milestone 5: Insurance & Care Agents (Claims & Booking)**
  - `[ ]` Build pre-authorization checklist and gap audit endpoints
  - `[ ]` Implement Resend API email client to automatically email compiled claim packets
  - `[ ]` Build background scheduler to detect checkup due dates and email diagnostic partner

- `[ ]` **Milestone 6: React Frontend - Patient Dashboard**
  - `[ ]` Design patient login page and personal dashboard shell
  - `[ ]` Build the chronological timeline view with expandable cards
  - `[ ]` Build Recharts biomarker graphs for lab test trends (glucose, blood pressure, etc.)
  - `[ ]` Build file upload & download panels

- `[ ]` **Milestone 7: React Frontend - Hospital Console**
  - `[ ]` Design patient registration and local UID search panel
  - `[ ]` Build hospital document dropzone for uploads
  - `[ ]` Build physician Clinical Brief preview pane
  - `[ ]` Build hospital insurance desk pre-auth checklist and email dispatch dashboard

- `[ ]` **Milestone 8: Live Cloud Deployment**
  - `[ ]` Migrate database to Supabase PostgreSQL cloud instance
  - `[ ]` Deploy FastAPI backend to Render.com
  - `[ ]` Deploy React frontend to Vercel
  - `[ ]` Test end-to-end live flow

- [x] **Milestone 9: NVIDIA NIM Migration (Free Tier)**
  - [x] Link NVIDIA NGC API Key to backend configuration
  - [x] Migrate Clinical Brief Summarization to Llama 3.3 Instruct
  - [x] Integrate digital PDF text parser (pypdf)
  - [x] Connect scanned document/image upload to Llama 3.2 Vision
  - [x] Verify API integration under local dev server
