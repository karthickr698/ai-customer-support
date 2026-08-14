export interface RedisPort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isReady(): Promise<boolean>;
}
