/** Public surface of the TypeScript AI integration module. Not an AI implementation. */
export type { AICallContext, AICallTelemetry, AICallTelemetryPort, AIServicePort, SupportToneGenerationResult } from './application/ports/ai-service-port.js';
export { AIProviderError, AIServiceUnavailableError, InvalidAIPayloadError } from './application/errors.js';
export { PythonAIServiceAdapter, pythonAiRequestHeaders } from './adapters/outbound/python-ai/python-ai-service-adapter.js';
