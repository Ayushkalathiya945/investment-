import React, { useState } from "react";
import { toast } from "react-hot-toast";

import type { BrokerageCalculateResponse } from "@/types/brokerage";

import { calculateBrokerage } from "@/api/brokerage";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type CalculateBrokerageDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (data: BrokerageCalculateResponse) => void;
};

export default function CalculateBrokerageDialog({
    open,
    onOpenChange,
    onSuccess,
}: CalculateBrokerageDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1); // Current month
    const [year, setYear] = useState<number>(new Date().getFullYear()); // Current year

    // Generate years for dropdown (current year and 5 years back)
    const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

    // Month names for dropdown
    const months = [
        { value: 1, label: "January" },
        { value: 2, label: "February" },
        { value: 3, label: "March" },
        { value: 4, label: "April" },
        { value: 5, label: "May" },
        { value: 6, label: "June" },
        { value: 7, label: "July" },
        { value: 8, label: "August" },
        { value: 9, label: "September" },
        { value: 10, label: "October" },
        { value: 11, label: "November" },
        { value: 12, label: "December" },
    ];

    const handleCalculate = async () => {
        try {
            setIsLoading(true);
            const loadingToast = toast.loading("Calculating brokerage...");

            const response = await calculateBrokerage({ month, year });

            toast.dismiss(loadingToast);
            toast.success(`Successfully calculated brokerage for ${months.find(m => m.value === month)?.label} ${year}`);

            if (onSuccess) {
                onSuccess(response);
            }

            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to calculate brokerage");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Calculate Monthly Brokerage</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="month" className="text-right">
                            Month
                        </Label>
                        <Select
                            value={month.toString()}
                            onValueChange={val => setMonth(Number.parseInt(val))}
                            disabled={isLoading}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(month => (
                                    <SelectItem key={month.value} value={month.value.toString()}>
                                        {month.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="year" className="text-right">
                            Year
                        </Label>
                        <Select
                            value={year.toString()}
                            onValueChange={val => setYear(Number.parseInt(val))}
                            disabled={isLoading}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(year => (
                                    <SelectItem key={year} value={year.toString()}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        onClick={handleCalculate}
                        disabled={isLoading}
                    >
                        {isLoading ? "Calculating..." : "Calculate Brokerage"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
