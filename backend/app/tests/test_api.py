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


def test_hide_unhide_and_delete_restore_post():
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "restore-post-user", "username": "restore_post_user", "first_name": "Restore", "dev": True},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        post = client.post("/api/posts", headers=headers, data={"text": "restore me"}).json()
        post_id = post["id"]

        assert client.post(f"/api/posts/{post_id}/hide", headers=headers).json()["hidden"] is True
        hidden_feed = client.get("/api/posts?feed=new&limit=10", headers=headers).json()
        assert post_id not in {item["id"] for item in hidden_feed["items"]}

        assert client.delete(f"/api/posts/{post_id}/hide", headers=headers).json()["hidden"] is False
        visible_feed = client.get("/api/posts?feed=new&limit=10", headers=headers).json()
        assert post_id in {item["id"] for item in visible_feed["items"]}

        assert client.delete(f"/api/posts/{post_id}", headers=headers).status_code == 200
        assert client.get(f"/api/posts/{post_id}", headers=headers).status_code == 404
        restored = client.post(f"/api/posts/{post_id}/restore", headers=headers)
        assert restored.status_code == 200
        assert restored.json()["post"]["id"] == post_id
        assert client.get(f"/api/posts/{post_id}", headers=headers).status_code == 200


def test_comment_restore_and_reactions():
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "comment-reaction-user", "username": "comment_reactor", "first_name": "Comment", "dev": True},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        post = client.post("/api/posts", headers=headers, data={"text": "comment reaction post"}).json()
        comment = client.post(
            f"/api/posts/{post['id']}/comments",
            headers=headers,
            json={"text": "react to me"},
        ).json()
        comment_id = comment["id"]

        reacted = client.post(f"/api/comments/{comment_id}/reactions?emoji=😂", headers=headers)
        assert reacted.status_code == 200
        assert reacted.json()["reactions"] == [{"emoji": "😂", "count": 1, "reacted": True}]

        comments = client.get(f"/api/posts/{post['id']}/comments", headers=headers).json()["items"]
        assert comments[0]["reactions"] == [{"emoji": "😂", "count": 1, "reacted": True}]

        unreacted = client.delete(f"/api/comments/{comment_id}/reactions?emoji=😂", headers=headers)
        assert unreacted.status_code == 200
        assert unreacted.json()["reactions"] == []

        assert client.delete(f"/api/comments/{comment_id}", headers=headers).status_code == 200
        deleted = client.get(f"/api/posts/{post['id']}/comments", headers=headers).json()["items"][0]
        assert deleted["is_deleted"] is True
        restored = client.post(f"/api/comments/{comment_id}/restore", headers=headers)
        assert restored.status_code == 200
        assert restored.json()["comment"]["text"] == "react to me"


def test_message_reactions_are_persisted_in_chat_messages():
    with TestClient(app) as client:
        first_login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "message-reactor-a", "username": "message_reactor_a", "first_name": "A", "dev": True},
        )
        second_login = client.post(
            "/api/auth/dev-login",
            json={"telegram_id": "message-reactor-b", "username": "message_reactor_b", "first_name": "B", "dev": True},
        )
        assert first_login.status_code == 200
        assert second_login.status_code == 200
        first_headers = {"Authorization": f"Bearer {first_login.json()['token']}"}

        chat = client.post("/api/chats", headers=first_headers, json={"username": "message_reactor_b"}).json()
        message = client.post(
            f"/api/chats/{chat['id']}/messages",
            headers=first_headers,
            json={"text": "hello reactions"},
        ).json()

        reacted = client.post(f"/api/messages/{message['id']}/reactions?emoji=👍", headers=first_headers)
        assert reacted.status_code == 200
        assert reacted.json()["reactions"] == [{"emoji": "👍", "count": 1, "reacted": True}]

        messages = client.get(f"/api/chats/{chat['id']}/messages", headers=first_headers).json()["items"]
        assert messages[0]["reactions"] == [{"emoji": "👍", "count": 1, "reacted": True}]

        unreacted = client.delete(f"/api/messages/{message['id']}/reactions?emoji=👍", headers=first_headers)
        assert unreacted.status_code == 200
        assert unreacted.json()["reactions"] == []
