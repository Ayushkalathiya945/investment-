import { z } from "zod";

// Stock symbols response type
export type StockSymbolsResponse = {
    symbols: {
        nse: string[];
        bse: string[];
    };
};

// Base Trade type
export type Trade = {
    id: number;
    clientId: number;
    symbol: string;
    exchange: "NSE" | "BSE";
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    tradeDate: string | Date;
    createdAt: string | Date;
    updatedAt: string | Date;
    status: "PENDING" | "COMPLETED" | "CANCELLED";
    notes?: string;
};

// API Response wrapper for a single trade
export type TradeResponse = {
    success: boolean;
    message: string;
    data: Trade;
    error?: {
        issues?: Array<{ path: string; message: string }>;
        message?: string;
    };
};

// API Response wrapper for multiple trades
export type TradesListResponse = {
    success: boolean;
    message: string;
    data: Trade[];
    error?: {
        issues?: Array<{ path: string; message: string }>;
        message?: string;
    };
    meatadata?: {
        total: number;
        hasNext: boolean;
        totalPages: number;
        currentPage: number;
    };
};

// Request type for creating a new trade
export type CreateTradeRequest = {
    clientId: number;
    symbol: string;
    exchange: "NSE" | "BSE";
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    tradeDate: string | Date;
    notes?: string;
};

// Request type for updating an existing trade
export type UpdateTradeRequest = {
    id: number;
    clientId?: number;
    symbol?: string;
    exchange?: "NSE" | "BSE";
    type?: "BUY" | "SELL";
    quantity?: number;
    price?: number;
    tradeDate?: string | Date;
    status?: "PENDING" | "COMPLETED" | "CANCELLED";
    notes?: string;
};

// Request type for filtering trades
export type TradeFilterRequest = {
    clientId?: number;
    stockSymbol?: string;
    exchange?: "NSE" | "BSE";
    type?: "BUY" | "SELL";
    from?: string | Date;
    to?: string | Date;
    startDate?: string | Date; // For compatibility with API schema
    endDate?: string | Date; // For compatibility with API schema
    page?: number;
    pageSize?: number;
    tradeType?: "BUY" | "SELL"; // For backward compatibility
};

// Keeping the existing Zod schema for form validation
export const addTradeSchema = z.object({
    client: z.string().optional(),
    trade: z.string().optional(),
    stock: z.string().optional(),
    quantity: z.string().email().optional(),
    date: z.string().optional(),
    pricePerShare: z.number().optional(),
});
export type AddTradeField = z.infer<typeof addTradeSchema>;
