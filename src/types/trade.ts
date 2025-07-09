import { z } from "zod";

export type StockSymbolsResponse = {
    symbols: {
        nse: string[];
        bse: string[];
    };
};

export type Trade = {
    id: number;
    clientId: number;
    clientName: string;
    symbol: string;
    exchange: "NSE" | "BSE";
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    tradeDate: string | Date | number;
    createdAt: string | Date;
    updatedAt: string | Date;
    status: "PENDING" | "COMPLETED" | "CANCELLED";
    notes?: string;
    isFullySold?: number;
    lastBrokerageCalculated?: string | null;
    netAmount?: number;
    originalQuantity?: number;
    remainingQuantity?: number;
    sellProcessed?: number;
};

export type TradeResponse = {
    success: boolean;
    message: string;
    data: Trade | {
        trade: Trade;
        fifoInfo?: any[];
    };
    error?: {
        issues?: Array<{ path: string; message: string }>;
        message?: string;
    };
};

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
    startDate?: string | Date;
    endDate?: string | Date;
    page?: number;
    pageSize?: number;
    tradeType?: "BUY" | "SELL";
};

export const addTradeSchema = z.object({
    client: z.string().optional(),
    trade: z.string().optional(),
    stock: z.string().optional(),
    quantity: z.number().optional(),
    date: z.string().optional(),
    pricePerShare: z.number().optional(),
});
export type AddTradeField = z.infer<typeof addTradeSchema>;
