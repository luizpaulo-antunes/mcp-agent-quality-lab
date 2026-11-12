export type ToolCall =
  | {
      name: 'get_order';
      input: { orderId: string };
    }
  | {
      name: 'create_return_draft';
      input: { orderId: string; reason: string };
    };

type SafeResponse = {
  answer: string;
  toolCalls: [] | [ToolCall];
  safety: {
    blocked: false;
    reason: 'none';
  };
};

type BlockedResponse = {
  answer: string;
  toolCalls: [];
  safety: {
    blocked: true;
    reason: 'prompt_injection' | 'sensitive_data';
  };
};

export type AgentResponse = SafeResponse | BlockedResponse;

export type Order = {
  orderId: string;
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED';
  estimatedDelivery: string;
  items: string[];
  customerLabel: string;
};
