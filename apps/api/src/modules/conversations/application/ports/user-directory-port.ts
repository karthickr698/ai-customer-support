export type DirectoryUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
};

export interface UserDirectoryPort {
  findById(id: string): Promise<DirectoryUser | null>;
}
