import { z } from "zod";

export const addTradeSchema = z.object({
    client: z.string().optional(),
    trade: z.string().optional(),
    stock: z.string().optional(),
    quantity: z.string().email().optional(),
    date: z.string().optional(),
    pricePerShare: z.number().optional(),
});
export type AddTradeField = z.infer<typeof addTradeSchema>;
