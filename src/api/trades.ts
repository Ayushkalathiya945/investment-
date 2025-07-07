import type {
    CreateTradeRequest,
    StockSymbolsResponse,
    Trade,
    TradeFilterRequest,
    TradeResponse,
    TradesListResponse,
    UpdateTradeRequest,
} from "@/types/trade";

import { ApiDelete, ApiGet, ApiPost, ApiPut } from "./api-helper";

export function formatDateForTradeApi(date: Date | undefined): string | undefined {
    // Return undefined if no date or invalid date
    if (!date)
        return undefined;

    try {
        // Check if the date is valid
        if (Number.isNaN(date.getTime())) {
            console.error("Invalid date object provided:", date);
            return undefined;
        }

        // Get YYYY-MM-DD format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        const formattedDate = `${year}-${month}-${day}`;
        return formattedDate;
    } catch (error) {
        console.error("Failed to format date:", error, date);
        return undefined;
    }
}

// Create a new trade
export async function createTrade(data: CreateTradeRequest): Promise<{ data: Trade; message: string }> {
    try {
        console.log("Creating trade with data:", JSON.stringify(data, null, 2));

        const response = await ApiPost<TradeResponse>("/trades/create", data);

        if (!response || !response.success) {
            // Handle specific business logic errors that should be displayed in toast
            const errorMessage = response?.message || "Failed to create trade";
            console.log("Error response:", JSON.stringify(response, null, 2));
            const error = new Error(errorMessage);

            // If the API returns specific error details, add them to the error object
            if (response?.error) {
                (error as any).error = response.error;
            }

            // Check if this is a brokerage conflict based on the message
            if (errorMessage.includes("brokerage has already been calculated")
                || errorMessage.includes("brokerage calculation first")) {
                (error as any).isBrokerageConflict = true;
            }

            throw error;
        }

        return {
            data: response.data as Trade,
            message: response.message || "Trade created successfully",
        };
    } catch (error: any) {
        console.error("Trade creation API error:", error);

        // Log detailed error information for debugging
        console.log("Error details:", {
            name: error.name,
            message: error.message,
            data: error.data,
            response: error.response?.data,
        });

        // For ApiError instances (from our ApiPost function)
        if (error.name === "ApiError") {
            // Log the error for debugging
            console.log("ApiError instance detected:", {
                message: error.message,
                data: error.data,
                status: error.status,
            });

            // Check for specific status codes
            if (error.status === 409) {
                // This is likely a brokerage calculation conflict
                error.isBrokerageConflict = true;

                // Make sure the error message is clear
                if (error.message && error.message.includes("brokerage has already been calculated")) {
                    // The message is already clear about brokerage calculation
                } else {
                    // Ensure there's a clear message about brokerage
                    error.message = error.message || "Cannot create trade as brokerage has already been calculated. Please delete the brokerage calculation first.";
                }
            }

            // But make sure to preserve any additional error details for validation errors
            if (error.data?.error) {
                error.error = error.data.error;
            }
        } else if (error.response) { // Handle regular Axios error responses (should not happen with our updated ApiPost)
            console.log("Direct Axios error:", error.response);

            // Check for specific status codes in Axios response
            if (error.response.status === 409) {
                error.isBrokerageConflict = true;
            }

            // Handle API response with validation issues
            if (error.response.data?.error?.issues) {
                console.error("Validation issues:", error.response.data.error.issues);
                error.error = error.response.data.error;
            }

            // If we have a specific error message from the API, use it
            if (typeof error.response.data === "string") {
                error.message = error.response.data;
            } else if (error.response.data?.message) {
                error.message = error.response.data.message;
            }

            console.log("Final error message:", error.message);
        }

        throw error;
    }
}

// Get all trades with filtering options
export async function getAllTrades(data: TradeFilterRequest): Promise<TradesListResponse> {
    const requestData: TradeFilterRequest = {
        page: data.page,
        pageSize: data.pageSize,
        clientId: data.clientId || undefined,
        stockSymbol: data.stockSymbol || undefined,
        type: data.type || undefined,
        from: data.startDate || undefined,
        to: data.endDate || undefined,
    };

    console.log(requestData);

    const response = await ApiPost<any>("/trades/get-all", requestData);

    if (!response || !response.success) {
        throw new Error("Failed to fetch trades");
    }

    // Map the backend metadata to our expected pagination structure
    const mappedResponse: TradesListResponse = {
        ...response,
        pagination: response.metadata
            ? {
                    total: response.metadata.total,
                    totalPages: response.metadata.totalPages,
                    currentPage: response.metadata.currentPage,
                    hasNext: response.metadata.hasNext,
                }
            : undefined,
    };

    return mappedResponse;
}

// Get a trade by ID
export async function getTradeById(id: number): Promise<any> { // Changed return type to 'any' to accommodate nested structure
    try {
        console.log(`Fetching trade details for ID: ${id}`);
        const response = await ApiGet<any>(`/trades/get-one/${id}`);

        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to fetch trade");
        }

        // Log the raw response to see the exact structure
        console.log("Raw trade response:", response);

        // The API might return the trade directly or nested inside a 'trade' property
        const tradeResponse = response.data as any;

        // Process the trade data, whether it's nested or not
        if (tradeResponse) {
            // If there's a nested trade property
            if ("trade" in tradeResponse) {
                const tradeData = tradeResponse.trade;
                if (tradeData && tradeData.tradeDate && typeof tradeData.tradeDate === "number") {
                    // Convert timestamp to YYYY-MM-DD format
                    const dateObj = new Date(tradeData.tradeDate);
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const day = String(dateObj.getDate()).padStart(2, "0");
                    tradeData.tradeDate = `${year}-${month}-${day}`;
                }
            } else if ("tradeDate" in tradeResponse && typeof tradeResponse.tradeDate === "number") { // If this is a direct trade object (not nested)
                // Convert timestamp to YYYY-MM-DD format
                const dateObj = new Date(tradeResponse.tradeDate);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                const day = String(dateObj.getDate()).padStart(2, "0");
                tradeResponse.tradeDate = `${year}-${month}-${day}`;
            }
        }

        console.log(`Trade details processed:`, tradeResponse);

        return tradeResponse;
    } catch (error: any) {
        console.error(`Error fetching trade #${id}:`, error);
        throw error;
    }
}

// Delete a trade
export async function deleteTrade(id: number): Promise<{ success: boolean; message: string }> {
    try {
        const response = await ApiDelete<{ success: boolean; message: string }>(`/trades/${id}`);

        if (!response || !response.success) {
            console.error("Error response in delete:", JSON.stringify(response, null, 2));
            throw new Error(response?.message || "Failed to delete trade");
        }

        return {
            success: true,
            message: response.message || "Trade deleted successfully",
        };
    } catch (error: any) {
        console.error(`Error deleting trade #${id}:`, error);

        // Log detailed error information for debugging
        console.error("Delete error details:", {
            name: error.name,
            message: error.message,
            data: error.data,
            response: error.response?.data,
        });

        // For ApiError instances (from our ApiDelete function)
        if (error.name === "ApiError") {
            // Log the error for debugging
            console.error("ApiError instance detected in delete:", {
                message: error.message,
                data: error.data,
                status: error.status,
            });

            // Check for specific status codes
            if (error.status === 409) {
                // This is likely a brokerage calculation conflict
                error.isBrokerageConflict = true;

                // Make sure the error message is clear
                if (error.message && error.message.includes("brokerage has already been calculated")) {
                    // The message is already clear about brokerage calculation
                } else {
                    // Ensure there's a clear message about brokerage
                    error.message = error.message || "Cannot delete trade as brokerage has already been calculated. Please delete the brokerage calculation first.";
                }
            }

            if (error.data?.error) {
                error.error = error.data.error;
            }
        } else if (error.response) { // Handle regular Axios error responses (should not happen with our updated ApiDelete)
            console.error("Direct Axios error in delete:", error.response);

            // If we have a specific error message from the API, use it
            if (typeof error.response.data === "string") {
                error.message = error.response.data;
            } else if (error.response.data?.message) {
                error.message = error.response.data.message;
            }

            console.error("Final delete error message:", error.message);
        }

        throw error;
    }
}

// Update an existing trade
export async function updateTrade(id: number, data: UpdateTradeRequest): Promise<{ data: any; message: string }> {
    try {
        const response = await ApiPut<TradeResponse>(`/trades/update`, { ...data, id });

        if (!response || !response.success) {
            // Handle specific business logic errors that should be displayed in toast
            const errorMessage = response?.message || "Failed to update trade";
            console.log("Error response in update:", JSON.stringify(response, null, 2));
            const error = new Error(errorMessage);

            // If the API returns specific error details like insufficient stocks, add them to the error object
            if (response?.error) {
                (error as any).error = response.error;
            }

            throw error;
        }

        // Process the response data to ensure proper format
        const responseData = response.data as any;

        // If there's a nested structure with trade data
        if (responseData && "trade" in responseData) {
            // Process date if needed for the nested trade object
            const tradeData = responseData.trade;
            if (tradeData && tradeData.tradeDate && typeof tradeData.tradeDate === "number") {
                const dateObj = new Date(tradeData.tradeDate);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                const day = String(dateObj.getDate()).padStart(2, "0");
                tradeData.tradeDate = `${year}-${month}-${day}`;
            }
        } else if (responseData && "tradeDate" in responseData && typeof responseData.tradeDate === "number") { // If it's a direct trade object
            const dateObj = new Date(responseData.tradeDate);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const day = String(dateObj.getDate()).padStart(2, "0");
            responseData.tradeDate = `${year}-${month}-${day}`;
        }

        console.log("Processed update response:", responseData);

        return {
            data: responseData,
            message: response.message || "Trade updated successfully",
        };
    } catch (error: any) {
        console.error("Trade update API error:", error);

        // For ApiError instances (from our ApiPut function)
        if (error.name === "ApiError") {
            // Log the error for debugging
            console.log("ApiError instance detected in update:", {
                message: error.message,
                data: error.data,
                status: error.status,
            });

            // Check for specific status codes
            if (error.status === 409) {
                // This is likely a brokerage calculation conflict
                error.isBrokerageConflict = true;

                // Make sure the error message is clear
                if (error.message && error.message.includes("brokerage has already been calculated")) {
                    // The message is already clear about brokerage calculation
                } else {
                    // Ensure there's a clear message about brokerage
                    error.message = error.message || "Cannot update trade as brokerage has already been calculated. Please delete the brokerage calculation first.";
                }
            }

            // But make sure to preserve any additional error details for validation errors
            if (error.data?.error) {
                error.error = error.data.error;
            }
        } else if (error.response) { // Handle regular Axios error responses (should not happen with our updated ApiPut)
            console.log("Direct Axios error in update:", error.response);

            // Check for specific status codes in Axios response
            if (error.response.status === 409) {
                error.isBrokerageConflict = true;
            }

            // Handle API response with validation issues
            if (error.response.data?.error?.issues) {
                console.error("Validation issues:", error.response.data.error.issues);
                error.error = error.response.data.error;
            }

            // If we have a specific error message from the API, use it
            if (typeof error.response.data === "string") {
                error.message = error.response.data;
            } else if (error.response.data?.message) {
                error.message = error.response.data.message;
            }

            console.log("Final update error message:", error.message);
        }

        throw error;
    }
}

// Get stock symbols from the backend
export async function getStockSymbols(): Promise<{ nse?: string[]; bse?: string[] }> {
    try {
        const response = await ApiGet<StockSymbolsResponse>("/stocks/symbols");

        if (!response) {
            throw new Error("Failed to fetch stock symbols");
        }

        const symbols = {
            nse: response.symbols.nse || [],
            bse: response.symbols.bse || [],
        };

        // console.log(response);

        // console.log(`Received ${symbols.nse?.length || 0} NSE symbols and ${symbols.bse?.length || 0} BSE symbols`);

        return symbols;
    } catch (error: any) {
        console.error("Error fetching stock symbols:", error);
        return { nse: [], bse: [] };
    }
}
