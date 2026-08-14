export function readBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  return token;
}
