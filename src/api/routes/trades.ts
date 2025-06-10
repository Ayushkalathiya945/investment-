import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { trades, stocks, clients } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import { tradeSchema, updateTradeSchema, tradeFilterSchema } from '../utils/validation-schemas';
import { eq, and, isNull, desc, sql, between } from 'drizzle-orm';
import { HoldingsManager } from '../services/holdings-manager';

// Create a new Hono router for trade routes
const tradeRouter = new Hono();

// Apply authentication middleware to all trade routes
tradeRouter.use('*', authMiddleware);

// Create new trade
tradeRouter.post('/', validateRequest(tradeSchema), async (c) => {
  const tradeData = c.get('validatedBody');
  
  try {
    // Validate client exists
    const client = await db.select({ id: clients.id })
      .from(clients)
      .where(and(
        eq(clients.id, tradeData.client_id),
        isNull(clients.deleted_at),
        eq(clients.active, 1)
      ))
      .limit(1);
    
    if (!client.length) {
      throw new HTTPException(404, { message: 'Client not found or inactive' });
    }
    
    // Validate stock exists
    const stock = await db.select({ id: stocks.id })
      .from(stocks)
      .where(and(
        eq(stocks.id, tradeData.stock_id),
        isNull(stocks.deleted_at),
        eq(stocks.active, 1)
      ))
      .limit(1);
    
    if (!stock.length) {
      throw new HTTPException(404, { message: 'Stock not found or inactive' });
    }
    
    // Calculate total charges
    const totalCharges = tradeData.brokerage_fee + 
                         tradeData.gst + 
                         tradeData.stt + 
                         tradeData.stamp_duty + 
                         tradeData.exchange_fee + 
                         tradeData.sebi_fee;
    
    // Calculate net amount
    const tradeValue = tradeData.quantity * tradeData.price;
    const netAmount = tradeData.type === 'buy' 
      ? tradeValue + totalCharges 
      : tradeValue - totalCharges;
    
    // Convert date strings to timestamps
    const tradeDate = new Date(tradeData.trade_date).getTime() / 1000;
    const settlementDate = new Date(tradeData.settlement_date).getTime() / 1000;
    
    // Insert trade into database
    const result = await db.insert(trades).values({
      client_id: tradeData.client_id,
      stock_id: tradeData.stock_id,
      type: tradeData.type,
      quantity: tradeData.quantity,
      price: tradeData.price,
      trade_date: tradeDate,
      settlement_date: settlementDate,
      brokerage_fee: tradeData.brokerage_fee,
      gst: tradeData.gst,
      stt: tradeData.stt,
      stamp_duty: tradeData.stamp_duty,
      exchange_fee: tradeData.exchange_fee,
      sebi_fee: tradeData.sebi_fee,
      total_charges: totalCharges,
      net_amount: netAmount,
      notes: tradeData.notes,
    }).returning();
    
    const newTrade = result[0];
    
    // Update client holdings
    try {
      await HoldingsManager.updateHoldings(newTrade);
    } catch (holdingsError: any) {
      // If holdings update fails, delete the trade and throw error
      await db.delete(trades).where(eq(trades.id, newTrade.id));
      throw new HTTPException(400, { message: holdingsError.message });
    }
    
    return c.json({
      success: true,
      message: 'Trade created successfully',
      data: newTrade
    }, 201);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to create trade' });
  }
});

// Get all trades with filters
tradeRouter.get('/', validateQuery(tradeFilterSchema), async (c) => {
  const { page, limit, client_id, stock_id, type, start_date, end_date, sort, order } = c.get('validatedQuery');
  
  try {
    // Build query conditions
    let conditions = sql`1=1`;
    
    if (client_id) {
      conditions = and(conditions, eq(trades.client_id, client_id));
    }
    
    if (stock_id) {
      conditions = and(conditions, eq(trades.stock_id, stock_id));
    }
    
    if (type) {
      conditions = and(conditions, eq(trades.type, type));
    }
    
    if (start_date && end_date) {
      const startTimestamp = new Date(start_date).getTime() / 1000;
      const endTimestamp = new Date(end_date).getTime() / 1000;
      conditions = and(conditions, between(trades.trade_date, startTimestamp, endTimestamp));
    } else if (start_date) {
      const startTimestamp = new Date(start_date).getTime() / 1000;
      conditions = and(conditions, sql`${trades.trade_date} >= ${startTimestamp}`);
    } else if (end_date) {
      const endTimestamp = new Date(end_date).getTime() / 1000;
      conditions = and(conditions, sql`${trades.trade_date} <= ${endTimestamp}`);
    }
    
    // Count total trades for pagination
    const totalCountResult = await db.select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(conditions);
    
    const totalCount = totalCountResult[0].count;
    
    // Determine sort column and order
    let sortColumn = trades.trade_date;
    if (sort === 'quantity') sortColumn = trades.quantity;
    else if (sort === 'price') sortColumn = trades.price;
    else if (sort === 'net_amount') sortColumn = trades.net_amount;
    
    // Get paginated trades with client and stock details
    const tradeList = await db.query.trades.findMany({
      where: conditions,
      with: {
        client: true,
        stock: true
      },
      orderBy: order === 'desc' ? desc(sortColumn) : sortColumn,
      limit: limit,
      offset: (page - 1) * limit
    });
    
    return c.json({
      success: true,
      data: tradeList,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to fetch trades' });
  }
});

// Get trade by ID
tradeRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid trade ID' });
  }
  
  try {
    const trade = await db.query.trades.findFirst({
      where: eq(trades.id, id),
      with: {
        client: true,
        stock: true
      }
    });
    
    if (!trade) {
      throw new HTTPException(404, { message: 'Trade not found' });
    }
    
    return c.json({
      success: true,
      data: trade
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to fetch trade' });
  }
});

// Update trade
tradeRouter.put('/:id', validateRequest(updateTradeSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const updateData = c.get('validatedBody');
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid trade ID' });
  }
  
  try {
    // Check if trade exists
    const existingTrade = await db.select()
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1);
    
    if (!existingTrade.length) {
      throw new HTTPException(404, { message: 'Trade not found' });
    }
    
    const oldTrade = existingTrade[0];
    
    // Prepare update data
    const dataToUpdate: any = { ...updateData };
    
    // Convert date strings to timestamps if provided
    if (updateData.trade_date) {
      dataToUpdate.trade_date = new Date(updateData.trade_date).getTime() / 1000;
    }
    
    if (updateData.settlement_date) {
      dataToUpdate.settlement_date = new Date(updateData.settlement_date).getTime() / 1000;
    }
    
    // Recalculate total charges and net amount if any of the fee fields are updated
    if (updateData.brokerage_fee !== undefined || 
        updateData.gst !== undefined || 
        updateData.stt !== undefined ||
        updateData.stamp_duty !== undefined ||
        updateData.exchange_fee !== undefined ||
        updateData.sebi_fee !== undefined) {
      
      const brokerage_fee = updateData.brokerage_fee ?? oldTrade.brokerage_fee;
      const gst = updateData.gst ?? oldTrade.gst;
      const stt = updateData.stt ?? oldTrade.stt;
      const stamp_duty = updateData.stamp_duty ?? oldTrade.stamp_duty;
      const exchange_fee = updateData.exchange_fee ?? oldTrade.exchange_fee;
      const sebi_fee = updateData.sebi_fee ?? oldTrade.sebi_fee;
      
      const totalCharges = brokerage_fee + gst + stt + stamp_duty + exchange_fee + sebi_fee;
      dataToUpdate.total_charges = totalCharges;
      
      // Recalculate net amount if price or quantity is also updated
      const price = updateData.price ?? oldTrade.price;
      const quantity = updateData.quantity ?? oldTrade.quantity;
      const type = updateData.type ?? oldTrade.type;
      
      const tradeValue = price * quantity;
      const netAmount = type === 'buy' 
        ? tradeValue + totalCharges 
        : tradeValue - totalCharges;
      
      dataToUpdate.net_amount = netAmount;
    } else if (updateData.price !== undefined || updateData.quantity !== undefined || updateData.type !== undefined) {
      // Recalculate net amount if price, quantity or type is updated
      const price = updateData.price ?? oldTrade.price;
      const quantity = updateData.quantity ?? oldTrade.quantity;
      const type = updateData.type ?? oldTrade.type;
      
      const tradeValue = price * quantity;
      const netAmount = type === 'buy' 
        ? tradeValue + oldTrade.total_charges 
        : tradeValue - oldTrade.total_charges;
      
      dataToUpdate.net_amount = netAmount;
    }
    
    // Update timestamp
    dataToUpdate.updated_at = Math.floor(Date.now() / 1000);
    
    // Update trade
    const result = await db.update(trades)
      .set(dataToUpdate)
      .where(eq(trades.id, id))
      .returning();
    
    const updatedTrade = result[0];
    
    // If trade type, quantity, price, client_id or stock_id has changed, update holdings
    if (updateData.type !== undefined || 
        updateData.quantity !== undefined || 
        updateData.price !== undefined ||
        updateData.client_id !== undefined ||
        updateData.stock_id !== undefined) {
      
      // First, revert the old trade's effect on holdings
      const reverseTrade = {
        ...oldTrade,
        type: oldTrade.type === 'buy' ? 'sell' : 'buy'
      };
      
      try {
        await HoldingsManager.updateHoldings(reverseTrade);
        
        // Then apply the updated trade
        await HoldingsManager.updateHoldings(updatedTrade);
      } catch (holdingsError: any) {
        // If holdings update fails, revert the trade update and throw error
        await db.update(trades)
          .set(oldTrade)
          .where(eq(trades.id, id));
        
        throw new HTTPException(400, { message: holdingsError.message });
      }
    }
    
    return c.json({
      success: true,
      message: 'Trade updated successfully',
      data: updatedTrade
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to update trade' });
  }
});

// Delete trade
tradeRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid trade ID' });
  }
  
  try {
    // Check if trade exists
    const existingTrade = await db.select()
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1);
    
    if (!existingTrade.length) {
      throw new HTTPException(404, { message: 'Trade not found' });
    }
    
    const oldTrade = existingTrade[0];
    
    // Delete trade
    await db.delete(trades).where(eq(trades.id, id));
    
    // Revert the trade's effect on holdings
    const reverseTrade = {
      ...oldTrade,
      type: oldTrade.type === 'buy' ? 'sell' : 'buy'
    };
    
    try {
      await HoldingsManager.updateHoldings(reverseTrade);
    } catch (holdingsError) {
      // If holdings update fails, log error but don't restore the trade
      console.error('Failed to update holdings after trade deletion:', holdingsError);
    }
    
    return c.json({
      success: true,
      message: 'Trade deleted successfully'
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to delete trade' });
  }
});

// Export the router
export default tradeRouter;
