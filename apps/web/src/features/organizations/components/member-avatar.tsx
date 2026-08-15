import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { initials } from '../format';

type MemberAvatarProps = {
  readonly name: string;
  readonly email?: string;
  readonly className?: string;
};

export function MemberAvatar({ name, email, className }: MemberAvatarProps) {
  return (
    <Avatar className={cn('size-9', className)}>
      <AvatarFallback>{initials(name, email)}</AvatarFallback>
    </Avatar>
  );
}
