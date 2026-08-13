import hashlib
import json
import os
import secrets
import smtplib
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from email.message import EmailMessage
from functools import wraps
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash


ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")
FRONTEND_DIR = ROOT_DIR / "frontend"
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", ROOT_DIR / "backend" / "users.db"))


def application_secret():
    configured = os.getenv("FLASK_SECRET_KEY") or os.getenv("SECRET_KEY")
    if configured:
        return configured
    secret_file = ROOT_DIR / "backend" / ".flask-secret"
    try:
        existing = secret_file.read_text(encoding="utf-8").strip()
        if len(existing) >= 32:
            return existing
    except FileNotFoundError:
        pass
    generated = secrets.token_hex(32)
    secret_file.write_text(generated, encoding="utf-8")
    return generated


app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
app.config.update(
    SECRET_KEY=application_secret(),
    MAX_CONTENT_LENGTH=512 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "false").lower() == "true",
)
otp_records: dict[str, dict] = {}
verification_tokens: dict[str, dict] = {}
password_reset_records: dict[str, dict] = {}
request_buckets: dict[str, deque] = defaultdict(deque)
geocode_cache: dict[str, tuple[float, object]] = {}
USER_STATE_TYPES = {
    "addresses": list,
    "bookings": list,
    "favourites": list,
    "profile": dict,
    "settings": dict,
}


@app.before_request
def protect_api_requests():
    if not request.path.startswith("/api/"):
        return None

    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        if request.headers.get("Sec-Fetch-Site") == "cross-site":
            return jsonify(message="Cross-site requests are not allowed."), 403

    limits = {
        "/api/send-otp": (5, 60),
        "/api/request-password-reset": (5, 60),
        "/api/login": (15, 60),
        "/api/verify-otp": (15, 60),
        "/api/reset-password": (15, 60),
        "/api/create-account": (15, 60),
    }
    limit, window = limits.get(request.path, (60, 60))
    forwarded_for = request.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
    trust_proxy = os.getenv("TRUST_PROXY_HEADERS", "false").lower() == "true"
    client = (forwarded_for if trust_proxy else "") or request.remote_addr or "unknown"
    route_key = request.path if request.path in limits else "/api/default"
    bucket = request_buckets[f"{client}:{route_key}"]
    now = time.time()
    while bucket and now - bucket[0] >= window:
        bucket.popleft()
    if len(bucket) >= limit:
        retry_after = max(1, int(window - (now - bucket[0])))
        response = jsonify(message="Too many requests. Please try again shortly.")
        response.status_code = 429
        response.headers["Retry-After"] = str(retry_after)
        return response
    bucket.append(now)
    return None


@app.after_request
def allow_local_frontend(response):
    origin = request.headers.get("Origin", "")
    origin_host = urlparse(origin).hostname
    if origin_host in {"127.0.0.1", "localhost"}:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Requested-With"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; "
        "img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; "
        "connect-src 'self'; frame-src https://maps.google.com https://www.google.com"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif request.path.startswith(("/assets/", "/css/", "/js/")):
        response.headers["Cache-Control"] = "public, max-age=3600"
    return response


@app.route("/api/<path:unused>", methods=["OPTIONS"])
def api_options(unused):
    return "", 204


@contextmanager
def database():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


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
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS user_state (
                user_id INTEGER NOT NULL,
                resource TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, resource),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
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


def signed_in_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    with database() as connection:
        return connection.execute(
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = signed_in_user()
        if not user:
            session.clear()
            return jsonify(message="Sign in to sync your account data."), 401
        return view(user, *args, **kwargs)

    return wrapped


def cached_nominatim(path, parameters):
    cache_key = f"{path}?{urlencode(sorted(parameters.items()))}"
    cached = geocode_cache.get(cache_key)
    now = time.time()
    if cached and cached[0] > now:
        return cached[1]

    url = f"https://nominatim.openstreetmap.org/{path}?{urlencode(parameters)}"
    contact = os.getenv("NOMINATIM_CONTACT_EMAIL", "support@localconnect.invalid")
    upstream_request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": f"LocalConnect/1.0 ({contact})",
        },
    )
    with urlopen(upstream_request, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    geocode_cache[cache_key] = (now + 900, payload)
    if len(geocode_cache) > 500:
        expired = [key for key, value in geocode_cache.items() if value[0] <= now]
        for key in expired or list(geocode_cache)[:100]:
            geocode_cache.pop(key, None)
    return payload


def send_otp_email(email, otp, purpose="account verification"):
    brevo_api_key = os.getenv("BREVO_API_KEY")
    smtp_host = os.getenv("SMTP_HOST")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = "".join(os.getenv("SMTP_PASSWORD", "").split())
    from_email = (
        os.getenv("BREVO_FROM_EMAIL")
        or os.getenv("SMTP_FROM_EMAIL")
        or os.getenv("FROM_EMAIL")
        or smtp_username
    )

    subject = f"Your {purpose} code"
    content = (
        f"Your {purpose} code is {otp}.\n\n"
        "This code expires in 10 minutes. If you did not request it, ignore this email."
    )

    if brevo_api_key:
        if not from_email:
            raise OSError("BREVO_FROM_EMAIL is required when BREVO_API_KEY is set")
        payload = json.dumps(
            {
                "sender": {
                    "email": from_email,
                    "name": os.getenv("BREVO_SENDER_NAME", "LocalConnect"),
                },
                "to": [{"email": email}],
                "subject": subject,
                "textContent": content,
            }
        ).encode("utf-8")
        api_request = Request(
            "https://api.brevo.com/v3/smtp/email",
            data=payload,
            headers={
                "accept": "application/json",
                "api-key": brevo_api_key,
                "content-type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(api_request, timeout=15) as response:
                if response.status != 201:
                    raise OSError(f"Brevo returned HTTP {response.status}")
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise OSError(f"Brevo returned HTTP {error.code}: {details}") from error
        except URLError as error:
            raise OSError(f"Could not connect to Brevo: {error.reason}") from error
        return True

    if not all((smtp_host, smtp_username, smtp_password, from_email)):
        app.logger.warning("Development OTP for %s: %s", email, otp)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = email
    message.set_content(content)

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


@app.get("/api/session")
def account_session():
    user = signed_in_user()
    if not user:
        session.clear()
        return jsonify(authenticated=False)
    return jsonify(
        authenticated=True,
        user={"id": user["id"], "name": user["name"], "email": user["email"]},
    )


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(message="Signed out successfully.")


@app.get("/api/me/state")
@login_required
def get_account_state(user):
    with database() as connection:
        rows = connection.execute(
            "SELECT resource, payload, updated_at FROM user_state WHERE user_id = ?",
            (user["id"],),
        ).fetchall()
    resources = {}
    for row in rows:
        try:
            value = json.loads(row["payload"])
        except json.JSONDecodeError:
            continue
        resources[row["resource"]] = {
            "value": value,
            "updatedAt": row["updated_at"],
        }
    return jsonify(resources=resources)


@app.route("/api/me/state/<resource>", methods=["GET", "PUT", "DELETE"])
@login_required
def account_state_resource(user, resource):
    expected_type = USER_STATE_TYPES.get(resource)
    if not expected_type:
        return jsonify(message="Unknown account resource."), 404

    if request.method == "GET":
        with database() as connection:
            row = connection.execute(
                "SELECT payload, updated_at FROM user_state WHERE user_id = ? AND resource = ?",
                (user["id"], resource),
            ).fetchone()
        if not row:
            return jsonify(value=None, updatedAt=None)
        return jsonify(value=json.loads(row["payload"]), updatedAt=row["updated_at"])

    if request.method == "DELETE":
        with database() as connection:
            connection.execute(
                "DELETE FROM user_state WHERE user_id = ? AND resource = ?",
                (user["id"], resource),
            )
        return "", 204

    data = request.get_json(silent=True) or {}
    value = data.get("value")
    if not isinstance(value, expected_type):
        return jsonify(message=f"Invalid {resource} data."), 400
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(payload.encode("utf-8")) > 256 * 1024:
        return jsonify(message=f"The {resource} data is too large."), 413
    with database() as connection:
        connection.execute(
            """
            INSERT INTO user_state (user_id, resource, payload, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, resource) DO UPDATE SET
                payload = excluded.payload,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user["id"], resource, payload),
        )
    return jsonify(message=f"{resource.title()} synced.")


@app.get("/api/geocode/reverse")
def reverse_geocode():
    try:
        latitude = float(request.args.get("lat", ""))
        longitude = float(request.args.get("lon", ""))
    except ValueError:
        return jsonify(message="Valid latitude and longitude are required."), 400
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return jsonify(message="The coordinates are outside the valid range."), 400

    language = str(request.args.get("language", "en"))[:16]
    try:
        result = cached_nominatim(
            "reverse",
            {
                "format": "jsonv2",
                "lat": f"{latitude:.5f}",
                "lon": f"{longitude:.5f}",
                "zoom": "16",
                "addressdetails": "1",
                "accept-language": language,
            },
        )
    except (HTTPError, URLError, OSError, ValueError, json.JSONDecodeError):
        app.logger.exception("Reverse geocoding failed")
        return jsonify(message="The address service is temporarily unavailable."), 503
    return jsonify(result)


@app.get("/api/geocode/search")
def search_geocode():
    query = " ".join(str(request.args.get("q", "")).split())
    if len(query) < 3 or len(query) > 120:
        return jsonify(message="Enter an address between 3 and 120 characters."), 400
    language = str(request.args.get("language", "en"))[:16]
    try:
        results = cached_nominatim(
            "search",
            {
                "format": "jsonv2",
                "q": query,
                "limit": "5",
                "addressdetails": "1",
                "accept-language": language,
            },
        )
    except (HTTPError, URLError, OSError, ValueError, json.JSONDecodeError):
        app.logger.exception("Address search failed")
        return jsonify(message="The address service is temporarily unavailable."), 503
    return jsonify(results if isinstance(results, list) else [])


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
            "SELECT id, name, email, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify(message="Incorrect email or password."), 401
    session.clear()
    session["user_id"] = user["id"]
    session.permanent = True
    return jsonify(
        message=f"Welcome back, {user['name']}!",
        name=user["name"],
        email=user["email"],
        authenticated=True,
    )


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
