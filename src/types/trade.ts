import { z } from "zod";

export const addTradeSchema = z.object({
    client: z.string().optional(),
    trade: z.string().optional(),
    stock: z.string().optional(),
    quantity: z.string().email().optional(),
    pricePerShare: z.string(),
});
export type AddTradeField = z.infer<typeof addTradeSchema>

export type AddTrade = {
    id?: string;
    client?: string;
    trade?: string;
    stock?: string;
    quantity?: string;
    pricePerShare?: string;
}