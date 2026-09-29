import { z } from 'zod';

import type { Order } from '../domain/types.js';

export const GetOrderInput = z.object({
  orderId: z.string().regex(/^ORD-\d{4}$/, 'Use an order id such as ORD-1001.')
});

export const CreateReturnDraftInput = GetOrderInput.extend({
  reason: z.string().min(3).max(160)
});

const syntheticOrders: Record<string, Order> = {
  'ORD-1001': {
    orderId: 'ORD-1001',
    status: 'SHIPPED',
    estimatedDelivery: '2026-10-03',
    items: ['Synthetic wireless keyboard'],
    customerLabel: 'Synthetic customer A'
  },
  'ORD-1002': {
    orderId: 'ORD-1002',
    status: 'DELIVERED',
    estimatedDelivery: '2026-09-20',
    items: ['Synthetic USB-C hub'],
    customerLabel: 'Synthetic customer B'
  }
};

/**
 * Deliberately small, synthetic tool surface shared by the local agent and MCP server.
 * It never performs payment, refund, or account mutations.
 */
export class SupportTools {
  getOrder(input: unknown): Order | undefined {
    const { orderId } = GetOrderInput.parse(input);
    return syntheticOrders[orderId];
  }

  createReturnDraft(input: unknown): { draftId: string; orderId: string; requiresHumanApproval: true } {
    const { orderId, reason } = CreateReturnDraftInput.parse(input);

    if (!syntheticOrders[orderId]) {
      throw new Error('Order not found.');
    }

    return {
      draftId: `RET-${orderId.slice(-4)}-${reason.length}`,
      orderId,
      requiresHumanApproval: true
    };
  }
}

