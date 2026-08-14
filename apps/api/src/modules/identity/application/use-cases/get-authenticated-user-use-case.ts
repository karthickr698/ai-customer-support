import type { AuthUserDto } from '@ai-customer-support/contracts';
import { UnauthorizedError, UserNotFoundError } from '../../domain/errors.js';
import { createUserId } from '../../domain/user-id.js';
import { toAuthUserDto } from '../dtos.js';
import type { UserRepository } from '../ports/user-repository.js';

export class GetAuthenticatedUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string | undefined): Promise<{ user: AuthUserDto }> {
    if (!userId) {
      throw new UnauthorizedError();
    }

    const user = await this.users.findById(createUserId(userId));
    if (!user) {
      throw new UserNotFoundError();
    }

    user.assertCanAuthenticate();
    return { user: toAuthUserDto(user) };
  }
}
