import { z } from "zod";

export const addPaymentSchema = z.object({
    client: z.string().optional(),
    date: z.string().optional(),
    amount: z.number().optional(),
    description: z.string().optional(),
});

export type AddPaymentField = z.infer<typeof addPaymentSchema>;

export type Payment = {
    id: number;
    clientId: number;
    amount: number;
    paymentDate: string | number;
    description?: string;
    createdAt: string;
};

export type PaymentCreateRequest = {
    clientId: number;
    amount: number;
    paymentDate: string;
    description?: string;
};

export type PaymentFilterRequest = {
    page: number;
    limit: number;
    clientId?: number;
    from?: string;
    to?: string;
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
