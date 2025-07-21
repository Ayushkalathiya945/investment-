import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { TransactionType } from "../db";
import type { ExchangeType, NewFifoAllocation, NewTrade, Trade } from "../db/schema";

import { getDB } from "../db";
import * as clientQueries from "../db/queries/client";
import * as fifoQueries from "../db/queries/fifoAllocation";
import * as stockQueries from "../db/queries/stock";
import * as tradeQueries from "../db/queries/trade";
import { TradeType } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { tradeFilterSchema, tradeGetOneSchema, tradeSchema, updateTradeSchema } from "../utils/validation-schemas";

type FifoProcessingResult = {
    allocations: NewFifoAllocation[];
    updatedBuyTrades: Array<{ tradeId: number; remainingQuantity: number; isFullySold: boolean }>;
    totalPnl: number;
};

// Create a new Hono router for trade routes
const tradeRouter = new Hono();

// Apply authentication middleware to all trade routes
tradeRouter.use("*", authMiddleware);

/**
 * Process a BUY trade
 * For BUY trades, we just need to ensure the trade has the correct FIFO tracking fields
 */
async function processBuyTrade(
    _trade: Trade,
    _tx?: TransactionType,
): Promise<void> {
    // Nothing additional to do for BUY trades
    // The trade record already has originalQuantity and remainingQuantity set
    // These will be used when processing SELL trades
}

/**
 * Process a SELL trade using FIFO method to determine which lots to sell from
 */
async function processSellTrade(
    sellTrade: Trade,
    tx?: TransactionType,
): Promise<FifoProcessingResult> {
    const { clientId, symbol, exchange, quantity, price, tradeDate, id: sellTradeId } = sellTrade;

    // Convert the tradeDate to timestamp
    // console.log("tradeDate type and value:", typeof tradeDate, tradeDate);

    // Ensure tradeDate is a Date object before calling getTime()
    let tradeTimestamp: number;
    if (tradeDate instanceof Date) {
        // console.log("tradeDate is a Date object");
        tradeTimestamp = tradeDate.getTime();
        // console.log("tradeTimestamp is:", tradeTimestamp);
    } else if (typeof tradeDate === "number") {
        // console.log("tradeDate is a number");
        // If it's already a timestamp
        tradeTimestamp = tradeDate;
        // console.log("tradeTimestamp is:", tradeTimestamp);
    } else if (typeof tradeDate === "string") {
        // If it's a string, parse it to Date first
        const parsedDate = new Date(tradeDate);
        if (Number.isNaN(parsedDate.getTime())) {
            throw new HTTPException(400, { message: "Invalid trade date format" });
        }
        tradeTimestamp = parsedDate.getTime();
    } else {
        throw new HTTPException(400, { message: "Invalid trade date type" });
    }

    // console.log("tradeTimestamp is: after", tradeTimestamp);

    if (tradeTimestamp === null || Number.isNaN(tradeTimestamp)) {
        // console.log("tradeTimestamp is null or NaN");
        throw new HTTPException(400, { message: "Invalid trade date" });
    }

    // console.log("before findBuyTradesWithRemainingQuantity");

    // Find all unsold BUY trades for this client/stock, ordered by oldest first (FIFO)
    const availableBuyTrades = await tradeQueries.findBuyTradesWithRemainingQuantity(
        {
            clientId,
            symbol,
            exchange,
            tradeDate: tradeTimestamp,
        },
        tx,
    );

    // console.log("Available buy trades:", availableBuyTrades.length);
    // if (availableBuyTrades.length > 0) {
    //     console.log("First buy trade tradeDate type and value:", typeof availableBuyTrades[0].tradeDate, availableBuyTrades[0].tradeDate);
    // }

    // console.log("Available BUY trades:", availableBuyTrades);

    // Check if we have enough shares across all BUY trades
    const totalAvailableShares = availableBuyTrades.reduce(
        (sum: number, trade: { remainingQuantity: number }) => sum + trade.remainingQuantity,
        0,
    );

    // console.log("Total available shares:", totalAvailableShares);

    if (totalAvailableShares < quantity) {
        throw new HTTPException(400, {
            message: `Insufficient shares to sell. You have ${totalAvailableShares} ${symbol} shares available, but attempting to sell ${quantity} shares.`,
        });
    }

    let remainingToSell = quantity;
    const allocations: NewFifoAllocation[] = [];
    const updatedBuyTrades: Array<{ tradeId: number; remainingQuantity: number; isFullySold: boolean }> = [];
    let totalPnl = 0;

    // Sort trades by oldest purchase date first (FIFO)
    // Ensure we're comparing numbers for the sort
    const sortedBuyTrades = [...availableBuyTrades].sort((a, b) => {
        const aDate = Number(a.tradeDate);
        const bDate = Number(b.tradeDate);
        return aDate - bDate;
    });

    // Consume from buy trades until we've sold all requested shares
    for (const buyTrade of sortedBuyTrades) {
        if (remainingToSell <= 0)
            break;

        const buyTradeId = buyTrade.id;
        const remainingQty = buyTrade.remainingQuantity;

        // Determine how many shares to sell from this trade
        const qtyToSell = Math.min(remainingToSell, remainingQty);

        // Calculate values
        const buyValue = qtyToSell * buyTrade.price;
        const sellValue = qtyToSell * price;
        const profitLoss = sellValue - buyValue;
        // Calculate holding days - both dates should be timestamps
        // buyTrade.tradeDate is already a timestamp from SQLite
        const sellTimestamp = tradeTimestamp;
        const holdingDays = Math.floor((sellTimestamp - buyTrade.tradeDate) / (1000 * 60 * 60 * 24));

        // Update remainingQuantity on the buy trade
        const newRemainingQty = remainingQty - qtyToSell;
        const isFullySold = newRemainingQty === 0;

        // Track the updates to be made
        updatedBuyTrades.push({
            tradeId: buyTradeId,
            remainingQuantity: newRemainingQty,
            isFullySold,
        });

        // Create FIFO allocation record
        // For SQLite storage with timestamp mode, we need to pass Date objects
        const fifoAllocation: NewFifoAllocation = {
            sellTradeId,
            buyTradeId,
            clientId,
            symbol,
            exchange: exchange as ExchangeType,
            quantityAllocated: qtyToSell,
            buyPrice: buyTrade.price,
            sellPrice: price,
            buyDate: buyTrade.tradeDate instanceof Date ? buyTrade.tradeDate : new Date(buyTrade.tradeDate),
            sellDate: new Date(tradeTimestamp),
            buyValue,
            sellValue,
            profitLoss,
            holdingDays,
            createdAt: new Date(),
        };

        allocations.push(fifoAllocation);
        totalPnl += profitLoss;

        // Update remaining shares to sell
        remainingToSell -= qtyToSell;
    }

    if (remainingToSell > 0) {
        // This shouldn't happen if we validated correctly earlier
        throw new HTTPException(500, { message: "Failed to process all sell quantities" });
    }

    // Apply the updates to the buy trades and create the FIFO allocations
    for (const update of updatedBuyTrades) {
        await tradeQueries.update({
            id: update.tradeId,
            remainingQuantity: update.remainingQuantity,
            isFullySold: update.isFullySold ? 1 : 0,
        }, tx);
    }

    for (const allocation of allocations) {
        await fifoQueries.create(allocation, tx);
    }

    // Mark the sell trade as processed
    await tradeQueries.update({
        id: sellTradeId,
        sellProcessed: 1,
    }, tx);

    return {
        allocations,
        updatedBuyTrades,
        totalPnl,
    };
}

/**
 * Create new trade
 */
tradeRouter.post("/create", zValidator("json", tradeSchema), async (c) => {
    const tradeData = c.req.valid("json") as {
        clientId: number;
        symbol: string;
        type: TradeType;
        quantity: number;
        price: number;
        tradeDate: string;
        exchange: ExchangeType;
        notes?: string;
    };

    // console.log("Creating trade with data:", tradeData);

    try {
        // Validate client exists
        const client = await clientQueries.findOne_Or({ id: tradeData.clientId });
        if (!client) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        // Validate stock exists
        const stock = await stockQueries.findOne({ symbol: tradeData.symbol, exchange: tradeData.exchange });
        if (!stock) {
            throw new HTTPException(404, { message: "Stock not found" });
        }

        // Calculate net amount
        const tradeValue = tradeData.quantity * tradeData.price;

        // Convert date string to Date object
        let parsedTradeDate: Date;
        try {
            parsedTradeDate = new Date(tradeData.tradeDate);
            if (Number.isNaN(parsedTradeDate.getTime())) {
                console.error("Invalid trade date format:", tradeData.tradeDate);
                throw new Error("Invalid date");
            }
        } catch (e) {
            console.error("Date parsing error:", e, "Input:", tradeData.tradeDate);
            throw new HTTPException(400, { message: "Invalid trade date format" });
        }

        // Use a transaction for all database operations to ensure consistency
        const db = getDB();
        return await db.transaction(async (tx: TransactionType) => {
            // Create trade record first with proper FIFO tracking fields
            const tradeData2Create: NewTrade = {
                clientId: tradeData.clientId,
                symbol: tradeData.symbol,
                type: tradeData.type,
                exchange: tradeData.exchange,
                quantity: tradeData.quantity,
                price: tradeData.price,
                tradeDate: parsedTradeDate, // Use the already parsed Date object
                netAmount: tradeValue,
                notes: tradeData.notes || null,
                // FIFO tracking fields
                originalQuantity: tradeData.type === TradeType.BUY ? tradeData.quantity : 0,
                remainingQuantity: tradeData.type === TradeType.BUY ? tradeData.quantity : 0,
                isFullySold: 0,
                sellProcessed: tradeData.type === TradeType.SELL ? 0 : 1,
            };

            // console.log("Creating trade with data:", tradeData2Create);

            const trade = await tradeQueries.create(
                tradeData2Create,
                tx,
            );

            if (!trade) {
                throw new HTTPException(500, { message: "Failed to create trade" });
            }

            // Process trade based on type
            if (tradeData.type === TradeType.BUY) {
                // For BUY trades, the FIFO fields are already set
                await processBuyTrade(trade, tx);
            } else if (tradeData.type === TradeType.SELL) {
                // console.log("Processing sell trade with data:", tradeData);
                // Process sell trade - create FIFO allocations
                await processSellTrade(trade, tx);
            }

            return c.json({
                success: true,
                message: "Trade created successfully",
                data: trade,
            }, 201);
        });
    } catch (error: any) {
        console.error("Trade creation error:", error);

        // Get specific error message
        let errorMessage = "Failed to create trade. Please check your data and try again.";
        let _errorStatus = 500;

        // If it's an HTTPException, extract the message and status
        if (error instanceof HTTPException) {
            errorMessage = error.message || errorMessage;
            _errorStatus = error.status;
        } else if (error && typeof error === "object" && error.message) { // Handle non-HTTPException errors with message property
            errorMessage = error.message;

            // Extract specific error messages we want to show directly to users
            if (error.message.includes("Insufficient shares")) {
                errorMessage = error.message;
                _errorStatus = 400;
            } else if (error.message.includes("Stock not found")) {
                errorMessage = error.message;
                _errorStatus = 404;
            } else if (error.message.includes("Client not found")) {
                errorMessage = error.message;
                _errorStatus = 404;
            } else if (error.message.includes("brokerage has already been calculated")
                || error.message.includes("brokerage calculation first")) {
                errorMessage = "Cannot create trade as brokerage has already been calculated. Please delete the brokerage calculation first.";
                _errorStatus = 409;
            }
        }

        // Return a consistent error response format
        return c.json({
            success: false,
            message: errorMessage,
            error: errorMessage,
        });
    }
});

/**
 * Reverse a trade's effects on FIFO allocations
 */
async function reverseTrade(
    trade: Trade,
    tx?: TransactionType,
): Promise<void> {
    // Note: Brokerage validation removed as fields don't exist in current schema

    if (trade.type === TradeType.BUY) {
        // For a BUY trade, we need to check if any of the shares have been sold
        const allocations = await fifoQueries.findByBuyTradeId(trade.id, tx);

        if (allocations.length > 0) {
            throw new HTTPException(400, {
                message: "Cannot update this trade as some shares from this purchase have already been sold",
            });
        }

        // No allocations means the BUY trade hasn't been used yet, so we can just delete it
        // The delete happens elsewhere, nothing to do here
    } else if (trade.type === TradeType.SELL) {
        // For a SELL trade, we need to reverse the FIFO allocations and restore quantities to BUY trades
        const allocations = await fifoQueries.findBySellTradeId(trade.id, tx);

        for (const allocation of allocations) {
            // Get the buy trade
            const buyTrade = await tradeQueries.findOne({ id: allocation.buyTradeId }, tx);
            if (!buyTrade) {
                throw new HTTPException(404, { message: `Buy trade not found for allocation ${allocation.id}` });
            }

            // Note: Brokerage validation removed as field doesn't exist in current schema

            // Restore shares to the buy trade
            const newRemainingQty = buyTrade.remainingQuantity + allocation.quantityAllocated;

            // Update the buy trade
            await tradeQueries.update(
                {
                    id: buyTrade.id,
                    remainingQuantity: newRemainingQty,
                    isFullySold: 0, // No longer fully sold since we're adding quantity back
                },
                tx,
            );
        }

        // Delete the FIFO allocations (this would be handled via database cascade delete when deleting the SELL trade)
    }
}

tradeRouter.put("/update", zValidator("json", updateTradeSchema), async (c) => {
    const updateData = c.req.valid("json") as {
        id: number;
        clientId?: number;
        symbol?: string;
        type?: TradeType;
        quantity?: number;
        price?: number;
        tradeDate?: string;
        notes?: string;
        exchange?: ExchangeType;
        netAmount?: number;
        originalQuantity?: number;
        remainingQuantity?: number;
        isFullySold?: number;
        sellProcessed?: number;
    };

    try {
        // Check if trade exists
        const existingTrade = await tradeQueries.findOne({ id: updateData.id });
        if (!existingTrade) {
            throw new HTTPException(404, { message: "Trade not found" });
        }

        // Note: Brokerage validation removed as fields don't exist in current schema

        // Validate client exists if clientId is being updated
        let clientId = existingTrade.clientId;
        if (updateData.clientId && updateData.clientId !== existingTrade.clientId) {
            const client = await clientQueries.findOne_Or({ id: updateData.clientId });
            if (!client) {
                throw new HTTPException(404, { message: "Client not found" });
            }
            clientId = updateData.clientId;
        }

        // Get stock information (either existing or new)
        const symbolToCheck = updateData.symbol || existingTrade.symbol;
        const exchangeToCheck = updateData.exchange || existingTrade.exchange;
        const stock = await stockQueries.findOne({ symbol: symbolToCheck, exchange: exchangeToCheck });
        if (!stock) {
            throw new HTTPException(404, { message: "Stock not found" });
        }

        // Use a transaction for all database operations to ensure consistency
        const db = getDB();
        return await db.transaction(async (tx: TransactionType) => {
            // Reverse the effects of the original trade
            await reverseTrade(existingTrade, tx);

            const newType = updateData.type ?? existingTrade.type;
            const quantity = updateData.quantity ?? existingTrade.quantity;

            // Prepare updated trade data
            const updatedTrade = {
                id: updateData.id,
                clientId,
                symbol: updateData.symbol ?? existingTrade.symbol,
                type: newType,
                exchange: stock.exchange,
                quantity,
                price: updateData.price ?? existingTrade.price,
                tradeDate: updateData.tradeDate ? new Date(updateData.tradeDate as string) : existingTrade.tradeDate,
                netAmount: quantity * (updateData.price ?? existingTrade.price),
                notes: updateData.notes ?? existingTrade.notes,
                // FIFO tracking fields - adjust based on type
                originalQuantity: newType === TradeType.BUY ? quantity : 0,
                remainingQuantity: newType === TradeType.BUY ? quantity : 0,
                isFullySold: newType === TradeType.BUY ? 0 : existingTrade.isFullySold,
                sellProcessed: newType === TradeType.SELL ? 0 : 1,
            };

            // Update the trade record
            const result = await tradeQueries.update(updatedTrade, tx);

            if (!result) {
                throw new HTTPException(500, { message: "Failed to update trade" });
            }

            // Re-apply the trade effects with the updated values
            const tradeType = updatedTrade.type;

            // Need to get the complete trade with all fields from DB
            const fullTradeRecord = await tradeQueries.findOne({ id: updatedTrade.id as number }, tx);
            if (!fullTradeRecord) {
                throw new HTTPException(500, { message: "Failed to retrieve updated trade" });
            }

            if (tradeType === TradeType.BUY) {
                await processBuyTrade(fullTradeRecord, tx);
            } else if (tradeType === TradeType.SELL) {
                await processSellTrade(fullTradeRecord, tx);
            }

            return c.json({
                success: true,
                message: "Trade updated successfully",
                data: result,
            });
        });
    } catch (error: any) {
        console.error("Trade update error:", error);

        // Get specific error message
        let errorMessage = "Failed to update trade. Please check your data and try again.";
        let _errorStatus = 500;

        // If it's an HTTPException, extract the message and status
        if (error instanceof HTTPException) {
            errorMessage = error.message || errorMessage;
            _errorStatus = error.status;
        } else if (error && typeof error === "object" && error.message) { // Handle non-HTTPException errors with message property
            errorMessage = error.message;

            // Customize error messages for better user experience
            if (error.message.includes("brokerage has already been calculated")
                || error.message.includes("brokerage calculation first")) {
                errorMessage = "Cannot modify this trade as brokerage has already been calculated.";
                _errorStatus = 409;
            } else if (error.message.includes("already been sold")) {
                _errorStatus = 400;
            } else if (error.message.includes("Insufficient shares")) {
                _errorStatus = 400;
            }
        }

        // Return a consistent error response format
        return c.json({
            success: false,
            message: errorMessage,
            error: errorMessage,
        });
    }
});

tradeRouter.post("/get-all", zValidator("json", tradeFilterSchema), async (c) => {
    const {
        page,
        limit,
        clientId,
        symbol,
        type,
        from,
        to,
    } = c.req.valid("json") as {
        page: number;
        limit: number;
        clientId?: number;
        symbol?: string;
        type?: TradeType;
        from?: string;
        to?: string;
    };

    try {
        // Safely convert date strings to timestamps
        const From = from
            ? (() => {
                    const date = new Date(from);
                    if (Number.isNaN(date.getTime())) {
                        throw new HTTPException(400, { message: "Invalid 'from' date format" });
                    }
                    return date.getTime();
                })()
            : undefined;

        const To = to
            ? (() => {
                    const date = new Date(to);
                    if (Number.isNaN(date.getTime())) {
                        throw new HTTPException(400, { message: "Invalid 'to' date format" });
                    }
                    return date.getTime();
                })()
            : undefined;

        const { trades: tradesList, count } = await tradeQueries.findAllWithPagination({
            page,
            limit,
            clientId,
            symbol,
            type,
            From,
            To,
        });

        const totalPage = Math.ceil(count / limit);

        return c.json({
            success: true,
            data: tradesList,
            metadata: {
                total: count,
                hasNext: page < totalPage,
                totalPages: totalPage,
                currentPage: page,
            },
        });
    } catch {
        throw new HTTPException(500, { message: "Failed to fetch trades" });
    }
});

tradeRouter.get("/get-one/:id", zValidator("param", tradeGetOneSchema), async (c) => {
    const id = c.req.valid("param").id as number;

    try {
        const trade = await tradeQueries.findOne({ id });
        if (!trade) {
            throw new HTTPException(404, { message: "Trade not found" });
        } // Get related FIFO allocation information based on trade type
        let fifoInfo = null;
        if (trade.type === TradeType.BUY) {
            // Get allocations where this trade was used as the buy side
            fifoInfo = await fifoQueries.findByBuyTradeId(trade.id);
        } else if (trade.type === TradeType.SELL) {
            // Get the FIFO allocations created by this sell trade
            fifoInfo = await fifoQueries.findBySellTradeId(trade.id);
        }

        return c.json({
            success: true,
            data: {
                trade,
                fifoInfo,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        throw new HTTPException(500, { message: "Failed to fetch trade" });
    }
});

tradeRouter.delete("/delete/:id", zValidator("param", tradeGetOneSchema), async (c) => {
    const id = c.req.valid("param").id as number;

    try {
        // Check if trade exists
        const trade = await tradeQueries.findOne({ id });
        if (!trade) {
            throw new HTTPException(404, { message: "Trade not found" });
        }

        // Note: Brokerage validation removed as fields don't exist in current schema

        // Use a transaction for all database operations to ensure consistency
        const db = getDB();
        return await db.transaction(async (tx: TransactionType) => {
            // Reverse the effects of the trade first
            await reverseTrade(trade, tx);

            // Then delete the trade
            await tradeQueries.remove(id, tx);

            return c.json({
                success: true,
                message: "Trade deleted successfully",
            });
        });
    } catch (error: any) {
        console.error("Trade deletion error:", error);

        // Get specific error message
        let errorMessage = "Failed to delete trade. Please try again later.";
        let _errorStatus = 500;

        // If it's an HTTPException, extract the message and status
        if (error instanceof HTTPException) {
            errorMessage = error.message || errorMessage;
            _errorStatus = error.status;
        } else if (error && typeof error === "object" && error.message) { // Handle non-HTTPException errors with message property
            errorMessage = error.message;

            // Customize error messages for better user experience
            if (error.message.includes("brokerage has already been calculated")
                || error.message.includes("brokerage calculation first")) {
                errorMessage = "Cannot delete this trade as brokerage has already been calculated. Please delete the brokerage calculation first.";
                _errorStatus = 409;
            } else if (error.message.includes("already been sold")) {
                _errorStatus = 400;
            } else if (error.message.includes("Trade not found")) {
                _errorStatus = 404;
            }
        }

        // Return a consistent error response format
        return c.json({
            success: false,
            message: errorMessage,
            error: errorMessage,
        });
    }
});

// Export the router
export default tradeRouter;
