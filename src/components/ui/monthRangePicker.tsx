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

    const [range, setRange] = React.useState<MonthRange>({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
    });

    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

    const handleMonthClick = (month: Date) => {
        if (!range.from || (range.from && range.to)) {
            setRange({ from: month, to: undefined });
        } else {
            const newRange = month < range.from ? { from: month, to: range.from } : { from: range.from, to: month };
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
                    className="w-full justify-between font-normal h-10 lg:h-12 px-4 py-2 border-border bg-transparent rounded-xl"
                >
                    <span className="text-xs">
                        {range.from
                            ? range.to
                                ? `${format(range.from, "MMM yyyy")} - ${format(range.to, "MMM yyyy")}`
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
