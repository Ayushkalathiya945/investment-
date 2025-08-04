import { and, eq } from "drizzle-orm";

import { db } from "@/lib/api/db";

import { quarters } from "../schema";

type CreateQuarter = typeof quarters.$inferInsert;

type UpdateQuarter = Partial<CreateQuarter>;

export async function create(quarterData: CreateQuarter) {
    try {
        const [newQuarter] = await db.insert(quarters).values(quarterData).returning();
        return newQuarter;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("UNIQUE constraint failed")) {
                throw new Error("A quarter with this year and quarter number already exists");
            }
        }
        throw error;
    }
}

export async function getByYearAndQuarter(year: number, quarterNumber: number) {
    const [quarter] = await db
        .select()
        .from(quarters)
        .where(
            and(
                eq(quarters.year, year),
                eq(quarters.quarterNumber, quarterNumber),
            ),
        )
        .limit(1);

    return quarter || null;
}

export async function update(id: number, data: UpdateQuarter) {
    try {
        const [updatedQuarter] = await db
            .update(quarters)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(quarters.id, id))
            .returning();

        if (!updatedQuarter) {
            throw new Error(`Quarter with ID ${id} not found`);
        }

        return updatedQuarter;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("UNIQUE constraint failed")) {
                throw new Error("A quarter with this year and quarter number already exists");
            }
        }
        throw error;
    }
}

export type { CreateQuarter, UpdateQuarter };
