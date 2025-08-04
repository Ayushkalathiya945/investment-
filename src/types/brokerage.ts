import type { ExchangeType } from "./stocks";

export enum PeriodType {
    DAILY = "daily",
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
}

export type DailyBrokerage = {
    id: number;
    clientId: number;
    clientName: string;
    date: string;
    totalDailyBrokerage: number;
    totalHoldingAmount: number;
    totalUnusedAmount: number;
};

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
    totalHoldingAmount: number;
    totalUnusedAmount: number;
    paidDate?: Date;
    createdAt: Date;
};

export type SellTradeBrokerage = {
    id: number;
    tradeId: number;
    clientId: number;
    amount: number;
    brokerageRate: number;
    brokerageAmount: number;
    totalHoldingAmount: number;
    totalUnusedAmount: number;
    appliedAt: Date;
    createdAt: Date;
};

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

export type BrokerageFilterRequest = {
    page?: number;
    limit?: number;
    periodType?: PeriodType;
    clientId?: string;

    startDate?: string | Date;
    endDate?: string | Date;

    startMonth?: number;
    startYear?: number;
    endMonth?: number;
    endYear?: number;

    quarter?: number;
    quarterYear?: number;

    from?: string | Date;
    to?: string | Date;
};

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

export type DailyBrokerageRecord = {
    id: number;
    clientId: number;
    clientName: string;
    date: Date;
    totalDailyBrokerage: number;
    totalHoldingAmount: number;
    totalUnusedAmount: number;
};

export type MonthlyBrokerageSummary = {
    clientId: number;
    clientName: string;
    period: {
        month: number;
        year: number;
    };
    brokerageAmount: number;
    totalHoldingAmount: number;
    totalUnusedAmount: number;
};

export type QuarterlyBrokerageSummary = {
    clientId: number;
    clientName: string;
    period: {
        quarter: number;
        year: number;
    };
    brokerageAmount: number;
    totalHoldingAmount: number;
    totalUnusedAmount: number;
};

export type DailyBrokerageResponse = PaginatedBrokerageResponse<DailyBrokerageRecord>;
export type MonthlyBrokerageResponse = PaginatedBrokerageResponse<MonthlyBrokerageSummary>;
export type QuarterlyBrokerageResponse = PaginatedBrokerageResponse<QuarterlyBrokerageSummary>;

export type BrokerageResponse
    = | DailyBrokerageResponse
        | MonthlyBrokerageResponse
        | QuarterlyBrokerageResponse;

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
