import { zValidator } from "@hono/zod-validator";
// Import sql for query conditions
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import * as clientQueries from "../db/queries/client";
import * as paymentQueries from "../db/queries/payment";
import { authMiddleware } from "../middleware/auth";
import { paymentFilterSchema, paymentSchema } from "../utils/validation-schemas";

// Create a new Hono router for payment routes
const paymentRouter = new Hono();

// Apply authentication middleware to all payment routes
paymentRouter.use("*", authMiddleware);

// Record new payment
paymentRouter.post("/create", zValidator("json", paymentSchema), async (c) => {
    const paymentData = c.req.valid("json");

    try {
        // Validate client exists
        const client = await clientQueries.findOne_Or({ id: paymentData.clientId });
        if (!client)
            throw new HTTPException(404, { message: "Client not found or inactive" });

        // Convert date string to timestamp
        const paymentDate = new Date(paymentData.paymentDate).getTime();

        // Insert payment into database
        const result = await paymentQueries.create({
            clientId: paymentData.clientId,
            amount: paymentData.amount,
            paymentDate: new Date(paymentDate),
            description: paymentData.description,
            notes: paymentData.notes,
        });

        return c.json({
            success: true,
            message: "Payment recorded successfully",
            data: result,
        }, 201);
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to record payment" });
    }
});

// Get all payments with filters
paymentRouter.post("/get-all", zValidator("json", paymentFilterSchema), async (c) => {
    const { page, limit, clientId, from, to } = c.req.valid("json");

    // Payment filters being used for the query

    try {
        const { payments, count } = await paymentQueries.findAllWithPagination({
            limit,
            page,
            clientId,
            from: from ? new Date(from).getTime() : undefined,
            to: to ? new Date(to).getTime() : undefined,
        });

        const totalPage = Math.ceil(count / limit);
        return c.json({
            success: true,
            data: payments,
            pagination: {
                total: count,
                hasNext: page < totalPage,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch payments" });
    }
});

// Export the router
export default paymentRouter;
