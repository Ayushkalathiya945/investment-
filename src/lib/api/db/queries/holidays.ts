import { and, eq, gte, lte } from "drizzle-orm";

import type { TransactionType } from "..";
import type { NewHoliday } from "../schema";

import { getDB } from "..";
import { holidays } from "../schema";

export async function create(data: NewHoliday[], tx?: TransactionType) {
    const db = getDB(tx);

    await db
        .insert(holidays)
        .values(data)
        .onConflictDoNothing();
}

export async function checkHoliday(date: Date, tx?: TransactionType) {
    const holiday = await getDB(tx).query.holidays.findFirst({
        where: and(
            eq(holidays.date, date.toISOString().split("T")[0]),
            eq(holidays.exchange, "BSE"),
        ),
    });

    return !!holiday;
}

export async function getHolidayList(from: string, to: string, tx?: TransactionType) {
    const holiday = await getDB(tx)
        .select(
            {
                date: holidays.date,
                name: holidays.name,
                exchange: holidays.exchange,
            },
        )
        .from(holidays)
        .where(and(
            gte(holidays.date, from.split("T")[0]),
            lte(holidays.date, to.split("T")[0]),
        ));

    return holiday;
}
