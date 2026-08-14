import type { EmailAddress } from '../../domain/email-address.js';
import type { User } from '../../domain/user.js';
import type { UserId } from '../../domain/user-id.js';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  save(user: User): Promise<void>;
}
