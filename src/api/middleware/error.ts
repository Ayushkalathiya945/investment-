import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// Error handling middleware
export const errorMiddleware = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);

    if (error instanceof HTTPException) {
      // Handle Hono HTTP exceptions
      return c.json({
        success: false,
        message: error.message,
        status: error.status,
      }, error.status);
    } else if (error instanceof ZodError) {
      // Handle validation errors
      return c.json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
        status: 400,
      }, 400);
    } else if (error instanceof Error) {
      // Handle general errors
      return c.json({
        success: false,
        message: error.message || 'Internal server error',
        status: 500,
      }, 500);
    } else {
      // Handle unknown errors
      return c.json({
        success: false,
        message: 'Internal server error',
        status: 500,
      }, 500);
    }
  }
};
