import { HTTPException } from "hono/http-exception";

export function validateAndConvertToTimestamp(
    tradeDate: Date | number | string,
    fieldName: string = "date",
): number {
    let timestamp: number;

    if (tradeDate instanceof Date) {
        timestamp = tradeDate.getTime();
    } else if (typeof tradeDate === "number") {
        timestamp = tradeDate;
    } else if (typeof tradeDate === "string") {
        const parsedDate = new Date(tradeDate);
        if (Number.isNaN(parsedDate.getTime())) {
            throw new HTTPException(400, {
                message: `Invalid ${fieldName} format. Please provide a valid date.`,
            });
        }
        timestamp = parsedDate.getTime();
    } else {
        throw new HTTPException(400, {
            message: `Invalid ${fieldName} type. Expected Date, number, or string.`,
        });
    }

    if (timestamp === null || Number.isNaN(timestamp)) {
        throw new HTTPException(400, {
            message: `Invalid ${fieldName}. Please provide a valid date.`,
        });
    }

    return timestamp;
}

export function validateDateString(dateString: string, fieldName: string = "date"): Date {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        throw new HTTPException(400, {
            message: `Invalid ${fieldName} format. Please provide a valid date string.`,
        });
    }
    return date;
}

export function convertDateRangeToTimestamps(from?: string, to?: string): {
    From?: number;
    To?: number;
} {
    const From = from ? validateDateString(from, "from").getTime() : undefined;
    const To = to ? validateDateString(to, "to").getTime() : undefined;

    return { From, To };
}
