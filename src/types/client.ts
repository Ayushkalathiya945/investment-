import { z } from "zod";

export const addClientSchema = z.object({
    name: z.string().optional(),
    panNo: z
        .string()
        .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN Card Number")
        .optional(),
    mobileNo: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string()
        .refine(val => val === "" || val === null || val === undefined || val.length >= 5, {
            message: "Address must be at least 5 characters long if provided",
        })
        .optional(),
    purseAmount: z.number().nonnegative().optional(),
});

export type AddClientField = z.infer<typeof addClientSchema>;

export type AddClient = {
    id?: string;
    name?: string;
    panNo?: string;
    mobileNo?: string;
    email?: string;
    address?: string;
    purseAmount?: number;
};

// Types for client API responses
export type Client = {
    id: number;
    name: string;
    email: string;
    mobile: string;
    pan: string;
    address: string;
    purseAmount: number;
    createdAt?: string;
    updatedAt?: string;
    // Client detail additional fields
    totalTradeAmount?: number;
    totalBrokerageAmount?: number;
    totalPaymentAmount?: number;
    totalSoldAmount?: number;
    remainingPurseAmount?: number;
};

export type ClientCreateRequest = {
    name: string;
    email: string;
    mobile: string;
    pan: string;
    address?: string;
    purseAmount?: number;
};

export type ClientResponse = {
    success: boolean;
    message: string;
    data: Client;
};

export type ClientsListResponse = {
    success: boolean;
    data: Client[];
    metadata: {
        total: number;
        hasNext: boolean;
    };
};

export type ClientFilterRequest = {
    page: number;
    limit: number;
    search?: string;
    from?: string; // Server-side expected format (YYYY-MM-DD)
    to?: string; // Server-side expected format (YYYY-MM-DD)
};

export type ClientUpdateRequest = {
    id: number;
    name?: string;
    email?: string;
    mobile?: string;
    pan?: string;
    address?: string;
    purseAmount?: number;
};

export type ClientAnalyticsResponse = {
    success: boolean;
    message?: string;
    data: {
        totalClient: number;
        totalValue: number;
        totalPayment: number;
        totalBrokerage: number;
        remainingPurseAmount: number;
    };
    _debug?: {
        timestamp: string;
        requestData: any;
        requestUrl: string;
        responseData?: any;
    };
};

// Type for client dropdown items
export type ClientDropdownItem = {
    id: number;
    name: string;
};

// Response type for client dropdown API
export type ClientDropdownResponse = {
    success: boolean;
    data: ClientDropdownItem[];
};

// Financial totals response type
export type FinancialTotalsResponse = {
    success: boolean;
    data: {
        totalPortfolioValue: number;
        totalBrokerage: number;
        totalPayments: number;
    };
};

// Financial totals request type
export type FinancialTotalsRequest = {
    from?: number; // Unix timestamp
    to?: number; // Unix timestamp
};
