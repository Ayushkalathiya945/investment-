import bcrypt from "bcryptjs"; // Changed from bcrypt to bcryptjs to match your project
import { beforeAll, describe, expect, it } from "vitest";

import { admins } from "../db/schema";
import api from "../index";
import { testDb } from "./setup";

describe("authentication API", () => {
    beforeAll(async () => {
    // Ensure we have a test admin user with known credentials
        await testDb.delete(admins);
        const hashedPassword = await bcrypt.hash("testpassword", 10);
        await testDb.insert(admins).values({
            email: "testadmin@investasure.com",
            password: hashedPassword,
        });
    });

    it("should return 401 for invalid credentials", async () => {
    // Create a mock request for login with wrong password
        const req = new Request("http://localhost/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "testadmin@investasure.com",
                password: "wrongpassword",
            }),
        });

        const res = await api.fetch(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.message).toContain("Invalid username or password");
    });

    it("should login successfully with valid credentials", async () => {
    // Create a mock request for login with correct credentials
        const req = new Request("http://localhost/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "testadmin@investasure.com",
                password: "testpassword",
            }),
        });

        const res = await api.fetch(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("token");
        expect(data.data).toHaveProperty("admin");
        expect(data.data.admin.email).toBe("testadmin@investasure.com");
        expect(data.data.admin).not.toHaveProperty("password");

        // Save token for next test
        return data.data.token;
    });

    it("should reject requests to protected routes without token", async () => {
        const req = new Request("http://localhost/clients", {
            method: "GET",
        });

        const res = await api.fetch(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.message).toContain("Unauthorized");
    });

    it("should accept requests to protected routes with valid token", async () => {
    // First login to get a token
        const loginReq = new Request("http://localhost/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "testadmin@investasure.com",
                password: "testpassword",
            }),
        });

        const loginRes = await api.fetch(loginReq);
        const loginData = await loginRes.json();
        const token = loginData.data.token;

        // Now use that token to access a protected route
        const req = new Request("http://localhost/clients", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const res = await api.fetch(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });
});
