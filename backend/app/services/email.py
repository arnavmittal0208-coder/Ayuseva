import sys
import os
from datetime import datetime
import resend
from app.config import settings

# Global registry to inspect stubs/mocks during automated tests
sent_emails = []

def send_html_email(to_email: str, subject: str, html_content: str, cc_email: str = None) -> bool:
    """Sends an HTML email using the Resend API client, with stubs for tests."""
    is_test = (
        "pytest" in sys.modules or 
        os.getenv("PYTEST_CURRENT_TEST") is not None or 
        os.getenv("MOCK_EMAIL") == "true" or 
        settings.MOCK_EMAIL
    )

    if is_test or not settings.RESEND_API_KEY or settings.RESEND_API_KEY == "your_resend_api_key_here":
        sent_emails.append({
            "to": to_email,
            "cc": cc_email,
            "subject": subject,
            "html": html_content,
            "timestamp": datetime.utcnow().isoformat()
        })
        print("\n--- [MOCK EMAIL DISPATCH] ---")
        print(f"To: {to_email}")
        if cc_email:
            print(f"CC: {cc_email}")
        print(f"Subject: {subject}")
        print(f"HTML Content:\n{html_content}")
        print("-----------------------------\n")
        return True

    resend.api_key = settings.RESEND_API_KEY
    
    cc_list = [cc_email] if cc_email else []

    params = {
        "from": "AyuSeva <onboarding@resend.dev>", # Standard Resend testing sender
        "to": [to_email],
        "subject": subject,
        "html": html_content,
    }
    if cc_list:
        params["cc"] = cc_list

    try:
        response = resend.Emails.send(params)
        print(f"Resend Email dispatched successfully. Response ID: {response.get('id')}")
        return True
    except Exception as e:
        print(f"Failed to dispatch email via Resend API: {str(e)}")
        return False
