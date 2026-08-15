import type { FastifyReply } from 'fastify';

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function applySecureHeaders(reply: FastifyReply, production: boolean): void {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header('X-DNS-Prefetch-Control', 'off');
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  reply.header('X-Permitted-Cross-Domain-Policies', 'none');
  reply.header('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  if (!reply.hasHeader('cache-control')) {
    reply.header('Cache-Control', 'no-store');
  }
  if (production) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}
