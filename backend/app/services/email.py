import sys
import os
from datetime import datetime
import resend
from app.config import settings

# Global registry to inspect stubs/mocks during automated tests
sent_emails = []
last_email_error = None

def send_html_email(to_email: str, subject: str, html_content: str, cc_email: str = None, attachments: list = None) -> bool:
    """Sends an HTML email using the Resend API client, with stubs for tests."""
    global last_email_error
    last_email_error = None

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
            "attachments": attachments,
            "timestamp": datetime.utcnow().isoformat()
        })
        print("\n--- [MOCK EMAIL DISPATCH] ---")
        print(f"To: {to_email}")
        if cc_email:
            print(f"CC: {cc_email}")
        print(f"Subject: {subject}")
        print(f"HTML Content:\n{html_content}")
        if attachments:
            print(f"Attachments: {[a.get('filename') for a in attachments]}")
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
    if attachments:
        params["attachments"] = attachments

    try:
        response = resend.Emails.send(params)
        print(f"Resend Email dispatched successfully. Response ID: {response.get('id')}")
        return True
    except Exception as e:
        err_msg = str(e)
        err_type = type(e).__name__
        status_code = getattr(e, "status_code", getattr(e, "code", None))
        
        # Check if it is the Resend sandbox verification restriction
        if "you can only send testing emails to your own email address" in err_msg.lower():
            sandbox_fallback_email = "arnavmittal1510@gmail.com"
            print(f"[SANDBOX RESTRICTION DETECTED] Attempting to reroute email to verified sandbox owner: {sandbox_fallback_email}")
            
            fallback_params = dict(params)
            fallback_params["to"] = [sandbox_fallback_email]
            fallback_params["subject"] = f"[Sandbox Route to {to_email}] {subject}"
            if "cc" in fallback_params:
                del fallback_params["cc"]
                
            try:
                response = resend.Emails.send(fallback_params)
                print(f"Resend Email rerouted and dispatched successfully. Response ID: {response.get('id')}")
                return True
            except Exception as fallback_err:
                err_msg = f"Sandbox fallback also failed: {str(fallback_err)} (Original error: {err_msg})"
                status_code = getattr(fallback_err, "status_code", getattr(fallback_err, "code", status_code))

        last_email_error = {
            "message": err_msg,
            "type": err_type,
            "status_code": status_code
        }
        print(f"Failed to dispatch email via Resend API: [{err_type}] {err_msg}")
        return False
