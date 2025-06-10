import { and, between, eq, sql } from "drizzle-orm";

import type { BrokerageCalculation, NewBrokerageCalculation } from "../db/schema";

import { db } from "../db";
import { brokerage, trades } from "../db/schema";

/**
 * Service to calculate brokerage fees
 */
export class BrokerageCalculator {
    /**
     * Calculate monthly brokerage for a client
     * @param clientId The client ID
     * @param month The month (1-12)
     * @param year The year
     */
    static async calculateMonthlyBrokerage(clientId: number, month: number, year: number): Promise<BrokerageCalculation> {
    // Validate month and year
        if (month < 1 || month > 12) {
            throw new Error("Month must be between 1 and 12");
        }

        if (year < 2000 || year > 2100) {
            throw new Error("Year must be valid");
        }

        // Calculate start and end date for the month
        const startDate = new Date(year, month - 1, 1).getTime() / 1000;
        const endDate = new Date(year, month, 0, 23, 59, 59).getTime() / 1000;

        // Get all trades for the client in that month
        const clientTrades = await db.select({
            count: sql<number>`count(*)`,
            totalTurnover: sql<number>`sum(${trades.quantity} * ${trades.price})`,
        })
            .from(trades)
            .where(
                and(
                    eq(trades.client_id, clientId),
                    between(trades.trade_date, startDate, endDate),
                ),
            );

        const { count, totalTurnover } = clientTrades[0];

        // If no trades, return zero brokerage
        if (count === 0 || !totalTurnover) {
            throw new Error("No trades found for the specified month");
        }

        // Calculate brokerage amount (0.5% of turnover)
        const brokerageRate = 0.005; // 0.5%
        const brokerageAmount = totalTurnover * brokerageRate;

        // Calculate GST (18% of brokerage)
        const gstRate = 0.18; // 18%
        const gstAmount = brokerageAmount * gstRate;

        // Calculate total amount
        const totalAmount = brokerageAmount + gstAmount;

        // Check if brokerage calculation already exists for this month
        const existingCalculation = await db.select()
            .from(brokerage)
            .where(
                and(
                    eq(brokerage.client_id, clientId),
                    eq(brokerage.month, month),
                    eq(brokerage.year, year),
                ),
            )
            .limit(1);

        const now = Math.floor(Date.now() / 1000);

        if (existingCalculation.length > 0) {
            // Update existing calculation
            const result = await db.update(brokerage)
                .set({
                    total_trades: count,
                    total_turnover: totalTurnover,
                    brokerage_amount: brokerageAmount,
                    gst_amount: gstAmount,
                    total_amount: totalAmount,
                    calculation_date: now,
                    updated_at: now,
                })
                .where(
                    and(
                        eq(brokerage.client_id, clientId),
                        eq(brokerage.month, month),
                        eq(brokerage.year, year),
                    ),
                )
                .returning();

            return result[0];
        } else {
            // Create new calculation
            const newCalculation: NewBrokerageCalculation = {
                client_id: clientId,
                month,
                year,
                total_trades: count,
                total_turnover: totalTurnover,
                brokerage_amount: brokerageAmount,
                gst_amount: gstAmount,
                total_amount: totalAmount,
                calculation_date: now,
            };

            const result = await db.insert(brokerage)
                .values(newCalculation)
                .returning();

            return result[0];
        }
    }

    /**
     * Calculate brokerage for all clients for a specific month
     * @param month The month (1-12)
     * @param year The year
     */
    static async calculateBulkBrokerage(month: number, year: number): Promise<number> {
    // Validate month and year
        if (month < 1 || month > 12) {
            throw new Error("Month must be between 1 and 12");
        }

        if (year < 2000 || year > 2100) {
            throw new Error("Year must be valid");
        }

        // Calculate start and end date for the month
        const startDate = new Date(year, month - 1, 1).getTime() / 1000;
        const endDate = new Date(year, month, 0, 23, 59, 59).getTime() / 1000;

        // Get all clients who had trades in that month
        const clientsWithTrades = await db.select({
            clientId: trades.client_id,
        })
            .from(trades)
            .where(between(trades.trade_date, startDate, endDate))
            .groupBy(trades.client_id);

        let calculationsCount = 0;

        // Calculate brokerage for each client
        for (const { clientId } of clientsWithTrades) {
            try {
                await this.calculateMonthlyBrokerage(clientId, month, year);
                calculationsCount++;
            } catch (error) {
                console.error(`Failed to calculate brokerage for client ${clientId}:`, error);
            }
        }

        return calculationsCount;
    }

    /**
     * Get outstanding brokerage amounts
     */
    static async getOutstandingBrokerage(): Promise<BrokerageCalculation[]> {
        return db.select()
            .from(brokerage)
            .where(eq(brokerage.paid, 0))
            .orderBy(brokerage.calculation_date);
    }

    /**
     * Mark brokerage calculation as paid
     * @param calculationId The brokerage calculation ID
     */
    static async markAsPaid(calculationId: number): Promise<BrokerageCalculation> {
        const result = await db.update(brokerage)
            .set({
                paid: 1,
                updated_at: Math.floor(Date.now() / 1000),
            })
            .where(eq(brokerage.id, calculationId))
            .returning();

        if (!result.length) {
            throw new Error("Brokerage calculation not found");
        }

        return result[0];
    }
}
