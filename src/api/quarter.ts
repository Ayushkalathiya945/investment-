import type { CreateQuarterInput, QuarterResponse, UpdateQuarterInput } from "@/types/quarter";

import { ApiGet, ApiPost, ApiPut } from "./api-helper";

type ApiResponse<T> = {
    success: boolean;
    data: T;
    message?: string;
};

export async function createQuarters(data: CreateQuarterInput): Promise<QuarterResponse[]> {
    try {
        const response = await ApiPost<ApiResponse<QuarterResponse[]>>("/quarter/create", data);
        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to create quarters");
        }
        return response.data;
    } catch (error: any) {
        console.error("Quarter creation error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Failed to create quarters";

        throw new Error(errorMessage);
    }
}

export async function updateQuarters(
    year: number,
    data: UpdateQuarterInput,
): Promise<QuarterResponse[]> {
    try {
        const response = await ApiPut<ApiResponse<QuarterResponse[]>>(
            `/quarter/update/${year}`,
            data,
        );
        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to update quarters");
        }

        return response.data;
    } catch (error: any) {
        console.error("Quarter update error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Failed to update quarters";

        throw new Error(errorMessage);
    }
}

export async function getQuartersByYear(year: number): Promise<QuarterResponse[]> {
    try {
        const response = await ApiGet<ApiResponse<QuarterResponse[]>>(`/quarter/year/${year}`);

        if (!response || !response.success) {
            throw new Error(response?.message || `No quarters found for year ${year}`);
        }
        return response.data;
    } catch (error: any) {
        if (error.message?.includes("404")) {
            return [];
        }
        console.error("Error fetching quarters:", error);
        const errorMessage = error.response?.data?.message || error.message || "Failed to fetch quarters";

        throw new Error(errorMessage);
    }
}

export async function getQuarter(
    year: number,
    quarterNumber: number,
): Promise<QuarterResponse | null> {
    try {
        const response = await ApiGet<ApiResponse<QuarterResponse>>(
            `/quarter/${year}/${quarterNumber}`,
        );
        if (!response || !response.success) {
            return null;
        }
        return response.data;
    } catch (error) {
        console.error("Error fetching quarter:", error);
        return null;
    }
}
