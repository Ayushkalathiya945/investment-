import type {
    Payment,
    PaymentCreateRequest,
    PaymentFilterRequest,
    PaymentResponse,
    PaymentsListResponse,
} from "@/types/payment";

import { ApiGet, ApiPost, ApiPut } from "./api-helper";

export async function createPayment(data: PaymentCreateRequest): Promise<Payment> {
    try {
        if (!data.clientId) {
            throw new Error("Client ID is required");
        }
        if (!data.amount || data.amount <= 0) {
            throw new Error("Valid payment amount is required");
        }
        if (!data.paymentDate) {
            throw new Error("Payment date is required");
        }

        const response = await ApiPost<PaymentResponse>("/payments/create", data);

        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to create payment");
        }

        return response.data;
    } catch (error: any) {
        console.error("Payment creation API error:", error);

        if (error?.error?.issues) {
            const issues = error.error.issues;
            const messages = issues.map((issue: any) =>
                `${issue.path.join(".")}: ${issue.message}`,
            ).join(", ");
            throw new Error(`Validation error: ${messages}`);
        }

        throw error;
    }
}

export async function updatePayment(id: number, data: PaymentCreateRequest): Promise<Payment> {
    try {
        if (!data.clientId) {
            throw new Error("Client ID is required");
        }
        if (!data.amount || data.amount <= 0) {
            throw new Error("Valid payment amount is required");
        }
        if (!data.paymentDate) {
            throw new Error("Payment date is required");
        }

        const response = await ApiPut<PaymentResponse>(`/payments/update/${id}`, data);

        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to update payment");
        }

        return response.data;
    } catch (error: any) {
        console.error("Payment update API error:", error);
        throw error;
    }
}

// get payment by ID
export async function getPaymentById(id: number): Promise<Payment> {
    const response = await ApiGet<PaymentResponse>(`/payments/get/${id}`);

    if (!response || !response.success) {
        throw new Error(response?.message || "Failed to fetch payment");
    }

    return response.data;
}

export async function getAllPayments(data: PaymentFilterRequest): Promise<PaymentsListResponse> {
    const requestData = {
        page: data.page,
        limit: data.limit,
        clientId: data.clientId || undefined,
        from: data.from || undefined,
        to: data.to || undefined,
    };

    const response = await ApiPost<PaymentsListResponse>("/payments/get-all", requestData);

    if (!response || !response.success) {
        throw new Error("Failed to fetch payments");
    }

    return response;
}

export function formatDateForPaymentApi(date: Date | undefined): string | undefined {
    // Return undefined if no date or invalid date
    if (!date)
        return undefined;

    try {
        // Check if the date is valid
        if (Number.isNaN(date.getTime())) {
            console.error("Invalid date object provided:", date);
            return undefined;
        }

        // Get YYYY-MM-DD format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        const formattedDate = `${year}-${month}-${day}`;
        // console.error(`Formatted date from ${date.toISOString()} to ${formattedDate}`);
        return formattedDate;
    } catch (error) {
        console.error("Failed to format date:", error, date);
        return undefined;
    }
}

export function calculateTotalPayments(payments: Payment[]): number {
    return payments.reduce((total, payment) => total + payment.amount, 0);
}

export function groupPaymentsByClient(payments: Payment[]): Record<number, number> {
    return payments.reduce((acc, payment) => {
        const { clientId, amount } = payment;
        acc[clientId] = (acc[clientId] || 0) + amount;
        return acc;
    }, {} as Record<number, number>);
}
