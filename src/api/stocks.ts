import type { StockSymbolsResponse, StockUploadResponse } from "@/types/stocks";

import { ApiGet } from "./api-helper";

/**
 * Upload NSE stocks CSV file
 * @param file CSV file containing NSE stocks data
 * @returns Upload statistics and success message
 */
export async function uploadNseStocks(file: File): Promise<StockUploadResponse> {
    try {
        // //console.log(`Uploading NSE file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

        // Read the first few lines of the file to check its content
        await file.slice(0, 500).text();
        // //console.log(`NSE file preview (first 500 chars):\n${filePreview}`);

        const formData = new FormData();
        formData.append("nse", file);

        const response = await fetch("/api/stocks/upload-nse-stocks", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to upload NSE stocks");
        }

        return {
            success: true,
            message: data.message || "NSE stocks uploaded successfully",
            nse: data.nse,
        };
    } catch (error: any) {
        // console.error("NSE stock upload error:", error);
        // Provide more specific error message based on common problems
        let errorMessage = "Failed to upload NSE stocks";

        if (error.message.includes("required column")) {
            errorMessage = `CSV format error: ${error.message}`;
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
            errorMessage = "Network error: Could not connect to server";
        }

        return {
            success: false,
            message: "Failed to upload NSE stocks",
            error: errorMessage,
        };
    }
}

export async function uploadBseStocks(file: File): Promise<StockUploadResponse> {
    try {
        // //console.log(`Uploading BSE file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

        const formData = new FormData();
        formData.append("bse", file);

        // //console.log("FormData created with BSE file");

        const response = await fetch("/api/stocks/upload-bse-stocks", {
            method: "POST",
            body: formData,
        });

        // //console.log(`BSE upload response status: ${response.status}`);
        const data = await response.json();
        // //console.log("BSE upload response data:", data);

        if (!response.ok) {
            throw new Error(data.error || "Failed to upload BSE stocks");
        }

        return {
            success: true,
            message: data.message || "BSE stocks uploaded successfully",
            bse: data.bse,
        };
    } catch (error: any) {
        console.error("BSE stock upload error:", error);
        // Provide more specific error message based on common problems
        let errorMessage = "Failed to upload BSE stocks";

        if (error.message.includes("required column")) {
            errorMessage = `CSV format error: ${error.message}`;
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
            errorMessage = "Network error: Could not connect to server";
        }

        return {
            success: false,
            message: "Failed to upload BSE stocks",
            error: errorMessage,
        };
    }
}

/**
 * Get all stock symbols (NSE and BSE)
 * @returns Object containing NSE and BSE stock symbols
 */
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
