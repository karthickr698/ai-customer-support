export interface QueuePort {
  enqueue<T>(queueName: string, payload: T): Promise<void>;
  process<T>(queueName: string, handler: (payload: T) => Promise<void>): void;
}
