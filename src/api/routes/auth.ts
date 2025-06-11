import { zValidator } from "@hono/zod-validator";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import * as adminQueries from "@/api/db/queries/admin";
import { generateToken, hashPassword } from "@/api/utils";
import { loginSchema, registerSchema } from "@/api/utils/validation-schemas";
import env from "@/env";

// Create a new Hono router for authentication routes
const authRouter = new Hono();

// Login route
authRouter.post("/login", zValidator("json", loginSchema), async (c) => {
    const { username, password } = c.req.valid("json");

    try {
        // Find admin by username
        const admin = await adminQueries.findOne({ username });
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
            lastLogin: Math.floor(Date.now() / 1000),
        });

        const token = generateToken({
            id: admin.id,
            username: admin.username,
        });

        // Return token and admin info
        return c.json({
            success: true,
            message: "Login successful",
            data: {
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
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
    const { username, password, adminPassword } = c.req.valid("json");

    try {
        if (adminPassword !== env.ADMIN_PASSWORD) {
            throw new HTTPException(401, { message: "Invalid admin password" });
        }

        // Find admin by username
        const existingAdmin = await adminQueries.findOne({ username });
        if (existingAdmin) {
            throw new HTTPException(409, { message: "Admin already exists" });
        }

        const hashedPassword = await hashPassword(password);

        // Update last login timestamp
        const newAdmin = await adminQueries.create({
            username,
            password: hashedPassword,
        });

        // Return token and admin info
        return c.json({
            success: true,
            message: "Admin registered successfully",
            data: {
                admin: {
                    id: newAdmin.id,
                    username: newAdmin.username,
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

// Export the router
export default authRouter;
