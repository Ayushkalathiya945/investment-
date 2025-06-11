import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import jwt from "jsonwebtoken";

import env from "@/env";

// Interface for JWT payload
type JWTPayload = {
    id: number;
    username: string;
    iat: number;
    exp: number;
};

// Authentication middleware for protected routes
export async function authMiddleware(c: Context, next: () => Promise<void>) {
    try {
    // Get authorization header
        const authHeader = c.req.header("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new HTTPException(401, { message: "Unauthorized: No token provided" });
        }

        // Extract token from header
        const token = authHeader.split(" ")[1];

        if (!token) {
            throw new HTTPException(401, { message: "Unauthorized: Invalid token format" });
        }

        // Verify token
        const jwtSecret = env.JWT_SECRET;
        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

        // Add admin data to context for use in route handlers
        c.set("admin", {
            id: decoded.id,
            username: decoded.username,
        });

        // Continue to next middleware or route handler
        await next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw new HTTPException(401, { message: "Unauthorized: Invalid token" });
        } else if (error instanceof jwt.TokenExpiredError) {
            throw new HTTPException(401, { message: "Unauthorized: Token expired" });
        } else if (error instanceof HTTPException) {
            throw error;
        } else {
            throw new HTTPException(500, { message: "Internal server error during authentication" });
        }
    }
}
