import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { TransactionType } from "../db";
import type { ExchangeType, NewTrade, Trade, TradeAllocation, UnusedAmount } from "../db/schema";

import { getDB } from "../db";
import * as amountUsageQueries from "../db/queries/amountUsage";
import * as clientQueries from "../db/queries/client";
import * as holdingQueries from "../db/queries/holding";
import * as stockQueries from "../db/queries/stock";
import * as tradeQueries from "../db/queries/trade";
import * as tradeAllocationQueries from "../db/queries/tradeAllocation";
import * as unusedAmountQueries from "../db/queries/unusedAmount";
import { TradeType } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { convertDateRangeToTimestamps, validateAndConvertToTimestamp } from "../utils/date-helpers";
import { tradeFilterSchema, tradeGetOneSchema, tradeSchema, updateTradeSchema } from "../utils/validation-schemas";

const tradeRouter = new Hono();

tradeRouter.use("*", authMiddleware);

async function createTradeAllocationsForSell(sellTrade: Trade, tx?: TransactionType): Promise<number> {
    const { clientId, symbol, exchange, quantity: sellQuantity } = sellTrade;

    const tradeTimestamp = validateAndConvertToTimestamp(sellTrade.tradeDate, "trade date");
    const availableBuyTrades: Trade[] = await tradeQueries.findBuyTradesWithRemainingQuantity({
        clientId,
        symbol,
        exchange,
        tradeDate: tradeTimestamp,
    }, tx);

    let remainingToAllocate = sellQuantity;
    let buyAmount = 0;

    for (const buyTrade of availableBuyTrades) {
        if (remainingToAllocate <= 0)
            break;

        const quantityToAllocate = Math.min(remainingToAllocate, buyTrade.remainingQuantity);

        buyAmount += buyTrade.price * quantityToAllocate;

        // Create the allocation record
        await tradeAllocationQueries.tradeAllocationQueries.create({
            sellTradeId: sellTrade.id,
            buyTradeId: buyTrade.id,
            quantityAllocated: quantityToAllocate,
        }, tx);

        // Update the remainingQuantity in the buy trade
        const newRemainingQuantity = buyTrade.remainingQuantity - quantityToAllocate;
        await tradeQueries.update({
            id: buyTrade.id,
            remainingQuantity: newRemainingQuantity,
        }, tx);

        remainingToAllocate -= quantityToAllocate;
    }

    if (remainingToAllocate > 0) {
        console.warn(`Could not fully allocate sell trade ${sellTrade.id}. Remaining quantity: ${remainingToAllocate}`);
        throw new HTTPException(400, {
            message: `Could not fully allocate sell trade of ${sellTrade.symbol} - ${sellTrade.exchange} . You need ${remainingToAllocate} more shares .`,
        });
    }

    return buyAmount;
}

async function processSellTrade(sellTrade: Trade, tx?: TransactionType): Promise<number> {
    const { clientId, symbol, exchange, quantity } = sellTrade;

    // Check current holdings
    const currentHolding = await holdingQueries.findByClientSymbolExchange(
        { clientId, symbol, exchange },
        tx,
    );

    const availableShares = currentHolding?.holding || 0;

    if (availableShares < quantity) {
        throw new HTTPException(400, {
            message: `Insufficient shares to sell. You have ${availableShares} ${symbol} shares available, but attempting to sell ${quantity} shares.`,
        });
    }

    // Update holdings
    await holdingQueries.updateHoldings(clientId, symbol, exchange, -quantity, tx);

    // Create trade allocations
    const buyAmount = await createTradeAllocationsForSell(sellTrade, tx);

    return buyAmount;
}

async function updateTrade(
    tradeId: number,
    updateData: {
        clientId?: number;
        symbol?: string;
        exchange?: ExchangeType;
        type?: TradeType;
        quantity?: number;
        price?: number;
        tradeDate?: string;
        notes?: string;
    },
    tx?: TransactionType,
): Promise<Trade> {
    const existingTrade = await tradeQueries.findOne({ id: tradeId }, tx);
    if (!existingTrade) {
        throw new HTTPException(404, { message: "Trade not found" });
    }

    if (existingTrade.brokerageCalculatedDate) {
        throw new HTTPException(409, {
            message: "Cannot update trade as brokerage has already been calculated.",
        });
    }

    const newClientId = updateData.clientId || existingTrade.clientId;
    const newSymbol = updateData.symbol || existingTrade.symbol;
    const newExchange = updateData.exchange || existingTrade.exchange;
    const newType = updateData.type || existingTrade.type;
    const newQuantity = updateData.quantity || existingTrade.quantity;
    const newPrice = updateData.price || existingTrade.price;
    const newNetAmount = newQuantity * newPrice;
    const newTradeDate = updateData.tradeDate
        ? new Date(validateAndConvertToTimestamp(updateData.tradeDate, "trade date"))
        : existingTrade.tradeDate;
    const newNotes = updateData.notes !== undefined ? updateData.notes : existingTrade.notes;

    if (newClientId !== existingTrade.clientId) {
        const client = await clientQueries.findOne_Or({ id: newClientId });
        if (!client) {
            throw new HTTPException(404, { message: "Client not found" });
        }
    }

    if (newSymbol !== existingTrade.symbol || newExchange !== existingTrade.exchange) {
        const stock = await stockQueries.findOne({ symbol: newSymbol, exchange: newExchange });
        if (!stock) {
            throw new HTTPException(404, { message: "Stock not found" });
        }
    }

    let totalAllocated = 0;
    if (existingTrade.type === TradeType.BUY) {
        const existingAllocations = await tradeAllocationQueries.tradeAllocationQueries.findByBuyTradeId(existingTrade.id, tx);
        totalAllocated = existingAllocations.reduce((sum: number, allocation: TradeAllocation) => sum + allocation.quantityAllocated, 0);

        if (newQuantity !== existingTrade.quantity && newQuantity < totalAllocated) {
            throw new HTTPException(400, {
                message: `Cannot reduce buy trade quantity to ${newQuantity}. Already allocated ${totalAllocated} shares to sell trades. Minimum required: ${totalAllocated}`,
            });
        }
    }

    if (existingTrade.type === TradeType.BUY && newType === TradeType.BUY
        && (newQuantity !== existingTrade.quantity || newClientId !== existingTrade.clientId
            || newSymbol !== existingTrade.symbol || newExchange !== existingTrade.exchange)) {
        // Current holdings = old_buy_quantity - total_allocated_to_sells
        // New holdings should = new_buy_quantity - total_allocated_to_sells

        const holdingsDifference = newQuantity - existingTrade.quantity;

        if (holdingsDifference !== 0) {
            await holdingQueries.updateHoldings(
                existingTrade.clientId,
                existingTrade.symbol,
                existingTrade.exchange,
                -existingTrade.quantity,
                tx,
            );

            await holdingQueries.updateHoldings(
                newClientId,
                newSymbol,
                newExchange,
                newQuantity - totalAllocated,
                tx,
            );
        }

        const amountDifference = newNetAmount - existingTrade.netAmount;
        if (amountDifference !== 0) {
            await clientQueries.updateCurrentHoldingAmount(existingTrade.clientId, existingTrade.netAmount, tx);
            await clientQueries.updateCurrentHoldingAmount(newClientId, -newNetAmount, tx);
        }
    } else {
        await reverseTradeEffects(existingTrade, tx);
    }

    if (newType === TradeType.SELL) {
        const currentHolding = await holdingQueries.findByClientSymbolExchange(
            { clientId: newClientId, symbol: newSymbol, exchange: newExchange },
            tx,
        );

        const availableShares = currentHolding?.holding || 0;

        if (availableShares < newQuantity) {
            throw new HTTPException(400, {
                message: `Insufficient shares to sell. Available: ${availableShares} ${newSymbol}, Required: ${newQuantity}`,
            });
        }
    }

    let newRemainingQuantity = 0;
    if (newType === TradeType.BUY) {
        if (existingTrade.type === TradeType.BUY) {
            newRemainingQuantity = newQuantity - totalAllocated;
        } else {
            newRemainingQuantity = newQuantity;
        }
    }

    // Update trade record
    const updatedTrade = await tradeQueries.update({
        id: existingTrade.id,
        clientId: newClientId,
        symbol: newSymbol,
        exchange: newExchange,
        type: newType,
        quantity: newQuantity,
        price: newPrice,
        netAmount: newNetAmount,
        remainingQuantity: newRemainingQuantity,
        tradeDate: newTradeDate,
        notes: newNotes,
        updatedAt: new Date(),
    }, tx);

    if (!updatedTrade) {
        throw new HTTPException(500, { message: "Failed to update trade" });
    }

    const isBuyTradeUpdate = existingTrade.type === TradeType.BUY && newType === TradeType.BUY
        && (newQuantity !== existingTrade.quantity || newClientId !== existingTrade.clientId
            || newSymbol !== existingTrade.symbol || newExchange !== existingTrade.exchange);

    if (!isBuyTradeUpdate) {
        await applyTradeEffects(updatedTrade, tx);
    } else {
        if (existingTrade.type === TradeType.BUY) {
            const usageRecords = await amountUsageQueries.findByBuyTrade(updatedTrade.id, tx);
            for (const usage of usageRecords) {
                const unusedAmount = await unusedAmountQueries.findById(usage.unusedAmountId, tx);
                if (unusedAmount) {
                    await unusedAmountQueries.updateById(usage.unusedAmountId, {
                        remainingAmount: unusedAmount.remainingAmount + usage.amountUsed,
                        endDate: null,
                    }, tx);
                }
            }
            await amountUsageQueries.deleteByBuyTrade(updatedTrade.id, tx);

            let amountToCover = updatedTrade.netAmount;
            const activeUnusedAmounts = await unusedAmountQueries.getActive(updatedTrade.clientId, tx);

            for (const unused of activeUnusedAmounts) {
                if (amountToCover <= 0)
                    break;

                const amountToUse = Math.min(amountToCover, unused.remainingAmount);

                await amountUsageQueries.create({
                    unusedAmountId: unused.id,
                    buyTradeId: updatedTrade.id,
                    amountUsed: amountToUse,
                    usageDate: new Date(updatedTrade.tradeDate),
                }, tx);

                const newRemainingAmount = unused.remainingAmount - amountToUse;
                const updates: Partial<UnusedAmount> = { remainingAmount: newRemainingAmount };

                if (newRemainingAmount <= 0) {
                    updates.endDate = new Date(updatedTrade.tradeDate);
                }

                await unusedAmountQueries.updateById(unused.id, updates, tx);
                amountToCover -= amountToUse;
            }
        }
    }

    return updatedTrade;
}

async function reverseTradeEffects(trade: Trade, tx?: TransactionType): Promise<void> {
    const { clientId, symbol, exchange, type, quantity, netAmount } = trade;

    if (type === TradeType.BUY) {
        await holdingQueries.updateHoldings(clientId, symbol, exchange, -quantity, tx);
        await clientQueries.updateCurrentHoldingAmount(clientId, netAmount, tx);

        const usageRecords = await amountUsageQueries.findByBuyTrade(trade.id, tx);
        for (const usage of usageRecords) {
            const unusedAmount = await unusedAmountQueries.findById(usage.unusedAmountId, tx);
            if (unusedAmount) {
                await unusedAmountQueries.updateById(usage.unusedAmountId, {
                    remainingAmount: unusedAmount.remainingAmount + usage.amountUsed,
                    endDate: null,
                }, tx);
            }
        }
        await amountUsageQueries.deleteByBuyTrade(trade.id, tx);

        await tradeAllocationQueries.tradeAllocationQueries.deleteByBuyTradeId(trade.id, tx);
    } else if (type === TradeType.SELL) {
        await holdingQueries.updateHoldings(clientId, symbol, exchange, quantity, tx);
        await clientQueries.updateCurrentHoldingAmount(clientId, -netAmount, tx);

        const unusedAmount = await unusedAmountQueries.findBySourceTrade(trade.id, tx);
        if (unusedAmount) {
            await unusedAmountQueries.deleteBySourceTrade(trade.id, tx);
        }

        const allocations = await tradeAllocationQueries.tradeAllocationQueries.findBySellTradeId(trade.id, tx);
        for (const allocation of allocations) {
            const buyTrade = await tradeQueries.findOne({ id: allocation.buyTradeId }, tx);
            if (buyTrade) {
                await tradeQueries.update({
                    id: allocation.buyTradeId,
                    remainingQuantity: buyTrade.remainingQuantity + allocation.quantityAllocated,
                }, tx);
            }
        }
        await tradeAllocationQueries.tradeAllocationQueries.deleteBySellTradeId(trade.id, tx);
    }
}

async function applyTradeEffects(trade: Trade, tx?: TransactionType): Promise<void> {
    const { type } = trade;

    let buyamount = 0;

    if (type === TradeType.BUY) {
        await clientQueries.updateCurrentHoldingAmount(trade.clientId, -trade.netAmount, tx);
        await holdingQueries.updateHoldings(trade.clientId, trade.symbol, trade.exchange, trade.quantity, tx);

        let amountToCover = trade.netAmount;
        const activeUnusedAmounts = await unusedAmountQueries.getActive(trade.clientId, tx);

        for (const unused of activeUnusedAmounts) {
            if (amountToCover <= 0)
                break;

            const amountToUse = Math.min(amountToCover, unused.remainingAmount);

            await amountUsageQueries.create({
                unusedAmountId: unused.id,
                buyTradeId: trade.id,
                amountUsed: amountToUse,
                usageDate: new Date(trade.tradeDate),
            }, tx);

            const newRemainingAmount = unused.remainingAmount - amountToUse;
            const updates: Partial<UnusedAmount> = { remainingAmount: newRemainingAmount };

            if (newRemainingAmount <= 0) {
                updates.endDate = new Date(trade.tradeDate);
            }

            await unusedAmountQueries.updateById(unused.id, updates, tx);
            amountToCover -= amountToUse;
        }
    } else if (type === TradeType.SELL) {
        const buyAmount = await processSellTrade(trade, tx);
        buyamount = buyAmount;
        await clientQueries.updateCurrentHoldingAmount(trade.clientId, trade.netAmount, tx);

        await unusedAmountQueries.create({
            clientId: trade.clientId,
            sourceTradeId: trade.id,
            amount: trade.netAmount,
            remainingAmount: trade.netAmount,
            startDate: new Date(trade.tradeDate),
            lastBrokerageDate: new Date(trade.tradeDate),
        }, tx);

        await tradeQueries.update({
            id: trade.id,
            buyAmount: buyamount,
            profit: trade.netAmount - buyamount,
        }, tx);
    }
}

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

    try {
        const client = await clientQueries.findOne_Or({ id: tradeData.clientId });
        if (!client) {
            throw new HTTPException(404, { message: "Client not found" });
        }

        const stock = await stockQueries.findOne({ symbol: tradeData.symbol, exchange: tradeData.exchange });
        if (!stock) {
            throw new HTTPException(404, { message: "Stock not found" });
        }

        const tradeValue = tradeData.quantity * tradeData.price;
        const tradeTimestamp = validateAndConvertToTimestamp(tradeData.tradeDate, "trade date");
        const parsedTradeDate = new Date(tradeTimestamp);

        const db = getDB();
        return await db.transaction(async (tx: TransactionType) => {
            const tradeData2Create: NewTrade = {
                clientId: tradeData.clientId,
                symbol: tradeData.symbol,
                type: tradeData.type,
                exchange: tradeData.exchange,
                quantity: tradeData.quantity,
                price: tradeData.price,
                tradeDate: parsedTradeDate,
                netAmount: tradeValue,
                notes: tradeData.notes || null,
                remainingQuantity: tradeData.type === TradeType.BUY ? tradeData.quantity : 0,
                brokerageCalculatedDate: null,
            };

            const newTrade = await tradeQueries.create(tradeData2Create, tx);

            if (!newTrade) {
                throw new HTTPException(500, { message: "Failed to create trade" });
            }

            await applyTradeEffects(newTrade, tx);

            return c.json({
                success: true,
                message: "Trade created successfully",
                data: newTrade,
            }, 201);
        });
    } catch (error: any) {
        console.error("Trade creation error:", error);

        let errorMessage = "Failed to create trade. Please check your data and try again.";

        if (error instanceof HTTPException) {
            errorMessage = error.message || errorMessage;
        } else if (error && typeof error === "object" && error.message) {
            errorMessage = error.message;

            if (error.message.includes("Insufficient shares")) {
                errorMessage = error.message;
            } else if (error.message.includes("not found")) {
                errorMessage = error.message;
            }
        }

        return c.json({
            success: false,
            message: errorMessage,
            error: errorMessage,
        });
    }
});

tradeRouter.put("/update/:id", zValidator("param", tradeGetOneSchema), zValidator("json", updateTradeSchema), async (c) => {
    const tradeId = c.req.valid("param").id as number;
    const updateData = c.req.valid("json") as {
        clientId?: number;
        symbol?: string;
        exchange?: ExchangeType;
        type?: TradeType;
        quantity?: number;
        price?: number;
        tradeDate?: string;
        notes?: string;
    };

    try {
        const db = getDB();
        const result = await db.transaction(async (tx: TransactionType) => {
            return await updateTrade(tradeId, updateData, tx);
        });

        return c.json({
            success: true,
            message: "Trade updated successfully",
            data: result,
        }, 200);
    } catch (error: any) {
        console.error("Trade update error:", error);

        let errorMessage = "Failed to update trade. Please check your data and try again.";

        if (error instanceof HTTPException) {
            errorMessage = error.message || errorMessage;
        } else if (error && typeof error === "object" && error.message) {
            errorMessage = error.message;

            if (error.message.includes("Insufficient shares")) {
                errorMessage = error.message;
            } else if (error.message.includes("not found")) {
                errorMessage = error.message;
            } else if (error.message.includes("brokerage has already been calculated")) {
                errorMessage = "Cannot update trade as brokerage has already been calculated.";
            }
        }

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
        const { From, To } = convertDateRangeToTimestamps(from, to);

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
        }

        const currentHolding = await holdingQueries.findByClientSymbolExchange(
            { clientId: trade.clientId, symbol: trade.symbol, exchange: trade.exchange },
        );

        return c.json({
            success: true,
            data: {
                trade,
                currentHolding: currentHolding ? currentHolding.holding : 0,
            },
        });
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        throw new HTTPException(500, { message: "Failed to fetch trade" });
    }
});

export default tradeRouter;
