import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { clients, payments, brokerage } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import { paymentSchema, updatePaymentSchema, paymentFilterSchema } from '../utils/validation-schemas';
import { eq, and, isNull, desc, between } from 'drizzle-orm';
import { BrokerageCalculator } from '../services/brokerage-calculator';

// Create a new Hono router for payment routes
const paymentRouter = new Hono();

// Apply authentication middleware to all payment routes
paymentRouter.use('*', authMiddleware);

// Record new payment
paymentRouter.post('/', validateRequest(paymentSchema), async (c) => {
  const paymentData = c.get('validatedBody');
  
  try {
    // Validate client exists
    const client = await db.select({ id: clients.id })
      .from(clients)
      .where(and(
        eq(clients.id, paymentData.client_id),
        isNull(clients.deleted_at),
        eq(clients.active, 1)
      ))
      .limit(1);
    
    if (!client.length) {
      throw new HTTPException(404, { message: 'Client not found or inactive' });
    }
    
    // Validate brokerage calculation if provided
    if (paymentData.brokerage_calculation_id) {
      const calculation = await db.select()
        .from(brokerage)
        .where(and(
          eq(brokerage.id, paymentData.brokerage_calculation_id),
          eq(brokerage.client_id, paymentData.client_id)
        ))
        .limit(1);
      
      if (!calculation.length) {
        throw new HTTPException(404, { message: 'Brokerage calculation not found or does not belong to this client' });
      }
      
      // Mark brokerage calculation as paid
      await BrokerageCalculator.markAsPaid(paymentData.brokerage_calculation_id);
    }
    
    // Convert date string to timestamp
    const paymentDate = new Date(paymentData.payment_date).getTime() / 1000;
    
    // Insert payment into database
    const result = await db.insert(payments).values({
      client_id: paymentData.client_id,
      brokerage_calculation_id: paymentData.brokerage_calculation_id,
      amount: paymentData.amount,
      payment_date: paymentDate,
      payment_method: paymentData.payment_method,
      reference_number: paymentData.reference_number,
      notes: paymentData.notes,
    }).returning();
    
    return c.json({
      success: true,
      message: 'Payment recorded successfully',
      data: result[0]
    }, 201);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to record payment' });
  }
});

// Get all payments with filters
paymentRouter.get('/', validateQuery(paymentFilterSchema), async (c) => {
  const { page, limit, client_id, payment_method, start_date, end_date, sort, order } = c.get('validatedQuery');
  
  try {
    // Build query conditions
    let conditions = sql`1=1`;
    
    if (client_id) {
      conditions = and(conditions, eq(payments.client_id, client_id));
    }
    
    if (payment_method) {
      conditions = and(conditions, eq(payments.payment_method, payment_method));
    }
    
    if (start_date && end_date) {
      const startTimestamp = new Date(start_date).getTime() / 1000;
      const endTimestamp = new Date(end_date).getTime() / 1000;
      conditions = and(conditions, between(payments.payment_date, startTimestamp, endTimestamp));
    } else if (start_date) {
      const startTimestamp = new Date(start_date).getTime() / 1000;
      conditions = and(conditions, sql`${payments.payment_date} >= ${startTimestamp}`);
    } else if (end_date) {
      const endTimestamp = new Date(end_date).getTime() / 1000;
      conditions = and(conditions, sql`${payments.payment_date} <= ${endTimestamp}`);
    }
    
    // Count total payments for pagination
    const totalCountResult = await db.select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(conditions);
    
    const totalCount = totalCountResult[0].count;
    
    // Determine sort column and order
    let sortColumn = payments.payment_date;
    if (sort === 'amount') sortColumn = payments.amount;
    
    // Get paginated payments with client details
    const paymentList = await db.query.payments.findMany({
      where: conditions,
      with: {
        client: true,
        brokerageCalculation: true
      },
      orderBy: order === 'desc' ? desc(sortColumn) : sortColumn,
      limit: limit,
      offset: (page - 1) * limit
    });
    
    return c.json({
      success: true,
      data: paymentList,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to fetch payments' });
  }
});

// Get client's payment history
paymentRouter.get('/client/:clientId', async (c) => {
  const clientId = parseInt(c.req.param('clientId'), 10);
  
  if (isNaN(clientId)) {
    throw new HTTPException(400, { message: 'Invalid client ID' });
  }
  
  try {
    // Check if client exists
    const client = await db.select({ id: clients.id })
      .from(clients)
      .where(and(
        eq(clients.id, clientId),
        isNull(clients.deleted_at)
      ))
      .limit(1);
    
    if (!client.length) {
      throw new HTTPException(404, { message: 'Client not found' });
    }
    
    // Get client's payment history
    const paymentHistory = await db.query.payments.findMany({
      where: eq(payments.client_id, clientId),
      with: {
        brokerageCalculation: true
      },
      orderBy: desc(payments.payment_date)
    });
    
    return c.json({
      success: true,
      data: paymentHistory
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to fetch payment history' });
  }
});

// Get payment by ID
paymentRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid payment ID' });
  }
  
  try {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, id),
      with: {
        client: true,
        brokerageCalculation: true
      }
    });
    
    if (!payment) {
      throw new HTTPException(404, { message: 'Payment not found' });
    }
    
    return c.json({
      success: true,
      data: payment
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to fetch payment' });
  }
});

// Update payment
paymentRouter.put('/:id', validateRequest(updatePaymentSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const updateData = c.get('validatedBody');
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid payment ID' });
  }
  
  try {
    // Check if payment exists
    const existingPayment = await db.select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    
    if (!existingPayment.length) {
      throw new HTTPException(404, { message: 'Payment not found' });
    }
    
    // Prepare update data
    const dataToUpdate: any = { ...updateData };
    
    // Convert date string to timestamp if provided
    if (updateData.payment_date) {
      dataToUpdate.payment_date = new Date(updateData.payment_date).getTime() / 1000;
    }
    
    // Update timestamp
    dataToUpdate.updated_at = Math.floor(Date.now() / 1000);
    
    // Update payment
    const result = await db.update(payments)
      .set(dataToUpdate)
      .where(eq(payments.id, id))
      .returning();
    
    return c.json({
      success: true,
      message: 'Payment updated successfully',
      data: result[0]
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to update payment' });
  }
});

// Delete payment
paymentRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid payment ID' });
  }
  
  try {
    // Check if payment exists
    const existingPayment = await db.select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    
    if (!existingPayment.length) {
      throw new HTTPException(404, { message: 'Payment not found' });
    }
    
    // If payment is linked to a brokerage calculation, unmark it as paid
    if (existingPayment[0].brokerage_calculation_id) {
      await db.update(brokerage)
        .set({
          paid: 0,
          updated_at: Math.floor(Date.now() / 1000)
        })
        .where(eq(brokerage.id, existingPayment[0].brokerage_calculation_id));
    }
    
    // Delete payment
    await db.delete(payments).where(eq(payments.id, id));
    
    return c.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to delete payment' });
  }
});

// Get outstanding amounts
paymentRouter.get('/outstanding', async (c) => {
  try {
    // Get outstanding brokerage calculations
    const outstandingBrokerage = await BrokerageCalculator.getOutstandingBrokerage();
    
    // Calculate total outstanding amount
    const totalOutstanding = outstandingBrokerage.reduce(
      (sum, calculation) => sum + calculation.total_amount,
      0
    );
    
    // Group by client
    const clientMap = new Map();
    
    for (const calculation of outstandingBrokerage) {
      if (!clientMap.has(calculation.client_id)) {
        // Get client details
        const client = await db.query.clients.findFirst({
          where: eq(clients.id, calculation.client_id),
          columns: {
            id: true,
            name: true,
            email: true,
            mobile: true
          }
        });
        
        clientMap.set(calculation.client_id, {
          client,
          calculations: [],
          totalAmount: 0
        });
      }
      
      const clientData = clientMap.get(calculation.client_id);
      clientData.calculations.push(calculation);
      clientData.totalAmount += calculation.total_amount;
    }
    
    return c.json({
      success: true,
      data: {
        totalOutstanding,
        clients: Array.from(clientMap.values())
      }
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to fetch outstanding amounts' });
  }
});

// Export the router
export default paymentRouter;

// Import sql for query conditions
import { sql } from 'drizzle-orm';
