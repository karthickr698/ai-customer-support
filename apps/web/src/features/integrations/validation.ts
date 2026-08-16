import type { ConnectorDefinitionDto, SetupConnectorRequest } from '@ai-customer-support/contracts';
import { validateSafeHttpsUrl } from '@/features/tools/validation';

export type SetupWizardStep = 'review' | 'permissions' | 'credentials' | 'authorize' | 'health';

export type SetupFormValues = {
  name: string;
  permissions: string[];
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  toolName: string;
  credentialKind: 'api_key' | 'bearer';
  secret: string;
  baseUrl: string;
  headerName: string;
};

export type SetupFormErrors = Partial<Record<keyof SetupFormValues, string>>;

export function emptySetupForm(definition: ConnectorDefinitionDto): SetupFormValues {
  const required = definition.permissions.filter((item) => item.required).map((item) => item.id);
  const defaults = definition.defaultScopes.length > 0 ? [...definition.defaultScopes] : required;
  return {
    name: definition.name,
    permissions: defaults,
    clientId: '',
    clientSecret: '',
    authorizationUrl: definition.defaultAuthorizationUrl ?? '',
    tokenUrl: definition.defaultTokenUrl ?? '',
    toolName: definition.kind === 'http' ? (definition.permissions[0]?.id ?? '') : '',
    credentialKind: 'bearer',
    secret: '',
    baseUrl: '',
    headerName: 'Authorization',
  };
}

export function wizardStepsFor(definition: ConnectorDefinitionDto): readonly SetupWizardStep[] {
  return definition.kind === 'oauth'
    ? ['review', 'permissions', 'credentials', 'authorize', 'health']
    : ['review', 'permissions', 'credentials', 'health'];
}

export function validateSetupCredentials(
  definition: ConnectorDefinitionDto,
  values: SetupFormValues,
): SetupFormErrors {
  const errors: SetupFormErrors = {};
  const name = values.name.trim();
  if (name.length < 1 || name.length > 120) {
    errors.name = 'Name must be between 1 and 120 characters';
  }

  if (definition.kind === 'oauth') {
    if (values.clientId.trim().length < 1 || values.clientId.trim().length > 200) {
      errors.clientId = 'Client id is required';
    }
    if (values.clientSecret.trim().length < 8) {
      errors.clientSecret = 'Client secret must be at least 8 characters';
    }
    const authError = validateSafeHttpsUrl(values.authorizationUrl, 'Authorization URL');
    if (authError) {
      errors.authorizationUrl = authError;
    }
    const tokenError = validateSafeHttpsUrl(values.tokenUrl, 'Token URL');
    if (tokenError) {
      errors.tokenUrl = tokenError;
    }
  } else {
    if (!values.toolName.trim()) {
      errors.toolName = 'Select the HTTP tool this credential may call';
    }
    if (values.secret.trim().length < 8) {
      errors.secret = 'Secret must be at least 8 characters';
    }
    const urlError = validateSafeHttpsUrl(values.baseUrl, 'Base URL');
    if (urlError) {
      errors.baseUrl = urlError;
    }
  }

  return errors;
}

export function toSetupRequest(definition: ConnectorDefinitionDto, values: SetupFormValues): SetupConnectorRequest {
  if (definition.kind === 'oauth') {
    return {
      catalogId: definition.id,
      name: values.name.trim(),
      permissions: values.permissions,
      clientId: values.clientId.trim(),
      clientSecret: values.clientSecret.trim(),
      authorizationUrl: values.authorizationUrl.trim(),
      tokenUrl: values.tokenUrl.trim(),
    };
  }

  return {
    catalogId: definition.id,
    name: values.name.trim(),
    permissions: values.toolName ? [values.toolName] : values.permissions,
    toolName: values.toolName as SetupConnectorRequest['toolName'],
    credentialKind: values.credentialKind,
    secret: values.secret.trim(),
    baseUrl: values.baseUrl.trim(),
    headerName: values.headerName.trim() || undefined,
    provider: definition.provider,
  };
}
