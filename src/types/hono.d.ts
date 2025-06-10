import type { z } from "zod";

import type * as schemas from "../api/utils/validation-schemas";

// Extend Hono's ContextVariables interface to include our custom properties
declare module "hono" {
  type ContextVariables = {
    validatedBody: z.infer<typeof schemas.loginSchema> | 
                   z.infer<typeof schemas.clientSchema> | 
                   z.infer<typeof schemas.updateClientSchema> |
                   z.infer<typeof schemas.stockSchema> |
                   z.infer<typeof schemas.updateStockSchema> |
                   z.infer<typeof schemas.tradeSchema> |
                   z.infer<typeof schemas.updateTradeSchema> |
                   z.infer<typeof schemas.brokerageCalculationSchema> |
                   z.infer<typeof schemas.bulkBrokerageCalculationSchema> |
                   z.infer<typeof schemas.paymentSchema> |
                   z.infer<typeof schemas.updatePaymentSchema>;
    validatedQuery: z.infer<typeof schemas.paginationSchema> |
                    z.infer<typeof schemas.dateRangeSchema> |
                    z.infer<typeof schemas.clientFilterSchema> |
                    z.infer<typeof schemas.stockFilterSchema> |
                    z.infer<typeof schemas.tradeFilterSchema> |
                    z.infer<typeof schemas.paymentFilterSchema>;
    user?: {
      id: string;
      username: string;
      role: string;
    };
  }
}
