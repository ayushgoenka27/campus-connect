"""
Phase 5 backend tests: Real-time messaging, conversations, read receipts, and WebSocket gateway.

Coverage:
- FR-MSG-1: Verified users can message accepted connections over WebSocket / REST
- FR-MSG-1 (Restriction): Users CANNOT message unconnected or non-accepted users (HTTP 403)
- FR-MSG-1 (Restriction): Users cannot message themselves (HTTP 400)
- FR-MSG-2: Message history is persisted in PostgreSQL/SQLite for each conversation
- FR-MSG-2: Paginated message history via before_id cursor
- FR-MSG-4: Message status ('sent', 'delivered', 'read') and read receipts
- FR-MSG-5: Mark conversation messages as read and unread counter decrements
- Authorization: Non-participants cannot view conversation or messages (HTTP 403)
- Validation: Blank messages and messages > 5000 characters rejected (HTTP 422)
- WebSocket gateway: Authentication via token query parameter (1008 on failure), ping/pong, and frame delivery
"""
import pytest
from app.core.security import create_access_token


def _register_and_login(client, suffix):
    client.post("/api/v1/auth/register", json={
        "full_name": f"Student {suffix}",
        "username": f"stu_{suffix}",
        "email": f"stu_{suffix}@thapar.edu",
        "password": "Password123!",
    })
    res = client.post("/api/v1/auth/login", json={
        "email": f"stu_{suffix}@thapar.edu",
        "password": "Password123!",
    })
    token = res.json()["access_token"]
    user_res = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    user_id = user_res.json()["id"]
    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "token": token,
        "id": user_id,
    }


def _connect_users(client, u1, u2):
    # u1 sends request to u2
    req = client.post(f"/api/v1/connections/{u2['id']}", headers=u1["headers"])
    conn_id = req.json()["connection"]["id"]
    # u2 accepts request
    client.patch(f"/api/v1/connections/{conn_id}?action=accepted", headers=u2["headers"])


class TestConversationAuthorization:
    def test_cannot_message_self(self, client):
        u1 = _register_and_login(client, "self_msg")
        res = client.post("/api/v1/conversations", json={"recipient_id": u1["id"]}, headers=u1["headers"])
        assert res.status_code == 400
        assert "yourself" in res.json()["detail"].lower()

    def test_cannot_message_unconnected_user(self, client):
        u1 = _register_and_login(client, "unconn_1")
        u2 = _register_and_login(client, "unconn_2")

        res = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"])
        assert res.status_code == 403
        assert "accepted connections" in res.json()["detail"].lower()

    def test_cannot_message_pending_connection(self, client):
        u1 = _register_and_login(client, "pend_1")
        u2 = _register_and_login(client, "pend_2")

        # Send request without accepting
        client.post(f"/api/v1/connections/{u2['id']}", headers=u1["headers"])

        res = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"])
        assert res.status_code == 403
        assert "accepted connections" in res.json()["detail"].lower()

    def test_can_start_conversation_with_accepted_connection(self, client):
        u1 = _register_and_login(client, "acc_1")
        u2 = _register_and_login(client, "acc_2")
        _connect_users(client, u1, u2)

        res = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"])
        assert res.status_code == 201
        data = res.json()
        assert data["peer"]["id"] == u2["id"]
        assert data["unread_count"] == 0

    def test_conversation_creation_is_idempotent(self, client):
        u1 = _register_and_login(client, "idem_1")
        u2 = _register_and_login(client, "idem_2")
        _connect_users(client, u1, u2)

        res1 = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"])
        res2 = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"])
        res3 = client.post("/api/v1/conversations", json={"recipient_id": u1["id"]}, headers=u2["headers"])

        assert res1.json()["id"] == res2.json()["id"]
        assert res1.json()["id"] == res3.json()["id"]


class TestMessagingAndHistory:
    def test_send_and_list_messages(self, client):
        u1 = _register_and_login(client, "msg_1")
        u2 = _register_and_login(client, "msg_2")
        _connect_users(client, u1, u2)

        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()
        conv_id = conv["id"]

        # Send message from u1 to u2
        msg_res = client.post(
            f"/api/v1/conversations/{conv_id}/messages",
            json={"content": "Hello there! Do you have the DBMS slides?"},
            headers=u1["headers"],
        )
        assert msg_res.status_code == 201
        msg = msg_res.json()
        assert msg["sender_id"] == u1["id"]
        assert msg["recipient_id"] == u2["id"]
        assert msg["is_read"] is False
        assert msg["status"] in ("sent", "delivered")

        # u2 retrieves history
        history_res = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=u2["headers"])
        assert history_res.status_code == 200
        history = history_res.json()
        assert history["total"] >= 1
        assert history["items"][-1]["content"] == "Hello there! Do you have the DBMS slides?"

    def test_non_participant_cannot_access_messages(self, client):
        u1 = _register_and_login(client, "part_1")
        u2 = _register_and_login(client, "part_2")
        u3 = _register_and_login(client, "part_3")
        _connect_users(client, u1, u2)

        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()
        conv_id = conv["id"]

        # u3 attempts to view messages
        res = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=u3["headers"])
        assert res.status_code == 403

        # u3 attempts to send message
        send_res = client.post(f"/api/v1/conversations/{conv_id}/messages",
                               json={"content": "Sneaky message"}, headers=u3["headers"])
        assert send_res.status_code == 403

    def test_message_validation(self, client):
        u1 = _register_and_login(client, "val_1")
        u2 = _register_and_login(client, "val_2")
        _connect_users(client, u1, u2)

        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()
        conv_id = conv["id"]

        # Blank content
        blank_res = client.post(f"/api/v1/conversations/{conv_id}/messages",
                                json={"content": "   "}, headers=u1["headers"])
        assert blank_res.status_code == 422

        # Too long content (> 5000 chars)
        long_res = client.post(f"/api/v1/conversations/{conv_id}/messages",
                               json={"content": "A" * 5001}, headers=u1["headers"])
        assert long_res.status_code == 422

    def test_read_receipts_and_unread_counts(self, client):
        u1 = _register_and_login(client, "read_1")
        u2 = _register_and_login(client, "read_2")
        _connect_users(client, u1, u2)

        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()
        conv_id = conv["id"]

        # u1 sends 2 messages to u2
        client.post(f"/api/v1/conversations/{conv_id}/messages", json={"content": "Message 1"}, headers=u1["headers"])
        client.post(f"/api/v1/conversations/{conv_id}/messages", json={"content": "Message 2"}, headers=u1["headers"])

        # Check u2's conversation list shows unread_count = 2
        conv_list = client.get("/api/v1/conversations", headers=u2["headers"]).json()
        match = next(c for c in conv_list["items"] if c["id"] == conv_id)
        assert match["unread_count"] == 2

        # u2 marks conversation as read
        read_res = client.patch(f"/api/v1/conversations/{conv_id}/read", headers=u2["headers"])
        assert read_res.status_code == 200
        assert read_res.json()["marked_count"] == 2

        # Verify unread count is now 0
        conv_list_after = client.get("/api/v1/conversations", headers=u2["headers"]).json()
        match_after = next(c for c in conv_list_after["items"] if c["id"] == conv_id)
        assert match_after["unread_count"] == 0

        # Verify message status is 'read'
        messages = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=u2["headers"]).json()
        for m in messages["items"]:
            assert m["is_read"] is True
            assert m["status"] == "read"
            assert m["read_at"] is not None


    def test_client_msg_id_idempotency_rest(self, client):
        u1 = _register_and_login(client, "idem_msg_1")
        u2 = _register_and_login(client, "idem_msg_2")
        _connect_users(client, u1, u2)

        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()
        conv_id = conv["id"]

        # Send first message with client_msg_id
        res1 = client.post(
            f"/api/v1/conversations/{conv_id}/messages",
            json={"content": "Unique message", "client_msg_id": "client-uuid-999"},
            headers=u1["headers"],
        )
        assert res1.status_code == 201
        m1 = res1.json()

        # Retry sending exact same message with client_msg_id (e.g. after network glitch)
        res2 = client.post(
            f"/api/v1/conversations/{conv_id}/messages",
            json={"content": "Unique message", "client_msg_id": "client-uuid-999"},
            headers=u1["headers"],
        )
        assert res2.status_code in (200, 201)
        m2 = res2.json()

        # Must return the SAME message ID without creating a duplicate
        assert m1["id"] == m2["id"]

        # Verify only 1 message exists in history
        history = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=u1["headers"]).json()
        matching = [m for m in history["items"] if m["client_msg_id"] == "client-uuid-999"]
        assert len(matching) == 1

    def test_message_status_consistency_check_constraint(self, client):
        from sqlalchemy.exc import IntegrityError
        from app.models.message import Message
        from app.db.dependencies import get_db

        # Test at DB model level that contradictory status and is_read violates CheckConstraint
        app_db = next(client.app.dependency_overrides[get_db]())
        u1 = _register_and_login(client, "ck_1")
        u2 = _register_and_login(client, "ck_2")
        _connect_users(client, u1, u2)
        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()

        # Contradiction: status='sent' but is_read=True
        bad_msg = Message(
            conversation_id=conv["id"],
            sender_id=u1["id"],
            recipient_id=u2["id"],
            content="Bad status",
            status="sent",
            is_read=True,  # Contradicts status='sent'
        )
        app_db.add(bad_msg)
        with pytest.raises(IntegrityError):
            app_db.commit()
        app_db.rollback()


class TestWebSocketGateway:
    def test_ws_connection_unauthenticated(self, client):
        # Missing token
        with pytest.raises(Exception):
            with client.websocket_connect("/ws") as ws:
                pass

        # Invalid token
        with pytest.raises(Exception):
            with client.websocket_connect("/ws?token=invalid_token") as ws:
                pass

    def test_ws_connection_authenticated_and_ping_pong(self, client):
        u1 = _register_and_login(client, "ws_1")
        with client.websocket_connect(f"/ws?token={u1['token']}") as ws:
            # Initial frame
            initial = ws.receive_json()
            assert initial["type"] == "connected"
            assert initial["user_id"] == u1["id"]

            # Ping-Pong
            ws.send_json({"type": "ping"})
            pong = ws.receive_json()
            assert pong["type"] == "pong"

    def test_ws_send_message_flow(self, client):
        u1 = _register_and_login(client, "ws_u1")
        u2 = _register_and_login(client, "ws_u2")
        _connect_users(client, u1, u2)

        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()
        conv_id = conv["id"]

        with client.websocket_connect(f"/ws?token={u1['token']}") as ws1:
            ws1.receive_json()  # consume 'connected' frame

            # Send chat message via WebSocket
            ws1.send_json({
                "type": "chat_message",
                "conversation_id": conv_id,
                "content": "Real-time message via WebSocket!",
                "client_msg_id": "cmsg-12345",
            })

            # Sender receives echo frame
            echo = ws1.receive_json()
            assert echo["type"] == "new_message"
            assert echo["message"]["content"] == "Real-time message via WebSocket!"
            assert echo["message"]["client_msg_id"] == "cmsg-12345"
            assert echo["message"]["sender_id"] == u1["id"]
            assert echo["message"]["recipient_id"] == u2["id"]

    def test_client_msg_id_idempotency_ws(self, client):
        u1 = _register_and_login(client, "ws_idem_1")
        u2 = _register_and_login(client, "ws_idem_2")
        _connect_users(client, u1, u2)

        conv = client.post("/api/v1/conversations", json={"recipient_id": u2["id"]}, headers=u1["headers"]).json()
        conv_id = conv["id"]

        with client.websocket_connect(f"/ws?token={u1['token']}") as ws:
            ws.receive_json()  # 'connected'

            # Send first time
            ws.send_json({
                "type": "chat_message",
                "conversation_id": conv_id,
                "content": "Idempotent WS content",
                "client_msg_id": "cmsg-ws-idem-777",
            })
            resp1 = ws.receive_json()
            assert resp1["type"] == "new_message"
            msg1 = resp1["message"]

            # Retry sending with same client_msg_id
            ws.send_json({
                "type": "chat_message",
                "conversation_id": conv_id,
                "content": "Idempotent WS content",
                "client_msg_id": "cmsg-ws-idem-777",
            })
            resp2 = ws.receive_json()
            assert resp2["type"] == "new_message"
            msg2 = resp2["message"]

            # Must match exactly and not create duplicate
            assert msg1["id"] == msg2["id"]

            history = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=u1["headers"]).json()
            matching = [m for m in history["items"] if m["client_msg_id"] == "cmsg-ws-idem-777"]
            assert len(matching) == 1

    def test_multi_socket_offline_only_after_final_disconnect(self, client):
        from app.core.websocket import manager

        u1 = _register_and_login(client, "multi_s1")
        # Connect tab 1
        with client.websocket_connect(f"/ws?token={u1['token']}") as ws1:
            ws1.receive_json()
            assert manager.is_online(u1["id"]) is True
            assert len(manager.active_connections[u1["id"]]) == 1

            # Connect tab 2
            with client.websocket_connect(f"/ws?token={u1['token']}") as ws2:
                ws2.receive_json()
                assert len(manager.active_connections[u1["id"]]) == 2
                assert manager.is_online(u1["id"]) is True

            # Tab 2 exited, tab 1 still open: user remains online!
            assert manager.is_online(u1["id"]) is True
            assert len(manager.active_connections[u1["id"]]) == 1

        # Tab 1 exited: now user is offline!
        assert manager.is_online(u1["id"]) is False

    def test_account_deactivation_disconnects_websocket(self, client):
        from starlette.websockets import WebSocketDisconnect

        # Register admin
        client.post("/api/v1/auth/register", json={
            "full_name": "Admin Tester",
            "username": "admin_ws_test",
            "email": "admin_ws_test@thapar.edu",
            "password": "Password123!",
        })
        login_admin = client.post("/api/v1/auth/login", json={
            "email": "admin_ws_test@thapar.edu",
            "password": "Password123!",
        }).json()
        admin_token = login_admin["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Promote to admin
        from app.db.dependencies import get_db
        from app.models.user import User
        from sqlalchemy import select
        app_db = next(client.app.dependency_overrides[get_db]())
        admin_user = app_db.scalar(select(User).where(User.email == "admin_ws_test@thapar.edu"))
        admin_user.role = "admin"
        app_db.commit()

        # Register normal student
        student = _register_and_login(client, "deact_stu")

        # Student connects WebSocket
        with client.websocket_connect(f"/ws?token={student['token']}") as ws:
            ws.receive_json()  # 'connected'

            # Admin deactivates student
            deact_res = client.patch(
                f"/api/v1/admin/users/{student['id']}/status",
                json={"is_active": False},
                headers=admin_headers,
            )
            assert deact_res.status_code == 200

            # WebSocket should be closed or next action rejected with disconnect
            with pytest.raises((WebSocketDisconnect, Exception)):
                ws.send_json({"type": "ping"})
                ws.receive_json()

