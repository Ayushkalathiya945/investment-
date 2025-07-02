// Stock types for the application
export enum ExchangeType {
    NSE = "NSE",
    BSE = "BSE",
}

// Base Stock type
export type Stock = {
    id: number;
    symbol: string;
    name: string;
    exchange: ExchangeType;
    currentPrice: number;
    createdAt: Date | string;
    updatedAt: Date | string;
};

// CSV Stock upload response types
export type StockUploadStats = {
    totalRecords: number;
    inserted: number;
    invalidRecords?: Array<{
        reason: string;
        record: Record<string, any>;
    }>;
};

export type ValidationError = {
    fileType: string;
    message: string;
    missingColumns?: string[];
};

export type StockUploadResponse = {
    success: boolean;
    message: string;
    error?: string;
    validationErrors?: ValidationError[];
    nse?: StockUploadStats;
    bse?: StockUploadStats;
};

// Stock symbols response
export type StockSymbolsResponse = {
    message: string;
    symbols: {
        nse: string[];
        bse: string[];
    };
};
