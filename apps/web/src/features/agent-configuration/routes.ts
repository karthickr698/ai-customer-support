import type { RouteObject } from 'react-router-dom';

export const agentConfigurationChildRoute: RouteObject = {
  path: 'ai-agent',
  lazy: async () => {
    const { AgentConfigurationPage } = await import('./pages/agent-configuration-page');
    return { Component: AgentConfigurationPage };
  },
};
