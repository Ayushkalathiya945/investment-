import type { StockSymbolsResponse } from "@/types/stocks";

import { ApiGet } from "./api-helper";

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
