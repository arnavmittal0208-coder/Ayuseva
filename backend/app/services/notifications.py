def generate_wellness_email(patient_name: str, patient_id: str, insurer_name: str, policy_number: str, checkup_date: str, recipient_email: str = None) -> tuple:
    """
    Generates a structured prototype wellness checkup email.
    Determines recipient based on input or falls back to a sandbox prototype address.
    """
    actual_recipient = recipient_email or "wellness-provider@ayuseva-prototype.com"
    subject = f"[PROTOTYPE SIMULATED] AyuSeva Wellness Checkup Request: {patient_name} ({policy_number})"
    body = f"""Dear {insurer_name} Health Care Provider / Wellness Team,

--- PROTOTYPE / SIMULATED NOTIFICATION ---
This is a simulated email request generated in sandbox mode for verification. No live provider has been contacted.
------------------------------------------

We are writing on behalf of our patient, {patient_name}, to request and coordinate a free health checkup benefit under their active insurance policy.

Patient Details:
- Name: {patient_name}
- Identifier: {patient_id}

Insurance Policy Details:
- Insurer: {insurer_name}
- Policy Number: {policy_number}
- Requested Checkup Date: {checkup_date}

Please coordinate with the patient at your earliest convenience to confirm the appointment and arrange the checkup services at an approved medical facility.

Sincerely,
AyuSeva Health & Care Coordination System (Prototype Environment)
"""
    return subject, actual_recipient, body
