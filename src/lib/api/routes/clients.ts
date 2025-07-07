import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import * as brokerageQueries from "../db/queries/brokerage";
import * as clientQueries from "../db/queries/client";
import * as paymentQueries from "../db/queries/payment";
import * as tradeQueries from "../db/queries/trade";
import { authMiddleware } from "../middleware/auth";
import { clientFilterSchema, clientGetOneSchema, clientSchema, updateClientSchema } from "../utils/validation-schemas";

// Create a new Hono router for client routes
const clientRouter = new Hono();

// Add a global error handler to properly format error responses
clientRouter.onError((err, c) => {
    console.error("Client route error:", err);

    // Format HTTP exceptions
    if (err instanceof HTTPException) {
        const status = err.status || 500;
        const message = err.message || "An error occurred";

        return c.json({
            success: false,
            message,
            status,
        }, status);
    }

    // Format other errors
    return c.json({
        success: false,
        message: err.message || "Internal Server Error",
        status: 500,
    }, 500);
});

// Apply authentication middleware to all client routes
clientRouter.use("*", authMiddleware);

// Create new client
clientRouter.post("/create", zValidator("json", clientSchema), async (c) => {
    const clientData = c.req.valid("json");

    // //console.log("Creating client with data:", clientData);

    try {
        // Check email, mobile, and PAN separately for more specific error messages
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

        // //console.log("No duplicate records found, proceeding with client creation");

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
        // Log the detailed error for debugging
        console.error("Error creating client:", error);
        // console.error("Error stack:", error.stack);

        // If it's already an HTTP exception (like our 409 conflicts), pass it through
        if (error instanceof HTTPException) {
            // The onError handler will format this properly
            throw error;
        }

        // Handle unique constraint violations from database (as a backup if our checks miss something)
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
            // Generic unique constraint violation
            return c.json({
                success: false,
                message: "A record with this information already exists",
                status: 409,
            }, 409);
        }

        // For other database or server errors
        console.error("Database or server error:", error);
        return c.json({
            success: false,
            message: `Failed to create client: ${error.message || "Unknown error"}`,
            status: 500,
        }, 500);
    }
});

// Get all clients with pagination and search
clientRouter.post("/get-all", zValidator("json", clientFilterSchema), async (c) => {
    const { page, limit, search, from, to } = c.req.valid("json");

    try {
        // Parse dates if provided
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

// Get client by ID
clientRouter.get("/get-one/:id", zValidator("param", clientGetOneSchema), async (c) => {
    const id = c.req.valid("param").id;

    try {
        const client = await clientQueries.findOne_And({ id });
        if (!client) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        // Calculate the total trade amount of particular client
        const totalTradeAmount = await tradeQueries.calculateTotalTradeAmount({ clientId: id });

        // Calculate the total brokerage amount of particular client
        const totalBrokerageAmount = await brokerageQueries.calculateTotalbrokerageAmount({ clientId: id });

        // Calculate the total payment amount of particular client
        const totalPaymentAmount = await paymentQueries.calculateTotalPaymentAmount({ clientId: id });

        // Calculate the total sold stock amount for this client
        const totalSoldAmount = await tradeQueries.calculateTotalSoldAmount({ clientId: id });

        // Calculate remaining purse amount (initial purse - buy trades + sell trades)
        const remainingPurseAmount = client.purseAmount - totalTradeAmount + totalSoldAmount;

        return c.json({
            success: true,
            data: {
                ...client,
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
        console.error("Error deleting client:", error);

        if (error instanceof HTTPException)
            throw error;
        throw new HTTPException(500, { message: "Failed to delete client" });
    }
});

clientRouter.post("/analytics", zValidator("json", clientFilterSchema), async (c) => {
    const body = c.req.valid("json");

    try {
        // Convert date strings to timestamps if provided
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (body.from) {
            fromDate = new Date(body.from);
        }

        if (body.to) {
            toDate = new Date(body.to);
            // Set to end of day for the "to" date
            toDate.setHours(23, 59, 59, 999);
        }

        // Get all financial totals from our comprehensive self-contained function
        const financialTotals = await clientQueries.calculateFinancialTotalsByDateRange({
            from: fromDate,
            to: toDate,
        });

        // Calculate remaining purse amount (considering only trades, not payments or brokerage)
        // When a date range is selected, we're calculating the purse amount as of the end date
        const totalBuyValue = financialTotals.totalBuyTrades || 0; // Total cost of ALL buy trades up to end date
        const totalSellValue = financialTotals.totalSellTrades || 0; // Total revenue from ALL sell trades up to end date
        const totalInitialPurse = financialTotals.totalPurseAmount || 0; // Total initial purse amount

        // Formula: Initial Purse - All Buy Trades + All Sell Trades (up to end date)
        const remainingPurseAmount = totalInitialPurse - totalBuyValue + totalSellValue;

        const response = {
            success: true,
            data: {
                totalClient: financialTotals.totalClient,
                totalValue: financialTotals.totalPortfolioValue,
                totalPayment: financialTotals.totalPayments,
                totalBrokerage: financialTotals.totalBrokerage,
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

// Get all clients ID and name for dropdowns
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
