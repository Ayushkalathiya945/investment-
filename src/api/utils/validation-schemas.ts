import { z } from "zod";

// Authentication schemas
export const loginSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    adminPassword: z.string(),
});

// Client schemas
export const clientSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number format"),
    pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format"),
    address: z.string().min(5, "Address must be at least 5 characters"),
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
    isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{10}$/, "Invalid ISIN format"),
    sector: z.string().optional(),
    current_price: z.number().nonnegative("Price must be non-negative").optional(),
});

export const updateStockSchema = stockSchema.partial();

// Trade schemas
export const tradeSchema = z.object({
    clientId: z.number().int().positive("Client ID must be positive"),
    stockId: z.number().int().positive("Stock ID must be positive"),
    type: z.enum(["buy", "sell"], {
        errorMap: () => ({ message: "Trade type must be either buy or sell" }),
    }),
    quantity: z.number().int().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
    tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    brokerageFee: z.number().nonnegative("Brokerage fee must be non-negative"),
    gst: z.number().nonnegative("GST must be non-negative"),
    stt: z.number().nonnegative("STT must be non-negative"),
    stampDuty: z.number().nonnegative("Stamp duty must be non-negative"),
    exchangeFee: z.number().nonnegative("Exchange fee must be non-negative"),
    sebiFee: z.number().nonnegative("SEBI fee must be non-negative"),
    notes: z.string().optional(),
});

export const updateTradeSchema = tradeSchema.partial();

// Brokerage calculation schemas
export const brokerageCalculationSchema = z.object({
    clientId: z.number().int().positive("Client ID must be positive"),
    month: z.number().int().min(1).max(12, "Month must be between 1 and 12"),
    year: z.number().int().min(2000).max(2100, "Year must be valid"),
});

export const bulkBrokerageCalculationSchema = z.object({
    month: z.number().int().min(1).max(12, "Month must be between 1 and 12"),
    year: z.number().int().min(2000).max(2100, "Year must be valid"),
});

// Payment schemas
export const paymentSchema = z.object({
    clientId: z.number().int().positive("Client ID must be positive"),
    brokerageCalculationId: z.number().int().positive("Brokerage calculation ID must be positive").optional(),
    amount: z.number().positive("Amount must be positive"),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    paymentMethod: z.enum(["upi", "netbanking", "card", "cash", "cheque"], {
        errorMap: () => ({ message: "Invalid payment method" }),
    }),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
});

export const updatePaymentSchema = paymentSchema.partial();

// Pagination and filter schemas
export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).default(10),
});

export const dateRangeSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional(),
});

export const clientFilterSchema = paginationSchema.extend({
    search: z.string().optional(),
    from: z.number().optional(),
    to: z.number().optional(),
});

export const clientGetOneSchema = z.object({
    id: z.number().int().positive("Client ID must be positive"),
});

export const stockFilterSchema = paginationSchema.extend({
    search: z.string().optional(),
    exchange: z.enum(["NSE", "BSE"]).optional(),
    sector: z.string().optional(),
});

export const tradeFilterSchema = paginationSchema.extend({
    clientId: z.number().optional(),
    stockId: z.number().optional(),
    type: z.enum(["buy", "sell"]).optional(),
}).merge(dateRangeSchema);

export const paymentFilterSchema = paginationSchema.extend({
    clientId: z.string().optional().transform(val => val ? Number.parseInt(val, 10) : undefined),
    paymentMethod: z.enum(["upi", "netbanking", "card", "cash", "cheque"]).optional(),
}).merge(dateRangeSchema);
