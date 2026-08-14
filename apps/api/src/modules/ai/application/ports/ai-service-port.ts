/**
 * TypeScript integration boundary to the Python AI service.
 * Business modules call this port. They never import LLM, embedding, or vector SDKs.
 *
 * Feature commands add generateResponse, classify, summarize, and similar operations.
 * `isReady` exists so the composition root can reach the Python process without
 * embedding AI implementation here.
 */
export interface AIServicePort {
  isReady(): Promise<boolean>;
}
