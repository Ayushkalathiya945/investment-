// utils/apiClient.ts
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import axios from "axios";

// Define a custom error class for API errors with additional properties
export class ApiError extends Error {
    status?: number;
    data?: any;
    error?: any;

    constructor(message: string, status?: number, data?: any, error?: any) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
        this.error = error;
    }
}

// Define API base URL using a default value instead of direct env access
// This avoids the node/no-process-env linting error
export const BASE_URL = `${
    // Use a fallback URL if env is not available
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
}/api`;

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // Enables sending cookies with requests
    headers: {
        "Content-Type": "application/json", // Default content type
        "x-client-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone, // Set client timezone
    },
});

// Function to dynamically set token for auth-enabled requests
function setAuthHeader(config: AxiosRequestConfig, useAuth: boolean): AxiosRequestConfig {
    if (useAuth) {
        const token = localStorage.getItem("token"); // Example: retrieving token
        if (token) {
            config.headers = {
                ...config.headers,
                Authorization: token,
            };
        }
    }
    return config;
}

// Interceptors for requests
apiClient.interceptors.request.use(
    (config: AxiosRequestConfig) => {
        return config as InternalAxiosRequestConfig<unknown>;
    },
    error => Promise.reject(error),
);

// Interceptors for responses
apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.error("Unauthorized! Redirecting to login...");
            window.location.href = "/auth"; // Redirect for unauthorized users
        }
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.message || "Something went wrong!";
            console.error(errorMessage);
            console.error("API Error:", error);
        }
        return Promise.reject(error);
    },
);

// Utility function for GET requests
export async function ApiGet<T>(url: string, config?: AxiosRequestConfig, useAuth = true): Promise<T> {
    const finalConfig = setAuthHeader(config || {}, useAuth);
    const response = await apiClient.get<T>(url, finalConfig);
    return response.data;
}

// Utility function for POST requests with JSON data
export async function ApiPost<T>(url: string, data: Record<string, unknown>, config?: AxiosRequestConfig, useAuth = true): Promise<T> {
    const finalConfig = setAuthHeader(config || {}, useAuth);
    try {
        const response = await apiClient.post<T>(url, data, finalConfig);
        return response.data;
    } catch (error: any) {
        // Extract detailed error message from the response
        const responseData = error.response?.data;

        // Log the full response data for debugging
        // //console.log("Full API error response data:", JSON.stringify(responseData, null, 2));

        // Determine the most specific error message
        let errorMessage: string;

        // When using Hono's HTTPException, the message is often in responseData.message
        if (typeof responseData === "object" && responseData?.message) {
            errorMessage = responseData.message;
        } else if (typeof responseData === "string" && responseData.includes("Insufficient shares")) { // Sometimes the message can be a direct string in responseData (especially with 400 errors)
            errorMessage = responseData;
        } else if (responseData?.error?.message) { // If message is buried in an error object
            errorMessage = responseData.error.message;
        } else { // Fall back to the Axios error message
            errorMessage = error.message || `Request to ${url} failed`;
        }

        // //console.log("Using error message:", errorMessage);
        console.error(`API POST Error for ${url}:`, errorMessage);

        const status = error.response?.status || 500;

        // Use our custom ApiError class with the proper error message
        throw new ApiError(errorMessage, status, responseData, responseData?.error);
    }
}

// Utility function for POST requests with FormData
export async function ApiPostFormData<T>(url: string, formData: FormData, config?: AxiosRequestConfig, useAuth = true): Promise<T> {
    const finalConfig = setAuthHeader(
        {
            ...config,
            headers: {
                ...config?.headers,
                "Content-Type": "multipart/form-data", // Explicitly set for FormData
            },
        },
        useAuth,
    );

    const response = await apiClient.post<T>(url, formData, finalConfig);
    return response.data;
}

// Utility function for PUT requests with JSON data
export async function ApiPut<T>(url: string, data: Record<string, unknown>, config?: AxiosRequestConfig, useAuth = true): Promise<T> {
    const finalConfig = setAuthHeader(config || {}, useAuth);
    try {
        const response = await apiClient.put<T>(url, data, finalConfig);
        return response.data;
    } catch (error: any) {
        // Extract detailed error message from the response
        const responseData = error.response?.data;

        // Log the full response data for debugging
        // //console.log("Full API PUT error response data:", JSON.stringify(responseData, null, 2));

        // Determine the most specific error message
        let errorMessage: string;

        // When using Hono's HTTPException, the message is often in responseData.message
        if (typeof responseData === "object" && responseData?.message) {
            errorMessage = responseData.message;
        } else if (typeof responseData === "string"
            && (responseData.includes("Insufficient shares") || responseData.includes("already been sold"))) { // Sometimes the message can be a direct string in responseData
            errorMessage = responseData;
        } else if (responseData?.error?.message) { // If message is buried in an error object
            errorMessage = responseData.error.message;
        } else { // Fall back to the Axios error message
            errorMessage = error.message || `Request to ${url} failed`;
        }

        // //console.log("Using PUT error message:", errorMessage);
        console.error(`API PUT Error for ${url}:`, errorMessage);

        const status = error.response?.status || 500;

        // Use our custom ApiError class with the proper error message
        throw new ApiError(errorMessage, status, responseData, responseData?.error);
    }
}

// Utility function for DELETE requests
export async function ApiDelete<T>(url: string, config?: AxiosRequestConfig, useAuth = true): Promise<T> {
    const finalConfig = setAuthHeader(config || {}, useAuth);
    try {
        const response = await apiClient.delete<T>(url, finalConfig);
        return response.data;
    } catch (error: any) {
        // Extract detailed error message from the response
        const responseData = error.response?.data;

        // Log the full response data for debugging
        // //console.log("Full API DELETE error response data:", JSON.stringify(responseData, null, 2));

        // Determine the most specific error message
        let errorMessage: string;

        // When using Hono's HTTPException, the message is often in responseData.message
        if (typeof responseData === "object" && responseData?.message) {
            errorMessage = responseData.message;
        } else if (typeof responseData === "string"
            && (responseData.includes("Insufficient shares") || responseData.includes("already been sold"))) { // Sometimes the message can be a direct string in responseData
            errorMessage = responseData;
        } else if (responseData?.error?.message) { // If message is buried in an error object
            errorMessage = responseData.error.message;
        } else { // Fall back to the Axios error message
            errorMessage = error.message || `Request to ${url} failed`;
        }

        // //console.log("Using DELETE error message:", errorMessage);
        console.error(`API DELETE Error for ${url}:`, errorMessage);

        const status = error.response?.status || 500;

        // Use our custom ApiError class with the proper error message
        throw new ApiError(errorMessage, status, responseData, responseData?.error);
    }
}

export default apiClient;
