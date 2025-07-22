"use client";

import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { TrendingUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type {
    DailyBrokerageRecord,
    MonthlyBrokerageSummary,
    QuarterlyBrokerageSummary,
} from "@/types/brokerage";

import { getPeriodicBrokerage } from "@/api/brokerage";
import StatCard from "@/components/StatCard";
import MonthRangePicker from "@/components/ui/monthRangePicker";
import { Pagination } from "@/components/ui/pagination";
import RangeDatePicker from "@/components/ui/rangeDatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT } from "@/lib/constants";
import { PeriodType as ApiPeriodType } from "@/types/brokerage";

function _formatDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// PeriodType enum for UI only
const PeriodType = {
    DAILY: "DAILY",
    MONTHLY: "MONTHLY",
    QUARTERLY: "QUARTERLY",
} as const;
type PeriodType = keyof typeof PeriodType;

function _getQuarterFromDate(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
}
function getQuarters(): number[] {
    return [1, 2, 3, 4];
}
function getAvailableYears(): number[] {
    const currentYear = new Date().getFullYear();
    return [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
}
function getQuarterName(quarter: number): string {
    return `Q${quarter}`;
}

const Brokerage: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Helper function to update URL with current filter state
    const updateURL = useCallback((params: Record<string, string | number | undefined>) => {
        const newSearchParams = new URLSearchParams(searchParams.toString());

        // Clear all existing filter params first
        const filterKeys = ["periodType", "page", "selectedMonthYear", "monthFrom", "monthTo", "selectedQuarter", "selectedQuarterYear", "dateFrom", "dateTo"];
        filterKeys.forEach(key => newSearchParams.delete(key));

        // Add new params
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                newSearchParams.set(key, value.toString());
            }
        });

        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    // Initialize state from URL parameters
    const initializeFromURL = useCallback(() => {
        const urlPeriodType = searchParams.get("periodType") as PeriodType || "MONTHLY";
        const urlPage = Number.parseInt(searchParams.get("page") || "1");
        const urlSelectedMonthYear = Number.parseInt(searchParams.get("selectedMonthYear") || new Date().getFullYear().toString());
        const urlSelectedQuarter = Number.parseInt(searchParams.get("selectedQuarter") || "1");
        const urlSelectedQuarterYear = Number.parseInt(searchParams.get("selectedQuarterYear") || new Date().getFullYear().toString());

        return {
            periodType: urlPeriodType,
            page: urlPage,
            selectedMonthYear: urlSelectedMonthYear,
            selectedQuarter: urlSelectedQuarter,
            selectedQuarterYear: urlSelectedQuarterYear,
            monthFrom: searchParams.get("monthFrom"),
            monthTo: searchParams.get("monthTo"),
            dateFrom: searchParams.get("dateFrom"),
            dateTo: searchParams.get("dateTo"),
        };
    }, [searchParams]);

    // UI state initialized from URL
    const [periodType, setPeriodType] = useState<PeriodType>(() => {
        const urlParams = initializeFromURL();
        return urlParams.periodType;
    });
    // Pagination
    const [currentPage, setCurrentPage] = useState(() => {
        const urlParams = initializeFromURL();
        return urlParams.page;
    });
    const [totalPages, setTotalPages] = useState(1);

    // Daily (date range)
    const [selectedDateRange, setSelectedDateRange] = useState<{ from?: Date; to?: Date }>(() => {
        const urlParams = initializeFromURL();
        return {
            from: urlParams.dateFrom ? new Date(urlParams.dateFrom) : startOfMonth(new Date()),
            to: urlParams.dateTo ? new Date(urlParams.dateTo) : new Date(),
        };
    });
    // Monthly
    const [monthRange, setMonthRange] = useState<{ from: Date; to: Date }>(() => {
        const urlParams = initializeFromURL();
        if (urlParams.monthFrom && urlParams.monthTo) {
            return {
                from: new Date(urlParams.monthFrom),
                to: new Date(urlParams.monthTo),
            };
        }
        const now = new Date();
        return {
            from: startOfMonth(new Date(now.getFullYear(), 0, 1)),
            to: endOfMonth(addMonths(new Date(now.getFullYear(), 0, 1), now.getMonth())),
        };
    });
    const [selectedMonthYear, setSelectedMonthYear] = useState<number>(() => {
        const urlParams = initializeFromURL();
        return urlParams.selectedMonthYear;
    });
    // Quarterly
    const [selectedQuarter, setSelectedQuarter] = useState<number>(() => {
        const urlParams = initializeFromURL();
        return urlParams.selectedQuarter;
    });
    const [selectedQuarterYear, setSelectedQuarterYear] = useState<number>(() => {
        const urlParams = initializeFromURL();
        return urlParams.selectedQuarterYear;
    });

    const [brokerageData, setBrokerageData] = useState<(DailyBrokerageRecord | MonthlyBrokerageSummary | QuarterlyBrokerageSummary)[]>([]);
    const [totalBrokerageAmount, setTotalBrokerageAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [_serverPaginationData, _setServerPaginationData] = useState<{ totalPages: number; total: number }>({ totalPages: 1, total: 0 });

    // Sync current state to URL
    const syncStateToURL = useCallback(() => {
        const params: Record<string, string | number | undefined> = {
            periodType,
            page: currentPage,
        };

        // Add period-specific parameters
        switch (periodType) {
            case "DAILY":
                if (selectedDateRange.from)
                    params.dateFrom = selectedDateRange.from.toISOString().split("T")[0];
                if (selectedDateRange.to)
                    params.dateTo = selectedDateRange.to.toISOString().split("T")[0];
                break;
            case "MONTHLY":
                params.selectedMonthYear = selectedMonthYear;
                params.monthFrom = monthRange.from.toISOString().split("T")[0];
                params.monthTo = monthRange.to.toISOString().split("T")[0];
                break;
            case "QUARTERLY":
                params.selectedQuarter = selectedQuarter;
                params.selectedQuarterYear = selectedQuarterYear;
                break;
        }

        updateURL(params);
    }, [periodType, currentPage, selectedDateRange, selectedMonthYear, monthRange, selectedQuarter, selectedQuarterYear, updateURL]);

    // Fetch data based on period type and filters
    const fetchBrokerageData = useCallback(async () => {
        setIsLoading(true);

        // Sync state to URL before fetching
        syncStateToURL();
        try {
            let apiPeriodType: ApiPeriodType;
            let period: number | undefined;
            let year: number | undefined;

            // Map UI period type to API period type and set appropriate filters
            switch (periodType) {
                case "DAILY":
                    apiPeriodType = ApiPeriodType.DAILY;
                    // For daily, we'll use the date range
                    break;
                case "MONTHLY":
                    apiPeriodType = ApiPeriodType.MONTHLY;
                    year = selectedMonthYear;
                    break;
                case "QUARTERLY":
                    apiPeriodType = ApiPeriodType.QUARTERLY;
                    period = selectedQuarter;
                    year = selectedQuarterYear;
                    break;
                default:
                    apiPeriodType = ApiPeriodType.MONTHLY;
            }

            // Log filter data for debugging
            // console.log("API Call Parameters:", {
            //     periodType: apiPeriodType,
            //     period,
            //     year,
            //     currentPage,
            //     limit: PAGE_LIMIT,
            //     uiPeriodType: periodType,
            //     selectedDateRange: periodType === "DAILY" ? selectedDateRange : null,
            //     selectedMonthYear: periodType === "MONTHLY" ? selectedMonthYear : null,
            //     selectedQuarter: periodType === "QUARTERLY" ? selectedQuarter : null,
            //     selectedQuarterYear: periodType === "QUARTERLY" ? selectedQuarterYear : null,
            // });

            const response = await getPeriodicBrokerage(
                apiPeriodType, // periodType
                period, // period
                year, // year
                currentPage, // page
                PAGE_LIMIT, // limit
                periodType === "QUARTERLY" ? selectedQuarter : undefined, // quarter
                periodType === "QUARTERLY" ? selectedQuarterYear : undefined, // quarterYear
                periodType === "MONTHLY" ? (monthRange.from.getMonth() + 1) : undefined, // startMonth
                periodType === "MONTHLY" ? monthRange.from.getFullYear() : undefined, // startYear
                periodType === "MONTHLY" ? (monthRange.to.getMonth() + 1) : undefined, // endMonth
                periodType === "MONTHLY" ? monthRange.to.getFullYear() : undefined, // endYear
                periodType === "DAILY" && selectedDateRange.from ? selectedDateRange.from.toISOString().split("T")[0] : undefined, // startDate
                periodType === "DAILY" && selectedDateRange.to ? selectedDateRange.to.toISOString().split("T")[0] : undefined, // endDate
                periodType === "DAILY" && selectedDateRange.from ? selectedDateRange.from.toISOString().split("T")[0] : undefined, // from
                periodType === "DAILY" && selectedDateRange.to ? selectedDateRange.to.toISOString().split("T")[0] : undefined, // to
            );

            // Log API response for debugging
            // console.log("API Response:", response);

            if (response.success && response.data) {
                // Handle the response data structure properly
                let dataArray: (DailyBrokerageRecord | MonthlyBrokerageSummary | QuarterlyBrokerageSummary)[] = [];

                if (Array.isArray(response.data)) {
                    dataArray = response.data;
                } else if (typeof response.data === "object" && response.data !== null) {
                    // Handle legacy response structure
                    if (response.data.daily) {
                        dataArray = response.data.daily.map(item => ({
                            id: item.id,
                            clientId: item.clientId,
                            clientName: item.clientName,
                            date: new Date(item.date),
                            totalDailyBrokerage: item.totalDailyBrokerage,
                        }));
                    } else if (response.data.quarterly) {
                        dataArray = response.data.quarterly.map(item => ({
                            clientId: item.clientId,
                            clientName: `Client ${item.clientId}`, // Fallback if name not available
                            period: {
                                quarter: item.quarter,
                                year: item.year,
                            },
                            brokerageAmount: item.totalBrokerage,
                        }));
                    }
                }

                setBrokerageData(dataArray);

                // Calculate total brokerage amount
                const total = dataArray.reduce((sum: number, item: any) => {
                    if ("totalDailyBrokerage" in item) {
                        return sum + item.totalDailyBrokerage;
                    } else if ("brokerageAmount" in item) {
                        return sum + item.brokerageAmount;
                    }
                    return sum;
                }, 0);
                setTotalBrokerageAmount(total);

                // Update pagination data
                if (response.metadata) {
                    _setServerPaginationData({
                        totalPages: response.metadata.totalPages,
                        total: response.metadata.total,
                    });
                    setTotalPages(response.metadata.totalPages);
                }
            } else {
                setBrokerageData([]);
                setTotalBrokerageAmount(0);
                _setServerPaginationData({ totalPages: 1, total: 0 });
                setTotalPages(1);
            }
        } catch (error) {
            console.error("Error fetching brokerage data:", error);
            toast.error("Failed to fetch brokerage data");
            setBrokerageData([]);
            setTotalBrokerageAmount(0);
        } finally {
            setIsLoading(false);
        }
    }, [periodType, selectedMonthYear, monthRange, selectedQuarter, selectedQuarterYear, currentPage, selectedDateRange, syncStateToURL]);

    // Fetch data when component mounts or dependencies change
    useEffect(() => {
        fetchBrokerageData();
    }, [fetchBrokerageData]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        // URL will be updated by fetchBrokerageData via syncStateToURL
    };

    // Handle period type change with URL clearing
    const handlePeriodTypeChange = (newPeriodType: PeriodType) => {
        setPeriodType(newPeriodType);
        setCurrentPage(1); // Reset to first page

        // Clear URL parameters and set new period type
        const params: Record<string, string | number | undefined> = {
            periodType: newPeriodType,
            page: 1,
        };

        updateURL(params);

        // Reset state based on period type
        if (newPeriodType === "DAILY") {
            setSelectedDateRange({
                from: startOfMonth(new Date()),
                to: new Date(),
            });
        } else if (newPeriodType === "MONTHLY") {
            const now = new Date();
            setMonthRange({
                from: startOfMonth(new Date(now.getFullYear(), 0, 1)),
                to: endOfMonth(addMonths(new Date(now.getFullYear(), 0, 1), now.getMonth() - 1)),
            });
            setSelectedMonthYear(new Date().getFullYear());
        } else if (newPeriodType === "QUARTERLY") {
            setSelectedQuarter(_getQuarterFromDate(new Date()));
            setSelectedQuarterYear(new Date().getFullYear());
        }
    };

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <h1 className="text-3xl font-semibold">Fees</h1>
                <div className="flex-col md:flex md:flex-row gap-4 items-center">
                    {/* Period Type Dropdown */}
                    <div className="flex min-w-50">
                        <Select
                            value={periodType}
                            onValueChange={value => handlePeriodTypeChange(value as PeriodType)}
                        >
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder="Period Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DAILY">Daily</SelectItem>
                                <SelectItem value="MONTHLY">Monthly</SelectItem>
                                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Daily: Date Range Picker Button with Popover */}
                    {periodType === "DAILY" && (
                        <div className="w-full md:w-auto">

                            <RangeDatePicker
                                from={selectedDateRange.from ? format(selectedDateRange.from, "yyyy-MM-dd") : undefined}
                                to={selectedDateRange.to ? format(selectedDateRange.to, "yyyy-MM-dd") : undefined}
                                onChange={(range: { from?: Date; to?: Date }) => setSelectedDateRange(range)}
                            />

                        </div>
                    )}

                    {/* Monthly: Month Range Picker and Year Selector */}
                    {periodType === "MONTHLY" && (
                        <>

                            <div className="md:w-1/2 w-full mt-2 md:mt-0">
                                <MonthRangePicker
                                    onChange={(range) => {
                                        if (range.from && range.to) {
                                            setMonthRange({ from: new Date(range.from), to: new Date(range.to) });
                                        }
                                    }}
                                    from={monthRange.from ? format(monthRange.from, "yyyy-MM-dd") : undefined}
                                    to={monthRange.to ? format(monthRange.to, "yyyy-MM-dd") : undefined}
                                />
                            </div>
                        </>
                    )}

                    {/* Quarterly: Year and Quarter Selectors */}
                    {periodType === "QUARTERLY" && (
                        <>
                            <div className="flex min-w-50 ml-0 md:ml-2 mt-2 md:mt-0">
                                <Select
                                    value={selectedQuarterYear.toString()}
                                    onValueChange={value => setSelectedQuarterYear(Number(value))}
                                >
                                    <SelectTrigger className="w-full ring-0">
                                        <SelectValue placeholder="Select Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getAvailableYears().map(year => (
                                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex min-w-50 ml-0 md:ml-2 mt-2 md:mt-0">
                                <Select
                                    value={selectedQuarter.toString()}
                                    onValueChange={value => setSelectedQuarter(Number(value))}
                                >
                                    <SelectTrigger className="w-full ring-0">
                                        <SelectValue placeholder="Select Quarter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getQuarters().map(quarter => (
                                            <SelectItem key={quarter} value={quarter.toString()}>
                                                {getQuarterName(quarter)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 justify-between gap-3 px-2">
                <StatCard
                    icon={<TrendingUp />}
                    value={new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                    }).format(totalBrokerageAmount)}
                    label="Total Fees"
                    isLoading={isLoading}
                />
            </div>
            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                    <Table className="bg-white">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold  w-full justify-between items-center gap-4 rounded-lg py-3">
                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Total Fees</TableHead>
                                <TableHead className="rounded-tr-xl">
                                    {periodType === "QUARTERLY"
                                        ? "Quarter"
                                        : periodType === "MONTHLY"
                                            ? "Month"
                                            : "Date"}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    )
                                : brokerageData.length === 0
                                    ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8">
                                                    No data available
                                                </TableCell>
                                            </TableRow>
                                        )
                                    : (
                                            brokerageData.map((item, index) => {
                                                const serialNumber = (currentPage - 1) * PAGE_LIMIT + index + 1;

                                                // Determine the display values based on item type
                                                let clientName = "";
                                                let amount = 0;
                                                let periodDisplay = "";

                                                if ("totalDailyBrokerage" in item) {
                                                    // Daily brokerage record
                                                    clientName = item.clientName;
                                                    amount = item.totalDailyBrokerage;
                                                    periodDisplay = new Date(item.date).toLocaleDateString();
                                                } else if ("brokerageAmount" in item) {
                                                    // Monthly or Quarterly summary
                                                    clientName = item.clientName;
                                                    amount = item.brokerageAmount;

                                                    if ("period" in item && typeof item.period === "object") {
                                                        if ("quarter" in item.period) {
                                                            periodDisplay = `Q${item.period.quarter} ${item.period.year}`;
                                                        } else if ("month" in item.period) {
                                                            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                            periodDisplay = `${monthNames[item.period.month - 1]} ${item.period.year}`;
                                                        }
                                                    }
                                                }

                                                return (
                                                    <TableRow key={`${item.clientId}-${index}`}>
                                                        <TableCell>{serialNumber}</TableCell>
                                                        <TableCell>{clientName}</TableCell>
                                                        <TableCell className="text-green-500">
                                                            {new Intl.NumberFormat("en-IN", {
                                                                style: "currency",
                                                                currency: "INR",
                                                                maximumFractionDigits: 2,
                                                            }).format(amount)}
                                                        </TableCell>
                                                        <TableCell>{periodDisplay}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                        </TableBody>
                    </Table>
                </div>
                {
                    totalPages > 1 && (
                        <div className="flex justify-center mt-4">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    )
                }
            </div>
        </div>
    );
};

export default Brokerage;
