import { ApplicationError, DomainError } from '@ai-customer-support/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface HttpErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export function mapErrorToHttpResponse(error: unknown): { statusCode: number; body: HttpErrorBody } {
  if (error instanceof DomainError || error instanceof ApplicationError) {
    return {
      statusCode: error.httpStatus,
      body: {
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  if (isFastifyValidationError(error)) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
        },
      },
    };
  }

  if (isFastifyError(error) && typeof error.statusCode === 'number' && error.statusCode < 500) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: 'Request failed',
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}

export async function httpErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const mapped = mapErrorToHttpResponse(error);

  if (mapped.statusCode >= 500) {
    request.log.error({ err: error }, 'Unhandled error');
  } else {
    request.log.warn({ code: mapped.body.error.code }, 'Request failed');
  }

  await reply.status(mapped.statusCode).send(mapped.body);
}

function isFastifyError(error: unknown): error is FastifyError {
  return typeof error === 'object' && error !== null && 'code' in error && 'statusCode' in error;
}

function isFastifyValidationError(error: unknown): boolean {
  return isFastifyError(error) && error.validation !== undefined;
}
