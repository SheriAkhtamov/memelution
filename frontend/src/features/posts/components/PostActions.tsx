import React from 'react';
import { Heart, MessageSquare, Repeat2, Bookmark, Share2 } from 'lucide-react';
import { Button, AnimatedNumber } from '../../../shared/ui';
import { useTranslation } from '../../../shared/i18n';

export interface PostActionsProps {
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  savesCount: number;
  liked: boolean;
  reposted: boolean;
  saved: boolean;
  likePulse?: boolean;
  repostPulse?: boolean;
  savePulse?: boolean;
  onLike: () => void;
  onComment: () => void;
  onRepost: () => void;
  onSave: () => void;
  onShare: () => void;
}

export function PostActions({
  likesCount,
  commentsCount,
  repostsCount,
  savesCount,
  liked,
  reposted,
  saved,
  likePulse,
  repostPulse,
  savePulse,
  onLike,
  onComment,
  onRepost,
  onSave,
  onShare,
}: PostActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3 text-muted-foreground">
      <Button
        variant="ghost"
        className="h-9 px-2.5"
        onClick={onComment}
        aria-label={t('post_page.open_comments')}
      >
        <MessageSquare size={17} />
        <AnimatedNumber value={commentsCount} className="tabular-nums" />
        <span className="hidden sm:inline">{t('post.comm_short')}</span>
      </Button>

      <Button
        variant="ghost"
        className={`h-9 px-2.5 transition-transform ${liked ? 'text-destructive' : ''} ${likePulse ? 'scale-125' : ''}`}
        onClick={onLike}
        aria-label={liked ? t('post.remove_like') : t('post.add_like')}
      >
        <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
        <AnimatedNumber value={likesCount} className="tabular-nums" />
        <span className="hidden sm:inline">{t('post.like')}</span>
      </Button>

      <Button
        variant="ghost"
        className={`h-9 px-2.5 transition-transform ${reposted ? 'text-emerald-600' : ''} ${repostPulse ? 'scale-125' : ''}`}
        onClick={onRepost}
        aria-label={reposted ? t('post.remove_repost') : t('post.add_repost')}
      >
        <Repeat2 size={17} />
        <AnimatedNumber value={repostsCount} className="tabular-nums" />
        <span className="hidden sm:inline">{t('post.repost')}</span>
      </Button>

      <Button
        variant="ghost"
        className={`h-9 px-2.5 transition-transform ${saved ? 'text-blue-600' : ''} ${savePulse ? 'scale-125' : ''}`}
        onClick={onSave}
        aria-label={saved ? t('post.menu_unsave') : t('post.save')}
      >
        <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
        <AnimatedNumber value={savesCount} className="tabular-nums" />
        <span className="hidden sm:inline">{t('post.saved_short')}</span>
      </Button>

      <Button
        variant="ghost"
        className="ml-auto h-9 px-2.5"
        onClick={onShare}
        aria-label={t('post.share')}
      >
        <Share2 size={17} />
        <span className="hidden sm:inline">{t('common.share')}</span>
      </Button>
    </div>
  );
}
