import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

import { errorMiddleware } from "../api/middleware/error";
// Import routes
import authRouter from "../api/routes/auth";
import brokerageRouter from "../api/routes/brokerage";
import clientRouter from "../api/routes/clients";
import paymentRouter from "../api/routes/payments";
import tradeRouter from "../api/routes/trades";
import quarterRouter from "./routes/quarter";
import readCsv from "./routes/stocks";

// Create Hono app
const api = new Hono().basePath("/api");

// Apply global middleware
api.use("*", logger());
api.use("*", prettyJSON());
api.use("*", cors());
api.use("*", errorMiddleware);

// Health check route
api.get("/", (c) => {
    return c.json({
        status: "ok",
        message: "InvestAsure Brokerage API is running",
        version: "1.0.0",
    });
});

// Mount routes
api.route("/auth", authRouter);
api.route("/clients", clientRouter);
api.route("/trades", tradeRouter);
api.route("/brokerage", brokerageRouter);
api.route("/payments", paymentRouter);
api.route("/quarter", quarterRouter);

// read csvs and store it
api.route("/stocks", readCsv);

// Export the Hono app
export default api;
