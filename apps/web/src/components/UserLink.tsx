// Tên/avatar người dùng bấm được, dẫn tới hồ sơ /u/:handle.
import { Avatar } from '@hoiminh/ui';
import { Link } from 'react-router-dom';

export interface UserLite {
  id?: string;
  name: string;
  handle: string;
  avatarUrl?: string | null;
  coverColor?: string | null;
}

export function UserAvatar({ user, size = 36, className }: { user: UserLite | null | undefined; size?: number; className?: string }) {
  if (!user) return <Avatar name="?" size={size} className={className} />;
  return (
    <Link to={`/u/${user.handle}`} className={`inline-flex ${className ?? ''}`} aria-label={user.name}>
      <Avatar name={user.name} src={user.avatarUrl} color={user.coverColor} size={size} />
    </Link>
  );
}

export function UserName({ user, className }: { user: UserLite | null | undefined; className?: string }) {
  if (!user) return <span className={className}>Ẩn danh</span>;
  return (
    <Link to={`/u/${user.handle}`} className={`font-semibold ${className ?? ''}`} style={{ color: 'inherit' }}>
      {user.name}
    </Link>
  );
}
