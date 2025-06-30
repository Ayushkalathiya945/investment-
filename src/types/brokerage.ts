import type { ExchangeType } from "./stocks";

// Define period types for brokerage calculation
export enum PeriodType {
    MONTH = "month",
    QUARTER = "quarter",
    CUSTOM = "custom",
}

// Request type for brokerage calculation
export type BrokerageCalculateRequest = {
    month: number;
    year: number;
};

// Response type for periodic brokerage list
export type BrokerageItem = {
    id: number;
    clientId: number;
    clientName: string;
    brokerageAmount: number;
    period: {
        month?: number;
        quarter?: number;
        year: number;
    };
    date: string;
    periodType: PeriodType;
    calculatedAt: number;
};

// For backwards compatibility
export type MonthlyBrokerageItem = BrokerageItem;

export type MonthlyBrokerageResponse = {
    success: boolean;
    data: MonthlyBrokerageItem[];
};

// Response types for brokerage calculation
export type BrokerageDetailType = {
    tradeId: number;
    symbol: string;
    exchange: ExchangeType;
    quantity: number;
    buyPrice: number;
    buyDate: string | Date;
    holdingStartDate: string | Date;
    holdingEndDate: string | Date | null;
    holdingDays: number;
    totalDaysInMonth: number;
    positionValue: number;
    brokerageAmount: number;
    calculationFormula: string;
    isSoldInMonth?: number | null;
    sellDate?: string | Date | null;
    sellPrice?: number | null;
    sellValue?: number | null;
};

export type BrokerageCalculateResponse = {
    success: boolean;
    message: string;
    data: {
        totalBrokerage: number;
        details: BrokerageDetailType[];
        totalHoldingValue: number;
        totalHoldingDays: number;
        totalTrades: number;
        totalTurnover: number;
        calculationPeriod: string;
    };
};

// Filter type for retrieving brokerage records
export type BrokerageFilterRequest = {
    page: number;
    limit: number;
    clientId?: number;
    month?: number;
    quarter?: number;
    year?: number;
    from?: string | Date;
    to?: string | Date;
};

// Response type for brokerage list
export type BrokerageRecord = {
    id: number;
    clientId: number;
    clientName: string;
    month: number;
    year: number;
    calculationPeriod: number;
    totalBrokerage: number;
    totalHoldingValue: number;
    totalHoldingDays: number;
    totalTrades: number;
    totalTurnover: number;
    createdAt: string;
};

export type BrokerageListResponse = {
    success: boolean;
    data: {
        records: BrokerageRecord[];
        total: number;
        page: number;
        limit: number;
    };
};
