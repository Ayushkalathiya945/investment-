import type {
    AdminLogin,
    LoginData,
    LoginResponse,
    VerifyTokenData,
    VerifyTokenRequest,
    VerifyTokenResponse,
} from "@/types/auth.types";

import { ApiPost } from "./api-helper";

export async function Adminlogin(data: AdminLogin): Promise<LoginData> {
    const response = await ApiPost<LoginResponse>("/auth/login", data, {}, false);

    if (!response || !response.success) {
        throw new Error(response?.message || "Login failed");
    }

    return response.data;
}

export async function verifyToken(token: string): Promise<VerifyTokenData> {
    const data: VerifyTokenRequest = { token };
    const response = await ApiPost<VerifyTokenResponse>("/auth/verify-token", data, {}, false);

    if (!response || !response.success) {
        throw new Error(response?.message || "Token verification failed");
    }

    return response.data!;
}

export async function checkAuth(): Promise<boolean> {
    try {
        // Check if localStorage is available (client-side only)
        if (typeof window === "undefined")
            return false;

        const token = localStorage.getItem("token");
        if (!token)
            return false;

        await verifyToken(token);
        return true;
    } catch (error) {
        console.error("Authentication check failed:", error);
        // Clear invalid tokens
        if (typeof window !== "undefined") {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
        }
        return false;
    }
}
