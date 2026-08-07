$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Service Booking OTP Server" -ForegroundColor Cyan
Write-Host ""

$gmailUser = Read-Host "Enter your Gmail address"
$gmailPassword = Read-Host "Enter your Gmail App Password without spaces"

$env:GMAIL_USER = $gmailUser
$env:GMAIL_APP_PASSWORD = $gmailPassword

Write-Host ""
Write-Host "Email OTP is configured with Gmail." -ForegroundColor Green
Write-Host "Phone OTP still needs Twilio environment variables." -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting server at http://localhost:3000/signup-choice.html" -ForegroundColor Cyan

Start-Process "http://localhost:3000/signup-choice.html"
node server.js
