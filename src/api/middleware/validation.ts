/**
 * This file re-exports Hono's zValidator for validation.
 * 
 * Instead of using this file directly, import zValidator from '@hono/zod-validator' 
 * and use it in your routes like:
 * 
 * ```typescript
 * import { zValidator } from '@hono/zod-validator';
 * import { loginSchema } from '@/api/utils/validation-schemas';
 * 
 * // In your route
 * app.post('/login', zValidator('json', loginSchema), async (c) => {
 *   const data = c.req.valid('json');
 *   // Use validated data
 * });
 * ```
 */

// For backward compatibility with existing code
import type { Context, Next } from 'hono';
import type { z } from 'zod';

import { HTTPException } from 'hono/http-exception';

// Re-export zValidator for backward compatibility
export { zValidator } from '@hono/zod-validator';

/**
 * @deprecated Use zValidator('json', schema) directly instead
 */
export function validateRequest<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      // Parse request body with the provided schema
      const body = await c.req.json();
      const validatedData = schema.parse(body);

      // Add validated data to context for use in route handlers
      c.set('validatedBody', validatedData);

      await next();
    } catch (error: any) {
      if (error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Validation error',
          cause: error,
        });
      }
      throw error;
    }
  };
}

/**
 * @deprecated Use zValidator('query', schema) directly instead
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      // Parse query parameters with the provided schema
      const query = c.req.query();
      const validatedQuery = schema.parse(query);

      // Add validated query to context for use in route handlers
      c.set('validatedQuery', validatedQuery);

      await next();
    } catch (error: any) {
      if (error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Validation error in query parameters',
          cause: error,
        });
      }
      throw error;
    }
  };
}
