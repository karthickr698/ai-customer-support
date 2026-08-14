export type DirectoryUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'active' | 'disabled';
};

export interface UserDirectoryPort {
  findById(id: string): Promise<DirectoryUser | null>;
  findByEmail(email: string): Promise<DirectoryUser | null>;
}
