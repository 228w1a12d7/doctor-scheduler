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

class APITester:
    def __init__(self):
        self.token = None
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

    def test_endpoint(self, test_num, name, method, endpoint, data=None, json_data=None, require_token=True):
        """Test a single endpoint"""
        try:
            url = f"{BASE_URL}{endpoint}"
            headers = {}
            
            if require_token and self.token:
                headers["Authorization"] = f"Bearer {self.token}"

            if method == "GET":
                response = requests.get(url, headers=headers, timeout=TIMEOUT)
            elif method == "POST":
                if data:
                    # Form-data request
                    response = requests.post(url, headers=headers, data=data, timeout=TIMEOUT)
                elif json_data:
                    # JSON request
                    response = requests.post(url, headers=headers, json=json_data, timeout=TIMEOUT)
                else:
                    response = requests.post(url, headers=headers, json={}, timeout=TIMEOUT)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=json_data, timeout=TIMEOUT)
            else:
                self.log(f"[TEST {test_num}] {name}")
                self.log(f"  ✗ FAIL - Unknown method: {method}\n")
                self.failed += 1
                return None

            if response.status_code < 400:
                self.log(f"[TEST {test_num}] {name}")
                self.log(f"  ✓ PASS - Status: {response.status_code}")
                try:
                    resp_data = response.json()
                    self.log(f"  Response: {json.dumps(resp_data, indent=2)}\n")
                    self.passed += 1
                    return resp_data
                except:
                    self.log(f"  Response: {response.text}\n")
                    self.passed += 1
                    return response.text
            else:
                self.log(f"[TEST {test_num}] {name}")
                self.log(f"  ✗ FAIL - Status: {response.status_code}")
                self.log(f"  Error: {response.text}\n")
                self.failed += 1
                return None

        except Exception as e:
            self.log(f"[TEST {test_num}] {name}")
            self.log(f"  ✗ FAIL - Exception: {str(e)}\n")
            self.failed += 1
            return None

    def run_all_tests(self):
        """Run all 16 API tests"""
        self.log("=" * 60)
        self.log("DOCTOR SCHEDULER BACKEND - COMPREHENSIVE API TEST SUITE")
        self.log("=" * 60 + "\n")

        # TEST 1: Signup
        email = f"test{datetime.now().timestamp()}@gmail.com"
        resp = self.test_endpoint(
            1, "POST /auth/signup", "POST", "/auth/signup",
            json_data={
                "name": "Test User",
                "email": email,
                "password": "123456",
                "role": "patient"
            },
            require_token=False
        )
        if resp and "user_id" in resp:
            self.patient_id = resp["user_id"]

        # TEST 2: Login
        resp = self.test_endpoint(
            2, "POST /auth/login", "POST", "/auth/login",
            json_data={
                "email": email,
                "password": "123456"
            },
            require_token=False
        )
        if resp and "token" in resp:
            self.token = resp["token"]
            self.patient_id = resp["user"]["id"]
            self.log(f"  Token acquired: {self.token[:30]}...\n")

        # TEST 3: Create Doctor (form-data, no image)
        resp = self.test_endpoint(
            3, "POST /doctors (form-data)", "POST", "/doctors",
            data={"name": "Dr Ravi", "speciality": "Cardiology"},
            require_token=True
        )
        if resp and "id" in resp:
            self.doctor_id = resp["id"]

        # TEST 4: List Doctors
        self.test_endpoint(
            4, "GET /doctors", "GET", "/doctors",
            require_token=True
        )

        # TEST 5: Create Clinic (form-data)
        resp = self.test_endpoint(
            5, "POST /clinics (form-data)", "POST", "/clinics",
            data={"name": "City Clinic", "location": "Hyderabad"},
            require_token=True
        )
        if resp and "id" in resp:
            self.clinic_id = resp["id"]

        # TEST 6: List Clinics
        self.test_endpoint(
            6, "GET /clinics", "GET", "/clinics",
            require_token=True
        )

        # TEST 7: Map Doctor to Clinic
        if self.doctor_id and self.clinic_id:
            self.test_endpoint(
                7, "POST /doctor-clinic", "POST", "/doctor-clinic",
                json_data={
                    "doctor_id": self.doctor_id,
                    "clinic_id": self.clinic_id
                },
                require_token=True
            )

        # TEST 8: Create Availability
        if self.doctor_id and self.clinic_id:
            # Create availability for multiple days
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            for day in days:
                self.test_endpoint(
                    8, f"POST /availability ({day})", "POST", "/availability",
                    json_data={
                        "doctor_id": self.doctor_id,
                        "clinic_id": self.clinic_id,
                        "day": day,
                        "start_time": "09:00",
                        "end_time": "14:00"
                    },
                    require_token=True
                )

        # TEST 9: Get Availability
        if self.doctor_id:
            self.test_endpoint(
                9, "GET /availability", "GET", f"/availability?doctor_id={self.doctor_id}",
                require_token=True
            )

        # TEST 10: Search Doctors
        self.test_endpoint(
            10, "GET /search", "GET", "/search?speciality=Cardiology",
            require_token=True
        )

        # TEST 11: Get Availability by Date
        if self.doctor_id:
            self.future_booking_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
            self.test_endpoint(
                11, "GET /availability-by-date", "GET", 
                f"/availability-by-date?doctor_id={self.doctor_id}&date={self.future_booking_date}",
                require_token=True
            )

        # TEST 12: Create Appointment
        if self.patient_id and self.doctor_id and self.clinic_id and self.future_booking_date:
            resp = self.test_endpoint(
                12, "POST /appointments", "POST", "/appointments",
                json_data={
                    "patient_id": self.patient_id,
                    "doctor_id": self.doctor_id,
                    "clinic_id": self.clinic_id,
                    "date": self.future_booking_date,
                    "time": "10:00"
                },
                require_token=True
            )
            if resp and "appointment_id" in resp:
                self.appointment_id = resp["appointment_id"]

        # TEST 13: Get Appointments
        if self.patient_id:
            self.test_endpoint(
                13, "GET /appointments", "GET", f"/appointments?patient_id={self.patient_id}",
                require_token=True
            )

        # TEST 14: Update Appointment Status
        if self.appointment_id:
            self.test_endpoint(
                14, "PUT /appointments/{id}", "PUT", f"/appointments/{self.appointment_id}",
                json_data={"status": "COMPLETED"},
                require_token=True
            )

        # TEST 15: Create Leave
        if self.doctor_id:
            self.test_endpoint(
                15, "POST /leaves", "POST", "/leaves",
                json_data={
                    "doctor_id": self.doctor_id,
                    "start_date": "2026-04-10",
                    "end_date": "2026-04-11",
                    "reason": "Sick Leave"
                },
                require_token=True
            )

        # TEST 16: Get Utilization
        if self.clinic_id:
            self.test_endpoint(
                16, "GET /utilization", "GET", f"/utilization?clinic_id={self.clinic_id}",
                require_token=True
            )

        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        self.log(f"PASSED: {self.passed}/16")
        self.log(f"FAILED: {self.failed}/16")
        self.log(f"Success Rate: {(self.passed/16)*100:.1f}%")
        
        if self.failed == 0:
            self.log("\n✓ ALL TESTS PASSED! API IS FULLY FUNCTIONAL")
        else:
            self.log(f"\n✗ {self.failed} test(s) failed - see details above")
        
        self.log("=" * 60)

        return self.failed == 0

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
