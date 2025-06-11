import { db } from '../db';
import { clients, trades, brokerage, payments, stocks, clientHoldings } from '../db/schema';
import { eq, and, sql, desc, between } from 'drizzle-orm';

/**
 * Service to calculate dashboard KPIs
 */
export class KpiCalculator {
  /**
   * Get all dashboard KPIs
   */
  static async getDashboardKpis() {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000;
    
    // Get total clients
    const totalClientsResult = await db.select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(isNull(clients.deleted_at));
    
    const totalClients = totalClientsResult[0].count;
    
    // Get new clients in last 30 days
    const newClientsResult = await db.select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(and(
        isNull(clients.deleted_at),
        sql`${clients.created_at} >= ${thirtyDaysAgo}`
      ));
    
    const newClients = newClientsResult[0].count;
    
    // Get total trades
    const totalTradesResult = await db.select({ count: sql<number>`count(*)` })
      .from(trades);
    
    const totalTrades = totalTradesResult[0].count;
    
    // Get trades in last 30 days
    const recentTradesResult = await db.select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(sql`${trades.trade_date} >= ${thirtyDaysAgo}`);
    
    const recentTrades = recentTradesResult[0].count;
    
    // Get total turnover
    const totalTurnoverResult = await db.select({
      turnover: sql<number>`sum(${trades.quantity} * ${trades.price})`
    }).from(trades);
    
    const totalTurnover = totalTurnoverResult[0].turnover || 0;
    
    // Get monthly turnover
    const monthlyTurnoverResult = await db.select({
      turnover: sql<number>`sum(${trades.quantity} * ${trades.price})`
    })
      .from(trades)
      .where(sql`${trades.trade_date} >= ${startOfMonth}`);
    
    const monthlyTurnover = monthlyTurnoverResult[0].turnover || 0;
    
    // Get total brokerage
    const totalBrokerageResult = await db.select({
      total: sql<number>`sum(${brokerage.total_amount})`
    }).from(brokerage);
    
    const totalBrokerage = totalBrokerageResult[0].total || 0;
    
    // Get outstanding brokerage
    const outstandingBrokerageResult = await db.select({
      total: sql<number>`sum(${brokerage.total_amount})`
    })
      .from(brokerage)
      .where(eq(brokerage.paid, 0));
    
    const outstandingBrokerage = outstandingBrokerageResult[0].total || 0;
    
    // Get total payments
    const totalPaymentsResult = await db.select({
      total: sql<number>`sum(${payments.amount})`
    }).from(payments);
    
    const totalPayments = totalPaymentsResult[0].total || 0;
    
    // Get monthly payments
    const monthlyPaymentsResult = await db.select({
      total: sql<number>`sum(${payments.amount})`
    })
      .from(payments)
      .where(sql`${payments.payment_date} >= ${startOfMonth}`);
    
    const monthlyPayments = monthlyPaymentsResult[0].total || 0;
    
    // Get total portfolio value
    const totalPortfolioValueResult = await db.select({
      total: sql<number>`sum(${clientHoldings.current_value})`
    }).from(clientHoldings);
    
    const totalPortfolioValue = totalPortfolioValueResult[0].total || 0;
    
    return {
      clients: {
        total: totalClients,
        new: newClients,
      },
      trades: {
        total: totalTrades,
        recent: recentTrades,
      },
      turnover: {
        total: totalTurnover,
        monthly: monthlyTurnover,
      },
      brokerage: {
        total: totalBrokerage,
        outstanding: outstandingBrokerage,
      },
      payments: {
        total: totalPayments,
        monthly: monthlyPayments,
      },
      portfolio: {
        totalValue: totalPortfolioValue,
      }
    };
  }

  /**
   * Get monthly statistics
   * @param year The year to get statistics for
   */
  static async getMonthlyStats(year: number = new Date().getFullYear()) {
    const months = [];
    
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(year, month - 1, 1).getTime() / 1000;
      const endDate = new Date(year, month, 0, 23, 59, 59).getTime() / 1000;
      
      // Get monthly turnover
      const turnoverResult = await db.select({
        turnover: sql<number>`sum(${trades.quantity} * ${trades.price})`
      })
        .from(trades)
        .where(between(trades.trade_date, startDate, endDate));
      
      const turnover = turnoverResult[0].turnover || 0;
      
      // Get monthly trades count
      const tradesResult = await db.select({ count: sql<number>`count(*)` })
        .from(trades)
        .where(between(trades.trade_date, startDate, endDate));
      
      const tradesCount = tradesResult[0].count;
      
      // Get monthly brokerage
      const brokerageResult = await db.select({
        total: sql<number>`sum(${brokerage.total_amount})`
      })
        .from(brokerage)
        .where(and(
          eq(brokerage.month, month),
          eq(brokerage.year, year)
        ));
      
      const brokerage = brokerageResult[0].total || 0;
      
      // Get monthly payments
      const paymentsResult = await db.select({
        total: sql<number>`sum(${payments.amount})`
      })
        .from(payments)
        .where(between(payments.payment_date, startDate, endDate));
      
      const payments = paymentsResult[0].total || 0;
      
      months.push({
        month,
        turnover,
        tradesCount,
        brokerage,
        payments
      });
    }
    
    return { year, months };
  }

  /**
   * Get top clients by trading volume
   * @param limit The number of clients to return
   * @param period The period to calculate for ('all', 'month', 'year')
   */
  static async getTopClients(limit: number = 10, period: 'all' | 'month' | 'year' = 'month') {
    let startDate = 0;
    const now = Math.floor(Date.now() / 1000);
    
    if (period === 'month') {
      startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000;
    } else if (period === 'year') {
      startDate = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
    }
    
    let dateCondition = sql`1=1`;
    if (period !== 'all') {
      dateCondition = sql`${trades.trade_date} >= ${startDate}`;
    }
    
    // Get top clients by trading volume
    const topClients = await db.select({
      client_id: trades.client_id,
      turnover: sql<number>`sum(${trades.quantity} * ${trades.price})`,
      trades_count: sql<number>`count(*)`
    })
      .from(trades)
      .where(dateCondition)
      .groupBy(trades.client_id)
      .orderBy(desc(sql`turnover`))
      .limit(limit);
    
    // Get client details
    const result = await Promise.all(
      topClients.map(async (item) => {
        const client = await db.query.clients.findFirst({
          where: eq(clients.id, item.client_id),
          columns: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            pan: true
          }
        });
        
        // Get portfolio value
        const portfolioValueResult = await db.select({
          value: sql<number>`sum(${clientHoldings.current_value})`
        })
          .from(clientHoldings)
          .where(eq(clientHoldings.client_id, item.client_id));
        
        const portfolioValue = portfolioValueResult[0].value || 0;
        
        return {
          ...item,
          client,
          portfolioValue
        };
      })
    );
    
    return result;
  }

  /**
   * Get recent trades summary
   * @param limit The number of trades to return
   */
  static async getRecentTrades(limit: number = 10) {
    // Get recent trades with client and stock details
    const recentTrades = await db.query.trades.findMany({
      with: {
        client: true,
        stock: true
      },
      orderBy: desc(trades.trade_date),
      limit
    });
    
    return recentTrades;
  }
}

// Import isNull for queries
import { isNull } from 'drizzle-orm';
