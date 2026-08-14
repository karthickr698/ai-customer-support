export interface EmbeddingRequest {
  readonly texts: readonly string[];
  readonly tenantId: string;
}

export interface EmbeddingPort {
  embed(request: EmbeddingRequest): Promise<readonly (readonly number[])[]>;
}
