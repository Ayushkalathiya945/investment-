import type {
    Client,
    ClientAnalyticsResponse,
    ClientCreateRequest,
    ClientDropdownItem,
    ClientDropdownResponse,
    ClientFilterRequest,
    ClientResponse,
    ClientsListResponse,
    ClientUpdateRequest,
} from "@/types/client";

import { PAGE_LIMIT } from "@/lib/constants";

import { ApiDelete, ApiGet, ApiPost, ApiPut } from "./api-helper";

// create client
export async function createClient(data: ClientCreateRequest): Promise<Client> {
    try {
        const response = await ApiPost<ClientResponse>("/clients/create", data);

        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to create client");
        }

        return response.data;
    } catch (error: any) {
        // Log detailed error information
        console.error("Client creation API error:", error);

        // Format validation errors if present
        if (error.response?.data?.error?.issues) {
            console.error("Validation issues:", error.response.data.error.issues);
            error.error = error.response.data.error;
        }

        // Just rethrow the error as our ApiPost function already handles error formatting
        // This preserves any additional properties added by ApiPost
        throw error;
    }
}

// get all clients
export async function getAllClients(data: ClientFilterRequest): Promise<ClientsListResponse> {
    const response = await ApiPost<ClientsListResponse>("/clients/get-all", data);

    if (!response || !response.success) {
        throw new Error("Failed to fetch clients");
    }

    return response;
}

// get client by ID
export async function getClientById(id: number): Promise<Client> {
    const response = await ApiGet<ClientResponse>(`/clients/get-one/${id}`);

    if (!response || !response.success) {
        throw new Error(response?.message || "Failed to fetch client");
    }

    return response.data;
}

// update client
export async function updateClient(data: ClientUpdateRequest): Promise<Client> {
    try {
        const response = await ApiPut<ClientResponse>("/clients/update", data);

        if (!response || !response.success) {
            throw new Error(response?.message || "Failed to update client");
        }

        return response.data;
    } catch (error: any) {
        // Log detailed error information
        console.error("Client update API error:", error);

        // Format validation errors if present
        if (error.response?.data?.error?.issues) {
            console.error("Validation issues:", error.response.data.error.issues);
            error.error = error.response.data.error;
        }

        throw error;
    }
}

// delete client
export async function deleteClient(id: number): Promise<{ success: boolean; message: string }> {
    console.log(`Deleting client with ID: ${id}`);

    const response = await ApiDelete<{ success: boolean; message: string }>(`/clients/${id}`);

    if (!response || !response.success) {
        throw new Error(response?.message || "Failed to delete client");
    }

    return response;
}

// get client analytics with financial metrics
export async function getClientAnalytics(data: ClientFilterRequest): Promise<ClientAnalyticsResponse> {
    try {
        // Ensure date format is YYYY-MM-DD for backend compatibility
        const formatDate = (dateString?: string): string | undefined => {
            if (!dateString)
                return undefined;

            // If already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                return dateString;
            }

            // Otherwise try to convert to YYYY-MM-DD in local timezone
            try {
                const date = new Date(dateString);
                // Format in local timezone to avoid UTC conversion issues
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
            } catch (e) {
                console.error("Invalid date format:", dateString);
                console.error("Error  : ", e);
                return undefined;
            }
        };

        // Prepare request data - must include page and limit for validation to pass
        const requestData = {
            page: data.page || 1,
            limit: data.limit || PAGE_LIMIT,
            search: data.search,
            from: formatDate(data.from),
            to: formatDate(data.to),
        };

        const response = await ApiPost<ClientAnalyticsResponse>("/clients/analytics", requestData);

        if (!response || !response.success) {
            console.error("[ERROR] Failed to fetch analytics:", response);
            throw new Error(response?.message || "Failed to fetch client analytics");
        }

        // Add response debug info to the returned object
        const enhancedResponse = {
            ...response,
            _debug: {
                timestamp: new Date().toISOString(),
                requestData,
                requestUrl: "/clients/analytics",
                responseData: response.data,
            },
        };

        return enhancedResponse as ClientAnalyticsResponse;
    } catch (error) {
        console.error("[ERROR] Error fetching client analytics:", error);
        throw error;
    }
}

// Get all client IDs and names for dropdown selection
export async function getAllClientsForDropdown(): Promise<ClientDropdownItem[]> {
    try {
        const response = await ApiGet<ClientDropdownResponse>("/clients/all-id-name");

        if (!response || !response.success) {
            console.error("Failed to fetch clients for dropdown:", response);
            throw new Error("Failed to fetch clients for dropdown");
        }

        return response.data;
    } catch (error) {
        console.error("Error fetching clients for dropdown:", error);
        return []; // Return empty array as fallback
    }
}
