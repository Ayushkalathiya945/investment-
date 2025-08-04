import { and, eq } from "drizzle-orm";

import type { TransactionType } from "../index";

import { db } from "../index";
import { holdings } from "../schema";

// Define the Holding type based on the schema
export type Holding = {
    id: number;
    clientId: number;
    symbol: string;
    exchange: "NSE" | "BSE";
    holding: number;
    createdAt: Date;
    updatedAt: Date;
};

export async function updateHoldings(
    clientId: number,
    symbol: string,
    exchange: "NSE" | "BSE",
    quantityChange: number,
    tx?: TransactionType,
): Promise<void> {
    const dbInstance = tx || db;

    // Get current holding if it exists
    const [currentHolding] = await dbInstance
        .select()
        .from(holdings)
        .where(
            and(
                eq(holdings.clientId, clientId),
                eq(holdings.symbol, symbol),
                eq(holdings.exchange, exchange),
            ),
        )
        .limit(1);

    if (currentHolding) {
        const newHolding = currentHolding.holding + quantityChange;

        if (newHolding > 0) {
            await dbInstance
                .update(holdings)
                .set({
                    holding: newHolding,
                    updatedAt: new Date(),
                })
                .where(eq(holdings.id, currentHolding.id));
        } else {
            await dbInstance
                .delete(holdings)
                .where(eq(holdings.id, currentHolding.id));
        }
    } else if (quantityChange > 0) {
        await dbInstance.insert(holdings).values({
            clientId,
            symbol,
            exchange,
            holding: quantityChange,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }
}

export async function getHoldingsByClientId(
    clientId: number,
    tx?: TransactionType,
): Promise<Holding[]> {
    try {
        const dbInstance = tx || db;

        return await dbInstance
            .select()
            .from(holdings)
            .where(eq(holdings.clientId, clientId))
            .orderBy(
                holdings.symbol,
                holdings.exchange,
            );
    } catch (error) {
        console.error(`Error fetching holdings for client ${clientId}:`, error);
        throw new Error(`Failed to retrieve holdings for client ${clientId}. Please try again later.`);
    }
}

export async function getAllClientsHoldings(
    tx?: TransactionType,
): Promise<Holding[]> {
    try {
        const dbInstance = tx || db;

        return await dbInstance
            .select()
            .from(holdings)
            .orderBy(
                holdings.clientId,
                holdings.symbol,
                holdings.exchange,
            );
    } catch (error) {
        console.error("Error fetching all clients holdings:", error);
        throw new Error("Failed to retrieve all clients holdings. Please try again later.");
    }
}

export async function findByClientSymbolExchange(
    { clientId, symbol, exchange }: { clientId: number; symbol: string; exchange: "NSE" | "BSE" },
    tx?: TransactionType,
): Promise<Holding | null> {
    try {
        const dbInstance = tx || db;

        const [result] = await dbInstance
            .select()
            .from(holdings)
            .where(
                and(
                    eq(holdings.clientId, clientId),
                    eq(holdings.symbol, symbol),
                    eq(holdings.exchange, exchange),
                ),
            )
            .limit(1);

        return result;
    } catch (error) {
        console.error(`Error fetching holding for client ${clientId}, symbol ${symbol}, exchange ${exchange}:`, error);
        throw new Error(`Failed to retrieve holding for client ${clientId}, symbol ${symbol}, exchange ${exchange}. Please try again later.`);
    }
}
