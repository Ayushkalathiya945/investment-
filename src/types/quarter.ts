import { z } from "zod";

export type Quarter = {
    id: number;
    year: number;
    quarterNumber: number;
    daysInQuarter: number;
    createdAt: Date;
    updatedAt: Date;
};

export type QuarterData = {
    quarterNumber: number;
    daysInQuarter: number;
};

export type CreateQuarterInput = {
    year: number;
    quarters: QuarterData[];
};

export type UpdateQuarterInput = {} & CreateQuarterInput;

export type QuarterResponse = {} & Quarter;

export const quarterSchema = z.object({
    quarterNumber: z.number()
        .int()
        .min(1, "Quarter number must be between 1 and 4")
        .max(4, "Quarter number must be between 1 and 4"),
    daysInQuarter: z.number()
        .int()
        .min(1, "Days in quarter must be at least 1")
        .max(92, "Days in quarter cannot exceed 92"),
});

export const createQuarterSchema = z.object({
    year: z.number()
        .int()
        .min(2000, "Year must be 2000 or later")
        .max(2100, "Year must be 2100 or earlier"),
    quarters: z.array(quarterSchema).length(4, "Must provide exactly 4 quarters"),
});

export const updateQuarterSchema = createQuarterSchema;
