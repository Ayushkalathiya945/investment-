import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { stocks } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import { stockSchema, updateStockSchema, stockFilterSchema } from '../utils/validation-schemas';
import { eq, and, like, isNull, desc, sql } from 'drizzle-orm';

// Create a new Hono router for stock routes
const stockRouter = new Hono();

// Apply authentication middleware to all stock routes
stockRouter.use('*', authMiddleware);

// Create new stock
stockRouter.post('/', validateRequest(stockSchema), async (c) => {
  const stockData = c.get('validatedBody');
  
  try {
    // Insert stock into database
    const result = await db.insert(stocks).values({
      symbol: stockData.symbol.toUpperCase(),
      name: stockData.name,
      exchange: stockData.exchange,
      isin: stockData.isin.toUpperCase(),
      sector: stockData.sector,
      current_price: stockData.current_price || 0,
      last_updated: Math.floor(Date.now() / 1000),
    }).returning();
    
    return c.json({
      success: true,
      message: 'Stock created successfully',
      data: result[0]
    }, 201);
  } catch (error: any) {
    // Handle unique constraint violations
    if (error.message?.includes('UNIQUE constraint failed')) {
      if (error.message.includes('symbol')) {
        throw new HTTPException(409, { message: 'Stock symbol already exists' });
      } else if (error.message.includes('isin')) {
        throw new HTTPException(409, { message: 'ISIN already exists' });
      }
    }
    throw new HTTPException(500, { message: 'Failed to create stock' });
  }
});

// Get all stocks with pagination and search
stockRouter.get('/', validateQuery(stockFilterSchema), async (c) => {
  const { page, limit, search, exchange, sector, sort, order } = c.get('validatedQuery');
  
  try {
    // Build query conditions
    let conditions = isNull(stocks.deleted_at);
    
    if (search) {
      conditions = and(
        conditions,
        sql`(${stocks.symbol} LIKE ${`%${search}%`} OR 
             ${stocks.name} LIKE ${`%${search}%`} OR 
             ${stocks.isin} LIKE ${`%${search}%`})`
      );
    }
    
    if (exchange) {
      conditions = and(conditions, eq(stocks.exchange, exchange));
    }
    
    if (sector) {
      conditions = and(conditions, eq(stocks.sector, sector));
    }
    
    // Count total stocks for pagination
    const totalCountResult = await db.select({ count: sql<number>`count(*)` })
      .from(stocks)
      .where(conditions);
    
    const totalCount = totalCountResult[0].count;
    
    // Determine sort column and order
    let sortColumn = stocks.symbol;
    if (sort === 'name') sortColumn = stocks.name;
    else if (sort === 'current_price') sortColumn = stocks.current_price;
    
    // Get paginated stocks
    const stockList = await db.select()
      .from(stocks)
      .where(conditions)
      .orderBy(order === 'desc' ? desc(sortColumn) : sortColumn)
      .limit(limit)
      .offset((page - 1) * limit);
    
    return c.json({
      success: true,
      data: stockList,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to fetch stocks' });
  }
});

// Get stock by ID
stockRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid stock ID' });
  }
  
  try {
    const stock = await db.select()
      .from(stocks)
      .where(and(
        eq(stocks.id, id),
        isNull(stocks.deleted_at)
      ))
      .limit(1);
    
    if (!stock.length) {
      throw new HTTPException(404, { message: 'Stock not found' });
    }
    
    return c.json({
      success: true,
      data: stock[0]
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to fetch stock' });
  }
});

// Update stock
stockRouter.put('/:id', validateRequest(updateStockSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const updateData = c.get('validatedBody');
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid stock ID' });
  }
  
  try {
    // Check if stock exists
    const existingStock = await db.select({ id: stocks.id })
      .from(stocks)
      .where(and(
        eq(stocks.id, id),
        isNull(stocks.deleted_at)
      ))
      .limit(1);
    
    if (!existingStock.length) {
      throw new HTTPException(404, { message: 'Stock not found' });
    }
    
    // Prepare update data
    const dataToUpdate: any = { ...updateData };
    
    // Convert symbol and ISIN to uppercase if provided
    if (updateData.symbol) {
      dataToUpdate.symbol = updateData.symbol.toUpperCase();
    }
    
    if (updateData.isin) {
      dataToUpdate.isin = updateData.isin.toUpperCase();
    }
    
    // Update timestamp
    dataToUpdate.updated_at = Math.floor(Date.now() / 1000);
    
    if (updateData.current_price) {
      dataToUpdate.last_updated = Math.floor(Date.now() / 1000);
    }
    
    // Update stock
    const result = await db.update(stocks)
      .set(dataToUpdate)
      .where(eq(stocks.id, id))
      .returning();
    
    return c.json({
      success: true,
      message: 'Stock updated successfully',
      data: result[0]
    });
  } catch (error: any) {
    // Handle unique constraint violations
    if (error.message?.includes('UNIQUE constraint failed')) {
      if (error.message.includes('symbol')) {
        throw new HTTPException(409, { message: 'Stock symbol already exists' });
      } else if (error.message.includes('isin')) {
        throw new HTTPException(409, { message: 'ISIN already exists' });
      }
    }
    throw new HTTPException(500, { message: 'Failed to update stock' });
  }
});

// Soft delete stock
stockRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid stock ID' });
  }
  
  try {
    // Check if stock exists
    const existingStock = await db.select({ id: stocks.id })
      .from(stocks)
      .where(and(
        eq(stocks.id, id),
        isNull(stocks.deleted_at)
      ))
      .limit(1);
    
    if (!existingStock.length) {
      throw new HTTPException(404, { message: 'Stock not found' });
    }
    
    // Soft delete stock
    await db.update(stocks)
      .set({
        deleted_at: Math.floor(Date.now() / 1000),
        active: 0,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(stocks.id, id));
    
    return c.json({
      success: true,
      message: 'Stock deleted successfully'
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to delete stock' });
  }
});

// Export the router
export default stockRouter;
