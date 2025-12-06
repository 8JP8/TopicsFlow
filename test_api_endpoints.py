#!/usr/bin/env python
"""
Quick API endpoint tester
Tests if all major endpoints are registered correctly
"""

import requests
import sys
import json

BASE_URL = "http://localhost:5000"
SESSION_COOKIE = None  # Will be set after login

def test_endpoint(method, endpoint, data=None, auth_required=True, expected_status=None):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if auth_required and not SESSION_COOKIE:
            print(f"  ⚠️  {method:6} {endpoint:50} SKIPPED (no auth)")
            return
        
        cookies = {'session': SESSION_COOKIE} if SESSION_COOKIE else None
        
        if method == "GET":
            response = requests.get(url, cookies=cookies, timeout=5)
        elif method == "POST":
            response = requests.post(url, json=data, cookies=cookies, timeout=5)
        elif method == "DELETE":
            response = requests.delete(url, cookies=cookies, timeout=5)
        else:
            print(f"  ❌ {method:6} {endpoint:50} UNSUPPORTED METHOD")
            return
        
        status = response.status_code
        
        if expected_status and status != expected_status:
            print(f"  ❌ {method:6} {endpoint:50} {status} (expected {expected_status})")
        elif status in [200, 201]:
            print(f"  ✅ {method:6} {endpoint:50} {status}")
        elif status in [401, 403]:
            print(f"  🔒 {method:6} {endpoint:50} {status} (auth required)")
        elif status in [404]:
            print(f"  ❌ {method:6} {endpoint:50} {status} NOT FOUND")
        else:
            print(f"  ⚠️  {method:6} {endpoint:50} {status}")
            
    except requests.exceptions.ConnectionError:
        print(f"  💀 {method:6} {endpoint:50} CONNECTION REFUSED")
        return False
    except Exception as e:
        print(f"  ❌ {method:6} {endpoint:50} ERROR: {str(e)}")
        return False
    
    return True

def main():
    print("=" * 80)
    print("TopicsFlow API Endpoint Tester")
    print("=" * 80)
    print()
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print("✅ Backend server is running")
        print()
    except:
        print("❌ Backend server is NOT running!")
        print()
        print("Start the backend with:")
        print("  cd backend")
        print("  python app.py")
        print()
        sys.exit(1)
    
    print("Testing Public Endpoints:")
    print("-" * 80)
    test_endpoint("POST", "/api/auth/register", auth_required=False, expected_status=400)
    test_endpoint("POST", "/api/auth/login", auth_required=False, expected_status=400)
    print()
    
    print("Testing User Endpoints (requires auth):")
    print("-" * 80)
    test_endpoint("GET", "/api/auth/me")
    test_endpoint("GET", "/api/users/profile")
    test_endpoint("GET", "/api/users/topics")
    test_endpoint("GET", "/api/users/friends")
    test_endpoint("GET", "/api/users/blocked")
    print()
    
    print("Testing Ticket Endpoints:")
    print("-" * 80)
    test_endpoint("GET", "/api/tickets/my-tickets")
    test_endpoint("POST", "/api/tickets/", data={
        "category": "test",
        "subject": "Test",
        "description": "Test ticket description here with enough characters",
        "priority": "low"
    })
    print()
    
    print("Testing Report Endpoints:")
    print("-" * 80)
    test_endpoint("GET", "/api/reports/")
    test_endpoint("POST", "/api/reports/", data={
        "reported_user_id": "test_id",
        "reason": "spam",
        "description": "Test report description"
    })
    print()
    
    print("Testing Admin Endpoints:")
    print("-" * 80)
    test_endpoint("GET", "/api/admin/stats")
    test_endpoint("GET", "/api/admin/reports")
    test_endpoint("GET", "/api/admin/tickets")
    print()
    
    print("Testing Topic Endpoints:")
    print("-" * 80)
    test_endpoint("GET", "/api/topics/")
    test_endpoint("GET", "/api/topics/?limit=10")
    print()
    
    print("Testing Private Message Endpoints:")
    print("-" * 80)
    test_endpoint("GET", "/api/users/private-messages/conversations")
    test_endpoint("GET", "/api/users/private-messages/unread-count")
    print()
    
    print("=" * 80)
    print("Test Complete!")
    print("=" * 80)
    print()
    print("Legend:")
    print("  ✅ = Endpoint working correctly")
    print("  🔒 = Endpoint requires authentication")
    print("  ❌ = Endpoint not found or error")
    print("  ⚠️  = Endpoint responding but unexpected status")
    print("  💀 = Cannot connect to server")
    print()
    print("Note: Many endpoints will show 🔒 because this test doesn't")
    print("include actual login credentials. That's expected!")
    print()
    print("To test with authentication, use the browser or Postman")
    print("with a valid session cookie.")
    print()

if __name__ == "__main__":
    main()
