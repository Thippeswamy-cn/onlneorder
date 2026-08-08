# LocalConnect marketplace

LocalConnect is a responsive home-services marketplace with email OTP account
creation, sign-in, service discovery, provider profiles, location selection,
and a multi-step booking interface.

## Project structure

```text
backend/                  Flask application and SQLite database
frontend/pages/           HTML pages
frontend/js/              Browser JavaScript
frontend/css/             Stylesheets
frontend/components/      Reusable HTML components
frontend/assets/          Images and other static assets
requirements.in           Human-maintained direct dependencies
requirements.txt          Pinned deployment dependencies
wsgi.py                   Production WSGI entry point
```

## Local setup

Python 3.11 or newer is recommended.

```powershell
cd online-order
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
python backend\app.py
```

Open <http://127.0.0.1:5000>. Use `localhost` during development because browser
geolocation is unavailable on ordinary insecure remote origins.

Without SMTP values, signup runs in development mode and returns the OTP in the
API response. Configure the SMTP variables in `.env` before a real deployment.

## Dependency locking

Edit `requirements.in` when adding or changing a direct dependency. Generate a
new pinned lock file with `pip-tools`, review it, and commit both files:

```powershell
python -m pip install pip-tools
pip-compile --resolver=backtracking --output-file=requirements.txt requirements.in
pip-sync requirements.txt
```

Application installs and deployments must use `requirements.txt`, not
`requirements.in`.

## Production deployment

Set at least these environment variables in the hosting platform:

- `FLASK_HOST=0.0.0.0`
- `FLASK_DEBUG=false`
- `PORT` to the platform-provided port
- `DATABASE_PATH` to persistent storage
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `FROM_EMAIL`

On a Linux host, install the lock file and start the WSGI application:

```sh
pip install -r requirements.txt
gunicorn --bind 0.0.0.0:${PORT:-5000} wsgi:app
```

The hosting platform must provide HTTPS for location access. SQLite is suitable
for a single-instance demonstration; use a managed production database before
running multiple application instances.

## Encoding

All source files are UTF-8. The workspace `.editorconfig` enforces UTF-8 and
consistent line endings. If PowerShell displays `₹`, `…`, or icons incorrectly,
read files with `Get-Content -Encoding UTF8` or use a UTF-8 terminal; the stored
source text is not corrupted.
