import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import * as brokerageQueries from "@/api/db/queries/brokerage";
import { authMiddleware } from "@/api/middleware/auth";
import { brokerageFilterSchema } from "@/api/utils/validation-schemas";

// Create a new Hono router for brokerage routes
const brokerageRouter = new Hono();

// Apply authentication middleware to all brokerage routes
brokerageRouter.use("*", authMiddleware);

// Mark brokerage calculation as paid
brokerageRouter.post("/get-all", zValidator("json", brokerageFilterSchema), async (c) => {
    const { page, limit, clientId, month, year } = c.req.valid("json");

    try {
        const from = new Date(year, month - 1, 1).getTime();
        const to = new Date(year, month, 0).getTime();

        const { brokerage, count } = await brokerageQueries.findAllWithPagination({ page, limit, clientId, from, to });

        const totalPage = Math.ceil(count / limit);

        return c.json({
            success: true,
            data: brokerage,
            metadata: {
                total: count,
                hasNext: page < totalPage,
            },
        });
    } catch (error: any) {
        if (error.message === "Brokerage calculation not found") {
            throw new HTTPException(404, { message: error.message });
        }
        throw new HTTPException(500, { message: "Failed to fetch brokerage" });
    }
});

// Export the router
export default brokerageRouter;
