import pytest


def test_root_and_health(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "message" in res.json()

    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"


def test_registration_and_login_flow(client):
    # 1. Register a new user
    register_payload = {
        "full_name": "Alice Johnson",
        "username": "alice_j",
        "email": "alice@university.edu",
        "password": "Password123!",
    }
    res = client.post("/api/v1/auth/register", json=register_payload)
    assert res.status_code == 201
    assert res.json()["message"] == "User registered successfully"
    user_id = res.json()["user_id"]
    assert isinstance(user_id, int)

    # 2. Duplicate registration should fail with 409
    res_dup = client.post("/api/v1/auth/register", json=register_payload)
    assert res_dup.status_code == 409

    # 3. Login with incorrect password should fail with 401
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@university.edu", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401
    assert "Invalid email or password" in bad_login.json()["detail"]

    # 4. Login with non-existent email should fail with 401
    no_user_login = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@university.edu", "password": "Password123!"},
    )
    assert no_user_login.status_code == 401

    # 5. Login with valid credentials returns JWT token
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@university.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    token = token_data["access_token"]

    # 6. Auth verification: /api/v1/auth/me
    auth_headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "alice@university.edu"
    assert me_res.json()["username"] == "alice_j"

    # 7. Access without token should be 403 (HTTPBearer default)
    no_token_res = client.get("/api/v1/auth/me")
    assert no_token_res.status_code in (401, 403)

    # 8. Access with invalid token should be 401
    invalid_token_res = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.payload"}
    )
    assert invalid_token_res.status_code == 401


def test_user_profile_operations(client):
    # Register & login
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Bob Smith",
            "username": "bob_smith",
            "email": "bob@university.edu",
            "password": "Password123!",
        },
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "bob@university.edu", "password": "Password123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch user profile
    profile_res = client.get("/api/v1/users/me", headers=headers)
    assert profile_res.status_code == 200
    profile = profile_res.json()
    assert profile["full_name"] == "Bob Smith"
    assert profile["course"] is None

    # Update profile
    update_payload = {
        "bio": "CS Major interested in AI and distributed systems.",
        "course": "B.Tech Computer Science",
        "branch": "Artificial Intelligence",
        "year": 3,
    }
    update_res = client.patch("/api/v1/users/me", json=update_payload, headers=headers)
    assert update_res.status_code == 200
    updated_user = update_res.json()["user"]
    assert updated_user["bio"] == update_payload["bio"]
    assert updated_user["course"] == update_payload["course"]
    assert updated_user["year"] == 3

    # List active users
    users_res = client.get("/api/v1/users", headers=headers)
    assert users_res.status_code == 200
    assert len(users_res.json()) >= 1

    # Search filter
    search_res = client.get("/api/v1/users?search=Bob", headers=headers)
    assert search_res.status_code == 200
    assert any(u["username"] == "bob_smith" for u in search_res.json())

    # Public profile endpoint (GET /users/{id})
    pub_res = client.get(f"/api/v1/users/{profile['id']}", headers=headers)
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["full_name"] == "Bob Smith"
    assert pub_data["username"] == "bob_smith"
    assert "email" not in pub_data  # Public profile hides email address

    # Non-existent user public profile returns 404
    not_found_res = client.get("/api/v1/users/999999", headers=headers)
    assert not_found_res.status_code == 404

    # Pagination test (skip and limit)
    paged_res = client.get("/api/v1/users?skip=0&limit=1", headers=headers)
    assert paged_res.status_code == 200
    assert len(paged_res.json()) <= 1


def test_connection_management_lifecycle(client):
    # Register User 1
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Charlie Brown",
            "username": "charlie_b",
            "email": "charlie@university.edu",
            "password": "Password123!",
        },
    )
    res1 = client.post(
        "/api/v1/auth/login",
        json={"email": "charlie@university.edu", "password": "Password123!"},
    )
    token1 = res1.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    u1_profile = client.get("/api/v1/users/me", headers=headers1).json()
    u1_id = u1_profile["id"]

    # Register User 2
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Diana Prince",
            "username": "diana_p",
            "email": "diana@university.edu",
            "password": "Password123!",
        },
    )
    res2 = client.post(
        "/api/v1/auth/login",
        json={"email": "diana@university.edu", "password": "Password123!"},
    )
    token2 = res2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}
    u2_profile = client.get("/api/v1/users/me", headers=headers2).json()
    u2_id = u2_profile["id"]

    # Prevent connecting with oneself
    self_res = client.post(f"/api/v1/connections/{u1_id}", headers=headers1)
    assert self_res.status_code == 400
    assert "cannot connect with yourself" in self_res.json()["detail"]

    # User 1 sends request to User 2
    req_res = client.post(f"/api/v1/connections/{u2_id}", headers=headers1)
    assert req_res.status_code == 201
    conn_id = req_res.json()["connection"]["id"]

    # Prevent duplicate request
    dup_res = client.post(f"/api/v1/connections/{u2_id}", headers=headers1)
    assert dup_res.status_code == 409

    # User 1 checks sent requests (should have 1 pending)
    sent_res = client.get("/api/v1/connections/sent", headers=headers1)
    assert sent_res.status_code == 200
    assert len(sent_res.json()) == 1
    assert sent_res.json()[0]["user"]["id"] == u2_id
    assert sent_res.json()[0]["status"] == "pending"

    # User 2 checks incoming requests (should have 1 pending)
    inbox_res = client.get("/api/v1/connections/requests", headers=headers2)
    assert inbox_res.status_code == 200
    assert len(inbox_res.json()) == 1
    assert inbox_res.json()[0]["user"]["id"] == u1_id

    # User 1 (sender) cannot accept their own request
    unauth_accept = client.patch(
        f"/api/v1/connections/{conn_id}?action=accepted", headers=headers1
    )
    assert unauth_accept.status_code == 403

    # User 2 (receiver) accepts the request
    accept_res = client.patch(
        f"/api/v1/connections/{conn_id}?action=accepted", headers=headers2
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["connection"]["status"] == "accepted"

    # Both users check accepted connections
    acc1 = client.get("/api/v1/connections/accepted", headers=headers1)
    assert acc1.status_code == 200
    assert len(acc1.json()) == 1
    assert acc1.json()[0]["user"]["id"] == u2_id

    acc2 = client.get("/api/v1/connections/accepted", headers=headers2)
    assert acc2.status_code == 200
    assert len(acc2.json()) == 1
    assert acc2.json()[0]["user"]["id"] == u1_id

    # User 1 sent requests should now be empty (since status is accepted)
    sent_after = client.get("/api/v1/connections/sent", headers=headers1)
    assert sent_after.status_code == 200
    assert len(sent_after.json()) == 0

    # User 1 deletes the connection
    del_res = client.delete(f"/api/v1/connections/{conn_id}", headers=headers1)
    assert del_res.status_code == 200

    # Accepted connections should now be empty for both
    acc1_after = client.get("/api/v1/connections/accepted", headers=headers1)
    assert len(acc1_after.json()) == 0

