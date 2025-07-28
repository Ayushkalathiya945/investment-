import type { ExchangeType } from "./stocks";

// Define period types for brokerage calculation
export enum PeriodType {
    DAILY = "daily",
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
}

// Daily brokerage type - matches the API response
export type DailyBrokerage = {
    id: number;
    clientId: number;
    clientName: string;
    date: string; // ISO date string from API
    totalDailyBrokerage: number;
};

// Quarterly brokerage type
export type QuarterlyBrokerage = {
    id: number;
    clientId: number;
    quarter: number;
    year: number;
    quarterStartDate: Date;
    quarterEndDate: Date;
    totalBrokerage: number;
    averageDailyHolding: number;
    averageDailyUnused: number;
    daysInQuarter: number;
    isPaid: number;
    paidAmount: number;
    paidDate?: Date;
    createdAt: Date;
};

// Sell trade brokerage type
export type SellTradeBrokerage = {
    id: number;
    tradeId: number;
    clientId: number;
    amount: number;
    brokerageRate: number;
    brokerageAmount: number;
    appliedAt: Date;
    createdAt: Date;
};

// Brokerage detail type
export type BrokerageDetail = {
    id: number;
    brokerageId: number;
    tradeId: number;
    stock: string;
    exchange: ExchangeType;
    quantity: number;
    amount: number;
    brokerageRate: number;
    brokerageAmount: number;
    appliedAt: Date;
    createdAt: Date;
};

// For calculating brokerage
export type BrokerageCalculationDetail = {
    id?: number;
    brokerageId?: number;
    tradeId: number;
    symbol: string;
    exchange: ExchangeType;
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
    holdingStartDate: Date;
    holdingEndDate: Date;
    holdingDays: number;
    totalDaysInMonth: number;
    positionValue: number;
    sellValue?: number;
    isSoldInMonth?: number;
    calculationFormula?: string;
    brokerageAmount?: number;
};

// Legacy response type for backwards compatibility
export type BrokerageResponseType = {
    success: boolean;
    data: {
        daily?: DailyBrokerage[];
        quarterly?: QuarterlyBrokerage[];
        sellTrade?: SellTradeBrokerage[];
    };
    metadata?: {
        total: number;
        hasNext: boolean;
        totalPages: number;
        currentPage: number;
    };
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
    page?: number;
    limit?: number;
    periodType?: PeriodType;
    clientId?: string;
    // Daily filters
    startDate?: string | Date;
    endDate?: string | Date;
    // Monthly filters
    startMonth?: number;
    startYear?: number;
    endMonth?: number;
    endYear?: number;
    // Quarterly filters
    quarter?: number;
    quarterYear?: number;
    // Generic date range filters
    from?: string | Date;
    to?: string | Date;
};

// Base response type for paginated brokerage data
export type PaginatedBrokerageResponse<T> = {
    success: boolean;
    data: T[];
    periodType: PeriodType;
    metadata: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
    };
    message?: string;
};

// Daily brokerage record
export type DailyBrokerageRecord = {
    id: number;
    clientId: number;
    clientName: string;
    date: Date;
    totalDailyBrokerage: number;
};

// Monthly brokerage summary
export type MonthlyBrokerageSummary = {
    clientId: number;
    clientName: string;
    period: {
        month: number;
        year: number;
    };
    brokerageAmount: number;
};

// Quarterly brokerage summary
export type QuarterlyBrokerageSummary = {
    clientId: number;
    clientName: string;
    period: {
        quarter: number;
        year: number;
    };
    brokerageAmount: number;
};

// Response types for each period type
export type DailyBrokerageResponse = PaginatedBrokerageResponse<DailyBrokerageRecord>;
export type MonthlyBrokerageResponse = PaginatedBrokerageResponse<MonthlyBrokerageSummary>;
export type QuarterlyBrokerageResponse = PaginatedBrokerageResponse<QuarterlyBrokerageSummary>;

// Union type for all brokerage responses
export type BrokerageResponse
    = | DailyBrokerageResponse
        | MonthlyBrokerageResponse
        | QuarterlyBrokerageResponse;

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
