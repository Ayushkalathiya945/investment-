export enum ExchangeType {
    NSE = "NSE",
    BSE = "BSE",
}

export type Stock = {
    id: number;
    symbol: string;
    name: string;
    exchange: ExchangeType;
    currentPrice: number;
    createdAt: Date | string;
    updatedAt: Date | string;
};

export type StockSymbolsResponse = {
    message: string;
    symbols: {
        nse: string[];
        bse: string[];
    };
};
