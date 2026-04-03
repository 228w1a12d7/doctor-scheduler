#!/usr/bin/env python3
"""
Comprehensive API Test Suite for Doctor Scheduler Backend
Tests all 16 endpoints with proper request formats
"""

import requests
import json
from datetime import datetime, timedelta
import sys

BASE_URL = "http://127.0.0.1:8001"
TIMEOUT = 10
WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

class APITester:
    def __init__(self):
        self.token = None
        self.admin_token = None
        self.patient_id = None
        self.doctor_id = None
        self.clinic_id = None
        self.appointment_id = None
        self.future_booking_date = None
        self.passed = 0
        self.failed = 0
        self.results = []

    def log(self, message):
        print(message)
        self.results.append(message)

    def _build_headers(self, require_token, token_override=None):
        headers = {}
        if require_token:
            active_token = token_override or self.token
            if active_token:
                headers["Authorization"] = f"Bearer {active_token}"
        return headers

    def _send_request(self, method, url, headers, data=None, json_data=None):
        if method == "GET":
            return requests.get(url, headers=headers, timeout=TIMEOUT)

        if method == "POST":
            if data is not None:
                # Form-data request
                return requests.post(url, headers=headers, data=data, timeout=TIMEOUT)
            if json_data is not None:
                # JSON request
                return requests.post(url, headers=headers, json=json_data, timeout=TIMEOUT)
            return requests.post(url, headers=headers, json={}, timeout=TIMEOUT)

        if method == "PUT":
            return requests.put(url, headers=headers, json=json_data, timeout=TIMEOUT)

        raise ValueError(f"Unknown method: {method}")

    def _log_test_title(self, test_num, name):
        self.log(f"[TEST {test_num}] {name}")

    def _record_http_success(self, test_num, name, response):
        self._log_test_title(test_num, name)
        self.log(f"  ✓ PASS - Status: {response.status_code}")

        try:
            payload = response.json()
            self.log(f"  Response: {json.dumps(payload, indent=2)}\n")
        except ValueError:
            payload = response.text
            self.log(f"  Response: {payload}\n")

        self.passed += 1
        return payload

    def _record_http_failure(self, test_num, name, response):
        self._log_test_title(test_num, name)
        self.log(f"  ✗ FAIL - Status: {response.status_code}")
        self.log(f"  Error: {response.text}\n")
        self.failed += 1

    def _record_failure(self, test_num, name, message):
        self._log_test_title(test_num, name)
        self.log(f"  ✗ FAIL - {message}\n")
        self.failed += 1

    def test_endpoint(
        self,
        test_num,
        name,
        method,
        endpoint,
        data=None,
        json_data=None,
        require_token=True,
        token_override=None,
    ):
        """Test a single endpoint."""
        url = f"{BASE_URL}{endpoint}"
        headers = self._build_headers(require_token=require_token, token_override=token_override)

        try:
            response = self._send_request(
                method=method,
                url=url,
                headers=headers,
                data=data,
                json_data=json_data,
            )
        except ValueError:
            self._record_failure(test_num, name, f"Unknown method: {method}")
            return None
        except Exception as request_error:
            self._record_failure(test_num, name, f"Exception: {request_error}")
            return None

        if response.status_code >= 400:
            self._record_http_failure(test_num, name, response)
            return None

        return self._record_http_success(test_num, name, response)

    def _run_auth_tests(self):
        email = f"test{datetime.now().timestamp()}@gmail.com"
        signup_resp = self.test_endpoint(
            1,
            "POST /auth/signup",
            "POST",
            "/auth/signup",
            json_data={
                "name": "Test User",
                "email": email,
                "password": "123456",
                "role": "patient",
            },
            require_token=False,
        )
        if signup_resp and "user_id" in signup_resp:
            self.patient_id = signup_resp["user_id"]

        login_resp = self.test_endpoint(
            2,
            "POST /auth/login",
            "POST",
            "/auth/login",
            json_data={"email": email, "password": "123456"},
            require_token=False,
        )
        if login_resp and "token" in login_resp:
            self.token = login_resp["token"]
            self.patient_id = login_resp["user"].get("patient_id") or login_resp["user"]["id"]
            self.log(f"  Token acquired: {self.token[:30]}...\n")

        admin_email = f"admin{datetime.now().timestamp()}@gmail.com"
        self.test_endpoint(
            "2A",
            "POST /auth/signup (admin)",
            "POST",
            "/auth/signup",
            json_data={
                "name": "Admin User",
                "email": admin_email,
                "password": "123456",
                "role": "admin",
            },
            require_token=False,
        )

        admin_login_resp = self.test_endpoint(
            "2B",
            "POST /auth/login (admin)",
            "POST",
            "/auth/login",
            json_data={"email": admin_email, "password": "123456"},
            require_token=False,
        )
        if admin_login_resp and "token" in admin_login_resp:
            self.admin_token = admin_login_resp["token"]

    def _run_doctor_clinic_tests(self):
        doctor_resp = self.test_endpoint(
            3,
            "POST /doctors (form-data)",
            "POST",
            "/doctors",
            data={"name": "Dr Ravi", "speciality": "Cardiology"},
            require_token=True,
        )
        if doctor_resp and "id" in doctor_resp:
            self.doctor_id = doctor_resp["id"]

        self.test_endpoint(4, "GET /doctors", "GET", "/doctors", require_token=True)

        clinic_resp = self.test_endpoint(
            5,
            "POST /clinics (form-data)",
            "POST",
            "/clinics",
            data={"name": "City Clinic", "location": "Hyderabad"},
            require_token=True,
        )
        if clinic_resp and "id" in clinic_resp:
            self.clinic_id = clinic_resp["id"]

        self.test_endpoint(6, "GET /clinics", "GET", "/clinics", require_token=True)

    def _run_mapping_and_availability_tests(self):
        if not (self.doctor_id and self.clinic_id):
            return

        self.test_endpoint(
            7,
            "POST /doctor-clinic",
            "POST",
            "/doctor-clinic",
            json_data={"doctor_id": self.doctor_id, "clinic_id": self.clinic_id},
            require_token=True,
        )

        for day in WEEK_DAYS:
            self.test_endpoint(
                8,
                f"POST /availability ({day})",
                "POST",
                "/availability",
                json_data={
                    "doctor_id": self.doctor_id,
                    "clinic_id": self.clinic_id,
                    "day": day,
                    "start_time": "09:00",
                    "end_time": "14:00",
                },
                require_token=True,
            )

    def _run_search_tests(self):
        if self.doctor_id:
            self.test_endpoint(
                9,
                "GET /availability",
                "GET",
                f"/availability?doctor_id={self.doctor_id}",
                require_token=True,
            )

        self.test_endpoint(
            10,
            "GET /search",
            "GET",
            "/search?speciality=Cardiology",
            require_token=True,
        )

        if self.doctor_id:
            self.future_booking_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
            self.test_endpoint(
                11,
                "GET /availability-by-date",
                "GET",
                f"/availability-by-date?doctor_id={self.doctor_id}&date={self.future_booking_date}",
                require_token=True,
            )

    def _run_appointment_tests(self):
        can_create_appointment = all(
            [self.patient_id, self.doctor_id, self.clinic_id, self.future_booking_date]
        )
        if can_create_appointment:
            appointment_resp = self.test_endpoint(
                12,
                "POST /appointments",
                "POST",
                "/appointments",
                json_data={
                    "patient_id": self.patient_id,
                    "doctor_id": self.doctor_id,
                    "clinic_id": self.clinic_id,
                    "date": self.future_booking_date,
                    "time": "10:00",
                },
                require_token=True,
            )
            if appointment_resp and "appointment_id" in appointment_resp:
                self.appointment_id = appointment_resp["appointment_id"]

        if self.patient_id:
            self.test_endpoint(
                13,
                "GET /appointments",
                "GET",
                f"/appointments?patient_id={self.patient_id}",
                require_token=True,
            )

        if self.appointment_id:
            self.test_endpoint(
                14,
                "PUT /appointments/{id}",
                "PUT",
                f"/appointments/{self.appointment_id}",
                json_data={"status": "COMPLETED"},
                require_token=True,
                token_override=self.admin_token,
            )

    def _run_leave_and_utilization_tests(self):
        if self.doctor_id:
            self.test_endpoint(
                15,
                "POST /leaves",
                "POST",
                "/leaves",
                json_data={
                    "doctor_id": self.doctor_id,
                    "start_date": "2026-04-10",
                    "end_date": "2026-04-11",
                    "reason": "Sick Leave",
                },
                require_token=True,
            )

        if self.clinic_id:
            self.test_endpoint(
                16,
                "GET /utilization",
                "GET",
                f"/utilization?clinic_id={self.clinic_id}",
                require_token=True,
            )

    def _print_summary(self):
        total_checks = self.passed + self.failed

        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        self.log(f"EXECUTED CHECKS: {total_checks}")
        self.log(f"PASSED: {self.passed}/{total_checks}")
        self.log(f"FAILED: {self.failed}/{total_checks}")
        success_rate = (self.passed / total_checks * 100) if total_checks else 0
        self.log(f"Success Rate: {success_rate:.1f}%")

        if self.failed == 0:
            self.log("\n✓ ALL TESTS PASSED! API IS FULLY FUNCTIONAL")
        else:
            self.log(f"\n✗ {self.failed} test(s) failed - see details above")

        self.log("=" * 60)
        return self.failed == 0

    def run_all_tests(self):
        """Run all backend API tests."""
        self.log("=" * 60)
        self.log("DOCTOR SCHEDULER BACKEND - COMPREHENSIVE API TEST SUITE")
        self.log("=" * 60 + "\n")

        self._run_auth_tests()
        self._run_doctor_clinic_tests()
        self._run_mapping_and_availability_tests()
        self._run_search_tests()
        self._run_appointment_tests()
        self._run_leave_and_utilization_tests()

        return self._print_summary()

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
