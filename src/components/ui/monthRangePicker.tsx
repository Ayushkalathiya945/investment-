"use client";

import { format } from "date-fns";
import { LucideCalendarFold } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type MonthRange = {
    from?: Date;
    to?: Date;
};

type MonthRangePickerProps = {
    from?: string;
    to?: string;
    onChange: (range: MonthRange) => void;
};

function getYears(start = 2020, end = new Date().getFullYear() + 5) {
    const years = [];
    for (let y = start; y <= end; y++) years.push(y);
    return years;
}

const MonthRangePicker: React.FC<MonthRangePickerProps> = ({ from, to, onChange }) => {
    const [open, setOpen] = React.useState(false);
    const [year, setYear] = React.useState(new Date().getFullYear());

    const [range, setRange] = React.useState<MonthRange>(() => {
        const fromDate = from ? new Date(from) : undefined;
        const toDate = to ? new Date(to) : undefined;

        // Adjust initial from date to first day of month
        const adjustedFromDate = fromDate
            ? new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
            : undefined;

        // Adjust initial to date to last day of month
        const adjustedToDate = toDate
            ? new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0)
            : undefined;

        return {
            from: adjustedFromDate,
            to: adjustedToDate,
        };
    });

    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

    // Handle single month selection
    const handleSingleMonthSelection = (month: Date) => {
        const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
        const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        const newRange = { from: firstDay, to: lastDay };
        setRange(newRange);
        onChange(newRange);
        setOpen(false);
    };

    const handleMonthClick = (month: Date) => {
        if (!range.from || (range.from && range.to)) {
            // When selecting first month, set date to first day of month
            const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
            setRange({ from: firstDayOfMonth, to: undefined });
        } else if (range.from
            && month.getFullYear() === range.from.getFullYear()
            && month.getMonth() === range.from.getMonth()) {
            // If clicking the same month that was already selected as the start,
            // treat it as a single month selection
            handleSingleMonthSelection(month);
        } else {
            let fromDate = range.from;
            let toDate: Date;

            if (month < range.from) {
                // If selecting earlier month as second click, swap and set days appropriately
                fromDate = new Date(month.getFullYear(), month.getMonth(), 1); // First day of earlier month
                toDate = new Date(range.from.getFullYear(), range.from.getMonth() + 1, 0); // Last day of later month
            } else {
                // Normal case - second month is after first month
                fromDate = new Date(range.from.getFullYear(), range.from.getMonth(), 1); // First day of first month
                toDate = new Date(month.getFullYear(), month.getMonth() + 1, 0); // Last day of last month
            }

            const newRange = { from: fromDate, to: toDate };
            setRange(newRange);
            onChange(newRange);
            setOpen(false);
        }
    };

    const clearRange = () => {
        setRange({ from: undefined, to: undefined });
        onChange({ from: undefined, to: undefined });
        setOpen(false);
    };

    const renderMonth = (month: Date) => {
        const selected
      = range.from?.getMonth() === month.getMonth()
          && range.from?.getFullYear() === month.getFullYear();
        const inRange
      = range.from
          && range.to
          && month >= new Date(range.from.getFullYear(), range.from.getMonth())
          && month <= new Date(range.to.getFullYear(), range.to.getMonth());

        return (
            <Button
                key={month.getMonth()}
                className={cn(
                    "p-2 w-24 rounded-md text-sm bg-secondary text-primary hover:bg-primary hover:text-white",
                    selected && "bg-primary text-white",
                    inRange && !selected && "bg-primary text-white",
                )}
                onClick={() => handleMonthClick(month)}
            >
                {format(month, "MMM")}
            </Button>
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="justify-between font-normal h-10 lg:h-12 px-4 py-2 border-border bg-transparent rounded-xl"
                >
                    <span className="text-xs">
                        {range.from
                            ? range.to
                                ? `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`
                                : format(range.from, "MMM yyyy")
                            : "Select Month Range"}
                    </span>
                    <LucideCalendarFold className="h-6 w-6 text-primary" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
                <div className="mb-2">
                    <select
                        className="text-sm border border-border rounded-md px-3 py-2"
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                    >
                        {getYears(2020, 2030).map(y => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {months.map(renderMonth)}
                </div>
                <div className="flex justify-end mt-4">
                    <Button variant="ghost" onClick={clearRange}>
                        Clear
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default MonthRangePicker;
