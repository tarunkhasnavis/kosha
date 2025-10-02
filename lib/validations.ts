import { z } from 'zod'

// Order validations
export const createOrderSchema = z.object({
  orderNumber: z.string().min(1),
  companyName: z.string().min(1),
  source: z.enum(['email', 'text', 'voicemail', 'spreadsheet', 'pdf']),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.string(),
    unit_price: z.number(),
    total: z.number()
  })).min(1),
  deliveryDate: z.string().optional(),
  notes: z.string().optional()
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['waiting_review', 'approved', 'rejected', 'processing'])
})

// Recipe validations
export const createRecipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  prep_time_minutes: z.number().optional(),
  cook_time_minutes: z.number().optional(),
  servings: z.number().optional(),
  difficulty_level: z.enum(['easy', 'medium', 'hard']).optional(),
  category: z.string().optional(),
  instructions: z.string().optional()
})

export const addRecipeIngredientSchema = z.object({
  ingredient_id: z.string(),
  ingredient_name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  preparation_notes: z.string().optional()
})

export const addRecipeStepSchema = z.object({
  instruction: z.string().min(1),
  step_number: z.number().min(1),
  duration_minutes: z.number().optional(),
  temperature: z.number().optional(),
  equipment: z.string().optional()
})

// Inventory validations
export const createInventoryItemSchema = z.object({
  name: z.string().min(1),
  category: z.string(),
  quantity: z.number().min(0),
  unit: z.string(),
  minimum_quantity: z.number().min(0),
  supplier: z.string().optional(),
  cost_per_unit: z.number().min(0).optional(),
  location: z.string().optional()
})

export const updateInventoryQuantitySchema = z.object({
  quantity: z.number().min(0),
  reason: z.string().optional()
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>
export type AddRecipeIngredientInput = z.infer<typeof addRecipeIngredientSchema>
export type AddRecipeStepInput = z.infer<typeof addRecipeStepSchema>
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryQuantityInput = z.infer<typeof updateInventoryQuantitySchema>