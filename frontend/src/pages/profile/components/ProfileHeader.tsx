import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Flame,
  Link as LinkIcon,
  Mail,
  MapPin,
  Plus,
  QrCode,
  Radio,
  Share2,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Avatar, Button } from '../../../shared/ui';
import type { User } from '../../../shared/types';
import { cn } from '../../../lib/utils';


interface ExtendedUser extends User {
  is_online?: boolean;
  last_seen?: string;
  theme_color?: string;
}

interface ExtendedProfile {
  user: ExtendedUser;
  is_following: boolean;
  is_blocked: boolean;
  communities: Array<{ id: string; name: string; slug: string; description: string; avatar_url?: string }>;
  achievements?: Array<{ id: string; title: string; description: string; unlocked: boolean }>;
  mutuals?: ExtendedUser[];
}

export interface ProfileHeaderProps {
  data: ExtendedProfile;
  own: boolean;
  followPending: boolean;
  chatPending: boolean;
  coverRef?: React.RefObject<HTMLDivElement | null>;
  onFollowToggle: () => void;
  onSendMessage: () => void;
  onShare: () => void;
  onShowQR: () => void;
  onShowFollowers: () => void;
  onShowFollowing: () => void;
}

function achievementBadgeClasses(index: number) {
  const palette = [
    'bg-amber-50 text-amber-700 ring-amber-200 shadow-amber-100 dark:bg-amber-950/20 dark:text-amber-400',
    'bg-purple-50 text-purple-700 ring-purple-200 shadow-purple-100 dark:bg-purple-950/20 dark:text-purple-400',
    'bg-sky-50 text-sky-700 ring-sky-200 shadow-sky-100 dark:bg-sky-950/20 dark:text-sky-400',
    'bg-emerald-50 text-emerald-700 ring-emerald-200 shadow-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400',
    'bg-rose-50 text-rose-700 ring-rose-200 shadow-rose-100 dark:bg-rose-950/20 dark:text-rose-400',
  ];
  return palette[index % palette.length];
}

export function ProfileHeader({
  data,
  own,
  followPending,
  chatPending,
  coverRef,
  onFollowToggle,
  onSendMessage,
  onShare,
  onShowQR,
  onShowFollowers,
  onShowFollowing,
}: ProfileHeaderProps) {
  const [showGamification, setShowGamification] = useState(false);

  const level = data.user.achievement_level || 1;
  const xpTarget = level * 150 + 50;
  const xpCurrent = data.user.activity_score || 0;
  const xpProgress = Math.min(100, Math.round((xpCurrent / xpTarget) * 100));
  const achievements = data.user.achievements || [];
  const joinedAt = data.user.created_at
    ? new Date(data.user.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    : null;

  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked).length;
  const achievementTotal = achievements.length;
  const mutuals = data.mutuals || [];

  return (
    <section className="profile-hero-card" aria-labelledby="profile-display-name">
      <div className="profile-cover">
        <div ref={coverRef} className="profile-cover-media">
          {data.user.cover_url ? (
            <img src={data.user.cover_url} alt="" className="h-full w-full object-cover animate-in fade-in duration-300" />
          ) : null}
        </div>
        {!data.user.cover_url ? (
          <>
            <span className="profile-cover-wave profile-cover-wave--one" aria-hidden="true" />
            <span className="profile-cover-wave profile-cover-wave--two" aria-hidden="true" />
          </>
        ) : null}
      </div>

      <div className="profile-summary">
        <div className="profile-avatar-wrap">
          <Avatar
            src={data.user.avatar_url}
            name={data.user.display_name}
            className="profile-avatar"
          />
          {data.user.is_online ? (
            <span className="profile-online-dot" aria-label="в сети" />
          ) : null}
        </div>

        <div className="profile-copy">
          <div className="profile-title-row">
            <h1 id="profile-display-name" className="text-foreground">{data.user.display_name}</h1>
            {data.user.is_verified || data.user.role === 'global_admin' ? (
              <BadgeCheck size={22} className="profile-verified-icon text-primary" aria-label="Проверен" />
            ) : null}
            {data.user.role === 'global_admin' ? (
              <span className="profile-founder-badge bg-primary/10 text-primary">
                <Flame size={13} />
                Основатель
              </span>
            ) : null}
          </div>

          <p className="profile-handle text-muted-foreground">@{data.user.username}</p>

          <div className="profile-presence-row text-muted-foreground">
            {data.user.is_online ? (
              <span className="profile-presence profile-presence--online text-emerald-500">
                <Radio size={12} className="animate-pulse" />
                в сети
              </span>
            ) : data.user.last_seen ? (
              <span className="profile-presence text-muted-foreground">
                <Clock size={12} />
                был(а) {formatDistanceToNow(new Date(data.user.last_seen), { addSuffix: true, locale: ru })}
              </span>
            ) : null}
          </div>

          <p className="profile-bio text-foreground">{data.user.bio || 'Пользователь Мемолюции'}</p>

          <div className="profile-meta-row text-muted-foreground">
            {data.user.location ? (
              <span>
                <MapPin size={14} />
                {data.user.location}
              </span>
            ) : null}
            {data.user.website ? (
              <a href={data.user.website} target="_blank" rel="noreferrer" className="hover:text-primary">
                <LinkIcon size={14} />
                {data.user.website.replace(/^https?:\/\//, '')}
              </a>
            ) : null}
            {joinedAt ? (
              <span>
                <CalendarDays size={14} />
                С нами с {joinedAt}
              </span>
            ) : null}
          </div>
        </div>

        <div className="profile-actions">
          {own ? (
            <Link to="/settings" className="profile-main-action bg-primary text-primary-foreground hover:brightness-105">
              Редактировать
            </Link>
          ) : (
            <>
              <Button
                onClick={onFollowToggle}
                loading={followPending}
                className="profile-main-action"
              >
                {data.is_following ? 'Отписаться' : 'Подписаться'}
              </Button>
              <Button variant="outline" onClick={onSendMessage} loading={chatPending} className="profile-secondary-action">
                <Mail size={16} /> Сообщение
              </Button>
            </>
          )}
            <Button
              onClick={onShare}
              variant="outline"
              className="profile-icon-action border border-border bg-card text-foreground hover:bg-muted p-0 h-auto"
              aria-label="Скопировать ссылку на профиль"
            >
              <Share2 size={18} />
            </Button>
            <Button
              onClick={onShowQR}
              variant="outline"
              className="profile-icon-action border border-border bg-card text-foreground hover:bg-muted p-0 h-auto"
              aria-label="Показать QR код профиля"
            >
              <QrCode size={18} />
            </Button>
        </div>
      </div>

      {(data.user.interests || []).length || own ? (
        <div className="profile-tags-row" aria-label="Интересы профиля">
          {(data.user.interests || []).map((interest) => {
            const tagName = interest.replace(/^#/, '').trim();
            if (!tagName) return null;
            return (
              <Link key={interest} to={`/hashtag/${encodeURIComponent(tagName)}`} className="profile-tag bg-muted text-foreground hover:bg-primary/10 hover:text-primary border border-border">
                #{tagName}
              </Link>
            );
          })}
          {own ? (
            <Link to="/settings" className="profile-tag profile-tag--add bg-muted hover:bg-primary/10 hover:text-primary border border-border" aria-label="Редактировать интересы">
              <Plus size={15} />
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="profile-stats-panel border border-border bg-card" aria-label="Статистика профиля">
        <div className="profile-stat">
          <span className="profile-stat-icon text-primary bg-primary/10">
            <FileText size={18} />
          </span>
          <span className="profile-stat-copy">
            <strong className="text-foreground">{data.user.posts_count || 0}</strong>
            <span className="text-muted-foreground">постов</span>
          </span>
        </div>
        <Button
          onClick={onShowFollowers}
          variant="ghost"
          className="profile-stat profile-stat--button hover:bg-muted/40 h-auto p-0 font-normal justify-start block"
        >
          <span className="profile-stat-icon text-primary bg-primary/10">
            <Users size={18} />
          </span>
          <span className="profile-stat-copy">
            <strong className="text-foreground">{data.user.followers_count || 0}</strong>
            <span className="text-muted-foreground">подписчиков</span>
          </span>
        </Button>
        <Button
          onClick={onShowFollowing}
          variant="ghost"
          className="profile-stat profile-stat--button hover:bg-muted/40 h-auto p-0 font-normal justify-start block"
        >
          <span className="profile-stat-icon text-primary bg-primary/10">
            <UserCheck size={18} />
          </span>
          <span className="profile-stat-copy">
            <strong className="text-foreground">{data.user.following_count || 0}</strong>
            <span className="text-muted-foreground">подписок</span>
          </span>
        </Button>
      </div>

      <div className="profile-level-card border border-border bg-card">
        <div className="profile-level-mark text-primary bg-primary/10" aria-hidden="true">
          <Zap size={26} />
        </div>
        <div className="profile-level-copy">
          <p className="text-foreground">
            <strong>Уровень {level}</strong>
            <span className="text-muted-foreground"> · {achievementTotal ? `${unlockedAchievements} из ${achievementTotal} достижений` : 'Новичок'}</span>
          </p>
          <div
            className="profile-level-progress bg-muted"
            role="progressbar"
            aria-label="Опыт профиля"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={xpProgress}
          >
            <span style={{ width: `${xpProgress}%` }} className="bg-primary" />
          </div>
        </div>
        <Button
          onClick={() => setShowGamification((value) => !value)}
          variant="ghost"
          className="profile-level-action text-primary hover:text-primary-hover h-auto p-0 font-normal"
          aria-expanded={showGamification}
        >
          Смотреть достижения
          <ChevronDown size={16} className={cn('transition-transform', showGamification ? 'rotate-180' : '')} />
        </Button>
      </div>

      {showGamification ? (
        <div className="profile-achievement-details border-t border-border bg-card">
          <div className="profile-achievement-meter text-muted-foreground">
            <span>{xpCurrent}/{xpTarget} XP</span>
            <span>{xpProgress}%</span>
          </div>
          {achievements.length ? (
            <div className="profile-achievement-list">
              {achievements.map((achievement, idx) => (
                <span
                  key={achievement.id}
                  title={achievement.description}
                  className={cn(
                    'profile-achievement-chip',
                    achievement.unlocked
                      ? achievementBadgeClasses(idx)
                      : 'bg-muted text-muted-foreground ring-1 ring-border'
                  )}
                >
                  <Sparkles size={13} />
                  {achievement.title}
                </span>
              ))}
            </div>
          ) : null}
          <div className="profile-activity-row text-muted-foreground">
            <span>
              <Activity size={14} />
              Активность {data.user.activity_score ?? 0}
            </span>
            <span>
              <Flame size={14} />
              Рейтинг {data.user.meme_rating ?? 0}
            </span>
          </div>
        </div>
      ) : null}

      {mutuals.length > 0 ? (
        <div className="profile-mutuals text-muted-foreground">
          <div className="profile-mutuals-avatars">
            {mutuals.slice(0, 4).map((person) => (
              <Avatar
                key={person.id}
                src={person.avatar_url}
                name={person.display_name}
                className="profile-mutual-avatar border-2 border-card"
              />
            ))}
          </div>
          <span>{mutuals.length} взаимных подписок</span>
        </div>
      ) : null}

      {!own ? (
        <div className="profile-follow-note bg-muted/30 text-muted-foreground">
          {data.is_following
            ? `Посты @${data.user.username} уже попадают в вашу ленту подписок.`
            : `Подпишитесь на @${data.user.username}, чтобы чаще видеть его публикации и ответы.`}
        </div>
      ) : null}
    </section>
  );
}
