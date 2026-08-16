import type {
  AiAgentCitationPolicy,
  AiAgentFallbackMode,
  AiAgentModelId,
  ToolName,
} from '@ai-customer-support/contracts';

export function modelLabel(model: AiAgentModelId): string {
  switch (model) {
    case 'gpt-4o-mini':
      return 'GPT-4o mini';
    case 'gpt-4o':
      return 'GPT-4o';
    case 'gpt-4.1-mini':
      return 'GPT-4.1 mini';
    case 'gpt-4.1':
      return 'GPT-4.1';
  }
}

export function modelDescription(model: AiAgentModelId): string {
  switch (model) {
    case 'gpt-4o-mini':
      return 'Fast default for greetings and short questions.';
    case 'gpt-4o':
      return 'Higher quality for complaints and longer turns.';
    case 'gpt-4.1-mini':
      return 'Fast newer model for everyday replies.';
    case 'gpt-4.1':
      return 'Highest quality for complex or sensitive questions.';
  }
}

export function fallbackModeLabel(mode: AiAgentFallbackMode): string {
  switch (mode) {
    case 'provider_then_heuristic':
      return 'Retry, then safe fallback';
    case 'canned_reply':
      return 'Canned reply';
    case 'handoff':
      return 'Hand off to a human';
  }
}

export function fallbackModeDescription(mode: AiAgentFallbackMode): string {
  switch (mode) {
    case 'provider_then_heuristic':
      return 'Retry the primary model, then use the local safe fallback.';
    case 'canned_reply':
      return 'Return the configured reply if the primary model fails.';
    case 'handoff':
      return 'Escalate to a teammate if the primary model fails.';
  }
}

export function citationPolicyLabel(policy: AiAgentCitationPolicy): string {
  switch (policy) {
    case 'required':
      return 'Required';
    case 'preferred':
      return 'Preferred';
    case 'off':
      return 'Do not mention sources';
  }
}

export function toolLabel(name: ToolName): string {
  switch (name) {
    case 'getCustomerDetails':
      return 'Get customer details';
    case 'getProductDetails':
      return 'Get product details';
    case 'getOrderDetails':
      return 'Get order details';
    case 'getShipmentDetails':
      return 'Get shipment details';
    case 'getReturnDetails':
      return 'Get return details';
    case 'createTicket':
      return 'Create ticket';
    case 'updateTicket':
      return 'Update ticket';
    case 'checkRefundStatus':
      return 'Check refund status';
    case 'handoffToAgent':
      return 'Handoff to agent';
  }
}

export function toolDescription(name: ToolName): string {
  switch (name) {
    case 'getCustomerDetails':
      return 'Look up a customer in this workspace.';
    case 'getProductDetails':
      return 'Look up a product by id or SKU.';
    case 'getOrderDetails':
      return 'Look up an order.';
    case 'getShipmentDetails':
      return 'Look up a shipment or tracking number.';
    case 'getReturnDetails':
      return 'Look up a return.';
    case 'createTicket':
      return 'Open a support ticket.';
    case 'updateTicket':
      return 'Update an existing ticket.';
    case 'checkRefundStatus':
      return 'Check whether a refund was issued.';
    case 'handoffToAgent':
      return 'Transfer the conversation to a human.';
  }
}
