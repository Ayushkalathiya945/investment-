import type { StockSymbolsResponse, StockUploadResponse, ValidationError } from "@/types/stocks";

import { ApiGet, ApiPostFormData } from "./api-helper";

// Type definition for stock stats response from server
type StockStats = {
    totalRecords: number;
    inserted: number;
    invalidRecords?: { reason: string; record: any }[];
};

// Interface for stock upload API responses
type StockUploadApiResponse = {
    success?: boolean;
    message: string;
    error?: string;
    validationErrors?: ValidationError[];
    nse?: StockStats;
    bse?: StockStats;
};

export async function uploadBothStocks(nseFile: File, bseFile: File): Promise<StockUploadResponse> {
    try {
        // Verify both files are provided
        if (!nseFile || !bseFile) {
            throw new Error("Both NSE and BSE files are required");
        }

        const formData = new FormData();

        // Append both files
        formData.append("nse", nseFile);
        formData.append("bse", bseFile);

        // Use ApiPostFormData utility from api-helper.ts with proper response typing
        const data = await ApiPostFormData<StockUploadApiResponse>("/stocks/upload-stocks", formData);

        // If server returns success: false but doesn't throw an error
        if (data.success === false) {
            return {
                success: false,
                message: data.message || "File validation failed",
                error: data.error,
                validationErrors: data.validationErrors,
            };
        }

        return {
            success: true,
            message: data.message || "Stock files uploaded successfully",
            nse: data.nse,
            bse: data.bse,
        };
    } catch (error: any) {
        console.error("Stock files upload error:", error);

        // Check if there are structured validation errors in the response
        const responseData = error.data;

        // Handle structured validation errors
        if (responseData?.validationErrors?.length > 0) {
            return {
                success: false,
                message: "File validation failed",
                error: error.message || "Failed to upload stock files",
                validationErrors: responseData.validationErrors,
            };
        }

        // Provide more specific error message based on common problems
        let errorMessage = error.message || "Failed to upload stock files";

        if (error.message?.includes("required column")) {
            errorMessage = `CSV format error: ${error.message}`;
        } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
            errorMessage = "Network error: Could not connect to server";
        }

        return {
            success: false,
            message: "Failed to upload stock files",
            error: errorMessage,
        };
    }
}

export async function getAllStockSymbols(): Promise<StockSymbolsResponse> {
    try {
        const response = await ApiGet<StockSymbolsResponse>("/stocks/symbols");

        if (!response || !response.symbols) {
            throw new Error("Failed to fetch stock symbols: Invalid response format");
        }

        // console.log("Fetched stock symbols:", response.symbols);

        return response;
    } catch (error: any) {
        console.error("Error fetching stock symbols:", error);
        // Return empty arrays as fallback
        return {
            message: "Failed to fetch stock symbols",
            symbols: {
                nse: [],
                bse: [],
            },
        };
    }
}
