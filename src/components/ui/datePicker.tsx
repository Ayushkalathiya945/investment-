"use client";

import type { SelectSingleEventHandler } from "react-day-picker";

import { format, getMonth, getYear, setMonth, setYear } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { twMerge } from "tailwind-merge";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

type DatePickerProps = {
    placeholder?: string;
    className?: string;
    selected?: Date;
    onSelect: SelectSingleEventHandler;
};
const DatePicker: React.FC<DatePickerProps> = ({
    placeholder,
    className,
    selected,
    onSelect,
}) => {
    const [open, setOpen] = React.useState(false);
    const [currentMonth, setCurrentMonth] = React.useState<Date>(
        selected || new Date(),
    );
    const handleSelect: SelectSingleEventHandler = (
        day,
        modifiers,
        dayPickerInput,
        e,
    ) => {
        if (onSelect) {
            onSelect(day, modifiers, dayPickerInput, e);
        }
        setOpen(false);
    };

    // Generate years (current year - 10 to current year + 10)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

    // Month names
    const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    // Handle year change
    const handleYearChange = (value: string) => {
        const newYear = Number.parseInt(value);
        const newDate = setYear(currentMonth, newYear);
        setCurrentMonth(newDate);
    };

    // Handle month change
    const handleMonthChange = (value: string) => {
        const newMonth = Number.parseInt(value);
        const newDate = setMonth(currentMonth, newMonth);
        setCurrentMonth(newDate);
    };

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
        >
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={twMerge(
                        "w-full justify-between text-left font-normal bg-primary border-none text-sm hover:bg-primary focus-visible:ring-0 focus-visible:ring-offset-0 h-5",
                        !selected && "text-muted-foreground",
                        className,
                    )}
                >

                    {
                        selected
                            ? (
                                    format(selected, "PPP")
                                )
                            : (
                                    <span>{placeholder}</span>
                                )
                    }
                    <CalendarIcon className="mr-2 h-3 w-3" />

                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-2 p-3 border-b">
                    <Select
                        value={getYear(currentMonth).toString()}
                        onValueChange={handleYearChange}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent className="h-52">
                            {years.map(year => (
                                <SelectItem
                                    key={year}
                                    value={year.toString()}
                                >
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={getMonth(currentMonth).toString()}
                        onValueChange={handleMonthChange}
                    >
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent className="h-52">
                            {months.map((month, index) => (
                                <SelectItem
                                    key={month}
                                    value={index.toString()}
                                >
                                    {month}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={handleSelect}
                    initialFocus
                    defaultMonth={currentMonth}
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                />
            </PopoverContent>
        </Popover>
    );
};

export default DatePicker;
