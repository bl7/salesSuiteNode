import { z } from 'zod';

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid().optional().nullable(),
  product_name: z.string(),
  product_sku: z.string().nullable(),
  quantity: z.union([z.number(), z.string()]),
  unit_price: z.union([z.number(), z.string()]),
  line_total: z.union([z.number(), z.string()]),
  notes: z.string().nullable(),
});

export const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  shop_id: z.string().uuid().nullable(),
  shop_name: z.string().nullable().optional(),
  shop_address: z.string().nullable().optional(),
  lead_id: z.string().uuid().nullable(),
  placed_by_company_user_id: z.string().uuid(),
  placed_by_name: z.string().nullable().optional(),
  status: z.enum(['received', 'processing', 'shipped', 'closed', 'cancelled']),
  notes: z.string().nullable(),
  total_amount: z.union([z.number(), z.string()]),
  currency_code: z.string(),
  discount_amount: z.union([z.number(), z.string()]).optional(),
  discount_type: z.enum(['fixed', 'percentage']).optional(),
  placed_at: z.date(),

  processed_at: z.date().nullable(),
  shipped_at: z.date().nullable(),
  closed_at: z.date().nullable(),
  cancelled_at: z.date().nullable(),
  cancel_reason: z.string().nullable(),
  cancel_note: z.string().nullable(),
  items_count: z.union([z.number(), z.string()]).optional(), // joined
  subtotal: z.union([z.number(), z.string()]).optional(), // joined
  items: z.array(orderItemSchema).optional() // for details
});

export const createOrderItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  productSku: z.string(),
  quantity: z.number().min(0.001),
  unitPrice: z.number().min(0),
  notes: z.string().optional()
});

export const createOrderSchema = z.object({
  shopId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  discountAmount: z.number().optional(),
  discountType: z.enum(['fixed', 'percentage']).optional(),
  items: z.array(createOrderItemSchema).min(1),
});


export const updateOrderSchema = z.object({
  status: z.enum(['received', 'processing', 'shipped', 'closed']).optional(),
  notes: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  discountType: z.enum(['fixed', 'percentage']).optional(),
  items: z.array(createOrderItemSchema).optional()
});

export const cancelOrderSchema = z.object({
  cancel_reason: z.string(),
  cancel_note: z.string().optional()
});

export const listOrdersQuerySchema = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  shop: z.string().uuid().optional(),
  rep: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional()
});
