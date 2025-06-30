import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { env } from "node:process";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { admins, clients } from "../db/schema";
import api from "../index";
import { testDb } from "./setup";

// Create a server for testing
const server = createServer({
    port: 0,
    fetch: api.fetch,
});

describe("clients API", () => {
    let authToken: string;

    beforeAll(async () => {
    // Create test admin
        await testDb.delete(admins);
        const hashedPassword = await bcrypt.hash("testpassword", 10);
        await testDb.insert(admins).values({
            username: "testadmin",
            password: hashedPassword,
            email: "testadmin@investasure.com",
        });

        // Generate auth token
        const admin = await testDb.query.admins.findFirst({
            where: (admins, { eq }) => eq(admins.username, "testadmin"),
        });

        authToken = jwt.sign(
            { id: admin!.id, username: admin!.username },
            env.JWT_SECRET || "test-secret",
            { expiresIn: "1h" },
        );
    });

    beforeEach(async () => {
    // Clear clients table before each test
        await testDb.delete(clients);
    });

    it("should create a new client", async () => {
        const clientData = {
            name: "John Doe",
            email: "john@example.com",
            mobile: "9876543210",
            pan: "ABCDE1234F",
            address: "123 Main St",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            date_of_birth: "1990-01-01",
            kyc_verified: true,
        };

        const response = await request(server)
            .post("/clients")
            .set("Authorization", `Bearer ${authToken}`)
            .send(clientData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.name).toBe(clientData.name);
        expect(response.body.data.email).toBe(clientData.email);
        expect(response.body.data.pan).toBe(clientData.pan);
    });

    it("should reject client creation with invalid data", async () => {
        const invalidClientData = {
            name: "John Doe",
            email: "not-an-email",
            mobile: "123", // Too short
            pan: "INVALID",
            address: "123 Main St",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            date_of_birth: "1990-01-01",
        };

        const response = await request(server)
            .post("/clients")
            .set("Authorization", `Bearer ${authToken}`)
            .send(invalidClientData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
    });

    it("should get all clients", async () => {
    // Insert test clients
        await testDb.insert(clients).values([
            {
                name: "John Doe",
                email: "john@example.com",
                mobile: "9876543210",
                pan: "ABCDE1234F",
                address: "123 Main St",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                date_of_birth: Math.floor(new Date("1990-01-01").getTime() / 1000),
                kyc_verified: 1,
            },
            {
                name: "Jane Smith",
                email: "jane@example.com",
                mobile: "9876543211",
                pan: "PQRST5678G",
                address: "456 Park Ave",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
                date_of_birth: Math.floor(new Date("1985-05-15").getTime() / 1000),
                kyc_verified: 0,
            },
        ]);

        const response = await request(server)
            .get("/clients")
            .set("Authorization", `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.total).toBe(2);
    });

    it("should get a client by ID", async () => {
    // Insert test client
        const [client] = await testDb.insert(clients).values({
            name: "John Doe",
            email: "john@example.com",
            mobile: "9876543210",
            pan: "ABCDE1234F",
            address: "123 Main St",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            date_of_birth: Math.floor(new Date("1990-01-01").getTime() / 1000),
            kyc_verified: 1,
        }).returning();

        const response = await request(server)
            .get(`/clients/${client.id}`)
            .set("Authorization", `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(client.id);
        expect(response.body.data.name).toBe("John Doe");
        expect(response.body.data.email).toBe("john@example.com");
    });

    it("should update a client", async () => {
    // Insert test client
        const [client] = await testDb.insert(clients).values({
            name: "John Doe",
            email: "john@example.com",
            mobile: "9876543210",
            pan: "ABCDE1234F",
            address: "123 Main St",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            date_of_birth: Math.floor(new Date("1990-01-01").getTime() / 1000),
            kyc_verified: 1,
        }).returning();

        const updateData = {
            name: "John Smith",
            address: "456 New Address",
            city: "Bangalore",
        };

        const response = await request(server)
            .put(`/clients/${client.id}`)
            .set("Authorization", `Bearer ${authToken}`)
            .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe("John Smith");
        expect(response.body.data.address).toBe("456 New Address");
        expect(response.body.data.city).toBe("Bangalore");
        // Unchanged fields should remain the same
        expect(response.body.data.email).toBe("john@example.com");
        expect(response.body.data.pan).toBe("ABCDE1234F");
    });

    it("should soft delete a client", async () => {
    // Insert test client
        const [client] = await testDb.insert(clients).values({
            name: "John Doe",
            email: "john@example.com",
            mobile: "9876543210",
            pan: "ABCDE1234F",
            address: "123 Main St",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            date_of_birth: Math.floor(new Date("1990-01-01").getTime() / 1000),
            kyc_verified: 1,
        }).returning();

        const response = await request(server)
            .delete(`/clients/${client.id}`)
            .set("Authorization", `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify client is soft deleted
        const deletedClient = await testDb.query.clients.findFirst({
            where: (clients, { eq }) => eq(clients.id, client.id),
        });

        expect(deletedClient).toBeDefined();
        expect(deletedClient!.deleted_at).not.toBeNull();
    });

    it("should search clients by name or email", async () => {
    // Insert test clients
        await testDb.insert(clients).values([
            {
                name: "John Doe",
                email: "john@example.com",
                mobile: "9876543210",
                pan: "ABCDE1234F",
                address: "123 Main St",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                date_of_birth: Math.floor(new Date("1990-01-01").getTime() / 1000),
                kyc_verified: 1,
            },
            {
                name: "Jane Smith",
                email: "jane@example.com",
                mobile: "9876543211",
                pan: "PQRST5678G",
                address: "456 Park Ave",
                city: "Delhi",
                state: "Delhi",
                pincode: "110001",
                date_of_birth: Math.floor(new Date("1985-05-15").getTime() / 1000),
                kyc_verified: 0,
            },
        ]);

        // Search by name
        const nameResponse = await request(server)
            .get("/clients?search=John")
            .set("Authorization", `Bearer ${authToken}`);

        expect(nameResponse.status).toBe(200);
        expect(nameResponse.body.success).toBe(true);
        expect(nameResponse.body.data).toHaveLength(1);
        expect(nameResponse.body.data[0].name).toBe("John Doe");

        // Search by email
        const emailResponse = await request(server)
            .get("/clients?search=jane@example")
            .set("Authorization", `Bearer ${authToken}`);

        expect(emailResponse.status).toBe(200);
        expect(emailResponse.body.success).toBe(true);
        expect(emailResponse.body.data).toHaveLength(1);
        expect(emailResponse.body.data[0].name).toBe("Jane Smith");
    });
});
