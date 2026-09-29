import type { AgentResponse, ToolCall } from '../domain/types.js';
import { SupportTools } from '../mcp/support-tools.js';

const ORDER_ID = /\bORD-\d{4}\b/i;
const INJECTION = /(ignore (all |any )?(previous|prior) instructions|reveal (the )?(system|developer) prompt|show (me )?(your )?(system|developer) message|DAN\b)/i;
const SENSITIVE_DATA = /\b(?:cpf|social security number|credit card)\b/i;

/**
 * Deterministic agent used by tests. It models the expected agent boundaries without
 * making external calls, which keeps API, E2E and eval suites repeatable in CI.
 */
export class SupportAgent {
  constructor(private readonly tools = new SupportTools()) {}

  async respond(message: string): Promise<AgentResponse> {
    if (INJECTION.test(message)) {
      return {
        answer: 'I can help with a synthetic order lookup, but I cannot disclose internal instructions or system messages.',
        toolCalls: [],
        safety: { blocked: true, reason: 'prompt_injection' }
      };
    }

    if (SENSITIVE_DATA.test(message)) {
      return {
        answer: 'Please do not share sensitive personal or payment information. I can help with a synthetic order id instead.',
        toolCalls: [],
        safety: { blocked: true, reason: 'sensitive_data' }
      };
    }

    const orderId = message.match(ORDER_ID)?.[0]?.toUpperCase();
    if (!orderId) {
      return {
        answer: 'Please provide a synthetic order id, for example ORD-1001.',
        toolCalls: [],
        safety: { blocked: false, reason: 'none' }
      };
    }

    if (/\b(return|refund)\b/i.test(message)) {
      const toolCall: ToolCall = {
        name: 'create_return_draft',
        input: { orderId, reason: 'Customer requested a return through the demo chat.' }
      };

      try {
        const draft = this.tools.createReturnDraft(toolCall.input);
        return {
          answer: `I created return draft ${draft.draftId} for ${orderId}. This demo did not execute a refund; human approval is required.`,
          toolCalls: [toolCall],
          safety: { blocked: false, reason: 'none' }
        };
      } catch {
        return {
          answer: `I could not create a return draft because ${orderId} was not found in the synthetic dataset.`,
          toolCalls: [toolCall],
          safety: { blocked: false, reason: 'none' }
        };
      }
    }

    const toolCall: ToolCall = { name: 'get_order', input: { orderId } };
    const order = this.tools.getOrder(toolCall.input);

    if (!order) {
      return {
        answer: `I could not find ${orderId} in the synthetic dataset. Try ORD-1001 or ORD-1002.`,
        toolCalls: [toolCall],
        safety: { blocked: false, reason: 'none' }
      };
    }

    return {
      answer: `${order.orderId} is ${order.status.toLowerCase()}. Estimated delivery: ${order.estimatedDelivery}.`,
      toolCalls: [toolCall],
      safety: { blocked: false, reason: 'none' }
    };
  }
}
