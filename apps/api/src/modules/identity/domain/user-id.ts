export type UserId = string & { readonly __brand: 'UserId' };

export function createUserId(id: string = crypto.randomUUID()): UserId {
  return id as UserId;
}
