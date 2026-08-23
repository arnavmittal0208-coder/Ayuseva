# Implementation Plan - Resend Email Integration for Preventive Care Checkups

This plan implements connecting the Preventive Care Benefits "Send Notification" logic to the backend Resend email service, extracting the insurer contact email from uploaded policies, and enforcing automatic date-driven notification sends.

## User Review Required

> [!IMPORTANT]
> The system now parses `"insurer_email"` directly from policy documents. For testing, please ensure that your uploaded policy document contains a visible email address (e.g. `arnavmittal1510@gmail.com`).

---

## Proposed Changes

### Database Layer

#### [MODIFY] [`backend/app/models.py`](file:///c:/Users/Arnav%20Mittal/Desktop/Health/backend/app/models.py)
- Add `insurer_email = Column(String, nullable=True)` to the `InsurancePolicy` model.

---

### Document Processing Layer

#### [MODIFY] [`backend/app/services/parser.py`](file:///c:/Users/Arnav%20Mittal/Desktop/Health/backend/app/services/parser.py)
- Update `parse_insurance_document` NIM prompt schema to extract `insurer_email`.
- Add a regex-based fallback to extract any email address from the PDF digital text if NIM parsing returns `null` for `insurer_email`.

---

### Business Logic & Routing Layer

#### [MODIFY] [`backend/app/routers/insurance.py`](file:///c:/Users/Arnav%20Mittal/Desktop/Health/backend/app/routers/insurance.py)
- Update `upload_new_insurance_policy` to store `insurer_email` on the `InsurancePolicy` model and inside `patient.policy_details`.
- Update `archive_insurance_policy` to carry over `insurer_email` when restoring `next_active` details.
- Add helper function `send_checkup_notification_email_sync(checkup_id, db)`:
  - Formats a professional HTML body including patient name, identifier, insurer name, policy number, and checkup date.
  - Resolves target recipient email from `policy.insurer_email`, `patient.policy_details`, or `record.parsed_json`.
  - Dispatches email via `send_html_email` (which uses the Resend API client or mocks to log).
  - Updates checkup status in database (`Sent`, `is_locked = True`, `notification_sent_at = timestamp`) on success. Keeps it as `Failed`/unlocked on error.
- Update `get_preventive_checkups` to run an automatic date-driven scan:
  - Whenever the patient checkups list is requested, identify any checkups where `notification_date <= today` and status is still unsent.
  - Automatically invoke `send_checkup_notification_email_sync` for those slots.
- Update `schedule_checkup` to also run the automatic check immediately:
  - If a patient schedules/reschedules a slot and the computed `notification_date <= today`, send the email immediately.
- Update `/checkup/{checkup_id}/simulate-notification` to act purely as a developer preview tool. Generates the template parameters and returns them for preview without sending/locking.

---

### User Interface Layer

#### [MODIFY] [`frontend/src/App.jsx`](file:///c:/Users/Arnav%20Mittal/Desktop/Health/frontend/src/App.jsx)
- Rename the `"Simulate Notif"` button to `"[Dev] Preview Notification"` to clearly indicate it is a debugging utility.
- Add descriptive badge statuses matching the requested states:
  - `AVAILABLE` (Date Change Allowed)
  - `SCHEDULED` (Notification Pending — Date Change Allowed)
  - `NOTIFICATION SENT` (Notification Sent — Date Locked)
  - `NOTIFICATION FAILED` (Send Failed — Retry Allowed)
- Display the extracted insurer email next to the policy overview card if present.

---

## Verification Plan

### Automated Tests
- Update [`backend/tests/test_preventive_checkups.py`](file:///c:/Users/Arnav%20Mittal/Desktop/Health/backend/tests/test_preventive_checkups.py):
  - Test immediate email dispatch when scheduling a checkup today or in the past.
  - Test scheduling in the future (status stays pending).
  - Test locking constraint on scheduled checkups that fail vs succeed.
  - Run `.venv\Scripts\python -m pytest` to confirm all tests pass cleanly.
