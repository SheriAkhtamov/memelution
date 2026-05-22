from fastapi.testclient import TestClient

from app.main import app


def test_health():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_dev_login_and_feed():
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "test-1", "username": "test_user", "first_name": "Тест", "dev": True},
        )
        assert login.status_code == 200
        token = login.json()["token"]
        feed = client.get("/api/posts", headers={"Authorization": f"Bearer {token}"})
        assert feed.status_code == 200
        assert "items" in feed.json()


def test_meme_evolution_is_removed():
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "test-2", "username": "legacy_guard", "first_name": "Guard", "dev": True},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        assert client.post("/api/memes/not-real/versions", headers=headers).status_code == 404
        assert client.get("/api/memes/not-real/chain", headers=headers).status_code == 404
        assert client.get("/api/memes/day", headers=headers).status_code == 404

        response = client.post(
            "/api/posts",
            headers=headers,
            data={"type": "meme_version", "text": "legacy type"},
        )
        assert response.status_code == 422


def test_feed_keyset_cursor_is_stable_when_new_posts_arrive():
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "cursor-user", "username": "cursor_user", "first_name": "Cursor", "dev": True},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        for index in range(3):
            response = client.post("/api/posts", headers=headers, data={"text": f"cursor post {index}"})
            assert response.status_code == 200

        first_page = client.get("/api/posts?feed=new&limit=2", headers=headers).json()
        assert first_page["next_cursor"]
        first_ids = {item["id"] for item in first_page["items"]}
        assert "offset" not in first_page

        client.post("/api/posts", headers=headers, data={"text": "newer post after cursor"})
        second_page = client.get(f"/api/posts?feed=new&limit=2&cursor={first_page['next_cursor']}", headers=headers).json()
        second_ids = {item["id"] for item in second_page["items"]}
        assert not first_ids.intersection(second_ids)


def test_default_save_collection_is_reused():
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "save-user", "username": "save_user", "first_name": "Saver", "dev": True},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        post = client.post("/api/posts", headers=headers, data={"text": "save me"}).json()

        assert client.post(f"/api/posts/{post['id']}/save", headers=headers, json={}).status_code == 200
        assert client.delete(f"/api/posts/{post['id']}/save", headers=headers).status_code == 200
        assert client.post(f"/api/posts/{post['id']}/save", headers=headers, json={}).status_code == 200

        collections = client.get("/api/save-collections", headers=headers).json()
        defaults = [item for item in collections if item["name"] == "Все сохранённые"]
        assert len(defaults) == 1


def test_disabled_post_comments_reject_new_comments():
    with TestClient(app) as client:
        author_login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "comments-author", "username": "comments_author", "first_name": "Author", "dev": True},
        )
        assert author_login.status_code == 200
        author_headers = {"Authorization": f"Bearer {author_login.json()['token']}"}
        post = client.post(
            "/api/posts",
            headers=author_headers,
            data={"text": "quiet post", "comments_enabled": "false"},
        )
        assert post.status_code == 200
        post_id = post.json()["id"]

        commenter_login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "comments-reader", "username": "comments_reader", "first_name": "Reader", "dev": True},
        )
        assert commenter_login.status_code == 200
        commenter_headers = {"Authorization": f"Bearer {commenter_login.json()['token']}"}

        response = client.post(
            f"/api/posts/{post_id}/comments",
            headers=commenter_headers,
            json={"text": "should not appear"},
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "COMMENTS_ARE_DISABLED"
