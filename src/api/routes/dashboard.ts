import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middleware/auth';
import { KpiCalculator } from '../services/kpi-calculator';

// Create a new Hono router for dashboard routes
const dashboardRouter = new Hono();

// Apply authentication middleware to all dashboard routes
dashboardRouter.use('*', authMiddleware);

// Get all dashboard KPIs
dashboardRouter.get('/kpis', async (c) => {
  try {
    const kpis = await KpiCalculator.getDashboardKpis();
    
    return c.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to fetch dashboard KPIs' });
  }
});

// Get monthly statistics
dashboardRouter.get('/monthly-stats', async (c) => {
  try {
    const year = parseInt(c.req.query('year') || new Date().getFullYear().toString(), 10);
    
    if (isNaN(year) || year < 2000 || year > 2100) {
      throw new HTTPException(400, { message: 'Invalid year parameter' });
    }
    
    const monthlyStats = await KpiCalculator.getMonthlyStats(year);
    
    return c.json({
      success: true,
      data: monthlyStats
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to fetch monthly statistics' });
  }
});

// Get top clients by volume
dashboardRouter.get('/top-clients', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const period = c.req.query('period') || 'month';
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new HTTPException(400, { message: 'Invalid limit parameter' });
    }
    
    if (!['all', 'month', 'year'].includes(period)) {
      throw new HTTPException(400, { message: 'Invalid period parameter' });
    }
    
    const topClients = await KpiCalculator.getTopClients(
      limit, 
      period as 'all' | 'month' | 'year'
    );
    
    return c.json({
      success: true,
      data: topClients
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to fetch top clients' });
  }
});

// Get recent trades summary
dashboardRouter.get('/recent-trades', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new HTTPException(400, { message: 'Invalid limit parameter' });
    }
    
    const recentTrades = await KpiCalculator.getRecentTrades(limit);
    
    return c.json({
      success: true,
      data: recentTrades
    });
  } catch (error) {
    throw new HTTPException(500, { message: 'Failed to fetch recent trades' });
  }
});

// Export the router
export default dashboardRouter;
