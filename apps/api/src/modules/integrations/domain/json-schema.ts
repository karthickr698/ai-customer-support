import type { JsonSchemaProperty, ToolArgumentSchema } from '@ai-customer-support/contracts';
import { InvalidToolCallError } from './errors.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateAgainstJsonSchema(
  schema: ToolArgumentSchema,
  value: unknown,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidToolCallError('Tool arguments must be an object');
  }

  const input = value as Record<string, unknown>;
  if (!schema.additionalProperties) {
    for (const key of Object.keys(input)) {
      if (!(key in schema.properties)) {
        throw new InvalidToolCallError(`Unexpected argument: ${key}`);
      }
    }
  }

  for (const required of schema.required) {
    if (input[required] === undefined || input[required] === null) {
      throw new InvalidToolCallError(`Missing required argument: ${required}`);
    }
  }

  const output: Record<string, unknown> = {};
  for (const [key, property] of Object.entries(schema.properties)) {
    const raw = input[key];
    if (raw === undefined) {
      continue;
    }
    output[key] = validateProperty(key, property, raw);
  }
  return output;
}

function validateProperty(name: string, schema: JsonSchemaProperty, value: unknown): unknown {
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new InvalidToolCallError(`${name} must be a boolean`);
    }
    return value;
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new InvalidToolCallError(`${name} must be a number`);
    }
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      throw new InvalidToolCallError(`${name} must be an integer`);
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new InvalidToolCallError(`${name} is below the minimum`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new InvalidToolCallError(`${name} is above the maximum`);
    }
    return value;
  }

  if (typeof value !== 'string') {
    throw new InvalidToolCallError(`${name} must be a string`);
  }
  const text = value.trim();
  if (schema.minLength !== undefined && text.length < schema.minLength) {
    throw new InvalidToolCallError(`${name} is too short`);
  }
  if (schema.maxLength !== undefined && text.length > schema.maxLength) {
    throw new InvalidToolCallError(`${name} is too long`);
  }
  if (schema.enum && !schema.enum.includes(text)) {
    throw new InvalidToolCallError(`${name} is not an allowed value`);
  }
  if (schema.format === 'uuid' && !UUID_PATTERN.test(text)) {
    throw new InvalidToolCallError(`${name} must be a UUID`);
  }
  if (schema.format === 'email' && !text.includes('@')) {
    throw new InvalidToolCallError(`${name} must be an email address`);
  }
  if (schema.format === 'uri') {
    try {
      const parsed = new URL(text);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new InvalidToolCallError(`${name} must be an http(s) URL`);
      }
    } catch (error: unknown) {
      if (error instanceof InvalidToolCallError) {
        throw error;
      }
      throw new InvalidToolCallError(`${name} must be a valid URL`);
    }
  }
  return text;
}
