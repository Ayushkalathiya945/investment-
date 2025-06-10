import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { db } from "../db";
import { brokerage, clients } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { BrokerageCalculator } from "../services/brokerage-calculator";
import { brokerageCalculationSchema, bulkBrokerageCalculationSchema } from "../utils/validation-schemas";

// Create a new Hono router for brokerage routes
const brokerageRouter = new Hono();

// Apply authentication middleware to all brokerage routes
brokerageRouter.use("*", authMiddleware);

// Calculate monthly brokerage for a client
brokerageRouter.post("/calculate/:clientId/:month/:year", async (c) => {
    const clientId = Number.parseInt(c.req.param("clientId"), 10);
    const month = Number.parseInt(c.req.param("month"), 10);
    const year = Number.parseInt(c.req.param("year"), 10);

    if (isNaN(clientId) || isNaN(month) || isNaN(year)) {
        throw new HTTPException(400, { message: "Invalid parameters" });
    }

    try {
    // Check if client exists
        const client = await db.select({ id: clients.id })
            .from(clients)
            .where(and(
                eq(clients.id, clientId),
                isNull(clients.deleted_at),
                eq(clients.active, 1),
            ))
            .limit(1);

        if (!client.length) {
            throw new HTTPException(404, { message: "Client not found or inactive" });
        }

        // Calculate brokerage
        const calculation = await BrokerageCalculator.calculateMonthlyBrokerage(clientId, month, year);

        return c.json({
            success: true,
            message: "Brokerage calculated successfully",
            data: calculation,
        });
    } catch (error: any) {
        if (error instanceof HTTPException)
            throw error;
        if (error.message === "No trades found for the specified month") {
            throw new HTTPException(404, { message: error.message });
        }
        throw new HTTPException(500, { message: "Failed to calculate brokerage" });
    }
});

// Calculate brokerage for all clients for a month
brokerageRouter.post("/bulk-calculate", validateRequest(bulkBrokerageCalculationSchema), async (c) => {
    const { month, year } = c.get("validatedBody");

    try {
    // Calculate brokerage for all clients
        const calculationsCount = await BrokerageCalculator.calculateBulkBrokerage(month, year);

        return c.json({
            success: true,
            message: `Brokerage calculated for ${calculationsCount} clients`,
            data: { calculationsCount },
        });
    } catch (error) {
        throw new HTTPException(500, { message: "Failed to calculate bulk brokerage" });
    }
});

// Get client's brokerage history
brokerageRouter.get("/client/:clientId", async (c) => {
    const clientId = Number.parseInt(c.req.param("clientId"), 10);

    if (isNaN(clientId)) {
        throw new HTTPException(400, { message: "Invalid client ID" });
    }

    try {
    // Check if client exists
        const client = await db.select({ id: clients.id })
            .from(clients)
            .where(and(
                eq(clients.id, clientId),
                isNull(clients.deleted_at),
            ))
            .limit(1);

        if (!client.length) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        // Get client's brokerage history
        const brokerageHistory = await db.select()
            .from(brokerage)
            .where(eq(brokerage.client_id, clientId))
            .orderBy(brokerage.year, brokerage.month);

        return c.json({
            success: true,
            data: brokerageHistory,
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch brokerage history" });
    }
});

// Get all outstanding brokerage
brokerageRouter.get("/outstanding", async (c) => {
    try {
    // Get outstanding brokerage calculations
        const outstandingBrokerage = await BrokerageCalculator.getOutstandingBrokerage();

        // Get client details for each calculation
        const result = await Promise.all(
            outstandingBrokerage.map(async (calculation) => {
                const client = await db.query.clients.findFirst({
                    where: eq(clients.id, calculation.client_id),
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true,
                        pan: true,
                    },
                });

                return {
                    ...calculation,
                    client,
                };
            }),
        );

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        throw new HTTPException(500, { message: "Failed to fetch outstanding brokerage" });
    }
});

// Mark brokerage calculation as paid
brokerageRouter.post("/mark-paid/:id", async (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);

    if (isNaN(id)) {
        throw new HTTPException(400, { message: "Invalid brokerage calculation ID" });
    }

    try {
    // Mark as paid
        const updatedCalculation = await BrokerageCalculator.markAsPaid(id);

        return c.json({
            success: true,
            message: "Brokerage marked as paid",
            data: updatedCalculation,
        });
    } catch (error: any) {
        if (error.message === "Brokerage calculation not found") {
            throw new HTTPException(404, { message: error.message });
        }
        throw new HTTPException(500, { message: "Failed to mark brokerage as paid" });
    }
});

// Export the router
export default brokerageRouter;
