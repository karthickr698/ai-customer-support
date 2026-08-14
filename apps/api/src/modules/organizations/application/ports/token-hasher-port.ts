export interface TokenHasherPort {
  hash(token: string): string;
}
