"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, Info, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import type { QuarterFormValues } from "@/lib/api/utils/validation-schemas";
import type { GetAllHolidaysResponse } from "@/types/holidays";

import { fetchAndStoreHolidaysAndQuarters, getAllHolidays } from "@/api/holidays";
import { createQuarters, getQuartersByYear, updateQuarters } from "@/api/quarter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { quarterFormSchema } from "@/lib/api/utils/validation-schemas";

// Move this to the top of the file (before `Page` component)

function HolidayList({
    holidays,
    exchange,
    isLoading,
    selectedYear,
}: {
    holidays: GetAllHolidaysResponse[];
    exchange: string;
    isLoading: boolean;
    selectedYear: number;
}) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                    </div>
                ))}
            </div>
        );
    }

    if (holidays.length === 0) {
        return (
            <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                    No
                    {" "}
                    {exchange}
                    {" "}
                    holidays found for
                    {" "}
                    {selectedYear}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {holidays.map(holiday => (

                <div
                    key={`holiday-${holiday.date}-${holiday.exchange}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-card"
                >
                    <div className="flex-1">
                        <h4 className="font-medium text-foreground">{holiday.name}</h4>
                        <p className="text-sm text-muted-foreground">
                            {new Date(holiday.date).toLocaleDateString("en-IN", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Badge variant="outline" className="text-xs">
                            {holiday.exchange}
                        </Badge>
                    </div>
                </div>
            ))}
        </div>
    );
}

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

    const { data: currentYearData, isLoading } = useQuery({
        queryKey: ["quarter", selectedYear],
        queryFn: () => getQuartersByYear(selectedYear),
    });

    const { data: holidaysData, isLoading: isHolidaysLoading } = useQuery({
        queryKey: ["holidays", selectedYear],
        queryFn: () => getAllHolidays(selectedYear),
    });

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

    const fetchHolidaysMutation = useMutation({
        mutationFn: (year: number) => fetchAndStoreHolidaysAndQuarters(year),
        onSuccess: () => {
            toast.success("Holidays and quarters data refreshed successfully!");
            queryClient.invalidateQueries({ queryKey: ["holidays"] });
            queryClient.invalidateQueries({ queryKey: ["quarter"] });
        },
        onError: () => {
            toast.error("Failed to refresh holidays data. Please try again.");
        },
    });

    useEffect(() => {
        if (currentYearData && currentYearData.length > 0) {
            form.setValue("year", selectedYear);
            form.setValue("quarters", currentYearData);
        }
    }, [currentYearData, selectedYear, form]);

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

    const handleRefreshHolidays = () => {
        fetchHolidaysMutation.mutate(selectedYear);
    };

    const hasExistingData = currentYearData && currentYearData.length > 0;

    // Filter holidays by exchange
    const nseHolidays = holidaysData?.filter(holiday => holiday.exchange === "NSE") || [];
    const bseHolidays = holidaysData?.filter(holiday => holiday.exchange === "BSE") || [];

    // Render alert for no data
    const renderNoDataAlert = () => (
        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300 font-semibold">
                No Data Found
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-400 mt-2">
                <div className="space-y-2">
                    <p>{`No quarter data found for ${selectedYear}`}</p>
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
        <Alert className="border-amber-200 bg-amber-50">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-amber-800 font-semibold">
                Current Year Data Already Exists
            </AlertTitle>
            <AlertDescription className="text-amber-700 mt-2">
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

    if (isLoading) {
        return (
            <div className="space-y-6 p-4 sm:p-6">
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
                        <div className="w-full max-w-sm space-y-2">
                            <Skeleton className="h-4 w-10" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                            {[1, 2, 3, 4].map(quarter => (
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
                        <div className="flex justify-end">
                            <Skeleton className="h-10 w-24" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 sm:p-6">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage application settings and configurations
                </p>
            </div>

            {/* Conditional Alert Messages */}
            {hasExistingData ? renderExistingDataAlert() : renderNoDataAlert()}

            <Tabs defaultValue="quarters" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="quarters">Quarter Days</TabsTrigger>
                    <TabsTrigger value="holidays">Holidays</TabsTrigger>
                </TabsList>

                <TabsContent value="quarters" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Quarter Data</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="space-y-4">
                                        {/* Year Field */}
                                        <div className="w-full max-w-sm">
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
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
                </TabsContent>

                <TabsContent value="holidays" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div>
                                <CardTitle>
                                    Holidays for
                                    {selectedYear}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    View and refresh holiday data for NSE and BSE exchanges
                                </p>
                            </div>
                            <Button
                                onClick={handleRefreshHolidays}
                                disabled={fetchHolidaysMutation.isPending}
                                size="sm"
                                variant="outline"
                                className="shrink-0"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${fetchHolidaysMutation.isPending ? "animate-spin" : ""}`} />
                                {fetchHolidaysMutation.isPending ? "Refreshing..." : "Refresh"}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="nse" className="w-full">
                                <TabsList className="grid w-full max-w-sm grid-cols-2">
                                    <TabsTrigger value="nse">
                                        NSE (
                                        {nseHolidays.length}
                                        )
                                    </TabsTrigger>
                                    <TabsTrigger value="bse">
                                        BSE (
                                        {bseHolidays.length}
                                        )
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="nse" className="mt-4">
                                    <HolidayList
                                        holidays={nseHolidays}
                                        exchange="NSE"
                                        isLoading={isHolidaysLoading}
                                        selectedYear={selectedYear}
                                    />

                                </TabsContent>

                                <TabsContent value="bse" className="mt-4">
                                    <HolidayList
                                        holidays={bseHolidays}
                                        exchange="BSE"
                                        isLoading={isHolidaysLoading}
                                        selectedYear={selectedYear}
                                    />

                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default Page;
