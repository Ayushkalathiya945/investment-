"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import type { QuarterFormValues } from "@/lib/api/utils/validation-schemas";

import { createQuarters, getQuartersByYear, updateQuarters } from "@/api/quarter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { quarterFormSchema } from "@/lib/api/utils/validation-schemas";

function Page() {
    const queryClient = useQueryClient();
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const defaultValues: Partial<QuarterFormValues> = {
        year: currentYear,
        quarters: [
            { quarterNumber: 1, daysInQuarter: 64 },
            { quarterNumber: 2, daysInQuarter: 65 },
            { quarterNumber: 3, daysInQuarter: 66 },
            { quarterNumber: 4, daysInQuarter: 66 },
        ],
    };

    const form = useForm<QuarterFormValues>({
        resolver: zodResolver(quarterFormSchema),
        defaultValues,
    });

    // Get quarter data for current year
    const { data: currentYearData, isLoading } = useQuery({
        queryKey: ["quarter", selectedYear],
        queryFn: () => getQuartersByYear(selectedYear),
    });

    // Mutation function for create
    const createQuarterMutation = useMutation({
        mutationFn: (quarterData: QuarterFormValues) => createQuarters(quarterData),
        onSuccess: () => {
            toast.success("All quarters data saved successfully!");
            queryClient.invalidateQueries({ queryKey: ["quarter"] });
            form.reset();
        },
        onError: () => {
            toast.error("Failed to save quarter data. Please try again.");
        },
    });

    // Update quarter mutation
    const updateQuarterMutation = useMutation({
        mutationFn: (quarterData: QuarterFormValues) => updateQuarters(quarterData.year, quarterData),
        onSuccess: () => {
            toast.success("All quarters data updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["quarter"] });
            form.reset();
        },
        onError: () => {
            toast.error("Failed to save quarter data. Please try again.");
        },
    });

    useEffect(() => {
        if (currentYearData && currentYearData.length > 0) {
            form.setValue("year", currentYear);
            form.setValue("quarters", currentYearData);
        }
    }, [currentYearData, currentYear, form]);

    const onSubmit = async (data: QuarterFormValues) => {
        try {
            const quartersData = {
                year: data.year,
                quarters: data.quarters.map(q => ({
                    quarterNumber: q.quarterNumber,
                    daysInQuarter: q.daysInQuarter,
                })),
            };

            if (currentYearData && currentYearData.length > 0) {
                await updateQuarterMutation.mutateAsync(quartersData);
            } else {
                await createQuarterMutation.mutateAsync(quartersData);
            }

            form.reset(quartersData);
        } catch (error) {
            console.error("Error saving quarter data:", error);
            toast.error("Failed to save quarter data. Please try again.");
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 p-6">
                {/* Header Skeleton */}
                <div className="space-y-0.5">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>

                {/* Alert Skeleton */}
                <div className="p-4 border rounded-lg bg-muted/20 animate-pulse">
                    <div className="flex items-start gap-3">
                        <Skeleton className="h-5 w-5 rounded-full mt-0.5" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-full max-w-md" />
                        </div>
                    </div>
                </div>

                {/* Card Skeleton */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Year Selector Skeleton */}
                        <div className="w-[300px] space-y-2">
                            <Skeleton className="h-4 w-10" />
                            <Skeleton className="h-10 w-full" />
                        </div>

                        {/* Quarters Grid Skeleton */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                            {[1, 2, 3, 4].map((quarter) => (
                                <Card key={quarter}>
                                    <CardHeader className="pb-2">
                                        <Skeleton className="h-6 w-8" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-10 w-full" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Submit Button Skeleton */}
                        <div className="flex justify-end">
                            <Skeleton className="h-10 w-24" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const hasExistingData = currentYearData && currentYearData.length > 0;

    // Render alert for no data
    const renderNoDataAlert = () => (
        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300 font-semibold">
                No Data Found
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-400 mt-2">
                <div className="space-y-2">
                    <p>
                        No quarter data found for {" "}
                        {selectedYear}
                        .
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3 w-3" />
                        <span>Please add quarter data using the form below to enable brokerage calculations.</span>
                    </div>
                </div>
            </AlertDescription>
        </Alert>
    );

    // Render alert for existing data
    const renderExistingDataAlert = () => (
        <Alert className="border-amber-200 bg-amber-50 ">
            <Info className="h-4 w-4  " />
            <AlertTitle className="text-amber-800  font-semibold">
                Current Year Data Already Exists
            </AlertTitle>
            <AlertDescription className="text-amber-700  mt-2">
                <div className="space-y-2">
                    <p>
                        Quarter data for
                        {" "}
                        {selectedYear}
                        {" "}
                        is already configured and active.
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                            ⚠️ Important: Any updates will be reflected from today onwards for all fees calculations of
                            {" "}
                            {selectedYear}
                            .
                        </span>
                    </div>
                </div>
            </AlertDescription>
        </Alert>
    );
    return (
        <div className="space-y-6 p-6">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage application settings and configurations
                </p>
            </div>

            {/* Conditional Alert Messages */}
            {hasExistingData ? renderExistingDataAlert() : renderNoDataAlert()}
            <Card>
                <CardHeader>
                    <CardTitle>Add Quarter Data</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="space-y-4">
                                {/* Year Field */}
                                <div className="w-[300px]">
                                    <FormField
                                        control={form.control}
                                        name="year"
                                        render={() => (
                                            <FormItem>
                                                <FormLabel>Year</FormLabel>
                                                <Select
                                                    onValueChange={(value) => {
                                                        const year = Number(value);
                                                        setSelectedYear(year);
                                                        form.setValue("year", year);
                                                    }}
                                                    value={selectedYear.toString()}
                                                >

                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select year" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {Array.from({ length: 7 }, (_, i) => currentYear - 3 + i).map(year => (
                                                            <SelectItem key={year} value={year.toString()}>
                                                                {year}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Quarters Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                                    {form.getValues("quarters")?.map((quarter, index) => (
                                        <Card key={`quarter-${quarter.quarterNumber}`}>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-lg">
                                                    Q
                                                    {form.getValues(`quarters.${index}.quarterNumber`)}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <FormField
                                                    control={form.control}
                                                    name={`quarters.${index}.daysInQuarter`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Days in Quarter</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    placeholder={`Enter days for Q${index + 1}`}
                                                                    min={1}
                                                                    max={92}
                                                                    step="1"
                                                                    {...field}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        // Only update if it's a valid number or empty
                                                                        if (value === "" || /^\d+$/.test(value)) {
                                                                            const numValue = value === "" ? "" : Number.parseInt(value, 10);
                                                                            field.onChange(numValue);
                                                                        }
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormMessage className="text-xs" />
                                                        </FormItem>
                                                    )}
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={createQuarterMutation.isPending || updateQuarterMutation.isPending}
                                >
                                    {createQuarterMutation.isPending || updateQuarterMutation.isPending
                                        ? "Saving..."
                                        : currentYearData && currentYearData.length > 0
                                            ? "Update Quarter Data"
                                            : "Save Quarter Data"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

export default Page;
