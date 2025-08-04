import { z } from "zod";

export type StockSymbolsResponse = {
    symbols: {
        nse: string[];
        bse: string[];
    };
};

export enum TradeType {
    BUY = "BUY",
    SELL = "SELL",
}

export enum ExchangeType {
    NSE = "NSE",
    BSE = "BSE",
}

export type Trade = {
    id: number;
    clientId: number;
    clientName: string;
    symbol: string;
    exchange: ExchangeType;
    type: TradeType;
    quantity: number;
    price: number;
    tradeDate: Date;
    netAmount: number;
    originalQuantity: number;
    remainingQuantity: number;
    isFullySold: number;
    sellProcessed: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
};

export type TradeResponse = {
    success: boolean;
    message: string;
    data: Trade | {
        trade: Trade;
        currentHolding?: number;
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
