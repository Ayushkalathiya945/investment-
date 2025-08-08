import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { getHolidayList } from "../db/queries/holidays";
import { fetchAndStoreHolidays } from "../service/AddHoliday";

const holiday = new Hono();

holiday.get("/get/:year", zValidator("param", z.object({ year: z.coerce.number() })), async (c) => {
    const { year } = c.req.valid("param");

    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    try {
        const data = await getHolidayList(start, end);
        return c.json({ success: true, data, message: "Holidays retrieved successfully" });
    } catch (error) {
        return c.json({ success: false, message: "Failed to retrieve holidays", error });
    }
});

holiday.post("/calculate", zValidator("json", z.object({ year: z.coerce.number() })), async (c) => {
    const { year } = c.req.valid("json");

    try {
        await fetchAndStoreHolidays(year);
        return c.json({ success: true, message: "Holidays calculated and stored successfully" });
    } catch (error) {
        return c.json({ success: false, message: "Failed to calculate and store holidays", error });
    }
});

export default holiday;
