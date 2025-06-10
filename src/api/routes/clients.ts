import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import * as brokerageQueries from "@/api/db/queries/brokerage";
import * as clientQueries from "@/api/db/queries/client";
import * as paymentQueries from "@/api/db/queries/payment";
import * as tradeQueries from "@/api/db/queries/trade";
import { authMiddleware } from "@/api/middleware/auth";
import { clientFilterSchema, clientGetOneSchema, clientSchema, updateClientSchema } from "@/api/utils/validation-schemas";

// Create a new Hono router for client routes
const clientRouter = new Hono();

// Apply authentication middleware to all client routes
clientRouter.use("*", authMiddleware);

// Create new client
clientRouter.post("/create", zValidator("json", clientSchema), async (c) => {
    const clientData = c.req.valid("json");

    try {
        const existingClient = await clientQueries.findOne_Or({ email: clientData.email, mobile: clientData.mobile, pan: clientData.pan });
        if (existingClient) {
            throw new HTTPException(409, { message: "Email or Mobile or PAN already exists" });
        }

        // Insert client into database
        const client = await clientQueries.create({
            ...clientData,
            pan: clientData.pan.toUpperCase(),
        });

        return c.json({
            success: true,
            message: "Client created successfully",
            data: client,
        }, 201);
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.message?.includes("UNIQUE constraint failed")) {
            if (error.message.includes("email")) {
                throw new HTTPException(409, { message: "Email already exists" });
            } else if (error.message.includes("pan")) {
                throw new HTTPException(409, { message: "PAN number already exists" });
            } else if (error.message.includes("mobile")) {
                throw new HTTPException(409, { message: "Mobile number already exists" });
            }
        }
        throw new HTTPException(500, { message: "Failed to create client" });
    }
});

// Get all clients with pagination and search
clientRouter.post("/get-all", zValidator("json", clientFilterSchema), async (c) => {
    const { page, limit, search } = c.req.valid("json");

    try {
        const { clients, count } = await clientQueries.findAllWithPagination({ page, limit, search });

        const totalPage = Math.ceil(count / limit);

        return c.json({
            success: true,
            data: clients,
            metadata: {
                total: count,
                hasNext: page < totalPage,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch clients" });
    }
});

// Get client by ID
clientRouter.get("/get-one/:id", zValidator("param", clientGetOneSchema), async (c) => {
    const id = c.req.valid("param").id;

    try {
        const client = await clientQueries.findOne_And({ id });
        if (!client) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        // help me to calculate the total trade amount of particular client
        const totalTradeAmount = await tradeQueries.calculateTotalTradeAmount({ clientId: id });

        // help me to calculate the total brokerage amount of particular client
        const totalBrokerageAmount = await brokerageQueries.calculateTotalbrokerageAmount({ clientId: id });

        // help me to calculate the total payment amount of particular client
        const totalPaymentAmount = await paymentQueries.calculateTotalPaymentAmount({ clientId: id });

        return c.json({
            success: true,
            data: {
                ...client,
                totalTradeAmount,
                totalBrokerageAmount,
                totalPaymentAmount,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch client" });
    }
});

// Update client
clientRouter.put("/update", zValidator("json", updateClientSchema), async (c) => {
    const updateData = c.req.valid("json");

    try {
        // Check if client exists
        const existingClient = await clientQueries.findOne_And({ id: updateData.id });
        if (!existingClient) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        if (updateData.pan) {
            const existingPan = await clientQueries.findOne_Or({ pan: updateData.pan });
            if (existingPan && existingPan.id !== updateData.id) {
                throw new HTTPException(409, { message: "PAN already exists" });
            }
        }

        if (updateData.email) {
            const existingEmail = await clientQueries.findOne_Or({ email: updateData.email });
            if (existingEmail && existingEmail.id !== updateData.id) {
                throw new HTTPException(409, { message: "Email already exists" });
            }
        }

        if (updateData.mobile) {
            const existingMobile = await clientQueries.findOne_Or({ mobile: updateData.mobile });
            if (existingMobile && existingMobile.id !== updateData.id) {
                throw new HTTPException(409, { message: "Mobile already exists" });
            }
        }

        // Update client
        const result = await clientQueries.update({
            ...updateData,
            id: updateData.id,
        });

        return c.json({
            success: true,
            message: "Client updated successfully",
            data: result,
        });
    } catch (error: any) {
    // Handle unique constraint violations
        if (error.message?.includes("UNIQUE constraint failed")) {
            if (error.message.includes("email")) {
                throw new HTTPException(409, { message: "Email already exists" });
            } else if (error.message.includes("pan")) {
                throw new HTTPException(409, { message: "PAN number already exists" });
            } else if (error.message.includes("mobile")) {
                throw new HTTPException(409, { message: "Mobile number already exists" });
            }
        }
        throw new HTTPException(500, { message: "Failed to update client" });
    }
});

clientRouter.delete("/:id", zValidator("param", clientGetOneSchema), async (c) => {
    const id = c.req.valid("param").id;

    try {
        // Check if client exists
        const existingClient = await clientQueries.findOne_And({ id });
        if (!existingClient) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        // Delete client
        await clientQueries.remove(id);

        return c.json({
            success: true,
            message: "Client deleted successfully",
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to delete client" });
    }
});

clientRouter.post("/analytics", zValidator("json", clientFilterSchema), async (c) => {
    const body = c.req.valid("json");

    try {
        const startDate = body.startDate ? new Date(body.startDate).getTime() : undefined;
        const endDate = body.endDate ? new Date(body.endDate).getTime() : undefined;

        const totalClient = await clientQueries.calculateTotalClient({ from: startDate, to: endDate });
        const totalTradeAmount = await tradeQueries.calculateTotalTradeAmount({ from: startDate, to: endDate });
        const totalBrokerageAmount = await brokerageQueries.calculateTotalbrokerageAmount({ from: startDate, to: endDate });
        const totalPaymentAmount = await paymentQueries.calculateTotalPaymentAmount({ from: startDate, to: endDate });

        return c.json({
            success: true,
            data: {
                totalClient,
                totalTradeAmount,
                totalBrokerageAmount,
                totalPaymentAmount,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch client analytics" });
    }
});

export default clientRouter;
