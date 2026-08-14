export interface TokenHasherPort {
  hash(token: string): string;
  pkceS256Challenge(verifier: string): string;
}
