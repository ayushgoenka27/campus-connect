from datetime import datetime, timedelta
import pytest
from starlette.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.models.event import Event, EventRSVP
from app.models.notification import Notification
from app.models.resource import Resource
from app.models.user import User


# Helper fixtures/functions
def create_test_user(db_session, email, username, role="student", password="Password123!"):
    user = User(
        email=email,
        username=username,
        password_hash=hash_password(password),
        full_name=f"Full {username}",
        role=role,
        is_active=True,
        token_version=1,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def auth_headers(user: User, token_version: int = None):
    tv = token_version if token_version is not None else getattr(user, "token_version", 1)
    token = create_access_token(user_id=user.id, token_version=tv)
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# 1. Password Change & Session Invalidation Tests (FR-SET-1)
# ===========================================================================
class TestPasswordChangeAndSessionRevocation:
    def test_password_change_success_and_token_invalidation(self, client: TestClient, db_session):
        user = create_test_user(db_session, "pc_user1@test.edu", "pc_user1")
        old_headers = auth_headers(user)

        # Confirm old token works
        resp = client.get("/api/v1/auth/me", headers=old_headers)
        assert resp.status_code == 200
        assert resp.json()["username"] == "pc_user1"

        # Change password
        change_resp = client.post(
            "/api/v1/auth/change-password",
            headers=old_headers,
            json={
                "current_password": "Password123!",
                "new_password": "NewSecretPass456!",
                "confirm_password": "NewSecretPass456!",
            },
        )
        assert change_resp.status_code == 200
        data = change_resp.json()
        assert "access_token" in data
        new_token = data["access_token"]

        # 1. Old token MUST now be rejected with 401 Unauthorized
        old_token_resp = client.get("/api/v1/auth/me", headers=old_headers)
        assert old_token_resp.status_code == 401
        assert "revoked or invalidated" in old_token_resp.json()["detail"]

        # 2. New token MUST work
        new_headers = {"Authorization": f"Bearer {new_token}"}
        new_token_resp = client.get("/api/v1/auth/me", headers=new_headers)
        assert new_token_resp.status_code == 200
        assert new_token_resp.json()["username"] == "pc_user1"

        # 3. Login with old password fails
        login_fail = client.post(
            "/api/v1/auth/login",
            json={"email": "pc_user1@test.edu", "password": "Password123!"},
        )
        assert login_fail.status_code == 401

        # 4. Login with new password succeeds
        login_ok = client.post(
            "/api/v1/auth/login",
            json={"email": "pc_user1@test.edu", "password": "NewSecretPass456!"},
        )
        assert login_ok.status_code == 200

    def test_password_change_validations(self, client: TestClient, db_session):
        user = create_test_user(db_session, "pc_user2@test.edu", "pc_user2")
        headers = auth_headers(user)

        # Wrong current password
        bad_cur = client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={
                "current_password": "WrongPassword!",
                "new_password": "ValidNewPassword123!",
                "confirm_password": "ValidNewPassword123!",
            },
        )
        assert bad_cur.status_code == 400
        assert "Current password is incorrect" in bad_cur.json()["detail"]

        # New password same as current password
        same_pass = client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={
                "current_password": "Password123!",
                "new_password": "Password123!",
                "confirm_password": "Password123!",
            },
        )
        assert same_pass.status_code == 400
        assert "must be different" in same_pass.json()["detail"]

        # Passwords mismatch
        mismatch = client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={
                "current_password": "Password123!",
                "new_password": "NewPassword123!",
                "confirm_password": "DifferentPassword123!",
            },
        )
        assert mismatch.status_code == 422


# ===========================================================================
# 2. Notifications Module Tests (FR-NOTIF-1 to FR-NOTIF-4)
# ===========================================================================
class TestNotificationsModule:
    def test_notification_lifecycle_and_isolation(self, client: TestClient, db_session):
        user1 = create_test_user(db_session, "notif_u1@test.edu", "notif_u1")
        user2 = create_test_user(db_session, "notif_u2@test.edu", "notif_u2")

        # Create notifications for user1
        n1 = Notification(
            user_id=user1.id,
            actor_id=user2.id,
            type="connection_request",
            title="Connection Request",
            content="notif_u2 sent you a connection request",
            link="/connections",
            created_at=datetime.utcnow(),
        )
        n2 = Notification(
            user_id=user1.id,
            type="announcement",
            title="Campus Update",
            content="Classes rescheduled",
            link="/announcements",
            created_at=datetime.utcnow(),
        )
        # Notification for user2
        n3 = Notification(
            user_id=user2.id,
            actor_id=user1.id,
            type="connection_request",
            title="User 2 Notification",
            content="Only for user 2",
            link="/connections",
            created_at=datetime.utcnow(),
        )
        db_session.add_all([n1, n2, n3])
        db_session.commit()
        db_session.refresh(n1)
        db_session.refresh(n2)
        db_session.refresh(n3)

        u1_headers = auth_headers(user1)
        u2_headers = auth_headers(user2)

        # 1. List user1 notifications - must only see user1's 2 notifications
        resp = client.get("/api/v1/notifications", headers=u1_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert data["unread_count"] == 2
        assert len(data["items"]) == 2

        # 2. Unread count endpoint
        count_resp = client.get("/api/v1/notifications/unread-count", headers=u1_headers)
        assert count_resp.status_code == 200
        assert count_resp.json()["unread_count"] == 2

        # 3. Cross-user isolation: user2 cannot mark user1's notification as read
        cross_read = client.patch(f"/api/v1/notifications/{n1.id}/read", headers=u2_headers)
        assert cross_read.status_code == 404

        # 4. User1 marks n1 as read
        read_resp = client.patch(f"/api/v1/notifications/{n1.id}/read", headers=u1_headers)
        assert read_resp.status_code == 200
        assert read_resp.json()["is_read"] is True

        # Unread count decrements to 1
        count_resp2 = client.get("/api/v1/notifications/unread-count", headers=u1_headers)
        assert count_resp2.json()["unread_count"] == 1

        # 5. Mark all as read
        read_all_resp = client.patch("/api/v1/notifications/read-all", headers=u1_headers)
        assert read_all_resp.status_code == 200
        assert read_all_resp.json()["updated_count"] == 1

        count_resp3 = client.get("/api/v1/notifications/unread-count", headers=u1_headers)
        assert count_resp3.json()["unread_count"] == 0

        # 6. Delete notification: user2 cannot delete user1's notification
        cross_del = client.delete(f"/api/v1/notifications/{n1.id}", headers=u2_headers)
        assert cross_del.status_code == 404

        # User1 deletes n1
        del_resp = client.delete(f"/api/v1/notifications/{n1.id}", headers=u1_headers)
        assert del_resp.status_code == 204

        # Total is now 1
        list_after = client.get("/api/v1/notifications", headers=u1_headers)
        assert list_after.json()["total"] == 1

    def test_connection_request_notification_trigger_and_deduplication(
        self, client: TestClient, db_session
    ):
        sender = create_test_user(db_session, "snd_user@test.edu", "snd_user")
        receiver = create_test_user(db_session, "rcv_user@test.edu", "rcv_user")

        s_headers = auth_headers(sender)
        r_headers = auth_headers(receiver)

        # Send connection request
        req_resp = client.post(f"/api/v1/connections/{receiver.id}", headers=s_headers)
        assert req_resp.status_code == 201

        # Receiver should have 1 connection_request notification
        n_resp = client.get("/api/v1/notifications", headers=r_headers)
        assert n_resp.status_code == 200
        items = n_resp.json()["items"]
        assert len(items) == 1
        assert items[0]["type"] == "connection_request"
        assert items[0]["actor_id"] == sender.id

        # Accept the connection
        conn_id = req_resp.json()["connection"]["id"]
        accept_resp = client.patch(
            f"/api/v1/connections/{conn_id}?action=accepted",
            headers=r_headers,
        )
        assert accept_resp.status_code == 200

        # Sender should have 1 connection_accepted notification
        s_notifs = client.get("/api/v1/notifications", headers=s_headers)
        assert s_notifs.status_code == 200
        s_items = s_notifs.json()["items"]
        assert len(s_items) == 1
        assert s_items[0]["type"] == "connection_accepted"
        assert s_items[0]["actor_id"] == receiver.id


# ===========================================================================
# 3. Campus Resources Module Tests (FR-RES-1, FR-RES-2)
# ===========================================================================
class TestCampusResourcesModule:
    def test_resources_rbac_and_crud(self, client: TestClient, db_session):
        admin = create_test_user(db_session, "res_admin@test.edu", "res_admin", role="admin")
        student = create_test_user(db_session, "res_student@test.edu", "res_student", role="student")

        a_headers = auth_headers(admin)
        s_headers = auth_headers(student)

        # 1. Student cannot create resource (403)
        stu_create = client.post(
            "/api/v1/resources",
            headers=s_headers,
            json={
                "title": "Student Resource",
                "category": "syllabus",
                "resource_type": "external_link",
                "url": "https://campus.edu/doc.pdf",
            },
        )
        assert stu_create.status_code == 403

        # 2. Admin creates valid resource
        adm_create = client.post(
            "/api/v1/resources",
            headers=a_headers,
            json={
                "title": "Algorithms Syllabus 2026",
                "description": "Complete semester syllabus for algorithms",
                "category": "syllabus",
                "resource_type": "official_doc",
                "url": "https://campus.edu/academics/algo-2026.pdf",
            },
        )
        assert adm_create.status_code == 201
        res_data = adm_create.json()
        assert res_data["title"] == "Algorithms Syllabus 2026"
        res_id = res_data["id"]

        # 3. External URL validation (must be http/https)
        bad_url = client.post(
            "/api/v1/resources",
            headers=a_headers,
            json={
                "title": "Invalid URL Resource",
                "category": "handbook",
                "resource_type": "external_link",
                "url": "ftp://files.campus.edu/secret.doc",
            },
        )
        assert bad_url.status_code == 422

        # 4. Student can list and search resources
        list_resp = client.get("/api/v1/resources?search=Algorithms", headers=s_headers)
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 1
        assert list_resp.json()["items"][0]["id"] == res_id

        # Category filter
        cat_resp = client.get("/api/v1/resources?category=syllabus", headers=s_headers)
        assert cat_resp.status_code == 200
        assert cat_resp.json()["total"] == 1

        cat_empty = client.get("/api/v1/resources?category=lab_manual", headers=s_headers)
        assert cat_empty.status_code == 200
        assert cat_empty.json()["total"] == 0

        # 5. Admin updates resource
        upd_resp = client.patch(
            f"/api/v1/resources/{res_id}",
            headers=a_headers,
            json={"title": "Updated Algorithms Syllabus 2026"},
        )
        assert upd_resp.status_code == 200
        assert upd_resp.json()["title"] == "Updated Algorithms Syllabus 2026"

        # 6. Student cannot delete resource (403)
        stu_del = client.delete(f"/api/v1/resources/{res_id}", headers=s_headers)
        assert stu_del.status_code == 403

        # 7. Admin deletes resource
        adm_del = client.delete(f"/api/v1/resources/{res_id}", headers=a_headers)
        assert adm_del.status_code == 200

        # Now 404
        get_404 = client.get(f"/api/v1/resources/{res_id}", headers=s_headers)
        assert get_404.status_code == 404


# ===========================================================================
# 4. Events & RSVP Module Tests (FR-EVT-1 to FR-EVT-4)
# ===========================================================================
class TestEventsAndRSVPModule:
    def test_events_rbac_and_rsvp_lifecycle(self, client: TestClient, db_session):
        admin = create_test_user(db_session, "evt_admin@test.edu", "evt_admin", role="admin")
        student1 = create_test_user(db_session, "evt_stu1@test.edu", "evt_stu1", role="student")
        student2 = create_test_user(db_session, "evt_stu2@test.edu", "evt_stu2", role="student")

        a_headers = auth_headers(admin)
        s1_headers = auth_headers(student1)
        s2_headers = auth_headers(student2)

        now = datetime.utcnow()

        # 1. Student cannot create event (403)
        stu_create = client.post(
            "/api/v1/events",
            headers=s1_headers,
            json={
                "title": "Student Hackathon",
                "description": "Unauthorized event",
                "category": "hackathon",
                "start_date": (now + timedelta(days=5)).isoformat(),
                "location": "Virtual",
            },
        )
        assert stu_create.status_code == 403

        # 2. Date validation: end_date < start_date rejected
        bad_dates = client.post(
            "/api/v1/events",
            headers=a_headers,
            json={
                "title": "Invalid Dates Event",
                "description": "End before start",
                "category": "workshop",
                "start_date": (now + timedelta(days=5)).isoformat(),
                "end_date": (now + timedelta(days=4)).isoformat(),
                "location": "Lab 1",
            },
        )
        assert bad_dates.status_code == 422

        # 3. Admin creates upcoming event with capacity 2
        evt_create = client.post(
            "/api/v1/events",
            headers=a_headers,
            json={
                "title": "AI Workshop 2026",
                "description": "Deep dive into transformers and FastAPI agents",
                "category": "workshop",
                "start_date": (now + timedelta(days=10)).isoformat(),
                "end_date": (now + timedelta(days=10, hours=3)).isoformat(),
                "location": "Auditorium A",
                "capacity": 2,
            },
        )
        assert evt_create.status_code == 201
        event_id = evt_create.json()["id"]

        # Also create a past event
        past_evt = Event(
            title="Past Event 2025",
            description="Event that already happened",
            category="general",
            start_date=now - timedelta(days=10),
            end_date=now - timedelta(days=10, hours=2),
            location="Room 101",
            created_at=now - timedelta(days=15),
            updated_at=now - timedelta(days=15),
        )
        db_session.add(past_evt)
        db_session.commit()
        db_session.refresh(past_evt)

        # 4. List upcoming vs past
        upcoming_list = client.get("/api/v1/events?time_filter=upcoming", headers=s1_headers)
        assert upcoming_list.status_code == 200
        assert any(e["id"] == event_id for e in upcoming_list.json()["items"])
        assert all(e["id"] != past_evt.id for e in upcoming_list.json()["items"])

        past_list = client.get("/api/v1/events?time_filter=past", headers=s1_headers)
        assert past_list.status_code == 200
        assert any(e["id"] == past_evt.id for e in past_list.json()["items"])

        # 5. Cannot RSVP to past event (400)
        past_rsvp = client.post(f"/api/v1/events/{past_evt.id}/rsvp", headers=s1_headers)
        assert past_rsvp.status_code == 400
        assert "already ended" in past_rsvp.json()["detail"]

        # 6. Student 1 RSVPs to upcoming event
        rsvp1 = client.post(f"/api/v1/events/{event_id}/rsvp", headers=s1_headers)
        assert rsvp1.status_code == 200
        assert rsvp1.json()["is_rsvped"] is True
        assert rsvp1.json()["attendee_count"] == 1

        # 7. Idempotent RSVP retry does not create duplicates or throw error
        rsvp1_repeat = client.post(
            f"/api/v1/events/{event_id}/rsvp",
            headers=s1_headers,
            json={"status": "interested"},
        )
        assert rsvp1_repeat.status_code == 200
        assert rsvp1_repeat.json()["rsvp_status"] == "interested"
        assert rsvp1_repeat.json()["attendee_count"] == 1

        # 8. Student 2 RSVPs (reaches capacity limit of 2)
        rsvp2 = client.post(f"/api/v1/events/{event_id}/rsvp", headers=s2_headers)
        assert rsvp2.status_code == 200
        assert rsvp2.json()["attendee_count"] == 2

        # 9. Third user RSVP rejected due to capacity limit (409)
        third_user = create_test_user(db_session, "evt_stu3@test.edu", "evt_stu3")
        u3_headers = auth_headers(third_user)
        rsvp3 = client.post(f"/api/v1/events/{event_id}/rsvp", headers=u3_headers)
        assert rsvp3.status_code == 409
        assert "capacity has been reached" in rsvp3.json()["detail"]

        # 10. Student 1 cancels RSVP
        cancel1 = client.delete(f"/api/v1/events/{event_id}/rsvp", headers=s1_headers)
        assert cancel1.status_code == 200
        assert cancel1.json()["is_rsvped"] is False
        assert cancel1.json()["attendee_count"] == 1

        # Check event detail view reflects updated attendee count and RSVP status
        detail = client.get(f"/api/v1/events/{event_id}", headers=s1_headers)
        assert detail.status_code == 200
        assert detail.json()["is_rsvped"] is False
        assert detail.json()["attendee_count"] == 1

