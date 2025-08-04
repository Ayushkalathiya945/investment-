import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { Client } from "../db/schema";

import * as brokerageQueries from "../db/queries/brokerage";
import * as clientQueries from "../db/queries/client";
import * as paymentQueries from "../db/queries/payment";
import * as tradeQueries from "../db/queries/trade";
import { authMiddleware } from "../middleware/auth";
import { clientFilterSchema, clientGetOneSchema, clientSchema, updateClientSchema } from "../utils/validation-schemas";

const clientRouter = new Hono();

clientRouter.onError((err, c) => {
    console.error("Client route error:", err);

    if (err instanceof HTTPException) {
        const status = err.status || 500;
        const message = err.message || "An error occurred";

        return c.json({
            success: false,
            message,
            status,
        }, status);
    }

    return c.json({
        success: false,
        message: err.message || "Internal Server Error",
        status: 500,
    }, 500);
});

clientRouter.use("*", authMiddleware);

clientRouter.post("/create", zValidator("json", clientSchema), async (c) => {
    const clientData = c.req.valid("json");

    try {
        if (clientData.email) {
            const existingEmail = await clientQueries.findOne_Or({ email: clientData.email });
            if (existingEmail) {
                throw new HTTPException(409, { message: "Email already exists" });
            }
        }

        if (clientData.mobile) {
            const existingMobile = await clientQueries.findOne_Or({ mobile: clientData.mobile });
            if (existingMobile) {
                throw new HTTPException(409, { message: "Mobile number already exists" });
            }
        }

        if (clientData.pan) {
            const existingPan = await clientQueries.findOne_Or({ pan: clientData.pan });
            if (existingPan) {
                throw new HTTPException(409, { message: "PAN number already exists" });
            }
        }

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
        console.error("Error creating client:", error);

        if (error instanceof HTTPException) {
            throw error;
        }

        if (error.message?.includes("UNIQUE constraint failed")) {
            if (error.message.includes("email")) {
                return c.json({
                    success: false,
                    message: "Email already exists",
                    status: 409,
                }, 409);
            } else if (error.message.includes("pan")) {
                return c.json({
                    success: false,
                    message: "PAN number already exists",
                    status: 409,
                }, 409);
            } else if (error.message.includes("mobile")) {
                return c.json({
                    success: false,
                    message: "Mobile number already exists",
                    status: 409,
                }, 409);
            }

            return c.json({
                success: false,
                message: "A record with this information already exists",
                status: 409,
            }, 409);
        }

        console.error("Database or server error:", error);
        return c.json({
            success: false,
            message: `Failed to create client: ${error.message || "Unknown error"}`,
            status: 500,
        }, 500);
    }
});

clientRouter.post("/get-all", zValidator("json", clientFilterSchema), async (c) => {
    const { page, limit, search, from, to } = c.req.valid("json");

    try {
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (from) {
            fromDate = new Date(from);
        }

        if (to) {
            toDate = new Date(to);
        }

        const { clients, count } = await clientQueries.findAllWithPagination({
            page,
            limit,
            search,
            from: fromDate,
            to: toDate,
        });

        const totalPage = Math.ceil(count / limit);

        return c.json({
            success: true,
            data: clients,
            metadata: {
                total: count,
                hasNext: page < totalPage,
                totalPages: totalPage,
                currentPage: page,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch clients" });
    }
});

clientRouter.get("/get-one/:id", zValidator("param", clientGetOneSchema), async (c) => {
    const id = c.req.valid("param").id;

    try {
        const client: Client = await clientQueries.findOne_And({ id });
        if (!client) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        const totalNetAmount = client.currentHoldings;

        const totalBrokerageAmount = await brokerageQueries.calculateTotalbrokerageAmount({ clientId: id });

        const totalPaymentAmount = await paymentQueries.calculateTotalPaymentAmount({ clientId: id });

        const totalSoldAmount = await tradeQueries.calculateTotalSoldAmount({ clientId: id });

        const totalTradeAmount = await tradeQueries.currentHoldingAmount(id);

        const remainingPurseAmount = client.purseAmount + totalNetAmount;

        return c.json({
            success: true,
            data: {
                ...client,
                totalNetAmount,
                totalTradeAmount,
                totalBrokerageAmount,
                totalPaymentAmount,
                totalSoldAmount,
                remainingPurseAmount,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch client" });
    }
});

clientRouter.put("/update", zValidator("json", updateClientSchema), async (c) => {
    const updateData = c.req.valid("json");

    try {
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
        const existingClient = await clientQueries.findOne_And({ id });
        if (!existingClient) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        await clientQueries.remove(id);

        return c.json({
            success: true,
            message: "Client deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting client:", error);

        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to delete client" });
    }
});

clientRouter.post("/analytics", zValidator("json", clientFilterSchema), async (c) => {
    const body = c.req.valid("json");

    try {
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (body.from) {
            fromDate = new Date(body.from);
        }

        if (body.to) {
            toDate = new Date(body.to);
            toDate.setHours(23, 59, 59, 999);
        }

        const financialTotals = await clientQueries.calculateFinancialTotalsByDateRange({
            from: fromDate,
            to: toDate,
        });

        const totalBuyValue = financialTotals.totalBuyTrades || 0;
        const totalSellValue = financialTotals.totalSellTrades || 0;
        const totalInitialPurse = financialTotals.totalPurseAmount || 0;

        const remainingPurseAmount = totalInitialPurse - totalBuyValue + totalSellValue;

        const response = {
            success: true,
            data: {
                totalClient: financialTotals.totalClient,
                totalValue: financialTotals.totalPortfolioValue,
                totalPayment: financialTotals.totalPayments,
                totalFees: financialTotals.totalFees,
                remainingPurseAmount,
            },
            _debug: {
                request: body,
                financialTotals,
            },
        };

        return c.json(response);
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch client analytics" });
    }
});

clientRouter.get("/all-id-name", async (c) => {
    try {
        const clients = await clientQueries.getAllClientsIdAndName();
        return c.json({
            success: true,
            data: clients,
        });
    } catch (error) {
        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to fetch clients" });
    }
});

export default clientRouter;
