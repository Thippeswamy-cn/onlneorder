import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
