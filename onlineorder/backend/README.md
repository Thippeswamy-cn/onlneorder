# Real OTP Backend

This backend sends real OTPs for the signup page.

## Setup

1. Create Twilio credentials for mobile OTP.
2. Create a Gmail App Password for email OTP.
3. Set these environment variables:

```powershell
$env:TWILIO_ACCOUNT_SID="your_twilio_account_sid"
$env:TWILIO_AUTH_TOKEN="your_twilio_auth_token"
$env:TWILIO_PHONE_NUMBER="your_twilio_phone_number"
$env:GMAIL_USER="yourgmail@gmail.com"
$env:GMAIL_APP_PASSWORD="your_16_character_app_password"
node server.js
```

Then open:

```text
http://localhost:3000/signup-choice.html
```

Mobile numbers must include country code, for example:

```text
+919876543210
```
