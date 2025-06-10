import { db } from '../db';
import { clientHoldings } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { ClientHolding, NewClientHolding, Trade } from '../db/schema';

/**
 * Service to manage client holdings
 */
export class HoldingsManager {
  /**
   * Update client holdings after a trade
   * @param trade The trade to process
   */
  static async updateHoldings(trade: Trade): Promise<ClientHolding> {
    // Find existing holding
    const existingHolding = await db.select()
      .from(clientHoldings)
      .where(
        and(
          eq(clientHoldings.client_id, trade.client_id),
          eq(clientHoldings.stock_id, trade.stock_id)
        )
      )
      .limit(1);

    const now = Math.floor(Date.now() / 1000);

    if (trade.type === 'buy') {
      // Handle buy trade
      if (existingHolding.length === 0) {
        // Create new holding if it doesn't exist
        const newHolding: NewClientHolding = {
          client_id: trade.client_id,
          stock_id: trade.stock_id,
          quantity: trade.quantity,
          average_price: trade.price,
          current_value: trade.price * trade.quantity,
          last_updated: now,
        };

        const result = await db.insert(clientHoldings)
          .values(newHolding)
          .returning();

        return result[0];
      } else {
        // Update existing holding with weighted average price
        const holding = existingHolding[0];
        const totalQuantity = holding.quantity + trade.quantity;
        const totalValue = (holding.quantity * holding.average_price) + (trade.quantity * trade.price);
        const newAveragePrice = totalValue / totalQuantity;

        const result = await db.update(clientHoldings)
          .set({
            quantity: totalQuantity,
            average_price: newAveragePrice,
            current_value: newAveragePrice * totalQuantity,
            last_updated: now,
            updated_at: now
          })
          .where(
            and(
              eq(clientHoldings.client_id, trade.client_id),
              eq(clientHoldings.stock_id, trade.stock_id)
            )
          )
          .returning();

        return result[0];
      }
    } else if (trade.type === 'sell') {
      // Handle sell trade
      if (existingHolding.length === 0) {
        throw new Error('Cannot sell stock that is not in holdings');
      }

      const holding = existingHolding[0];

      if (holding.quantity < trade.quantity) {
        throw new Error('Insufficient quantity in holdings');
      }

      const remainingQuantity = holding.quantity - trade.quantity;

      if (remainingQuantity === 0) {
        // Remove holding if quantity becomes zero
        await db.delete(clientHoldings)
          .where(
            and(
              eq(clientHoldings.client_id, trade.client_id),
              eq(clientHoldings.stock_id, trade.stock_id)
            )
          );

        return { ...holding, quantity: 0 } as ClientHolding;
      } else {
        // Update holding with reduced quantity
        // Note: We don't change the average price when selling
        const result = await db.update(clientHoldings)
          .set({
            quantity: remainingQuantity,
            current_value: holding.average_price * remainingQuantity,
            last_updated: now,
            updated_at: now
          })
          .where(
            and(
              eq(clientHoldings.client_id, trade.client_id),
              eq(clientHoldings.stock_id, trade.stock_id)
            )
          )
          .returning();

        return result[0];
      }
    }

    throw new Error('Invalid trade type');
  }

  /**
   * Get client's current holdings
   * @param clientId The client ID
   */
  static async getClientHoldings(clientId: number): Promise<ClientHolding[]> {
    return db.select()
      .from(clientHoldings)
      .where(eq(clientHoldings.client_id, clientId));
  }

  /**
   * Update current value of holdings based on stock prices
   * @param stockId The stock ID
   * @param currentPrice The current price of the stock
   */
  static async updateHoldingsValue(stockId: number, currentPrice: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await db.update(clientHoldings)
      .set({
        current_value: sql`${clientHoldings.quantity} * ${currentPrice}`,
        last_updated: now,
        updated_at: now
      })
      .where(eq(clientHoldings.stock_id, stockId));
  }
}

// Import sql for the updateHoldingsValue method
import { sql } from 'drizzle-orm';
