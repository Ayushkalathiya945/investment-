import { Hono } from "hono";

import { db } from "../db";
import * as stock from "../db/queries/stock";

const app = new Hono();

app.get("/symbols", async (c) => {
    const symbols = await stock.getAllSymbols(db);
    return c.json({ message: "stock symbols fetched successfully", symbols });
});

export default app;
