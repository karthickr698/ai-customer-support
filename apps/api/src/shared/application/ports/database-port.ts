export interface DatabasePort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isReady(): Promise<boolean>;
}
