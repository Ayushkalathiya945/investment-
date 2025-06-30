import { z } from "zod";

export const addPaymentSchema = z.object({
    client: z.string().optional(),
    date: z.string().optional(),
    amount: z.number().optional(),
    description: z.string().optional(),
});

export type AddPaymentField = z.infer<typeof addPaymentSchema>;

// API types for payment
export type Payment = {
    id: number;
    clientId: number;
    amount: number;
    paymentDate: string | number; // Can be timestamp or ISO string
    description?: string;
    notes?: string;
    createdAt: string;
};

export type PaymentCreateRequest = {
    clientId: number;
    amount: number;
    paymentDate: string; // YYYY-MM-DD format
    description?: string;
    notes?: string;
};

export type PaymentFilterRequest = {
    page: number;
    limit: number;
    clientId?: number;
    from?: string; // YYYY-MM-DD format
    to?: string; // YYYY-MM-DD format
};

export type PaymentResponse = {
    success: boolean;
    message: string;
    data: Payment;
};

export type PaymentsListResponse = {
    success: boolean;
    data: Payment[];
    pagination: {
        total: number;
        hasNext: boolean;
    };
};
