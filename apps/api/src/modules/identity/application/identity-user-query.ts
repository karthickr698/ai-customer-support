import { InvalidEmailError } from '../domain/errors.js';
import { EmailAddress } from '../domain/email-address.js';
import { User } from '../domain/user.js';
import { createUserId } from '../domain/user-id.js';
import type { UserRepository } from './ports/user-repository.js';

export type IdentityUserProfile = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'active' | 'disabled';
  readonly emailVerified: boolean;
};

export class IdentityUserQuery {
  constructor(private readonly users: UserRepository) {}

  async findById(id: string): Promise<IdentityUserProfile | null> {
    const user = await this.users.findById(createUserId(id));
    return user ? toProfile(user) : null;
  }

  async findByEmail(email: string): Promise<IdentityUserProfile | null> {
    try {
      const parsed = EmailAddress.parse(email);
      const user = await this.users.findByEmail(parsed);
      return user ? toProfile(user) : null;
    } catch (error: unknown) {
      if (error instanceof InvalidEmailError) {
        return null;
      }

      throw error;
    }
  }
}

function toProfile(user: User): IdentityUserProfile {
  return {
    id: user.id,
    email: user.email.value,
    displayName: user.displayName,
    status: user.status,
    emailVerified: user.emailVerified,
  };
}
