import type { IdentityUserQuery } from '../../../../identity/application/identity-user-query.js';
import type { DirectoryUser, UserDirectoryPort } from '../../../application/ports.js';

export class IdentityUserDirectoryAdapter implements UserDirectoryPort {
  constructor(private readonly users: IdentityUserQuery) {}

  async findById(id: string): Promise<DirectoryUser | null> {
    const user = await this.users.findById(id);
    if (!user) {
      return null;
    }
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}
