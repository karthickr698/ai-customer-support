import type {
  ConnectorCategory,
  ConnectorConnectionStatus,
  ConnectorHealthStatus,
  ConnectorKind,
} from '@ai-customer-support/contracts';

export function integrationsPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/integrations`;
  return segment ? `${base}/${segment}` : base;
}

export function connectorKindLabel(kind: ConnectorKind): string {
  return kind === 'oauth' ? 'OAuth' : 'HTTP';
}

export function connectorCategoryLabel(category: ConnectorCategory): string {
  switch (category) {
    case 'commerce':
      return 'Commerce';
    case 'payments':
      return 'Payments';
    case 'support':
      return 'Support';
    case 'custom':
      return 'Custom';
  }
}

export function connectionStatusLabel(status: ConnectorConnectionStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'connected':
      return 'Connected';
    case 'expired':
      return 'Expired';
    case 'disconnected':
      return 'Disconnected';
  }
}

export function connectionStatusVariant(
  status: ConnectorConnectionStatus,
): 'secondary' | 'success' | 'warning' | 'outline' {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'connected':
      return 'success';
    case 'expired':
      return 'warning';
    case 'disconnected':
      return 'outline';
  }
}

export function healthStatusLabel(status: ConnectorHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'unhealthy':
      return 'Unhealthy';
    case 'unknown':
      return 'Unknown';
    case 'disconnected':
      return 'Disconnected';
  }
}

export function healthStatusVariant(
  status: ConnectorHealthStatus,
): 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'unhealthy':
      return 'destructive';
    case 'unknown':
      return 'secondary';
    case 'disconnected':
      return 'outline';
  }
}
