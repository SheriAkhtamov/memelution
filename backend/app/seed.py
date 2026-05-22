from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db.session import SessionLocal, init_db
from app.models import (
    Category,
    Chat,
    ChatMember,
    Community,
    CommunityMember,
    Follow,
    Hashtag,
    Notification,
    Post,
    PostHashtag,
    User,
)


async def seed_database() -> None:
    await init_db()
    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.username == "memoking"))
        if existing:
            return

        admin = User(
            telegram_id="9001",
            username="admin_memolution",
            display_name="Админ Мемолюции",
            avatar_url="https://api.dicebear.com/9.x/avataaars/svg?seed=Admin",
            role="global_admin",
            onboarding_completed=True,
            bio="Глобальный администратор платформы",
        )
        u1 = User(
            telegram_id="123",
            username="memoking",
            display_name="Император Мемов",
            avatar_url="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix",
            onboarding_completed=True,
            interests=["айти", "дедлайны", "ташкент"],
            location="Ташкент",
            bio="Публикую мемы, короткие мысли и городские наблюдения.",
        )
        u2 = User(
            telegram_id="456",
            username="tashkent_memes",
            display_name="Ташкентский",
            avatar_url="https://api.dicebear.com/9.x/avataaars/svg?seed=Aneka",
            onboarding_completed=True,
            interests=["город", "учёба", "авто"],
            location="Ташкент",
        )
        u3 = User(
            telegram_id="789",
            username="bug_hunter",
            display_name="Охотник за багами",
            avatar_url="https://api.dicebear.com/9.x/avataaars/svg?seed=Bug",
            onboarding_completed=True,
            interests=["айти", "код", "работа"],
        )
        db.add_all([admin, u1, u2, u3])
        await db.flush()

        cat_it = Category(name="IT и работа", slug="it")
        cat_city = Category(name="Город", slug="city")
        db.add_all([cat_it, cat_city])
        await db.flush()

        community = Community(
            owner_id=u1.id,
            name="Айтишные мемы",
            slug="it-memes",
            description="Мемы про код, дедлайны, прод и утренние стендапы.",
            avatar_url="https://api.dicebear.com/9.x/shapes/svg?seed=IT",
            cover_url="https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=80&w=1200",
            category_id=cat_it.id,
            type="public",
            rules="Без травли, спама и чужих персональных данных.",
            settings={"premoderation": False, "allow_polls": True},
            members_count=3,
        )
        db.add(community)
        await db.flush()
        db.add_all(
            [
                CommunityMember(community_id=community.id, user_id=u1.id, role="creator", status="active"),
                CommunityMember(community_id=community.id, user_id=u2.id, role="member", status="active"),
                CommunityMember(community_id=community.id, user_id=u3.id, role="moderator", status="active"),
            ]
        )

        p1 = Post(
            author_id=u1.id,
            community_id=community.id,
            type="meme",
            text="Когда дедлайн был вчера, но ты только открыл IDE #айти #дедлайн",
            media_url="https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=1000",
            media_type="image/jpeg",
            likes_count=42,
            comments_count=2,
            reposts_count=7,
            saves_count=11,
        )
        db.add(p1)
        await db.flush()

        p2 = Post(
            author_id=u2.id,
            community_id=community.id,
            type="meme",
            text="Я, когда пытаюсь понять чужой код #айти",
            media_url="https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?auto=format&fit=crop&q=80&w=1000",
            media_type="image/jpeg",
            likes_count=55,
            comments_count=5,
            reposts_count=12,
            saves_count=18,
        )
        p3 = Post(
            author_id=u3.id,
            community_id=community.id,
            type="meme",
            text="Когда тесты красные, но пятница уже началась",
            media_url="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1000",
            media_type="image/jpeg",
            likes_count=31,
            comments_count=4,
            reposts_count=5,
            saves_count=6,
        )
        poll = Post(
            author_id=u2.id,
            type="poll",
            text="Какой мем сегодня публикуем?",
            poll_options=[
                {"id": "a", "text": "Про работу", "votes": 12},
                {"id": "b", "text": "Про учёбу", "votes": 8},
                {"id": "c", "text": "Про дороги", "votes": 5},
            ],
            poll_settings={"multiple": False, "results": "after_vote"},
            likes_count=9,
        )
        db.add_all([p2, p3, poll])
        await db.flush()

        tags: dict[str, Hashtag] = {}
        for name in ["айти", "дедлайн", "ташкент"]:
            tag = Hashtag(name=name, posts_count=1)
            tags[name] = tag
            db.add(tag)
        await db.flush()
        db.add_all(
            [
                PostHashtag(post_id=p1.id, hashtag_id=tags["айти"].id),
                PostHashtag(post_id=p1.id, hashtag_id=tags["дедлайн"].id),
                PostHashtag(post_id=p2.id, hashtag_id=tags["айти"].id),
            ]
        )

        db.add(Follow(follower_id=u2.id, following_id=u1.id))
        u1.followers_count += 1
        u2.following_count += 1
        community.posts_count = 3
        u1.posts_count = 1
        u2.posts_count = 2
        u3.posts_count = 1

        chat = Chat(type="direct", title=None)
        db.add(chat)
        await db.flush()
        db.add_all(
            [
                ChatMember(chat_id=chat.id, user_id=u1.id, role="member"),
                ChatMember(chat_id=chat.id, user_id=u2.id, role="member"),
                Notification(
                    user_id=u1.id,
                    type="post_liked",
                    data={"post_id": p1.id, "actor": u2.display_name},
                ),
            ]
        )

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_database())
