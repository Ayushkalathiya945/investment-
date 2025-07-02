import { parse } from "csv-parse";

import { ExchangeType } from "@/types/stocks";

import type { TransactionType } from "../db";

import * as stock from "../db/queries/stock";

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

export async function parseCSV(file: File, exchange: "NSE" | "BSE", validateColumns = false, tx: TransactionType): Promise<{
    totalRecords: number;
    inserted: number;
    invalidRecords?: { reason: string; record: any }[];
}> {
    if (!file)
        return { totalRecords: 0, inserted: 0, invalidRecords: [] };

    const text = await file.text();
    console.log(`Starting to parse ${exchange} CSV file...`);

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
                    // Validate that required columns exist
                    if (validateColumns && records.length > 0) {
                        const normalizedColumns = Object.keys(records[0] || {}).map(normalizeColumn);

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

    const totalRecords = records.length;
    console.log(`Processing ${totalRecords} records from ${exchange} CSV...`);

    // Process all records in parallel using map
    const processedResults = records.map((record) => {
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
            return {
                isValid: false,
                invalidRecord: {
                    reason: "Missing or empty symbol",
                    record,
                },
            };
        }

        // Validate name
        if (!name || name.trim() === "") {
            return {
                isValid: false,
                invalidRecord: {
                    reason: "Missing or empty name",
                    record,
                },
            };
        }

        // Parse closing price
        const parsedPrice = parsePrice(price);
        if (parsedPrice === 0) {
            return {
                isValid: false,
                invalidRecord: {
                    reason: "Zero or invalid closing price",
                    record,
                },
            };
        }

        const stockData = {
            symbol: symbol.trim(),
            name: name.trim(),
            exchange: exchange === "BSE" ? ExchangeType.BSE : ExchangeType.NSE,
            currentPrice: parsedPrice,
        };

        return {
            isValid: true,
            stockData,
        };
    });

    // Separate valid stocks and invalid records
    const validStocks = processedResults
        .filter(result => result.isValid)
        .map(result => result.stockData!);

    const invalidRecords = processedResults
        .filter(result => !result.isValid)
        .map(result => result.invalidRecord!);
    let insertedCount = 0;
    if (validStocks.length > 0) {
        try {
            await stock.create_Multiple(validStocks, tx);
            insertedCount = validStocks.length;
            console.log(`Successfully inserted ${insertedCount} stocks from ${exchange} CSV into database`);
        } catch (error) {
            console.error(`Failed to insert stocks from ${exchange} CSV into database:`, error);
            // If batch insert fails, add all records to invalid records
            for (const stockData of validStocks) {
                invalidRecords.push({
                    reason: `Failed to insert stock into database: ${(error as Error).message}`,
                    record: {
                        symbol: stockData.symbol,
                        name: stockData.name,
                        price: stockData.currentPrice.toString(),
                    },
                });
            }
        }
    }

    return { totalRecords, inserted: insertedCount, invalidRecords };
}
