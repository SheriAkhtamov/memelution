import React from 'react';
import { Avatar } from './Avatar';
import { Card } from './Card';

export interface UserCardProps {
  user: {
    username: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
  };
  action?: React.ReactNode;
}

export function UserCard({ user, action }: UserCardProps) {
  return (
    <Card
      variant="hoverable"
      padding="sm"
      className="motion-control flex items-center justify-between gap-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={user.avatar_url} name={user.display_name} />
        <span className="min-w-0">
          <span className="block truncate font-black text-foreground">{user.display_name}</span>
          <span className="block truncate text-xs font-bold text-muted-foreground">@{user.username}</span>
          {user.bio ? <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{user.bio}</span> : null}
        </span>
      </div>
      {action}
    </Card>
  );
}
