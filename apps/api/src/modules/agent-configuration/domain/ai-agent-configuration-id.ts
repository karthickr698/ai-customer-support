export type AiAgentConfigurationId = string & { readonly __brand: 'AiAgentConfigurationId' };

export function createAiAgentConfigurationId(
  id: string = crypto.randomUUID(),
): AiAgentConfigurationId {
  return id as AiAgentConfigurationId;
}
