import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from werkzeug.security import generate_password_hash

import backend.app as app_module


class LocalConnectApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.original_database_path = app_module.DATABASE_PATH
        app_module.DATABASE_PATH = Path(self.temporary_directory.name) / "test.db"
        app_module.app.config.update(TESTING=True, SECRET_KEY="localconnect-test-secret")
        app_module.request_buckets.clear()
        app_module.geocode_cache.clear()
        app_module.initialize_database()
        with app_module.database() as connection:
            connection.executemany(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                [
                    ("Asha Rao", "asha@example.com", generate_password_hash("secret12")),
                    ("Ravi Kumar", "ravi@example.com", generate_password_hash("secret34")),
                ],
            )
        self.client = app_module.app.test_client()

    def tearDown(self):
        app_module.DATABASE_PATH = self.original_database_path
        self.temporary_directory.cleanup()

    def sign_in(self, email="asha@example.com", password="secret12"):
        return self.client.post("/api/login", json={"email": email, "password": password})

    def test_security_headers_are_added(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
        response.close()

    def test_public_pages_and_optimized_image_are_served(self):
        for path in (
            "/pages/index.html",
            "/pages/signup.html",
            "/pages/home.html",
            "/pages/customer-dashboard.html",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()

        image = self.client.get("/assets/services/plumber-480.webp")
        self.assertEqual(image.status_code, 200)
        self.assertEqual(image.mimetype, "image/webp")
        self.assertIn("max-age=3600", image.headers["Cache-Control"])
        self.assertLess(len(image.data), 50_000)
        image.close()

    def test_every_page_loads_the_four_language_interface(self):
        for path in (
            "/pages/index.html",
            "/pages/signup.html",
            "/pages/forgot-password.html",
            "/pages/home.html",
            "/pages/customer-dashboard.html",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                markup = response.get_data(as_text=True)
                self.assertIn("/css/i18n.css", markup)
                self.assertIn("/js/i18n.js", markup)
                response.close()

        response = self.client.get("/js/i18n.js")
        script = response.get_data(as_text=True)
        for language, label in (
            ("en", "English"),
            ("kn", "ಕನ್ನಡ"),
            ("te", "తెలుగు"),
            ("hi", "हिन्दी"),
        ):
            with self.subTest(language=language):
                self.assertIn(f'{language}: {{ label: "{label}"', script)
        self.assertIn('const STORAGE_KEY = "localConnectLanguage"', script)
        self.assertIn("MutationObserver", script)
        response.close()

    def test_home_page_has_primary_service_discovery_controls(self):
        response = self.client.get("/pages/home.html")
        markup = response.get_data(as_text=True)
        for control_id in (
            'id="hero-service-search-form"',
            'id="hero-service-search"',
            'id="hero-location-button"',
            'id="more-services"',
        ):
            with self.subTest(control_id=control_id):
                self.assertIn(control_id, markup)
        response.close()

    def test_session_login_state_sync_and_logout(self):
        self.assertFalse(self.client.get("/api/session").get_json()["authenticated"])
        login = self.sign_in()
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.get_json()["authenticated"])

        bookings = [{"id": "LC100", "service": "Tap repair", "status": "Requested"}]
        saved = self.client.put("/api/me/state/bookings", json={"value": bookings})
        self.assertEqual(saved.status_code, 200)
        state = self.client.get("/api/me/state").get_json()["resources"]
        self.assertEqual(state["bookings"]["value"], bookings)

        self.assertEqual(self.client.post("/api/logout").status_code, 200)
        self.assertFalse(self.client.get("/api/session").get_json()["authenticated"])
        self.assertEqual(self.client.get("/api/me/state").status_code, 401)

    def test_state_is_typed_and_isolated_per_user(self):
        self.sign_in()
        invalid = self.client.put("/api/me/state/bookings", json={"value": {"id": "wrong"}})
        self.assertEqual(invalid.status_code, 400)
        self.client.put("/api/me/state/favourites", json={"value": [{"id": "sri-sai"}]})
        self.client.post("/api/logout")

        self.sign_in("ravi@example.com", "secret34")
        state = self.client.get("/api/me/state").get_json()["resources"]
        self.assertNotIn("favourites", state)

    def test_location_validation_does_not_call_upstream(self):
        self.assertEqual(self.client.get("/api/geocode/reverse?lat=100&lon=20").status_code, 400)
        self.assertEqual(self.client.get("/api/geocode/reverse?lat=x&lon=20").status_code, 400)
        self.assertEqual(self.client.get("/api/geocode/search?q=x").status_code, 400)

    def test_cross_site_writes_are_rejected(self):
        response = self.client.post(
            "/api/login",
            json={"email": "asha@example.com", "password": "secret12"},
            headers={"Sec-Fetch-Site": "cross-site"},
        )
        self.assertEqual(response.status_code, 403)

    def test_existing_account_gets_clear_signup_guidance(self):
        response = self.client.post("/api/send-otp", json={"email": "asha@example.com"})
        self.assertEqual(response.status_code, 409)
        self.assertIn("Forgot password", response.get_json()["message"])

    def test_smtp_delivery_uses_verified_starttls_connection(self):
        environment = {
            "BREVO_API_KEY": "",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_PORT": "587",
            "SMTP_USERNAME": "sender@example.com",
            "SMTP_PASSWORD": "abcd efgh ijkl mnop",
            "SMTP_FROM_EMAIL": "sender@example.com",
            "SMTP_USE_SSL": "false",
            "FROM_EMAIL": "",
        }
        tls_context = Mock()
        with (
            patch.dict(os.environ, environment),
            patch.object(app_module.ssl, "create_default_context", return_value=tls_context),
            patch.object(app_module.smtplib, "SMTP") as smtp,
        ):
            server = smtp.return_value.__enter__.return_value
            delivered = app_module.send_otp_email("customer@example.com", "123456")

        self.assertTrue(delivered)
        smtp.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        self.assertEqual(server.ehlo.call_count, 2)
        server.starttls.assert_called_once_with(context=tls_context)
        server.login.assert_called_once_with("sender@example.com", "abcdefghijklmnop")
        server.send_message.assert_called_once()

    def test_invalid_smtp_host_is_rejected_with_clear_error(self):
        environment = {
            "BREVO_API_KEY": "",
            "SMTP_HOST": "sender@example.com",
            "SMTP_PORT": "587",
            "SMTP_USERNAME": "sender@example.com",
            "SMTP_PASSWORD": "abcdefghijklmnop",
            "SMTP_FROM_EMAIL": "sender@example.com",
            "SMTP_USE_SSL": "false",
            "FROM_EMAIL": "",
        }
        with patch.dict(os.environ, environment):
            with self.assertRaisesRegex(OSError, "SMTP_HOST must be a hostname"):
                app_module.send_otp_email("customer@example.com", "123456")

    def test_password_reset_code_survives_database_reopen_and_updates_login(self):
        delivered = {}

        def capture_reset_code(email, otp, purpose):
            delivered.update(email=email, otp=otp, purpose=purpose)
            return True

        with patch.object(app_module, "send_otp_email", side_effect=capture_reset_code):
            requested = self.client.post(
                "/api/request-password-reset", json={"email": "asha@example.com"}
            )

        self.assertEqual(requested.status_code, 200)
        self.assertEqual(requested.get_json()["expiresIn"], 600)
        self.assertEqual(requested.get_json()["resendIn"], 30)
        self.assertEqual(delivered["purpose"], "password reset")
        with app_module.database() as connection:
            stored = connection.execute(
                "SELECT otp_hash FROM password_reset_codes WHERE email = ?",
                ("asha@example.com",),
            ).fetchone()
        self.assertIsNotNone(stored)
        self.assertNotEqual(stored["otp_hash"], delivered["otp"])

        reset = self.client.post(
            "/api/reset-password",
            json={
                "email": "asha@example.com",
                "otp": delivered["otp"],
                "password": "new-secret-12",
            },
        )
        self.assertEqual(reset.status_code, 200)
        self.assertEqual(
            self.sign_in(email="asha@example.com", password="secret12").status_code, 401
        )
        self.assertEqual(
            self.sign_in(email="asha@example.com", password="new-secret-12").status_code,
            200,
        )
        with app_module.database() as connection:
            remaining = connection.execute(
                "SELECT 1 FROM password_reset_codes WHERE email = ?",
                ("asha@example.com",),
            ).fetchone()
        self.assertIsNone(remaining)

    def test_expired_password_reset_code_is_removed(self):
        with app_module.database() as connection:
            connection.execute(
                """
                INSERT INTO password_reset_codes
                    (email, otp_hash, expires_at, sent_at, attempts)
                VALUES (?, ?, 0, 0, 0)
                """,
                ("asha@example.com", app_module.hash_otp("123456")),
            )

        response = self.client.post(
            "/api/reset-password",
            json={
                "email": "asha@example.com",
                "otp": "123456",
                "password": "new-secret-12",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", response.get_json()["message"])
        with app_module.database() as connection:
            remaining = connection.execute(
                "SELECT 1 FROM password_reset_codes WHERE email = ?",
                ("asha@example.com",),
            ).fetchone()
        self.assertIsNone(remaining)

    def test_delivery_failure_returns_safe_message_and_discards_code(self):
        email = "new-customer@example.com"
        with (
            patch.object(app_module, "send_otp_email", side_effect=OSError("mail offline")),
            patch.object(app_module.app.logger, "exception"),
        ):
            response = self.client.post("/api/send-otp", json={"email": email})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn(email, app_module.otp_records)
        self.assertNotIn("SMTP", response.get_json()["message"])


if __name__ == "__main__":
    unittest.main()
