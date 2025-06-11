import { z } from "zod";

export const addPaymentSchema = z.object({
    client: z.string().optional(),
    date: z.string().optional(),
    amount: z.number().optional(),
    description: z.string().optional(),
});

export type AddPaymentField = z.infer<typeof addPaymentSchema>;
