"use client";

import type { ReactNode } from "react";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { checkAuth } from "@/api/auth";

type AuthGuardProps = {
    children: ReactNode;
};

/**
 * AuthGuard component protects routes by verifying authentication
 * Use this in layout files for protected routes
 */
function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        async function verifyAuth() {
            try {
                setIsLoading(true);
                const authStatus = await checkAuth();

                if (!authStatus) {
                    router.replace("/auth"); // Redirect to login if not authenticated
                    return;
                }

                setIsAuthenticated(true);
            } catch (error) {
                console.error("Auth verification failed:", error);
                router.replace("/auth");
            } finally {
                setIsLoading(false);
            }
        }

        verifyAuth();
    }, [router]);

    // Show loading state
    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Render children only if authenticated
    return isAuthenticated ? <>{children}</> : null;
}

export default AuthGuard;
