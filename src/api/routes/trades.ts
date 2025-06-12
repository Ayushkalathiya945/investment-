import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import * as clientQueries from "@/api/db/queries/client";
import * as stockQueries from "@/api/db/queries/stock";
import * as tradeQueries from "@/api/db/queries/trade";
import { authMiddleware } from "@/api/middleware/auth";
import { tradeFilterSchema, tradeGetOneSchema, tradeSchema, updateTradeSchema } from "@/api/utils/validation-schemas";

// Create a new Hono router for trade routes
const tradeRouter = new Hono();

// Apply authentication middleware to all trade routes
tradeRouter.use("*", authMiddleware);

// Create new trade
tradeRouter.post("/create", zValidator("json", tradeSchema), async (c) => {
    const tradeData = c.req.valid("json");

    try {
        // Validate client exists
        const client = await clientQueries.findOne_Or({ id: tradeData.clientId });
        if (!client)
            throw new HTTPException(404, { message: "Client not found or inactive" });

        // Validate stock exists
        const stock = await stockQueries.findOne({ id: tradeData.stockId });
        if (!stock) {
            throw new HTTPException(404, { message: "Stock not found or inactive" });
        }

        // Calculate net amount
        const tradeValue = tradeData.quantity * tradeData.price;

        // Convert date strings to timestamps
        const tradeDate = new Date(tradeData.tradeDate).getTime();

        // Insert trade into database
        const result = await tradeQueries.create({
            clientId: tradeData.clientId,
            stockId: tradeData.stockId,
            type: tradeData.type,
            quantity: tradeData.quantity,
            price: tradeData.price,
            tradeDate,
            netAmount: tradeValue,
            notes: tradeData.notes,
        });

        return c.json({
            success: true,
            message: "Trade created successfully",
            data: result,
        }, 201);
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to create trade" });
    }
});

// Get all trades with filters
tradeRouter.post("/get-all", zValidator("json", tradeFilterSchema), async (c) => {
    const { page, limit, clientId, stockId, type, startDate, endDate } = c.req.valid("json");

    try {
        const { trades, count } = await tradeQueries.findAllWithPagination({
            limit,
            page,
            clientId,
            stockId,
            from: startDate ? new Date(startDate).getTime() : undefined,
            to: endDate ? new Date(endDate).getTime() : undefined,
            type,
        });

        const totalPage = Math.ceil(count / limit);
        return c.json({
            success: true,
            data: trades,
            metadata: {
                total: count,
                hasNext: page < totalPage,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch trades" });
    }
});

// Get trade by ID
tradeRouter.get("/get-one/:id", zValidator("param", tradeGetOneSchema), async (c) => {
    const id = c.req.valid("param").id;

    try {
        const trade = await tradeQueries.findOneWithRelations({ id });
        if (!trade)
            throw new HTTPException(404, { message: "Trade not found" });

        return c.json({
            success: true,
            data: trade,
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch trade" });
    }
});

// Update trade
tradeRouter.put("/update", zValidator("json", updateTradeSchema), async (c) => {
    const updateData = c.req.valid("json");

    try {
        // Check if trade exists
        const existingTrade = await tradeQueries.findOne({ id: updateData.id });
        if (!existingTrade)
            throw new HTTPException(404, { message: "Trade not found" });

        let netAmount = existingTrade.netAmount;
        if (updateData.quantity) {
            netAmount = updateData.quantity * existingTrade.price;
        }

        // Update trade
        const result = await tradeQueries.update({
            id: updateData.id,
            clientId: updateData.clientId,
            stockId: updateData.stockId,
            type: updateData.type,
            quantity: updateData.quantity,
            price: updateData.price,
            tradeDate: updateData.tradeDate ? new Date(updateData.tradeDate).getTime() : undefined,
            netAmount,
            notes: updateData.notes,
        });

        return c.json({
            success: true,
            message: "Trade updated successfully",
            data: result,
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to update trade" });
    }
});

// Delete trade
tradeRouter.delete("/delete/:id", zValidator("param", tradeGetOneSchema), async (c) => {
    const id = c.req.valid("param").id;

    try {
        // Check if trade exists
        const existingTrade = await tradeQueries.findOne({ id });
        if (!existingTrade)
            throw new HTTPException(404, { message: "Trade not found" });

        // Delete trade
        await tradeQueries.remove(id);

        return c.json({
            success: true,
            message: "Trade deleted successfully",
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to delete trade" });
    }
});

// Export the router
export default tradeRouter;
