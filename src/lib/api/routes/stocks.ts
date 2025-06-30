import { zValidator } from "@hono/zod-validator";
import { parse } from "csv-parse";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db"; // Assuming you have a drizzle-orm db setup
import * as stock from "../db/queries/stock";
import { ExchangeType, stocks } from "../db/schema"; // Your schema file
import { bseFormSchema, nseFormSchema } from "../utils/validation-schemas";

// Define the Hono app
const app = new Hono();

type BSEStock = {
    TckrSymb?: string;
    ClsPric?: string;
    FinInstrmNm?: string;
    [key: string]: string | undefined; // Ignore extra columns
};

type NSEStock = {
    "SYMBOL"?: string;
    "Security Name"?: string;
    "Close Price/Paid up value(Rs.)"?: string;
    [key: string]: string | undefined; // Ignore extra columns
};

// Function to normalize column names (ignore case and spaces)
function normalizeColumn(key: string): string {
    return key.toLowerCase().replace(/[\s_]+/g, "");
}

// Function to parse price (handle commas, currency symbols, etc.)
function parsePrice(price: string | undefined): number {
    if (!price || price.trim() === "")
        return 0;
    const cleanedPrice = price.replace(/[,₹$\s_]/g, "");
    const parsed = Number.parseFloat(cleanedPrice);
    return Number.isNaN(parsed) || !Number.isFinite(parsed) ? 0 : parsed;
}

// New route to handle only BSE CSV uploads
app.post("/upload-bse-stocks", zValidator("form", bseFormSchema), async (c) => {
    try {
        // Parse form-data
        const formData = await c.req.formData();
        const bseFile = formData.get("bse") as File;

        if (!bseFile) {
            return c.json({ error: "BSE file is required" }, 400);
        }

        // Clear existing BSE stock data
        await db.delete(stocks).where(eq(stocks.exchange, ExchangeType.BSE));
        console.warn("Cleared existing BSE data from stocks table");

        const bseStats = await parseCSV(bseFile, "BSE", true);

        // Return response with stats
        return c.json({
            message: "BSE stocks imported successfully",
            bse: {
                totalRecords: bseStats.totalRecords,
                inserted: bseStats.inserted,
                invalidRecords: bseStats.invalidRecords,
            },
        }, 200);
    } catch (error) {
        console.error("Error processing BSE CSV:", error);

        // Check if it's a validation error
        if (error instanceof Error && error.message.includes("required column")) {
            return c.json({ error: error.message }, 400);
        }

        return c.json({ error: "Failed to process BSE CSV file" }, 500);
    }
});

// New route to handle only NSE CSV uploads
app.post("/upload-nse-stocks", zValidator("form", nseFormSchema), async (c) => {
    try {
        // Parse form-data
        const formData = await c.req.formData();
        const nseFile = formData.get("nse") as File;

        if (!nseFile) {
            return c.json({ error: "NSE file is required" }, 400);
        }

        // Clear existing NSE stock data
        await db.delete(stocks).where(eq(stocks.exchange, ExchangeType.NSE));
        console.warn("Cleared existing NSE data from stocks table");

        const nseStats = await parseCSV(nseFile, "NSE", true);

        // Return response with stats
        return c.json({
            message: "NSE stocks imported successfully",
            nse: {
                totalRecords: nseStats.totalRecords,
                inserted: nseStats.inserted,
                invalidRecords: nseStats.invalidRecords,
            },
        }, 200);
    } catch (error) {
        console.error("Error processing NSE CSV:", error);

        // Check if it's a validation error
        if (error instanceof Error && error.message.includes("required column")) {
            return c.json({ error: error.message }, 400);
        }

        return c.json({ error: "Failed to process NSE CSV file" }, 500);
    }
});

// Enhanced Function to parse CSV file with column validation
async function parseCSV(file: File, exchange: "NSE" | "BSE", validateColumns = false): Promise<{
    totalRecords: number;
    inserted: number;
    invalidRecords?: { reason: string; record: object }[];
}> {
    if (!file)
        return { totalRecords: 0, inserted: 0, invalidRecords: [] };

    const text = await file.text();
    console.warn(`Parsing ${exchange} CSV file...`);

    const requiredColumns = exchange === "BSE"
        ? ["tckrsymb", "clspric", "fininstrmnm"]
        : ["symbol", "securityname", "closeprice/paidupvalue(rs.)"];

    const requiredColumnsDisplay = exchange === "BSE"
        ? ["TckrSymb", "ClsPric", "FinInstrmNm"]
        : ["SYMBOL", "Security Name", "Close Price/Paid up value(Rs.)"];

    const records: (BSEStock | NSEStock)[] = await new Promise((resolve, reject) => {
        parse(
            text,
            { columns: true, skip_empty_lines: true, trim: true },
            (err, records) => {
                if (err) {
                    reject(err);
                } else {
                    console.warn(`${exchange} CSV columns (raw):`, Object.keys(records[0] || {}));

                    // Validate that required columns exist
                    if (validateColumns && records.length > 0) {
                        const normalizedColumns = Object.keys(records[0] || {}).map(normalizeColumn);
                        console.warn(`${exchange} CSV columns (normalized):`, normalizedColumns);

                        const missingColumns = requiredColumns.filter(
                            col => !normalizedColumns.includes(col),
                        );

                        if (missingColumns.length > 0) {
                            const missingDisplayNames = missingColumns.map((col) => {
                                const index = requiredColumns.indexOf(col);
                                return requiredColumnsDisplay[index];
                            });
                            reject(new Error(`CSV file is missing required column(s): ${missingDisplayNames.join(", ")}`));
                            return;
                        }
                    }

                    resolve(records);
                }
            },
        );
    });

    let insertedCount = 0;
    const totalRecords = records.length;
    const invalidRecords: { reason: string; record: object }[] = [];

    // Process each record
    for (const record of records) {
        const normalizedRecord = Object.fromEntries(
            Object.entries(record).map(([key, value]) => [normalizeColumn(key), value]),
        );

        const symbolKey = exchange === "BSE" ? "tckrsymb" : "symbol";
        const priceKey = exchange === "BSE" ? "clspric" : "closeprice/paidupvalue(rs.)";
        const nameKey = exchange === "BSE" ? "fininstrmnm" : "securityname";

        const symbol = normalizedRecord[symbolKey];
        const price = normalizedRecord[priceKey];
        const name = normalizedRecord[nameKey];

        // Validate symbol
        if (!symbol || symbol.trim() === "") {
            console.warn(`Skipping record with missing or empty symbol: ${JSON.stringify(record)}`);
            invalidRecords.push({
                reason: "Missing or empty symbol",
                record,
            });
            continue;
        }

        // Validate name
        if (!name || name.trim() === "") {
            console.warn(`Skipping record with missing or empty name: ${JSON.stringify(record)}`);
            invalidRecords.push({
                reason: "Missing or empty name",
                record,
            });
            continue;
        }

        // Parse closing price
        const parsedPrice = parsePrice(price);
        if (parsedPrice === 0) {
            console.error(`Record with zero or invalid closing price: ${JSON.stringify(record)}`);
            invalidRecords.push({
                reason: "Zero or invalid closing price",
                record,
            });
        }

        const stockData = {
            symbol: symbol.trim(),
            name: name.trim(),
            exchange: exchange === "BSE" ? ExchangeType.BSE : ExchangeType.NSE,
            currentPrice: parsedPrice,
        };

        console.warn(
            `Processing ${exchange} record: symbol=${stockData.symbol}, name=${stockData.name}, exchange=${stockData.exchange}, closing price=${stockData.currentPrice}`,
        );

        // Insert stock into database
        try {
            await stock.create(stockData, db);
            insertedCount++;
        } catch (error) {
            console.error(`Failed to insert stock ${stockData.symbol} into database:`, error);
            invalidRecords.push({
                reason: `Failed to insert stock into database: ${(error as Error).message}`,
                record,
            });
        }
    }

    console.warn(`Processed ${exchange} CSV: ${insertedCount} stocks inserted out of ${totalRecords} records`);
    return { totalRecords, inserted: insertedCount, invalidRecords };
}

// Route to get all stock symbols
app.get("/symbols", async (c) => {
    const symbols = await stock.getAllSymbols(db);
    return c.json({ message: "stock symbols fetched successfully", symbols });
});

export default app;
