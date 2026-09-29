export type ToolCall = {
  name: 'get_order' | 'create_return_draft';
  input: Record<string, string>;
};

export type AgentResponse = {
  answer: string;
  toolCalls: ToolCall[];
  safety: {
    blocked: boolean;
    reason: 'none' | 'prompt_injection' | 'sensitive_data';
  };
};

export type Order = {
  orderId: string;
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED';
  estimatedDelivery: string;
  items: string[];
  customerLabel: string;
};

