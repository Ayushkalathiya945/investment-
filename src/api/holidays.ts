import type { GetAllHolidaysResponse } from "@/types/holidays";

import { ApiGet, ApiPost } from "./api-helper";

type ApiResponse<T> = {
    success: boolean;
    data: T;
    message?: string;
};

export async function getAllHolidays(year: number) {
    try {
        const response = await ApiGet<ApiResponse<GetAllHolidaysResponse[]>>(`/holidays/get/${year}`);
        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to fetch holidays");
        }

        return response.data;
    } catch (error) {
        console.error("Error fetching holidays:", error);
        throw new Error("Failed to fetch holidays");
    }
}

export async function fetchAndStoreHolidaysAndQuarters(year: number) {
    try {
        const response = await ApiPost<ApiResponse<GetAllHolidaysResponse[]>>(`/holidays/calculate`, { year });
        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to fetch holidays");
        }

        return response.data;
    } catch (error) {
        console.error("Error fetching holidays:", error);
        throw new Error("Failed to fetch holidays");
    }
}
