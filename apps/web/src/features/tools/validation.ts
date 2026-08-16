import type {
  IntegrationCredentialKind,
  JsonSchemaProperty,
  OAuthConnectorProvider,
  ToolArgumentSchema,
  ToolDefinitionDto,
  ToolName,
  UpsertIntegrationCredentialRequest,
  UpsertOAuthConnectorRequest,
} from '@ai-customer-support/contracts';
import { INTEGRATION_CREDENTIAL_KINDS, OAUTH_CONNECTOR_PROVIDERS } from '@ai-customer-support/contracts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

export type CredentialFormValues = {
  toolName: ToolName | '';
  name: string;
  kind: IntegrationCredentialKind;
  secret: string;
  baseUrl: string;
  headerName: string;
  provider: string;
};

export type CredentialFormErrors = Partial<Record<keyof CredentialFormValues, string>>;

export type OAuthFormValues = {
  provider: OAuthConnectorProvider;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopesText: string;
};

export type OAuthFormErrors = Partial<Record<keyof OAuthFormValues, string>>;

export const emptyCredentialForm = (toolName: ToolName | '' = ''): CredentialFormValues => ({
  toolName,
  name: '',
  kind: 'bearer',
  secret: '',
  baseUrl: '',
  headerName: 'Authorization',
  provider: 'custom',
});

export const emptyOAuthForm = (provider: OAuthConnectorProvider = 'custom'): OAuthFormValues => ({
  provider,
  name: '',
  clientId: '',
  clientSecret: '',
  authorizationUrl: '',
  tokenUrl: '',
  scopesText: '',
});

export function validateSafeHttpsUrl(raw: string, label = 'URL'): string | undefined {
  const url = raw.trim();
  if (url.length === 0) {
    return `${label} is required`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `${label} must be a valid URL`;
  }

  if (parsed.protocol !== 'https:') {
    return `${label} must use https`;
  }
  if (parsed.username || parsed.password) {
    return `${label} must not include credentials`;
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    return `${label} host is not allowed`;
  }

  return undefined;
}

export function validateCredentialForm(values: CredentialFormValues): CredentialFormErrors {
  const errors: CredentialFormErrors = {};
  if (!values.toolName) {
    errors.toolName = 'Select a tool';
  }
  const name = values.name.trim();
  if (name.length < 1 || name.length > 120) {
    errors.name = 'Name must be between 1 and 120 characters';
  }
  if (!(INTEGRATION_CREDENTIAL_KINDS as readonly string[]).includes(values.kind)) {
    errors.kind = 'Kind must be API key or bearer';
  }
  const secret = values.secret.trim();
  if (secret.length < 8 || secret.length > 8_000) {
    errors.secret = 'Secret must be between 8 and 8000 characters';
  }
  const urlError = validateSafeHttpsUrl(values.baseUrl, 'Base URL');
  if (urlError) {
    errors.baseUrl = urlError;
  }
  const header = values.headerName.trim() || 'Authorization';
  if (header.length > 80 || !/^[A-Za-z0-9-]+$/.test(header)) {
    errors.headerName = 'Header name may only include letters, numbers, and hyphens';
  }
  if (values.provider.trim().length > 40) {
    errors.provider = 'Provider must be at most 40 characters';
  }
  return errors;
}

export function toCredentialRequest(values: CredentialFormValues): UpsertIntegrationCredentialRequest {
  if (!values.toolName) {
    throw new Error('Select a tool');
  }
  return {
    toolName: values.toolName,
    name: values.name.trim(),
    kind: values.kind,
    secret: values.secret.trim(),
    baseUrl: values.baseUrl.trim(),
    headerName: values.headerName.trim() || undefined,
    provider: values.provider.trim() || undefined,
  };
}

export function parseScopes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function validateOAuthForm(values: OAuthFormValues): OAuthFormErrors {
  const errors: OAuthFormErrors = {};
  if (!(OAUTH_CONNECTOR_PROVIDERS as readonly string[]).includes(values.provider)) {
    errors.provider = 'Select a provider';
  }
  const name = values.name.trim();
  if (name.length < 1 || name.length > 120) {
    errors.name = 'Name must be between 1 and 120 characters';
  }
  const clientId = values.clientId.trim();
  if (clientId.length < 1 || clientId.length > 200) {
    errors.clientId = 'Client id must be between 1 and 200 characters';
  }
  const secret = values.clientSecret.trim();
  if (secret.length < 8 || secret.length > 8_000) {
    errors.clientSecret = 'Client secret must be between 8 and 8000 characters';
  }
  const authError = validateSafeHttpsUrl(values.authorizationUrl, 'Authorization URL');
  if (authError) {
    errors.authorizationUrl = authError;
  }
  const tokenError = validateSafeHttpsUrl(values.tokenUrl, 'Token URL');
  if (tokenError) {
    errors.tokenUrl = tokenError;
  }
  const scopes = parseScopes(values.scopesText);
  if (scopes.length > 20) {
    errors.scopesText = 'At most 20 scopes';
  } else if (scopes.some((scope) => scope.length > 80)) {
    errors.scopesText = 'Each scope must be at most 80 characters';
  }
  return errors;
}

export function toOAuthRequest(values: OAuthFormValues): UpsertOAuthConnectorRequest {
  const scopes = parseScopes(values.scopesText);
  return {
    provider: values.provider,
    name: values.name.trim(),
    clientId: values.clientId.trim(),
    clientSecret: values.clientSecret.trim(),
    authorizationUrl: values.authorizationUrl.trim(),
    tokenUrl: values.tokenUrl.trim(),
    scopes: scopes.length > 0 ? scopes : undefined,
  };
}

export function httpTools(catalog: readonly ToolDefinitionDto[]): readonly ToolDefinitionDto[] {
  return catalog.filter((tool) => tool.executionKind === 'http');
}

export function validateArgumentValue(
  property: JsonSchemaProperty,
  raw: string,
  required: boolean,
): string | undefined {
  const value = raw.trim();
  if (value.length === 0) {
    return required ? 'This field is required' : undefined;
  }

  if (property.enum && !property.enum.includes(value)) {
    return 'Select a valid option';
  }

  if (property.type === 'boolean') {
    if (value !== 'true' && value !== 'false') {
      return 'Must be true or false';
    }
    return undefined;
  }

  if (property.type === 'integer' || property.type === 'number') {
    const parsed = property.type === 'integer' ? Number.parseInt(value, 10) : Number.parseFloat(value);
    if (!Number.isFinite(parsed) || (property.type === 'integer' && !Number.isInteger(parsed))) {
      return property.type === 'integer' ? 'Enter a whole number' : 'Enter a number';
    }
    if (property.minimum !== undefined && parsed < property.minimum) {
      return `Must be at least ${String(property.minimum)}`;
    }
    if (property.maximum !== undefined && parsed > property.maximum) {
      return `Must be at most ${String(property.maximum)}`;
    }
    return undefined;
  }

  if (property.minLength !== undefined && value.length < property.minLength) {
    return `Must be at least ${String(property.minLength)} characters`;
  }
  if (property.maxLength !== undefined && value.length > property.maxLength) {
    return `Must be at most ${String(property.maxLength)} characters`;
  }
  if (property.format === 'uuid' && !UUID_PATTERN.test(value)) {
    return 'Enter a valid UUID';
  }
  if (property.format === 'email' && !EMAIL_PATTERN.test(value)) {
    return 'Enter a valid email address';
  }
  if (property.format === 'uri') {
    try {
      new URL(value);
    } catch {
      return 'Enter a valid URL';
    }
  }
  return undefined;
}

export function parseArgumentValue(property: JsonSchemaProperty, raw: string): unknown {
  const value = raw.trim();
  if (property.type === 'boolean') {
    return value === 'true';
  }
  if (property.type === 'integer') {
    return Number.parseInt(value, 10);
  }
  if (property.type === 'number') {
    return Number.parseFloat(value);
  }
  return value;
}

export function buildToolArguments(
  schema: ToolArgumentSchema,
  values: Record<string, string>,
): { arguments: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const args: Record<string, unknown> = {};
  const required = new Set(schema.required);

  for (const [key, property] of Object.entries(schema.properties)) {
    const raw = values[key] ?? '';
    const isRequired = required.has(key);
    const error = validateArgumentValue(property, raw, isRequired);
    if (error) {
      errors[key] = error;
      continue;
    }
    if (raw.trim().length === 0) {
      continue;
    }
    args[key] = parseArgumentValue(property, raw);
  }

  return { arguments: args, errors };
}

export function validateToolSpecificRules(
  name: ToolName,
  args: Record<string, unknown>,
): Record<string, string> {
  if (name === 'getCustomerDetails' && !args.customerId && !args.email) {
    return { customerId: 'Provide customer id or email' };
  }
  if (name === 'getProductDetails' && !args.productId && !args.sku) {
    return { productId: 'Provide product id or SKU' };
  }
  if (name === 'getShipmentDetails' && !args.shipmentId && !args.trackingNumber) {
    return { shipmentId: 'Provide shipment id or tracking number' };
  }
  if (name === 'getReturnDetails' && !args.returnId && !args.orderId) {
    return { returnId: 'Provide return id or order id' };
  }
  if (name === 'updateTicket' && !args.status && !args.note) {
    return { status: 'Provide a status or note' };
  }
  return {};
}

export function conversationIdError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (!UUID_PATTERN.test(trimmed)) {
    return 'Conversation id must be a UUID';
  }
  return undefined;
}
