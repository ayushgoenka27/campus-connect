"""
Phase 3 — Community Module Tests
Tests post CRUD, comments, like toggle, and authorization enforcement.
"""
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register_and_login(client, suffix: str) -> tuple[dict, dict]:
    """Register a user and return (user_profile, auth_headers)."""
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": f"User {suffix}",
            "username": f"user_{suffix}",
            "email": f"user_{suffix}@university.edu",
            "password": "Password123!",
        },
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": f"user_{suffix}@university.edu", "password": "Password123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    profile = client.get("/api/v1/users/me", headers=headers).json()
    return profile, headers


# ---------------------------------------------------------------------------
# Test: Post lifecycle (create, list, get, update, delete)
# ---------------------------------------------------------------------------

def test_post_create_list_get(client):
    """P3-01/06: Create a post and retrieve it."""
    user, headers = _register_and_login(client, "post_alpha")

    # Create
    create_res = client.post(
        "/api/v1/posts/",
        json={"content": "Hello, Campus Connect! #welcome"},
        headers=headers,
    )
    assert create_res.status_code == 201
    post = create_res.json()
    assert post["content"] == "Hello, Campus Connect! #welcome"
    assert post["author"]["username"] == "user_post_alpha"
    assert post["like_count"] == 0
    assert post["comment_count"] == 0
    assert post["is_liked"] is False
    post_id = post["id"]

    # List — should include the post
    list_res = client.get("/api/v1/posts/", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(p["id"] == post_id for p in list_data["posts"])

    # Get single post
    get_res = client.get(f"/api/v1/posts/{post_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == post_id

    # Nonexistent post returns 404
    not_found = client.get("/api/v1/posts/999999", headers=headers)
    assert not_found.status_code == 404


def test_post_update_and_delete_own(client):
    """P3-06/13: Author can edit and delete own posts."""
    user, headers = _register_and_login(client, "post_beta")

    create_res = client.post(
        "/api/v1/posts/",
        json={"content": "Original content"},
        headers=headers,
    )
    post_id = create_res.json()["id"]

    # Edit own post
    edit_res = client.patch(
        f"/api/v1/posts/{post_id}",
        json={"content": "Edited content"},
        headers=headers,
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["content"] == "Edited content"

    # Delete own post
    del_res = client.delete(f"/api/v1/posts/{post_id}", headers=headers)
    assert del_res.status_code == 200

    # Confirm deleted
    assert client.get(f"/api/v1/posts/{post_id}", headers=headers).status_code == 404


def test_post_authorization_enforcement(client):
    """P3-13: Another user cannot edit or delete someone else's post."""
    owner, headers_owner = _register_and_login(client, "post_owner_01")
    _other, headers_other = _register_and_login(client, "post_other_01")

    create_res = client.post(
        "/api/v1/posts/",
        json={"content": "Owner's post"},
        headers=headers_owner,
    )
    post_id = create_res.json()["id"]

    # Other user cannot edit
    edit_res = client.patch(
        f"/api/v1/posts/{post_id}",
        json={"content": "Stolen edit"},
        headers=headers_other,
    )
    assert edit_res.status_code == 403

    # Other user cannot delete
    del_res = client.delete(f"/api/v1/posts/{post_id}", headers=headers_other)
    assert del_res.status_code == 403


def test_post_validation(client):
    """P3-05: Content length constraints are enforced."""
    _user, headers = _register_and_login(client, "post_valid_01")

    # Empty content
    res_empty = client.post("/api/v1/posts/", json={"content": ""}, headers=headers)
    assert res_empty.status_code == 422

    # Content too long (2001 chars)
    res_long = client.post(
        "/api/v1/posts/",
        json={"content": "x" * 2001},
        headers=headers,
    )
    assert res_long.status_code == 422


# ---------------------------------------------------------------------------
# Test: Like toggle
# ---------------------------------------------------------------------------

def test_like_toggle(client):
    """P3-08: Like/unlike is idempotent and accurate."""
    user, headers = _register_and_login(client, "liker_01")
    other, headers_other = _register_and_login(client, "likee_01")

    post_res = client.post(
        "/api/v1/posts/",
        json={"content": "Like this!"},
        headers=headers_other,
    )
    post_id = post_res.json()["id"]

    # Like the post
    like_res = client.post(f"/api/v1/posts/{post_id}/like", headers=headers)
    assert like_res.status_code == 200
    like_data = like_res.json()
    assert like_data["liked"] is True
    assert like_data["like_count"] == 1

    # Verify is_liked reflected in post response
    post_data = client.get(f"/api/v1/posts/{post_id}", headers=headers).json()
    assert post_data["is_liked"] is True
    assert post_data["like_count"] == 1

    # Unlike (toggle off)
    unlike_res = client.post(f"/api/v1/posts/{post_id}/like", headers=headers)
    assert unlike_res.status_code == 200
    assert unlike_res.json()["liked"] is False
    assert unlike_res.json()["like_count"] == 0

    # Verify is_liked reflected
    post_data2 = client.get(f"/api/v1/posts/{post_id}", headers=headers).json()
    assert post_data2["is_liked"] is False


# ---------------------------------------------------------------------------
# Test: Comments lifecycle
# ---------------------------------------------------------------------------

def test_comment_add_list_delete(client):
    """P3-07/12: Add, list, and delete comments on a post."""
    author, headers_author = _register_and_login(client, "commenter_01")
    _other, headers_other = _register_and_login(client, "commenter_02")

    # Create post
    post_res = client.post(
        "/api/v1/posts/",
        json={"content": "Post for comments"},
        headers=headers_author,
    )
    post_id = post_res.json()["id"]

    # Add comment as author
    comment_res = client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Great post!"},
        headers=headers_author,
    )
    assert comment_res.status_code == 201
    comment = comment_res.json()
    assert comment["content"] == "Great post!"
    assert comment["post_id"] == post_id
    assert comment["author"]["username"] == "user_commenter_01"
    comment_id = comment["id"]

    # Add another comment as other user
    comment2_res = client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Thanks for sharing!"},
        headers=headers_other,
    )
    assert comment2_res.status_code == 201
    comment2_id = comment2_res.json()["id"]

    # List comments
    list_res = client.get(f"/api/v1/posts/{post_id}/comments", headers=headers_author)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 2
    assert len(list_data["comments"]) == 2

    # comment_count in post response reflects comments
    post_data = client.get(f"/api/v1/posts/{post_id}", headers=headers_author).json()
    assert post_data["comment_count"] == 2

    # Cannot delete someone else's comment
    unauth_del = client.delete(
        f"/api/v1/posts/comments/{comment2_id}", headers=headers_author
    )
    assert unauth_del.status_code == 403

    # Author deletes own comment
    del_res = client.delete(
        f"/api/v1/posts/comments/{comment_id}", headers=headers_author
    )
    assert del_res.status_code == 200

    # List should now have 1 comment
    list_after = client.get(f"/api/v1/posts/{post_id}/comments", headers=headers_author)
    assert list_after.json()["total"] == 1


def test_comment_validation(client):
    """P3-05: Comment content constraints enforced."""
    _user, headers = _register_and_login(client, "comment_valid_01")

    post_res = client.post(
        "/api/v1/posts/",
        json={"content": "Post for validation test"},
        headers=headers,
    )
    post_id = post_res.json()["id"]

    # Empty comment
    res_empty = client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": ""},
        headers=headers,
    )
    assert res_empty.status_code == 422

    # Comment too long (501 chars)
    res_long = client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "x" * 501},
        headers=headers,
    )
    assert res_long.status_code == 422


def test_post_delete_cascades_comments_and_likes(client):
    """When a post is deleted, its comments and likes are cascade-deleted."""
    user, headers = _register_and_login(client, "cascade_01")
    other, headers_other = _register_and_login(client, "cascade_02")

    # Create post
    post_res = client.post(
        "/api/v1/posts/",
        json={"content": "Post to cascade-delete"},
        headers=headers,
    )
    post_id = post_res.json()["id"]

    # Add comment + like from both users
    client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "A comment"},
        headers=headers,
    )
    client.post(f"/api/v1/posts/{post_id}/like", headers=headers)
    client.post(f"/api/v1/posts/{post_id}/like", headers=headers_other)

    # Verify data exists
    assert client.get(f"/api/v1/posts/{post_id}", headers=headers).json()["like_count"] == 2

    # Delete the post
    client.delete(f"/api/v1/posts/{post_id}", headers=headers)

    # Post is gone
    assert client.get(f"/api/v1/posts/{post_id}", headers=headers).status_code == 404

    # Comments endpoint on deleted post returns 404
    assert (
        client.get(f"/api/v1/posts/{post_id}/comments", headers=headers).status_code
        == 404
    )


def test_post_pagination(client):
    """P3-06: Pagination parameters work correctly."""
    _user, headers = _register_and_login(client, "paginate_01")

    # Create 5 posts
    for i in range(5):
        client.post(
            "/api/v1/posts/",
            json={"content": f"Pagination post {i}"},
            headers=headers,
        )

    # Get page 1 (limit=3)
    page1 = client.get("/api/v1/posts/?skip=0&limit=3", headers=headers)
    assert page1.status_code == 200
    assert len(page1.json()["posts"]) == 3

    # Get page 2 (skip=3, limit=3)
    page2 = client.get("/api/v1/posts/?skip=3&limit=3", headers=headers)
    assert page2.status_code == 200
    assert len(page2.json()["posts"]) >= 2  # at least 2 remaining

    # Total reflects all posts in the DB
    assert page1.json()["total"] >= 5
