export interface VectorSearchRequest {
  readonly tenantId: string;
  readonly query: string;
  readonly limit: number;
}

export interface VectorSearchHit {
  readonly id: string;
  readonly score: number;
  readonly content: string;
}

export interface VectorSearchPort {
  search(request: VectorSearchRequest): Promise<readonly VectorSearchHit[]>;
}
