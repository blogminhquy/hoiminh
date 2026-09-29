// Avatar ở header: bấm vào để mở cài đặt hồ sơ. Dùng chung cho mọi khung để đích luôn giống nhau.
import { Avatar, T } from '@hoiminh/ui';
import { Link } from 'react-router-dom';

export function AccountAvatarLink({ user, size = 40 }: { user: { name: string; avatarUrl?: string | null } | null | undefined; size?: number }) {
  return (
    <Link to="/tai-khoan/ho-so" aria-label="Cài đặt hồ sơ" title="Cài đặt hồ sơ">
      <Avatar name={user?.name} src={user?.avatarUrl} color={T.ink} size={size} />
    </Link>
  );
}
