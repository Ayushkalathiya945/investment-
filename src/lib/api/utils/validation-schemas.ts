import { z } from "zod";

import { PAGE_LIMIT } from "@/lib/constants";
import { PeriodType } from "@/types/brokerage";

import { ExchangeType, TradeType } from "../db/schema";

// Authentication schemas
export const loginSchema = z.object({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    adminPassword: z.string(),
});

export const verifyTokenSchema = z.object({
    token: z.string().min(1, "Token is required"),
});

// Client schemas
export const clientSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
    pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/i, "Invalid PAN format").transform(val => val.toUpperCase()),
    address: z.union([
        z.string().min(5, "Address must be at least 5 characters"),
        z.string().length(0), // Allow empty string
        z.null(), // Allow null
        z.undefined(), // Allow undefined
    ]).optional(),
    purseAmount: z.number().nonnegative("Purse amount must be non-negative").default(0).optional(),
});

export const updateClientSchema = clientSchema.partial().extend({
    id: z.number().int().positive("Client ID must be positive"),
});

// Stock schemas
export const stockSchema = z.object({
    symbol: z.string().min(1, "Symbol is required").max(20),
    name: z.string().min(1, "Name is required"),
    exchange: z.enum(["NSE", "BSE"], {
        errorMap: () => ({ message: "Exchange must be either NSE or BSE" }),
    }),
    sector: z.string().optional(),
    current_price: z.number().nonnegative("Price must be non-negative").optional(),
});

export const updateStockSchema = stockSchema.partial();

// Trade schemas
export const tradeSchema = z.object({
    clientId: z.number().int().positive("Client ID must be positive"),
    symbol: z.string().min(1, "Symbol is required"),
    type: z.nativeEnum(TradeType),
    quantity: z.number().int().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
    exchange: z.nativeEnum(ExchangeType),
    tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    notes: z.string().optional(),
});

export const updateTradeSchema = tradeSchema.partial().extend({
    id: z.number().int().positive("Trade ID must be positive"),
});

// Payment schemas
export const paymentSchema = z.object({
    clientId: z.number().int().positive("Client ID must be positive"),
    amount: z.number().positive("Amount must be positive"),
    description: z.string().optional(),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    notes: z.string().optional(),
});

export const updatePaymentSchema = paymentSchema.partial();

// Pagination and filter schemas
export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(15).default(PAGE_LIMIT),
});

export const dateRangeSchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be in YYYY-MM-DD format").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be in YYYY-MM-DD format").optional(),
});

// Brokerage calculation schemas
export const brokerageFilterSchema = paginationSchema.extend({
    clientId: z.number().int().positive("Client ID must be positive").optional(),
    periodType: z.nativeEnum(PeriodType).default(PeriodType.MONTHLY),

    // For daily date range filtering
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional(),

    // For monthly filtering
    startMonth: z.number().int().min(1).max(12, "Month must be between 1 and 12").optional(),
    startYear: z.number().int().min(2000).max(9999, "Year must be between 2000 and 9999").optional(),
    endMonth: z.number().int().min(1).max(12, "Month must be between 1 and 12").optional(),
    endYear: z.number().int().min(2000).max(9999, "Year must be between 2000 and 9999").optional(),

    // For quarterly filtering
    quarter: z.number().int().min(1).max(4, "Quarter must be between 1 and 4").optional(),
    quarterYear: z.number().int().min(2000).max(9999, "Year must be between 2000 and 9999").optional(),

    from: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be in YYYY-MM-DD format")
        .optional(),

    to: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be in YYYY-MM-DD format")
        .optional(),
})
    .refine((data) => {
    // Only validate if the fields are provided
        if (data.periodType === PeriodType.DAILY) {
            return !(data.startDate && data.endDate) || (!!data.startDate && !!data.endDate);
        }
        if (data.periodType === PeriodType.MONTHLY) {
            return !(data.startMonth && data.startYear && data.endMonth && data.endYear)
                || (!!data.startMonth && !!data.startYear && !!data.endMonth && !!data.endYear);
        }
        if (data.periodType === PeriodType.QUARTERLY) {
            return !(data.quarter && data.quarterYear)
                || (!!data.quarter && !!data.quarterYear);
        }
        return true;
    }, {
        message: "Invalid filter combination for the selected period type. All required fields must be provided:\n"
            + "- DAILY: both startDate and endDate are required\n"
            + "- MONTHLY: startMonth, startYear, endMonth, and endYear are required\n"
            + "- QUARTERLY: startQuarter, startQuarterYear, endQuarter, and endQuarterYear are required",
    });

// Schema for API input validation
export const brokerageSchema = z.object({
    month: z.number().int().min(1).max(12, "Month must be between 1 and 12"),
    year: z.number().int().min(2000).max(9999, "Year must be between 2000 and 9999"),
});

export const clientFilterSchema = paginationSchema.extend({
    search: z.string().optional(),
}).merge(dateRangeSchema);

export const clientGetOneSchema = z.object({
    id: z.coerce.number().int().positive("Client ID must be positive"),
});

export const stockFilterSchema = paginationSchema.extend({
    search: z.string().optional(),
    exchange: z.enum(["NSE", "BSE"]).optional(),
    sector: z.string().optional(),
});

export const tradeFilterSchema = paginationSchema.extend({
    clientId: z.number().optional(),
    stockId: z.number().optional(),
    type: z.nativeEnum(TradeType).optional(),
    symbol: z.string().optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be in YYYY-MM-DD format").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be in YYYY-MM-DD format").optional(),
}).merge(dateRangeSchema);

export const tradeGetOneSchema = z.object({
    id: z.coerce.number().int().positive("Trade ID must be positive"),
});

export const paymentFilterSchema = paginationSchema.extend({
    clientId: z.number().optional(),
}).merge(dateRangeSchema);

// Schema for validating incoming form-data
export const bseFormSchema = z.object({
    bse: z.instanceof(File).refine(file => file.size > 0, { message: "BSE file is required" }),
});

export const nseFormSchema = z.object({
    nse: z.instanceof(File).refine(file => file.size > 0, { message: "NSE file is required" }),
});
