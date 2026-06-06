import React from 'react';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { useTranslation } from '../i18n';

export interface CommunityCardProps {
  community: {
    name: string;
    slug: string;
    avatar_url?: string;
    description?: string;
    members_count?: number;
  };
  action?: React.ReactNode;
}

export function CommunityCard({ community, action }: CommunityCardProps) {
  const { t } = useTranslation();
  return (
    <Card
      variant="hoverable"
      padding="sm"
      className="motion-control flex items-center justify-between gap-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={community.avatar_url} name={community.name} />
        <span className="min-w-0">
          <span className="block truncate font-black text-foreground">{community.name}</span>
          {community.description ? <span className="line-clamp-2 block text-xs text-muted-foreground">{community.description}</span> : null}
          <span className="text-xs font-bold text-muted-foreground">{community.members_count || 0} {t('layout.members')}</span>
        </span>
      </div>
      {action}
    </Card>
  );
}
