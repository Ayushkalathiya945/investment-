"use client";

import type { DateRange } from "react-day-picker";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { LucideCalendarFold } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const formSchema = z.object({
    dateRange: z
        .object({
            from: z.date().optional(),
            to: z.date().optional(),
        })
        .optional(),
});

type FormValues = z.infer<typeof formSchema>;

// help me to add the props to the component
type RangeDatePickerProps = {
    onChange: (date: DateRange) => void;
    from?: string;
    to?: string;
};

const RangeDatePicker: React.FC<RangeDatePickerProps> = ({ from, to, onChange }) => {
    // Parse dates safely
    const parseDate = (dateStr?: string): Date | undefined => {
        if (!dateStr)
            return undefined;
        try {
            const parsedDate = new Date(dateStr);
            return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
        } catch (e) {
            console.error("Failed to parse date:", dateStr, e);
            return undefined;
        }
    };

    // Parse the incoming date strings
    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    // console.log("RangeDatePicker received:", { from, to });
    // console.log("Parsed dates:", { fromDate, toDate });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            dateRange: {
                from: fromDate,
                to: toDate,
            },
        },
    });

    const [date, setDate] = React.useState<DateRange | undefined>(
        fromDate || toDate
            ? { from: fromDate, to: toDate }
            : undefined,
    );

    // Use ref to track internal updates vs. prop changes
    const isInternalUpdate = React.useRef(false);
    const onClear = () => {
        // Mark as internal update since user is clearing
        isInternalUpdate.current = true;

        // Update internal state
        setDate({
            from: undefined,
            to: undefined,
        });

        // Clear the form
        form.setValue("dateRange", { from: undefined, to: undefined });
    };

    // Update form value when date changes internally (from the calendar)
    React.useEffect(() => {
        if (!date)
            return;

        // Update the form value
        form.setValue("dateRange", date);

        // Only notify parent if this was an internal update (user selection)
        if (isInternalUpdate.current) {
            // console.log("RangeDatePicker internal update, notifying parent:", date);
            onChange(date);
            isInternalUpdate.current = false;
        }
    }, [date, form, onChange]);

    // Handle prop changes - only update the internal state if props change significantly
    // This prevents infinite loops between parent and child state
    React.useEffect(() => {
        const newFromDate = parseDate(from);
        const newToDate = parseDate(to);

        // We need to compare the date values, not the Date objects
        const hasFromChanged = newFromDate?.getTime() !== date?.from?.getTime();
        const hasToChanged = newToDate?.getTime() !== date?.to?.getTime();

        // Only update if dates actually changed and it's not due to our internal change
        if ((hasFromChanged || hasToChanged) && !isInternalUpdate.current) {
            // console.log("RangeDatePicker props changed significantly, updating internal state");
            setDate(newFromDate || newToDate ? { from: newFromDate, to: newToDate } : undefined);
        }
    }, [from, to, date]);

    return (
        <Form {...form}>
            <form className="space-y-4">
                <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                        <FormItem>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-between text-left font-normal h-10 lg:h-12 px-4 py-2 border-border bg-transparent rounded-xl",
                                                !field.value && "text-[989898]",
                                            )}
                                        >
                                            <span className="text-xs">
                                                {field.value?.from instanceof Date
                                                    ? (
                                                            field.value.to instanceof Date
                                                                ? (
                                                                        <>
                                                                            {format(field.value.from, "LLL dd, y")}
                                                                            {" "}
                                                                            -
                                                                            {" "}
                                                                            {format(field.value.to, "LLL dd, y")}
                                                                        </>
                                                                    )
                                                                : (
                                                                        format(field.value.from, "LLL dd, y")
                                                                    )
                                                        )
                                                    : (
                                                            "Date Range"
                                                        )}

                                            </span>
                                            <LucideCalendarFold className="h-6 w-6 text-primary" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-auto p-0"
                                    align="start"
                                >
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={(newDate) => {
                                            // Mark that this change is coming from user interaction
                                            isInternalUpdate.current = true;
                                            setDate(newDate);
                                        }}
                                        numberOfMonths={2}
                                    />
                                    <div className="flex justify-end p-2">
                                        <Button type="submit" onClick={onClear}>Clear</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </FormItem>
                    )}
                />
            </form>
        </Form>
    );
};

export default RangeDatePicker;
