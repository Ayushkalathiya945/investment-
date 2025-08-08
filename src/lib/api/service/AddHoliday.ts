import axios from "axios";

import env from "@/env";

import type { NewHoliday } from "../db/schema";

import * as holiday from "../db/queries/holidays";
import { addAllQuarters } from "../db/queries/quartes";

export async function fetchAndStoreHolidays(year: number): Promise<void> {
    const apiKey = env.HOLIDAY_API_KEY;
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const apiUrlBse = `https://financialmodelingprep.com/stable/holidays-by-exchange?exchange=BSE&from=${from}&to=${to}&apikey=${apiKey}`;
    const apiUrlNse = `https://financialmodelingprep.com/stable/holidays-by-exchange?exchange=NSE&from=${from}&to=${to}&apikey=${apiKey}`;

    try {
        const [bseRes, nseRes] = await Promise.all([
            axios(apiUrlBse),
            axios(apiUrlNse),
        ]);

        if (bseRes.status === 200 && nseRes.status === 200) {
            const allHolidays = [...bseRes.data, ...nseRes.data];

            const matchingHolidays: NewHoliday[] = allHolidays.map((h: any) => ({
                date: h.date,
                exchange: h.exchange as "NSE" | "BSE",
                name: h.name,
                isClosed: 1,
            }));

            if (matchingHolidays.length > 0) {
                await holiday.create(matchingHolidays);
                await calculateDaysOfAllQuartersAndSaveInQuarters(new Date(from), new Date(to), matchingHolidays);
            }
        } else {
            console.error("One or both holiday API calls failed.");
        }
    } catch (error) {
        console.error(`Failed to fetch/store holidays: ${error}`);
        throw error;
    }
}

export async function checkCurrentYearHolidayExists(year: number): Promise<boolean> {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const holidayList = await holiday.getHolidayList(from, to);

    return holidayList.length > 0;
}

export async function calculateDaysOfAllQuartersAndSaveInQuarters(
    startDate: Date,
    endDate: Date,
    holidayList: NewHoliday[],
) {
    const holidayDates = new Set(
        holidayList.map(h => h.date),
    );

    const results: { year: number; quarterNumber: number; daysInQuarter: number }[] = [];

    let current = new Date(startDate);

    while (current <= endDate) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const quarterNumber = Math.floor(month / 3) + 1;

        const qStart = new Date(year, (quarterNumber - 1) * 3, 1);
        const qEnd = new Date(year, quarterNumber * 3, 0);

        let daysInQuarter = 0;

        const day = new Date(qStart);
        const endDate = new Date(qEnd);

        // eslint-disable-next-line no-unmodified-loop-condition
        while (day <= endDate) {
            const dateStr = formatDateIST(day);

            if (!holidayDates.has(dateStr) && !isWeekend(day)) {
                daysInQuarter++;
            }

            day.setDate(day.getDate() + 1);
        }

        results.push({ year, quarterNumber, daysInQuarter });

        current = new Date(qEnd);
        current.setDate(current.getDate() + 1);
    }

    try {
        await addAllQuarters(results);
    } catch (error) {
        console.error("Error adding all quarters:", error);
        throw error;
    }
}

export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

export function formatDateIST(date: Date): string {
    return date.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}
