import { zValidator } from "@hono/zod-validator";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import jwt from "jsonwebtoken";

import env from "@/env";

import * as adminQueries from "../db/queries/admin";
import { generateToken, hashPassword } from "../utils";
import { loginSchema, registerSchema, verifyTokenSchema } from "../utils/validation-schemas";

// Interface for JWT payload
type JWTPayload = {
    id: number;
    email: string;
    iat: number;
    exp: number;
};

// Create a new Hono router for authentication routes
const authRouter = new Hono();

// Login route
authRouter.post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");

    try {
        // Find admin by username
        const admin = await adminQueries.findOne({ email });
        if (!admin) {
            throw new HTTPException(401, { message: "Invalid username or password" });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            throw new HTTPException(401, { message: "Invalid username or password" });
        }

        // Update last login timestamp
        await adminQueries.update({
            id: admin.id,
            lastLogin: Date.now(),
        });

        const token = generateToken({
            id: admin.id,
            email: admin.email,
        });

        // Return token and admin info
        return c.json({
            success: true,
            message: "Login successful",
            data: {
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                },
            },
        });
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        throw new HTTPException(500, { message: "Internal server error during login" });
    }
});

authRouter.post("/register", zValidator("json", registerSchema), async (c) => {
    const { email, password, adminPassword } = c.req.valid("json");

    try {
        if (adminPassword !== env.ADMIN_PASSWORD) {
            throw new HTTPException(401, { message: "Invalid admin password" });
        }

        // Find admin by username
        const existingAdmin = await adminQueries.findOne({ email });
        if (existingAdmin) {
            throw new HTTPException(409, { message: "Admin already exists" });
        }

        const hashedPassword = await hashPassword(password);

        // Update last login timestamp
        const newAdmin = await adminQueries.create({
            email,
            password: hashedPassword,
        });

        // Return token and admin info
        return c.json({
            success: true,
            message: "Admin registered successfully",
            data: {
                admin: {
                    id: newAdmin.id,
                    email: newAdmin.email,
                },
            },
        });
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        throw new HTTPException(500, { message: "Internal server error during registration" });
    }
});

// verify token route
authRouter.post("/verify-token", zValidator("json", verifyTokenSchema), async (c) => {
    try {
        let { token } = c.req.valid("json") as { token: string };

        if (!token) {
            throw new HTTPException(401, { message: "No token provided" });
        }

        // Remove prefix "Bearer "
        if (token.startsWith("Bearer ")) {
            token = token.slice(7);
        }

        // Verify token
        const jwtSecret = env.JWT_SECRET;
        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

        // Find admin by username to ensure it still exists
        const admin = await adminQueries.findOne({ email: decoded.email });
        if (!admin) {
            throw new HTTPException(401, { message: "Invalid token: User not found" });
        }

        return c.json({
            success: true,
            message: "Token is valid",
            data: {
                admin: {
                    id: decoded.id,
                    email: decoded.email,
                },
                tokenExpiry: new Date(decoded.exp * 1000).toISOString(),
            },
        });
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return c.json({
                success: false,
                message: "Invalid token",
                error: "token_invalid",
            }, 401);
        } else if (error instanceof jwt.TokenExpiredError) {
            return c.json({
                success: false,
                message: "Token expired",
                error: "token_expired",
            }, 401);
        } else if (error instanceof HTTPException) {
            throw error;
        } else {
            console.error("Token verification error:", error);
            throw new HTTPException(500, { message: "Internal server error during token verification" });
        }
    }
});

// Export the router
export default authRouter;
