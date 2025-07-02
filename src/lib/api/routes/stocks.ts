import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db"; // Assuming you have a drizzle-orm db setup
import * as stock from "../db/queries/stock";
import { ExchangeType, stocks } from "../db/schema"; // Your schema file
import { calculateAndSaveMonthlyBrokerageOptimized } from "../services/brokerage-calculator";
import { parseCSV } from "../services/stocks-upload";
import { combinedStocksFormSchema } from "../utils/combined-validation-schemas";
import { bseFormSchema, nseFormSchema } from "../utils/validation-schemas";

/**
 * Helper function to get the current month and year
 */
function getCurrentMonthAndYear(): { month: number; year: number } {
    const now = new Date();
    return {
        month: now.getMonth() + 1, // getMonth() returns 0-11
        year: now.getFullYear(),
    };
}

/**
 * Validates CSV format by checking for required columns
 * @param file CSV file to validate
 * @param exchangeType The exchange type (NSE or BSE)
 * @returns Object with validation result and error message if validation failed
 */
async function validateCSVFormat(
    file: File,
    exchangeType: string,
): Promise<{ valid: boolean; error?: string; missingColumns?: string[] }> {
    try {
        // Read and parse file header (first line only)
        const fileContent = await file.text();
        const lines = fileContent.split("\n");

        // Determine the most likely delimiter - comma, semicolon, or tab
        let delimiter = ",";
        if (lines[0].includes(";") && !lines[0].includes(",")) {
            delimiter = ";";
        } else if (lines[0].includes("\t") && !lines[0].includes(",") && !lines[0].includes(";")) {
            delimiter = "\t";
        }

        if (!lines || lines.length === 0) {
            return {
                valid: false,
                error: `Empty ${exchangeType} file`,
            };
        }

        const header = lines[0].trim();
        const headerColumns = header.split(delimiter).map(col => col.trim());

        // Minimal logging with just essential info
        console.log(`${exchangeType} file validation: "${file.name}", size: ${file.size} bytes, delimiter: ${delimiter}`);

        const missingColumns: string[] = [];

        // Function to check if a column exists with various matching strategies
        function checkColumnExists(columnId: string, aliases: string[] = []): boolean {
            // Exact match with any header column
            if (headerColumns.includes(columnId)) {
                return true;
            }

            // Case-insensitive match with any header column
            if (headerColumns.some(hc => hc.toLowerCase() === columnId.toLowerCase())) {
                return true;
            }

            // Check against aliases with exact and case-insensitive matches
            if (aliases.some(alias =>
                headerColumns.some(hc => hc === alias || hc.toLowerCase() === alias.toLowerCase()),
            )) {
                return true;
            }

            // Substring matching for flexibility (less precise)
            if (headerColumns.some(hc => hc.toLowerCase().includes(columnId.toLowerCase()))) {
                return true;
            }

            // Substring matching with aliases
            if (aliases.some(alias =>
                headerColumns.some(hc => hc.toLowerCase().includes(alias.toLowerCase())),
            )) {
                return true;
            }

            return false;
        }

        // Check for required columns based on exchange type
        if (exchangeType === "BSE") {
            // BSE required columns with more descriptive names for the frontend
            const requiredColumns = [
                { id: "TckrSymb", displayName: "Ticker Symbol (TckrSymb)", aliases: ["tickersymbol", "ticker", "symbol", "SYMBOL"] },
                { id: "FinInstrmNm", displayName: "Financial Instrument Name (FinInstrmNm)", aliases: ["FinancialInstrumentName", "financial instrument name", "name", "INSTRUMENT NAME"] },
                { id: "ClsPric", displayName: "Close Price (ClsPric)", aliases: ["ClosePrice", "close price", "close", "CLOSE PRICE"] },
            ];

            // Check each required column
            for (const column of requiredColumns) {
                if (!checkColumnExists(column.id, column.aliases)) {
                    missingColumns.push(column.displayName);
                }
            }

            if (missingColumns.length > 0) {
                return {
                    valid: false,
                    error: `The BSE file is missing required columns`,
                    missingColumns,
                };
            }
        } else if (exchangeType === "NSE") {
            // NSE required columns with more descriptive names for the frontend
            const requiredColumns = [
                { id: "SYMBOL", displayName: "Symbol (SYMBOL)", aliases: ["symbol", "Symbol", "Ticker", "ticker", "TickerSymbol"] },
                { id: "Security Name", displayName: "Security Name", aliases: ["security name", "SecurityName", "securityname", "SECURITY NAME", "Name", "name", "Company"] },
                { id: "Close Price/Paid up value(Rs.)", displayName: "Close Price/Paid up value(Rs.)", aliases: ["close price", "Close Price", "CLOSE PRICE", "ClosePrice", "Price", "price"] },
            ];

            // Check each required column
            for (const column of requiredColumns) {
                if (!checkColumnExists(column.id, column.aliases)) {
                    missingColumns.push(column.displayName);
                }
            }

            if (missingColumns.length > 0) {
                return {
                    valid: false,
                    error: `The NSE file is missing required columns`,
                    missingColumns,
                };
            }
        } else {
            return { valid: false, error: `Unknown exchange type: ${exchangeType}` };
        }

        // Check if the file has at least one data row
        if (lines.length < 2 || !lines[1].trim()) {
            return {
                valid: false,
                error: `The ${exchangeType} file does not contain any data rows`,
            };
        }

        // Simple success log
        console.log(`${exchangeType} validation: Success`);
        return {
            valid: true,
            error: undefined,
            missingColumns: undefined,
        };
    } catch (error) {
        // Concise error logging
        console.error(`${exchangeType} validation error: ${error instanceof Error ? error.message : String(error)}`);
        return {
            valid: false,
            error: `Failed to validate ${exchangeType} file: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

// Define the Hono app
const app = new Hono();

// New route to handle only BSE CSV uploads

app.post("/upload-bse-stocks", zValidator("form", bseFormSchema), async (c) => {
    try {
        const formData = await c.req.formData();
        const bseFile = formData.get("bse") as File;

        if (!bseFile) {
            return c.json({
                success: false,
                error: "BSE file is required",
                validationErrors: [{
                    fileType: "BSE",
                    message: "BSE file is required",
                }],
            }, 400);
        }

        // Validate file format first
        const bseValidation = await validateCSVFormat(bseFile, "BSE");
        if (!bseValidation.valid) {
            return c.json({
                success: false,
                error: bseValidation.error || "BSE file validation failed",
                validationErrors: [{
                    fileType: "BSE",
                    message: bseValidation.error || "File format is invalid",
                    missingColumns: bseValidation.missingColumns,
                }],
            }, 400);
        }

        // Measure performance
        console.time("BSE-processing-total");

        // Match the type returned by parseCSV
        let bseStats: {
            totalRecords: number;
            inserted: number;
            invalidRecords?: { reason: string; record: any }[];
        } = {
            totalRecords: 0,
            inserted: 0,
            invalidRecords: [],
        };

        await db.transaction(async (tx) => {
            // Task 1: Clear existing data and parse the file in parallel
            const [_, parsedStats] = await Promise.all([
                (async () => {
                    await tx.delete(stocks).where(eq(stocks.exchange, ExchangeType.BSE));
                })(),
                parseCSV(bseFile, "BSE", true, tx),
            ]);

            // Store the results
            bseStats = parsedStats;

            // Task 2: Calculate brokerage within the same transaction
            try {
                const { month, year } = getCurrentMonthAndYear();
                // Use optimized version with reduced logging
                await calculateAndSaveMonthlyBrokerageOptimized(month, year, tx);
            } catch (brokerageError) {
                console.error("Error calculating brokerage:", brokerageError);
                // Continue with transaction, don't abort due to brokerage error
            }
        });

        console.timeEnd("BSE-processing-total");

        return c.json({
            success: true,
            message: "BSE stocks imported successfully and brokerage recalculated",
            bse: {
                totalRecords: bseStats.totalRecords,
                inserted: bseStats.inserted,
                invalidRecords: bseStats.invalidRecords,
            },
        });
    } catch (error) {
        console.error("Error processing BSE CSV:", error);

        if (error instanceof Error) {
            const errorMessage = error.message;

            // Check if it's a validation error
            if (errorMessage.includes("required column") || errorMessage.includes("validation")) {
                return c.json({
                    success: false,
                    error: errorMessage,
                    validationErrors: [{
                        fileType: "BSE",
                        message: errorMessage,
                    }],
                }, 400);
            }
        }

        return c.json({
            success: false,
            error: "Failed to process BSE CSV file",
            validationErrors: [{
                fileType: "BSE",
                message: "An error occurred during processing",
            }],
        }, 500);
    }
});

// New route to handle only NSE CSV uploads

app.post("/upload-nse-stocks", zValidator("form", nseFormSchema), async (c) => {
    try {
        const formData = await c.req.formData();
        const nseFile = formData.get("nse") as File;

        if (!nseFile) {
            return c.json({
                success: false,
                error: "NSE file is required",
                validationErrors: [{
                    fileType: "NSE",
                    message: "NSE file is required",
                }],
            }, 400);
        }

        // Validate file format first
        const nseValidation = await validateCSVFormat(nseFile, "NSE");
        if (!nseValidation.valid) {
            return c.json({
                success: false,
                error: nseValidation.error || "NSE file validation failed",
                validationErrors: [{
                    fileType: "NSE",
                    message: nseValidation.error || "File format is invalid",
                    missingColumns: nseValidation.missingColumns,
                }],
            }, 400);
        }

        // Measure performance
        console.time("NSE-processing-total");

        // Match the type returned by parseCSV
        let nseStats: {
            totalRecords: number;
            inserted: number;
            invalidRecords?: { reason: string; record: any }[];
        } = {
            totalRecords: 0,
            inserted: 0,
            invalidRecords: [],
        };

        await db.transaction(async (tx) => {
            // Task 1: Clear existing data and parse the file in parallel
            const [_, parsedStats] = await Promise.all([
                (async () => {
                    await tx.delete(stocks).where(eq(stocks.exchange, ExchangeType.NSE));
                })(),
                parseCSV(nseFile, "NSE", true, tx),
            ]);

            // Store the results
            nseStats = parsedStats;

            // Task 2: Calculate brokerage within the same transaction
            try {
                const { month, year } = getCurrentMonthAndYear();
                // Use optimized version with reduced logging
                await calculateAndSaveMonthlyBrokerageOptimized(month, year, tx);
            } catch (brokerageError) {
                console.error("Error calculating brokerage:", brokerageError);
                // Continue with transaction, don't abort due to brokerage error
            }
        });

        console.timeEnd("NSE-processing-total");

        return c.json({
            success: true,
            message: "NSE stocks imported successfully and brokerage recalculated",
            nse: {
                totalRecords: nseStats.totalRecords,
                inserted: nseStats.inserted,
                invalidRecords: nseStats.invalidRecords,
            },
        });
    } catch (error) {
        console.error("Error processing NSE CSV:", error);

        if (error instanceof Error) {
            const errorMessage = error.message;

            // Check if it's a validation error
            if (errorMessage.includes("required column") || errorMessage.includes("validation")) {
                return c.json({
                    success: false,
                    error: errorMessage,
                    validationErrors: [{
                        fileType: "NSE",
                        message: errorMessage,
                    }],
                }, 400);
            }
        }

        return c.json({
            success: false,
            error: "Failed to process NSE CSV file",
            validationErrors: [{
                fileType: "NSE",
                message: "An error occurred during processing",
            }],
        }, 500);
    }
});

// New combined endpoint to upload both BSE and NSE stocks in a single call

app.post("/upload-stocks", zValidator("form", combinedStocksFormSchema), async (c) => {
    try {
        const formData = await c.req.formData();
        const bseFile = formData.get("bse") as File;
        const nseFile = formData.get("nse") as File;

        // For the combined endpoint, we now require both files
        if (!bseFile && !nseFile) {
            return c.json({
                success: false,
                error: "Both BSE and NSE files are required",
                validationErrors: [
                    { fileType: "BSE", message: "BSE file is required" },
                    { fileType: "NSE", message: "NSE file is required" },
                ],
            }, 400);
        } else if (!bseFile) {
            return c.json({
                success: false,
                error: "BSE file is required",
                validationErrors: [
                    { fileType: "BSE", message: "BSE file is required" },
                ],
            }, 400);
        } else if (!nseFile) {
            return c.json({
                success: false,
                error: "NSE file is required",
                validationErrors: [
                    { fileType: "NSE", message: "NSE file is required" },
                ],
            }, 400);
        }

        // Measure total performance
        console.time("stock-upload-total");

        // Define type that matches parseCSV return type
        type StockStats = {
            totalRecords: number;
            inserted: number;
            invalidRecords?: { reason: string; record: any }[];
        };

        const stats = {
            bse: {
                totalRecords: 0,
                inserted: 0,
                invalidRecords: [],
            } as StockStats,
            nse: {
                totalRecords: 0,
                inserted: 0,
                invalidRecords: [],
            } as StockStats,
        };

        // Validate files before starting the transaction to avoid partial processing
        const bsePreCheck = await validateCSVFormat(bseFile, "BSE");
        const nsePreCheck = await validateCSVFormat(nseFile, "NSE");

        const validationErrors = [];

        if (!bsePreCheck.valid) {
            validationErrors.push({
                fileType: "BSE",
                message: bsePreCheck.error || "Unknown validation error",
                missingColumns: bsePreCheck.missingColumns,
            });
        }

        if (!nsePreCheck.valid) {
            validationErrors.push({
                fileType: "NSE",
                message: nsePreCheck.error || "Unknown validation error",
                missingColumns: nsePreCheck.missingColumns,
            });
        }

        // If either file has validation errors, return them all at once
        if (validationErrors.length > 0) {
            return c.json({
                success: false,
                error: "File validation failed",
                validationErrors,
            }, 400);
        }

        try {
            await db.transaction(async (tx) => {
                // Files are already validated, so we can proceed
                const tasks = [];

                // BSE processing
                tasks.push((async () => {
                    await tx.delete(stocks).where(eq(stocks.exchange, ExchangeType.BSE));
                    try {
                        const parsedStats = await parseCSV(bseFile, "BSE", true, tx);
                        stats.bse = parsedStats;
                    } catch (bseError: any) {
                        console.error(`BSE processing error: ${bseError?.message || "Unknown error"}`);
                        throw new Error(`BSE file error: ${bseError?.message || "Unknown error"}`);
                    }
                })());

                // NSE processing
                tasks.push((async () => {
                    await tx.delete(stocks).where(eq(stocks.exchange, ExchangeType.NSE));
                    try {
                        const parsedStats = await parseCSV(nseFile, "NSE", true, tx);
                        stats.nse = parsedStats;
                    } catch (nseError: any) {
                        console.error(`NSE processing error: ${nseError?.message || "Unknown error"}`);
                        throw new Error(`NSE file error: ${nseError?.message || "Unknown error"}`);
                    }
                })());

                await Promise.all(tasks);

                // Calculate brokerage once after all stocks are updated
                try {
                    const { month, year } = getCurrentMonthAndYear();
                    await calculateAndSaveMonthlyBrokerageOptimized(month, year, tx);
                } catch (brokerageError) {
                    console.error(`Brokerage calculation error: ${brokerageError instanceof Error ? brokerageError.message : String(brokerageError)}`);
                    // We don't want to fail the entire transaction if just the brokerage calculation fails
                }
            });

            console.timeEnd("stock-upload-total");

            return c.json({
                success: true,
                message: "Stock data imported successfully and brokerage recalculated",
                bse: stats.bse,
                nse: stats.nse,
            });
        } catch (txError: any) {
            // Transaction errors should be handled separately
            console.error(`Transaction failed: ${txError.message || "Unknown error"}`);
            const errorMessage = txError.message || "Transaction failed";

            // Create a structured error response that's easy to handle in the frontend
            const errorResponse = {
                success: false,
                error: errorMessage,
                validationErrors: [] as any[],
            };

            if (errorMessage.includes("BSE file")) {
                errorResponse.validationErrors.push({
                    fileType: "BSE",
                    message: errorMessage.replace("BSE file error: ", ""),
                });
            } else if (errorMessage.includes("NSE file")) {
                errorResponse.validationErrors.push({
                    fileType: "NSE",
                    message: errorMessage.replace("NSE file error: ", ""),
                });
            } else {
                // Generic transaction error
                errorResponse.validationErrors.push({
                    fileType: "SYSTEM",
                    message: "A database error occurred during processing",
                });
            }

            return c.json(errorResponse, 400);
        }
    } catch (error: any) {
        console.error(`CSV processing error: ${error instanceof Error ? error.message : String(error)}`);

        // Check if the error message indicates which file has issues
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorResponse = {
            success: false,
            error: "Failed to process stock CSV files",
            validationErrors: [] as any[],
        };

        if (errorMessage.includes("BSE") && errorMessage.includes("required column")) {
            errorResponse.validationErrors.push({
                fileType: "BSE",
                message: "BSE file is missing required columns",
            });
        } else if (errorMessage.includes("NSE") && errorMessage.includes("required column")) {
            errorResponse.validationErrors.push({
                fileType: "NSE",
                message: "NSE file is missing required columns",
            });
        } else if (errorMessage.includes("required column")) {
            errorResponse.validationErrors.push({
                fileType: "UNKNOWN",
                message: errorMessage,
            });
        } else {
            errorResponse.validationErrors.push({
                fileType: "SYSTEM",
                message: "An unexpected error occurred",
            });
        }

        return c.json(errorResponse, 500);
    }
});

// Enhanced Function to parse CSV file with column validation

// Enhanced Function to parse CSV file with column validation

// Route to get all stock symbols
app.get("/symbols", async (c) => {
    const symbols = await stock.getAllSymbols(db);
    return c.json({ message: "stock symbols fetched successfully", symbols });
});

export default app;
