import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { create, getByYearAndQuarter, update } from "@/lib/api/db/queries/quartes";
import { createQuarterSchema, updateQuarterSchema } from "@/types/quarter";

import { db } from "../db";
import { quarters as quartersTable } from "../db/schema";

const quarter = new Hono();

quarter.post(
    "/create",
    zValidator("json", createQuarterSchema),
    async (c) => {
        const { year, quarters: quartersData } = await c.req.valid("json");

        try {
            const existingQuarters = await Promise.all(
                quartersData.map(q =>
                    getByYearAndQuarter(year, q.quarterNumber),
                ),
            );

            const existing = existingQuarters.some(q => q !== null);
            if (existing) {
                throw new HTTPException(400, { message: "One or more quarters already exist for this year" });
            }

            const createdQuarters = await Promise.all(
                quartersData.map(q => create({
                    year,
                    quarterNumber: q.quarterNumber,
                    daysInQuarter: q.daysInQuarter,
                })),
            );

            return c.json({
                success: true,
                data: createdQuarters,
                message: "Quarters created successfully",
            });
        } catch (error) {
            if (error instanceof HTTPException)
                throw error;
            console.error("Error creating quarters:", error);
            throw new HTTPException(500, { message: "Failed to create quarters" });
        }
    },
);

quarter.put(
    "/update/:year",
    zValidator("param", z.object({
        year: z.string().regex(/^\d{4}$/, { message: "Year must be a 4-digit number" }),
    })),
    zValidator("json", updateQuarterSchema),
    async (c) => {
        const { year } = c.req.valid("param");
        const { year: requestYear, quarters } = c.req.valid("json");
        const yearNum = Number.parseInt(year);

        if (yearNum !== requestYear) {
            throw new HTTPException(400, {
                message: "Year in URL does not match year in request body",
            });
        }

        try {
            const existingQuarters = await db
                .select()
                .from(quartersTable)
                .where(eq(quartersTable.year, yearNum));

            const updatePromises = quarters.map((q) => {
                const existingQuarter = existingQuarters.find(
                    eqQ => eqQ.quarterNumber === q.quarterNumber,
                );

                if (existingQuarter) {
                    return update(existingQuarter.id, {
                        daysInQuarter: q.daysInQuarter,
                    });
                } else {
                    return create({
                        year: yearNum,
                        quarterNumber: q.quarterNumber,
                        daysInQuarter: q.daysInQuarter,
                    });
                }
            });

            const updatedQuarters = await Promise.all(updatePromises);

            return c.json({
                success: true,
                data: updatedQuarters,
                message: "Quarters updated successfully",
            });
        } catch (error) {
            console.error("Error updating quarters:", error);
            if (error instanceof HTTPException)
                throw error;
            throw new HTTPException(500, { message: "Failed to update quarters" });
        }
    },
);

quarter.get(
    "/year/:year",
    zValidator("param", z.object({
        year: z.string(),
    })),
    async (c) => {
        const { year } = c.req.valid("param");
        const yearNum = Number.parseInt(year);

        try {
            // Get all quarters for the year
            const quarters = [];
            for (let q = 1; q <= 4; q++) {
                const quarter = await getByYearAndQuarter(yearNum, q);
                if (quarter)
                    quarters.push(quarter);
            }

            return c.json({
                success: true,
                data: quarters,
                message: quarters.length ? "Quarters retrieved successfully" : "No quarters found for this year",
            });
        } catch (error) {
            throw new HTTPException(500, { message: `Failed to retrieve quarters ${error}` });
        }
    },
);

quarter.get(
    "/:year/:quarterNumber",
    zValidator("param", z.object({
        year: z.string().regex(/^\d{4}$/, { message: "Year must be a 4-digit number" }),
        quarterNumber: z.string().regex(/^[1-4]$/, { message: "Quarter number must be between 1 and 4" }),
    })),
    async (c) => {
        const { year, quarterNumber } = c.req.valid("param");

        try {
            const quarter = await getByYearAndQuarter(
                Number.parseInt(year),
                Number.parseInt(quarterNumber),
            );

            if (!quarter) {
                throw new HTTPException(404, { message: "Quarter not found" });
            }

            return c.json({
                success: true,
                data: quarter,
                message: "Quarter retrieved successfully",
            });
        } catch (error) {
            if (error instanceof HTTPException)
                throw error;
            throw new HTTPException(500, { message: "Failed to retrieve quarter" });
        }
    },
);

export default quarter;
