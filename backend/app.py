import hashlib
import os
import secrets
import smtplib
import sqlite3
import time
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash


ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")
FRONTEND_DIR = ROOT_DIR / "frontend"
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", ROOT_DIR / "backend" / "users.db"))

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
otp_records: dict[str, dict] = {}
verification_tokens: dict[str, dict] = {}
password_reset_records: dict[str, dict] = {}


@app.after_request
def allow_local_frontend(response):
    origin = request.headers.get("Origin", "")
    origin_host = urlparse(origin).hostname
    if origin == "null" or origin_host in {"127.0.0.1", "localhost"}:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@app.route("/api/<path:unused>", methods=["OPTIONS"])
def api_options(unused):
    return "", 204


def database():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with database() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def normalize_email(value):
    return str(value or "").strip().lower()


def hash_otp(otp):
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def user_exists(email):
    with database() as connection:
        return connection.execute(
            "SELECT 1 FROM users WHERE email = ?", (email,)
        ).fetchone() is not None


def send_otp_email(email, otp, purpose="account verification"):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = "".join(os.getenv("SMTP_PASSWORD", "").split())
    from_email = (
        os.getenv("SMTP_FROM_EMAIL")
        or os.getenv("FROM_EMAIL")
        or smtp_username
    )

    if not all((smtp_host, smtp_username, smtp_password, from_email)):
        app.logger.warning("Development OTP for %s: %s", email, otp)
        return False

    message = EmailMessage()
    message["Subject"] = f"Your {purpose} code"
    message["From"] = from_email
    message["To"] = email
    message.set_content(
        f"Your {purpose} code is {otp}.\n\n"
        "This code expires in 10 minutes. If you did not request it, ignore this email."
    )

    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as error:
        raise OSError("SMTP_PORT must be a number") from error
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    if use_ssl:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
            server.login(smtp_username, smtp_password)
            server.send_message(message)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(message)
    return True


@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR / "pages", "index.html")


@app.get("/<path:filename>")
def frontend_file(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.post("/api/send-otp")
def send_otp():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        return jsonify(message="Enter a valid email address."), 400
    if user_exists(email):
        return jsonify(message="An account already exists for this email."), 409

    existing = otp_records.get(email)
    now = time.time()
    if existing and now - existing["sent_at"] < 30:
        return jsonify(message="Please wait 30 seconds before requesting another code."), 429

    otp = f"{secrets.randbelow(900000) + 100000:06d}"
    otp_records[email] = {
        "otp_hash": hash_otp(otp),
        "expires_at": now + 600,
        "sent_at": now,
        "attempts": 0,
    }

    try:
        delivered = send_otp_email(email, otp)
    except (OSError, smtplib.SMTPException):
        app.logger.exception("OTP email delivery failed")
        otp_records.pop(email, None)
        return jsonify(message="Could not send the email. Check the SMTP configuration."), 502

    if delivered:
        return jsonify(message="Verification code sent to your email.")
    return jsonify(
        message=f"Development mode — your OTP is {otp}",
        development=True,
    )


@app.post("/api/verify-otp")
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    otp = str(data.get("otp") or "")
    record = otp_records.get(email)
    now = time.time()

    if not record or now > record["expires_at"]:
        otp_records.pop(email, None)
        return jsonify(message="The code has expired. Request a new one."), 400

    record["attempts"] += 1
    if record["attempts"] > 5:
        otp_records.pop(email, None)
        return jsonify(message="Too many attempts. Request a new code."), 429
    if not secrets.compare_digest(hash_otp(otp), record["otp_hash"]):
        return jsonify(message="The verification code is incorrect."), 400

    token = secrets.token_urlsafe(32)
    verification_tokens[token] = {"email": email, "expires_at": now + 900}
    otp_records.pop(email, None)
    return jsonify(verificationToken=token)


@app.post("/api/create-account")
def create_account():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    name = str(data.get("name") or "").strip()
    password = str(data.get("password") or "")
    token_value = str(data.get("verificationToken") or "")
    verified = verification_tokens.get(token_value)

    if (
        not verified
        or verified["email"] != email
        or time.time() > verified["expires_at"]
    ):
        verification_tokens.pop(token_value, None)
        return jsonify(message="Email verification expired. Please verify again."), 401
    if len(name) < 2 or len(password) < 6:
        return jsonify(message="Check your name and password."), 400

    try:
        with database() as connection:
            connection.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (name, email, generate_password_hash(password)),
            )
    except sqlite3.IntegrityError:
        return jsonify(message="An account already exists for this email."), 409

    verification_tokens.pop(token_value, None)
    return jsonify(message="Account created successfully. Redirecting to sign in…"), 201


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    password = str(data.get("password") or "")
    with database() as connection:
        user = connection.execute(
            "SELECT name, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify(message="Incorrect email or password."), 401
    return jsonify(message=f"Welcome back, {user['name']}!", name=user["name"])


@app.post("/api/request-password-reset")
def request_password_reset():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        return jsonify(message="Enter a valid email address."), 400

    # Keep the response generic so this endpoint does not reveal registered emails.
    if not user_exists(email):
        return jsonify(message="If an account exists, a reset code has been sent.")

    existing = password_reset_records.get(email)
    now = time.time()
    if existing and now - existing["sent_at"] < 30:
        return jsonify(message="Please wait 30 seconds before requesting another code."), 429

    otp = f"{secrets.randbelow(900000) + 100000:06d}"
    password_reset_records[email] = {
        "otp_hash": hash_otp(otp),
        "expires_at": now + 600,
        "sent_at": now,
        "attempts": 0,
    }
    try:
        delivered = send_otp_email(email, otp, "password reset")
    except (OSError, smtplib.SMTPException):
        app.logger.exception("Password reset email delivery failed")
        password_reset_records.pop(email, None)
        return jsonify(message="Could not send the email. Check the SMTP configuration."), 502

    if delivered:
        return jsonify(message="A password reset code was sent to your email.")
    return jsonify(
        message=f"Development mode — your reset code is {otp}",
        development=True,
    )


@app.post("/api/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    otp = str(data.get("otp") or "")
    password = str(data.get("password") or "")
    record = password_reset_records.get(email)
    now = time.time()

    if len(password) < 6:
        return jsonify(message="Password must be at least 6 characters."), 400
    if not record or now > record["expires_at"]:
        password_reset_records.pop(email, None)
        return jsonify(message="The reset code has expired. Request a new one."), 400

    record["attempts"] += 1
    if record["attempts"] > 5:
        password_reset_records.pop(email, None)
        return jsonify(message="Too many attempts. Request a new code."), 429
    if not secrets.compare_digest(hash_otp(otp), record["otp_hash"]):
        return jsonify(message="The reset code is incorrect."), 400

    with database() as connection:
        result = connection.execute(
            "UPDATE users SET password_hash = ? WHERE email = ?",
            (generate_password_hash(password), email),
        )
    password_reset_records.pop(email, None)
    if result.rowcount != 1:
        return jsonify(message="Account not found."), 404
    return jsonify(message="Password updated. You can now sign in.")


initialize_database()

if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )
