#!/usr/bin/env python3
"""Comprehensive API tests for Doctor Scheduler v2."""

import json
import sys
from datetime import date, datetime, timedelta

import requests

BASE_URL = "http://127.0.0.1:8001"
TIMEOUT = 10


class APITester:
    def __init__(self):
        self.token = None
        self.admin_token = None
        self.patient_id = None
        self.doctor_id = None
        self.mode = "online"
        self.speciality = "Cardiology"
        self.schedule_date = (date.today() + timedelta(days=1)).isoformat()
        self.available_schedule_id = None
        self.appointment_id = None
        self.passed = 0
        self.failed = 0

    def log(self, message):
        print(message)

    def _record_manual_failure(self, test_num, name, message):
        self.log(f"[TEST {test_num}] {name}")
        self.log(f"  x FAIL - {message}\n")
        self.failed += 1

    def _build_headers(self, token=None):
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _safe_payload(self, response):
        try:
            return response.json()
        except ValueError:
            return response.text

    def _request(self, method, endpoint, token=None, data=None, json_data=None, params=None):
        headers = self._build_headers(token=token)

        if method in {"POST", "PUT"}:
            if data is not None:
                return requests.request(
                    method,
                    f"{BASE_URL}{endpoint}",
                    headers=headers,
                    data=data,
                    params=params,
                    timeout=TIMEOUT,
                )

            return requests.request(
                method,
                f"{BASE_URL}{endpoint}",
                headers=headers,
                json=json_data if json_data is not None else {},
                params=params,
                timeout=TIMEOUT,
            )

        return requests.request(
            method,
            f"{BASE_URL}{endpoint}",
            headers=headers,
            params=params,
            timeout=TIMEOUT,
        )

    def test_endpoint(
        self,
        test_num,
        name,
        method,
        endpoint,
        token=None,
        data=None,
        json_data=None,
        params=None,
        expected_statuses=None,
    ):
        self.log(f"[TEST {test_num}] {name}")

        try:
            response = self._request(
                method=method,
                endpoint=endpoint,
                token=token,
                data=data,
                json_data=json_data,
                params=params,
            )
        except Exception as request_error:
            self.log(f"  x FAIL - Exception: {request_error}\n")
            self.failed += 1
            return None

        payload = self._safe_payload(response)

        if expected_statuses is None:
            success = 200 <= response.status_code < 300
            expected_label = "2xx"
        else:
            allowed = set(expected_statuses)
            success = response.status_code in allowed
            expected_label = "/".join(str(code) for code in expected_statuses)

        if success:
            self.passed += 1
            self.log(f"  + PASS - Status: {response.status_code} (expected {expected_label})")
        else:
            self.failed += 1
            self.log(f"  x FAIL - Status: {response.status_code} (expected {expected_label})")

        if isinstance(payload, (dict, list)):
            self.log(f"  Response: {json.dumps(payload, indent=2)}\n")
        else:
            self.log(f"  Response: {payload}\n")

        return payload if success else None

    def _run_auth_tests(self):
        timestamp = int(datetime.now().timestamp())
        patient_email = f"patient{timestamp}@gmail.com"
        admin_email = f"admin{timestamp}@gmail.com"

        self.test_endpoint(
            1,
            "POST /auth/signup (patient)",
            "POST",
            "/auth/signup",
            json_data={
                "name": "Patient User",
                "email": patient_email,
                "password": "123456",
                "role": "patient",
                "contact": "9876543210",
                "dob": "1998-08-15",
                "gender": "Female",
            },
        )

        patient_login = self.test_endpoint(
            2,
            "POST /auth/login (patient)",
            "POST",
            "/auth/login",
            json_data={"email": patient_email, "password": "123456"},
        )
        if patient_login:
            self.token = patient_login.get("token")
            user_obj = patient_login.get("user", {})
            self.patient_id = user_obj.get("patient_id")

        self.test_endpoint(
            3,
            "GET /auth/me (patient)",
            "GET",
            "/auth/me",
            token=self.token,
        )

        self.test_endpoint(
            4,
            "POST /auth/signup (admin)",
            "POST",
            "/auth/signup",
            json_data={
                "name": "Admin User",
                "email": admin_email,
                "password": "123456",
                "role": "admin",
            },
        )

        admin_login = self.test_endpoint(
            5,
            "POST /auth/login (admin)",
            "POST",
            "/auth/login",
            json_data={"email": admin_email, "password": "123456"},
        )
        if admin_login:
            self.admin_token = admin_login.get("token")

    def _run_doctor_and_schedule_tests(self):
        doctor_email = f"dr.ravi.api.{int(datetime.now().timestamp())}@example.com"

        doctor_resp = self.test_endpoint(
            6,
            "POST /doctors",
            "POST",
            "/doctors",
            token=self.admin_token,
            data={
                "name": "Dr Ravi API",
                "email": doctor_email,
                "speciality": self.speciality,
                "mode": self.mode,
                "fee": "600",
                "active": "true",
                "meeting_link": "https://meet.google.com/dr-ravi-api-room",
            },
        )
        if doctor_resp:
            self.doctor_id = doctor_resp.get("id")

        self.test_endpoint(
            7,
            "GET /specialties",
            "GET",
            "/specialties",
            token=self.admin_token,
        )

        self.test_endpoint(
            8,
            "GET /doctors (active)",
            "GET",
            "/doctors",
            token=self.token,
            params={"active_only": "true"},
        )

        if self.doctor_id is None:
            self._record_manual_failure(9, "POST /doctor-schedules", "doctor_id not available")
            self._record_manual_failure(10, "GET /doctor-schedules", "doctor_id not available")
            self._record_manual_failure(11, "GET /availability-by-date", "doctor_id not available")
            self._record_manual_failure(12, "GET /search", "doctor_id not available")
            self._record_manual_failure(13, "GET /availability-by-date mode mismatch", "doctor_id not available")
            return

        self.test_endpoint(
            9,
            "POST /doctor-schedules",
            "POST",
            "/doctor-schedules",
            token=self.admin_token,
            json_data={
                "doctor_id": self.doctor_id,
                "date": self.schedule_date,
                "start_time": "10:00",
                "end_time": "11:00",
                "booked": False,
            },
        )

        self.test_endpoint(
            10,
            "GET /doctor-schedules",
            "GET",
            "/doctor-schedules",
            token=self.admin_token,
            params={
                "doctor_id": self.doctor_id,
                "date": self.schedule_date,
                "include_booked": "false",
            },
        )

        availability = self.test_endpoint(
            11,
            "GET /availability-by-date",
            "GET",
            "/availability-by-date",
            token=self.token,
            params={
                "doctor_id": self.doctor_id,
                "date": self.schedule_date,
                "mode": self.mode,
            },
        )

        if availability and availability.get("available_slots"):
            first_slot = availability["available_slots"][0]
            self.available_schedule_id = first_slot.get("schedule_id")

        self.test_endpoint(
            12,
            "GET /search",
            "GET",
            "/search",
            token=self.token,
            params={"speciality": self.speciality, "mode": self.mode, "active_only": "true"},
        )

        wrong_mode = "offline" if self.mode == "online" else "online"
        self.test_endpoint(
            13,
            "GET /availability-by-date (mode mismatch -> 400)",
            "GET",
            "/availability-by-date",
            token=self.token,
            params={
                "doctor_id": self.doctor_id,
                "date": self.schedule_date,
                "mode": wrong_mode,
            },
            expected_statuses=[400],
        )

    def _run_appointment_tests(self):
        if self.doctor_id is None or self.available_schedule_id is None:
            self._record_manual_failure(14, "POST /appointments", "doctor_id or schedule_id missing")
            self._record_manual_failure(15, "POST /appointments mode mismatch", "doctor_id or schedule_id missing")
            self._record_manual_failure(16, "GET /appointments (patient)", "booking preconditions failed")
            self._record_manual_failure(17, "GET /appointments (admin)", "booking preconditions failed")
            self._record_manual_failure(18, "PUT /appointments/{id}/status", "appointment_id missing")
            return

        appointment_resp = self.test_endpoint(
            14,
            "POST /appointments",
            "POST",
            "/appointments",
            token=self.token,
            json_data={
                "doctor_id": self.doctor_id,
                "schedule_id": self.available_schedule_id,
                "mode": self.mode,
            },
        )
        if appointment_resp:
            self.appointment_id = appointment_resp.get("appointment_id")

        wrong_mode = "offline" if self.mode == "online" else "online"
        self.test_endpoint(
            15,
            "POST /appointments (mode mismatch -> 400)",
            "POST",
            "/appointments",
            token=self.token,
            json_data={
                "doctor_id": self.doctor_id,
                "schedule_id": self.available_schedule_id,
                "mode": wrong_mode,
            },
            expected_statuses=[400],
        )

        self.test_endpoint(
            16,
            "GET /appointments (patient)",
            "GET",
            "/appointments",
            token=self.token,
        )

        self.test_endpoint(
            17,
            "GET /appointments (admin)",
            "GET",
            "/appointments",
            token=self.admin_token,
            params={"patient_id": self.patient_id},
        )

        if self.appointment_id is None:
            self._record_manual_failure(18, "PUT /appointments/{id}/status", "appointment_id missing")
            return

        self.test_endpoint(
            18,
            "PUT /appointments/{id}/status",
            "PUT",
            f"/appointments/{self.appointment_id}/status",
            token=self.admin_token,
            json_data={"status": "COMPLETED"},
        )

    def _run_dashboard_tests(self):
        self.test_endpoint(
            19,
            "GET /dashboard/daily-summary",
            "GET",
            "/dashboard/daily-summary",
            token=self.admin_token,
            params={"date": self.schedule_date},
        )

        self.test_endpoint(
            20,
            "GET /dashboard/daily-summary (mode filtered)",
            "GET",
            "/dashboard/daily-summary",
            token=self.admin_token,
            params={"date": self.schedule_date, "mode": self.mode},
        )

    def _print_summary(self):
        total_checks = self.passed + self.failed
        success_rate = (self.passed / total_checks * 100) if total_checks else 0

        self.log("\n" + "=" * 64)
        self.log("DOCTOR SCHEDULER V2 - TEST SUMMARY")
        self.log("=" * 64)
        self.log(f"EXECUTED CHECKS: {total_checks}")
        self.log(f"PASSED: {self.passed}/{total_checks}")
        self.log(f"FAILED: {self.failed}/{total_checks}")
        self.log(f"Success Rate: {success_rate:.1f}%")

        if self.failed == 0:
            self.log("\n+ ALL TESTS PASSED")
        else:
            self.log(f"\n! {self.failed} test(s) failed")

        self.log("=" * 64)
        return self.failed == 0

    def run_all_tests(self):
        self.log("=" * 64)
        self.log("DOCTOR SCHEDULER BACKEND - COMPREHENSIVE API TEST SUITE (V2)")
        self.log("=" * 64 + "\n")

        self._run_auth_tests()
        self._run_doctor_and_schedule_tests()
        self._run_appointment_tests()
        self._run_dashboard_tests()

        return self._print_summary()


if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
