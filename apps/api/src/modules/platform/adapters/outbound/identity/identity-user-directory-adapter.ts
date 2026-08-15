import type { IdentityUserQuery } from '../../../../identity/index.js';
import type { DirectoryUser, UserDirectoryPort } from '../../../application/ports.js';

export class IdentityUserDirectoryAdapter implements UserDirectoryPort {
  constructor(private readonly users: IdentityUserQuery) {}

  async findById(id: string): Promise<DirectoryUser | null> {
    const user = await this.users.findById(id);
    return user ? toDirectoryUser(user) : null;
  }

  async findByEmail(email: string): Promise<DirectoryUser | null> {
    const user = await this.users.findByEmail(email);
    return user ? toDirectoryUser(user) : null;
  }
}

function toDirectoryUser(user: {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'active' | 'disabled';
  readonly emailVerified: boolean;
}): DirectoryUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    emailVerified: user.emailVerified,
  };
}
