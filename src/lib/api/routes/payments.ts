import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import * as clientQueries from "../db/queries/client";
import * as paymentQueries from "../db/queries/payment";
import { authMiddleware } from "../middleware/auth";
import { paymentFilterSchema, paymentSchema } from "../utils/validation-schemas";

const paymentRouter = new Hono();

paymentRouter.use("*", authMiddleware);

paymentRouter.post("/create", zValidator("json", paymentSchema), async (c) => {
    const paymentData = c.req.valid("json");

    try {
        const client = await clientQueries.findOne_Or({ id: paymentData.clientId });
        if (!client)
            throw new HTTPException(404, { message: "Client not found or inactive" });

        const paymentDate = new Date(paymentData.paymentDate).getTime();

        const result = await paymentQueries.create({
            clientId: paymentData.clientId,
            amount: paymentData.amount,
            paymentDate: new Date(paymentDate),
            description: paymentData.description,
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

paymentRouter.put("/update/:id", zValidator("param", z.object({ id: z.string() })), zValidator("json", paymentSchema), async (c) => {
    const { id } = c.req.valid("param");
    const paymentData = c.req.valid("json");

    try {
        const client = await clientQueries.findOne_Or({ id: paymentData.clientId });
        if (!client)
            throw new HTTPException(404, { message: "Client not found or inactive" });

        const paymentDate = new Date(paymentData.paymentDate).getTime();

        const result = await paymentQueries.update({
            id: Number(id),
            clientId: paymentData.clientId,
            amount: paymentData.amount,
            paymentDate: new Date(paymentDate),
            description: paymentData.description,
        });

        return c.json({
            success: true,
            message: "Payment updated successfully",
            data: result,
        }, 201);
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to update payment" });
    }
});

paymentRouter.get("/get/:id", zValidator("param", z.object({ id: z.string() })), async (c) => {
    const { id } = c.req.valid("param");

    try {
        const payment = await paymentQueries.findOne({ id: Number(id) });
        if (!payment)
            throw new HTTPException(404, { message: "Payment not found" });

        return c.json({
            success: true,
            data: payment,
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch payment" });
    }
});

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

export default paymentRouter;
