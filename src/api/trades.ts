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
    if (!date)
        return undefined;

    try {
        if (Number.isNaN(date.getTime())) {
            console.error("Invalid date object provided:", date);
            return undefined;
        }

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

export async function createTrade(data: CreateTradeRequest): Promise<{ data: Trade; message: string }> {
    try {
        const response = await ApiPost<TradeResponse>("/trades/create", data);

        if (!response || !response.success) {
            const errorMessage = response?.message || "Failed to create trade";
            const error = new Error(errorMessage);

            if (response?.error) {
                (error as any).error = response.error;
            }

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

        if (error.name === "ApiError") {
            console.error("ApiError instance detected:", {
                message: error.message,
                data: error.data,
                status: error.status,
            });

            if (error.data?.error) {
                error.error = error.data.error;
            }
        } else if (error.response) {
            console.error("Direct Axios error:", error.response);

            if (error.response.status === 409) {
                error.isBrokerageConflict = true;
            }

            if (error.response.data?.error?.issues) {
                console.error("Validation issues:", error.response.data.error.issues);
                error.error = error.response.data.error;
            }

            if (typeof error.response.data === "string") {
                error.message = error.response.data;
            } else if (error.response.data?.message) {
                error.message = error.response.data.message;
            }

            console.error("Final error message:", error.message);
        }

        throw error;
    }
}

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

    const response = await ApiPost<any>("/trades/get-all", requestData);

    if (!response || !response.success) {
        throw new Error("Failed to fetch trades");
    }

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

export async function getTradeById(id: number): Promise<any> {
    try {
        const response = await ApiGet<any>(`/trades/get-one/${id}`);

        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to fetch trade");
        }

        const tradeResponse = response.data as any;

        if (tradeResponse) {
            if ("trade" in tradeResponse) {
                const tradeData = tradeResponse.trade;
                if (tradeData && tradeData.tradeDate && typeof tradeData.tradeDate === "number") {
                    const dateObj = new Date(tradeData.tradeDate);
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const day = String(dateObj.getDate()).padStart(2, "0");
                    tradeData.tradeDate = `${year}-${month}-${day}`;
                }
            } else if ("tradeDate" in tradeResponse && typeof tradeResponse.tradeDate === "number") {
                const dateObj = new Date(tradeResponse.tradeDate);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                const day = String(dateObj.getDate()).padStart(2, "0");
                tradeResponse.tradeDate = `${year}-${month}-${day}`;
            }
        }

        return tradeResponse;
    } catch (error: any) {
        console.error(`Error fetching trade #${id}:`, error);
        throw error;
    }
}

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

        console.error("Delete error details:", {
            name: error.name,
            message: error.message,
            data: error.data,
            response: error.response?.data,
        });

        if (error.name === "ApiError") {
            console.error("ApiError instance detected in delete:", {
                message: error.message,
                data: error.data,
                status: error.status,
            });

            if (error.data?.error) {
                error.error = error.data.error;
            }
        } else if (error.response) {
            console.error("Direct Axios error in delete:", error.response);

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

export async function updateTrade(id: number, data: UpdateTradeRequest): Promise<{ data: any; message: string }> {
    try {
        const response = await ApiPut<TradeResponse>(`/trades/update/${id}`, { ...data, id });

        if (!response || !response.success) {
            const errorMessage = response?.message || "Failed to update trade";
            console.error("Error response in update:", JSON.stringify(response, null, 2));
            const error = new Error(errorMessage);

            if (response?.error) {
                (error as any).error = response.error;
            }

            throw error;
        }

        const responseData = response.data as any;

        if (responseData && "trade" in responseData) {
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

        return {
            data: responseData,
            message: response.message || "Trade updated successfully",
        };
    } catch (error: any) {
        console.error("Trade update API error:", error);

        if (error.name === "ApiError") {
            console.error("ApiError instance detected in update:", {
                message: error.message,
                data: error.data,
                status: error.status,
            });

            if (error.data?.error) {
                error.error = error.data.error;
            }
        } else if (error.response) {
            console.error("Direct Axios error in update:", error.response);

            if (error.response.status === 409) {
                error.isBrokerageConflict = true;
            }

            if (error.response.data?.error?.issues) {
                console.error("Validation issues:", error.response.data.error.issues);
                error.error = error.response.data.error;
            }

            if (typeof error.response.data === "string") {
                error.message = error.response.data;
            } else if (error.response.data?.message) {
                error.message = error.response.data.message;
            }

            console.error("Final update error message:", error.message);
        }

        throw error;
    }
}

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

        return symbols;
    } catch (error: any) {
        console.error("Error fetching stock symbols:", error);
        return { nse: [], bse: [] };
    }
}
