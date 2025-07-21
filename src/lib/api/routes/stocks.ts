import { Hono } from "hono";

import { db } from "../db"; // Assuming you have a drizzle-orm db setup
import * as stock from "../db/queries/stock";

// Define the Hono app
const app = new Hono();

// Route to get all stock symbols
app.get("/symbols", async (c) => {
    const symbols = await stock.getAllSymbols(db);
    return c.json({ message: "stock symbols fetched successfully", symbols });
});

export default app;
