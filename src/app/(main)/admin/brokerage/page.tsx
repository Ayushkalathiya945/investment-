"use client";

import { format } from "date-fns";
import { TrendingUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type { BrokerageCalculateResponse, BrokerageItem } from "@/types/brokerage";

import { getAllPeriodicBrokerage, getBrokerageRecords } from "@/api/brokerage";
import { getAllClientsForDropdown } from "@/api/client";
import BrokerageResults from "@/components/BrokerageResults";
import CalculateBrokerageButton from "@/components/Dialoge/CalculateBrokerageButton";
import StatCard from "@/components/StatCard";
import MonthRangePicker from "@/components/ui/monthRangePicker";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT } from "@/lib/constants";
import { PeriodType } from "@/types/brokerage";

function formatDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getQuarterFromDate(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
}

function parseDateFromString(dateString: string | null): Date | undefined {
    if (!dateString)
        return undefined;
    try {
        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return undefined;
        }

        if (dateString.includes("T")) {
            return date;
        }

        if (dateString.includes("-")) {
            const [yearStr, monthStr, dayStr] = dateString.split("-");
            const year = Number.parseInt(yearStr);
            const month = Number.parseInt(monthStr) - 1;
            const day = Number.parseInt(dayStr);
            return new Date(year, month, day);
        }

        return date;
    } catch {
        return undefined;
    }
}

function getQuarterName(quarter: number): string {
    return `Q${quarter}`;
}

function getQuarters(): number[] {
    return [1, 2, 3, 4];
}

function getAvailableYears(): number[] {
    const currentYear = new Date().getFullYear();
    return [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
}

type MonthRange = {
    from?: Date;
    to?: Date;
};

const Brokerage: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const initialPage = Number.parseInt(searchParams.get("page") || "1");
    const initialClientId = searchParams.get("clientId") ? Number.parseInt(searchParams.get("clientId")!) : undefined;
    const initialPeriodType = searchParams.get("periodType") as PeriodType || PeriodType.MONTH;

    const parsedFrom = parseDateFromString(searchParams.get("from"));
    const parsedTo = parseDateFromString(searchParams.get("to"));
    const initialDateRange: MonthRange = (parsedFrom && parsedTo)
        ? {
                from: parsedFrom,
                to: parsedTo,
            }
        : {};

    // Initialize quarter and year from URL params or default to current
    const initialQuarter = searchParams.get("quarter")
        ? Number.parseInt(searchParams.get("quarter")!)
        : initialDateRange.from
            ? getQuarterFromDate(initialDateRange.from)
            : getQuarterFromDate(new Date());

    const initialYear = searchParams.get("year")
        ? Number.parseInt(searchParams.get("year")!)
        : initialDateRange.from
            ? initialDateRange.from.getFullYear()
            : new Date().getFullYear();

    const [currentPage, setCurrentPage] = useState(initialPage);
    const [dateRange, setDateRange] = useState<MonthRange>(initialDateRange);
    const [calculationResult, setCalculationResult] = useState<BrokerageCalculateResponse | null>(null);
    const [brokerageData, setBrokerageData] = useState<BrokerageItem[]>([]);
    const [periodType, setPeriodType] = useState<PeriodType>(initialPeriodType);
    const [totalBrokerageAmount, setTotalBrokerageAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedClientId, setSelectedClientId] = useState<number | undefined>(initialClientId);
    const [selectedQuarter, setSelectedQuarter] = useState<number>(initialQuarter);
    const [selectedYear, setSelectedYear] = useState<number>(initialYear);
    const [clients, setClients] = useState<Array<{ id: number; name: string }>>([]);

    const updateURLParams = useCallback((params: { [key: string]: string | null }) => {
        const newSearchParams = new URLSearchParams(searchParams.toString());

        Object.entries(params).forEach(([key, value]) => {
            if (value === null) {
                newSearchParams.delete(key);
            } else {
                newSearchParams.set(key, value);
            }
        });

        const search = newSearchParams.toString();
        const query = search ? `?${search}` : "";
        router.replace(`${pathname}${query}`, { scroll: false });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");

        if (fromParam && toParam) {
            const fromDate = parseDateFromString(fromParam);
            const toDate = parseDateFromString(toParam);

            if (fromDate && toDate) {
                setDateRange({ from: fromDate, to: toDate });
            }
        }

        const quarterParam = searchParams.get("quarter");
        const yearParam = searchParams.get("year");

        if (quarterParam) {
            setSelectedQuarter(Number.parseInt(quarterParam));
        }

        if (yearParam) {
            setSelectedYear(Number.parseInt(yearParam));
        }

        const periodTypeParam = searchParams.get("periodType");
        if (periodTypeParam && (periodTypeParam === PeriodType.MONTH || periodTypeParam === PeriodType.QUARTER)) {
            setPeriodType(periodTypeParam);
        }
    }, []);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const clientsData = await getAllClientsForDropdown();
                setClients(clientsData);
            } catch (error) {
                console.error("Error fetching clients:", error);
                toast.error("Failed to load client list");
            }
        };

        fetchClients();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                let response;

                if (selectedClientId) {
                    const filterParams = {
                        page: 1,
                        limit: 20,
                        clientId: selectedClientId,

                        year: selectedYear || new Date().getFullYear(),

                        ...(dateRange.from && dateRange.to && {
                            from: formatDateString(dateRange.from),
                            to: formatDateString(dateRange.to),
                        }),
                        // Include period-specific parameters
                        ...(periodType === PeriodType.QUARTER && {
                            quarter: selectedQuarter || getQuarterFromDate(new Date()),
                        }),
                        // For monthly period type, use date range month if available
                        ...(periodType === PeriodType.MONTH && {
                            month: dateRange.from ? dateRange.from.getMonth() + 1 : new Date().getMonth() + 1,
                        }),
                    };

                    response = await getBrokerageRecords(filterParams);
                } else {
                    if (periodType === PeriodType.QUARTER) {
                        // console.log(`🔍 Fetching quarterly data with params:`, {
                        //     periodType,
                        //     quarter: selectedQuarter,
                        //     year: selectedYear,
                        // });
                        response = await getAllPeriodicBrokerage(periodType, selectedQuarter, selectedYear);
                    } else if (periodType === PeriodType.MONTH) {
                        if (dateRange.from && dateRange.to) {
                            const filterParams = {
                                page: 1,
                                limit: 1000,
                                periodType: PeriodType.MONTH,
                                from: formatDateString(dateRange.from),
                                to: formatDateString(dateRange.to),
                            };

                            // console.log(`Fetching monthly data with date range:`, filterParams);

                            response = await getBrokerageRecords(filterParams);
                        } else if (searchParams.get("from") && searchParams.get("to") && Object.keys(dateRange).length > 0) {
                            const fromParam = searchParams.get("from");
                            const toParam = searchParams.get("to");

                            const fromDate = fromParam ? parseDateFromString(fromParam) : undefined;
                            const toDate = toParam ? parseDateFromString(toParam) : undefined;

                            const filterParams = {
                                page: 1,
                                limit: 1000,
                                periodType: PeriodType.MONTH,
                                // Use formatDateString to ensure YYYY-MM-DD format
                                ...(fromDate && toDate
                                    ? {
                                            from: formatDateString(fromDate),
                                            to: formatDateString(toDate),
                                        }
                                    : {}),
                            };

                            // console.log(`🔍 Fetching monthly data with URL date parameters:`, filterParams);
                            response = await getBrokerageRecords(filterParams);
                        } else {
                            // No date range selected, use current month
                            const currentDate = new Date();
                            const defaultMonth = currentDate.getMonth() + 1;
                            const defaultYear = currentDate.getFullYear();

                            // Check if we're handling a cleared date range
                            const isEmptyDateRange = Object.keys(dateRange).length === 0;

                            if (isEmptyDateRange) {
                                const cleanParams = {
                                    page: 1,
                                    limit: 20,
                                    periodType: PeriodType.MONTH,

                                };

                                response = await getBrokerageRecords(cleanParams);
                            } else {
                                response = await getAllPeriodicBrokerage(PeriodType.MONTH, defaultMonth, defaultYear);
                            }
                        }
                    }
                }

                if (response && response.success && Array.isArray(response.data)) {
                    setBrokerageData(response.data);

                    const totalBrokerage = response.data.reduce(
                        (sum: number, item: BrokerageItem) => sum + (item?.brokerageAmount || 0),
                        0,
                    );
                    setTotalBrokerageAmount(totalBrokerage);
                } else {
                    setBrokerageData([]);
                    setTotalBrokerageAmount(0);
                    console.warn("⚠️ Received invalid brokerage data", response);
                }
            } catch (error) {
                toast.error("Failed to fetch brokerage data");
                console.error("Error fetching brokerage data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [periodType, selectedClientId, dateRange, selectedQuarter, selectedYear]);

    // Additional useEffect to sync URL params when selectedQuarter, selectedYear, or dateRange changes
    useEffect(() => {
        if (periodType === PeriodType.QUARTER) {
            updateURLParams({
                quarter: selectedQuarter.toString(),
                year: selectedYear.toString(),
                // Clear date range params when in quarterly mode
                from: null,
                to: null,
            });
        } else if (periodType === PeriodType.MONTH) {
            if (dateRange.from && dateRange.to) {
                // Make sure date range is reflected in URL for monthly view
                updateURLParams({
                    // Format dates as YYYY-MM-DD for API compatibility
                    from: formatDateString(dateRange.from),
                    to: formatDateString(dateRange.to),
                    // Clear quarter and year params when in monthly mode with date range
                    quarter: null,
                    year: null,
                });
            } else if (Object.keys(dateRange).length === 0) {
                // When date range is cleared, make sure URL reflects that
                updateURLParams({
                    from: null,
                    to: null,
                    // Keep periodType
                    periodType: PeriodType.MONTH,
                });
            }
        }
    }, [selectedQuarter, selectedYear, periodType, dateRange, updateURLParams]);

    // Filter data based on date range
    const filteredData = brokerageData.filter((item: BrokerageItem) => {
        // Skip invalid items
        if (!item || !item.date)
            return false;

        // Check if we have date range in state
        const { from, to } = dateRange ?? {};

        // If no date range in state or URL, show all data
        if ((!from || !to) && !searchParams.get("from") && !searchParams.get("to"))
            return true;

        // Parse the date string to create a Date object
        const [periodName, year] = (item.date || "Unknown 2025").split(" ");
        let itemDate: Date;

        if (item.periodType === PeriodType.QUARTER) {
            // For quarterly data, use the first month of the quarter
            const quarterMonths = [0, 3, 6, 9]; // Starting months for each quarter (0-indexed)
            const quarterIndex = Number.parseInt(periodName.replace("Q", "")) - 1;
            if (quarterIndex < 0 || quarterIndex > 3)
                return true;

            itemDate = new Date(Number.parseInt(year), quarterMonths[quarterIndex], 1);
        } else {
            // For monthly data
            const monthNames = [
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
            const monthIndex = monthNames.indexOf(periodName);
            if (monthIndex === -1)
                return true;

            itemDate = new Date(Number.parseInt(year), monthIndex, 1);
        }

        // Try to use date range from state first
        if (from && to) {
            const fromDate = new Date(from.getFullYear(), from.getMonth(), 1);
            const toDate = new Date(to.getFullYear(), to.getMonth() + 1, 0);
            return itemDate >= fromDate && itemDate <= toDate;
        }

        // If we don't have date range in state, try to parse directly from URL
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");
        if (fromParam && toParam) {
            try {
                const fromDate = new Date(fromParam);
                const toDate = new Date(toParam);
                if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
                    return itemDate >= fromDate && itemDate <= toDate;
                }
            } catch (error) {
                console.warn("Failed to parse date parameters from URL", error);
            }
        }

        // If no valid date range, include all items
        return true;
    });

    const handleDateChange = (range: MonthRange) => {
        // Check if this is a "clear" action (both from and to are undefined)
        const isClearing = !range.from && !range.to;

        if (isClearing) {
            console.log("🧹 Clearing date range");
            // When clearing the date range, we need to fully reset the date state
            setDateRange({});
        } else {
            // Normal date change
            setDateRange(range);
        }

        setCurrentPage(1); // Reset to first page when filtering

        // Create parameters for URL
        const params: Record<string, string | null> = {
            page: "1",
        };

        // When range is cleared, we want to completely remove date params from URL
        if (range.from && range.to) {
            // Only add date params if both dates are present
            params.from = formatDateString(range.from); // Use YYYY-MM-DD format instead of ISO
            params.to = formatDateString(range.to);
        } else {
            // Explicitly remove date params from URL
            params.from = null;
            params.to = null;
        }

        // Keep clientId if selected
        if (selectedClientId) {
            params.clientId = selectedClientId.toString();
        }

        // Always set period type when clearing
        if (isClearing) {
            // Always use MONTH as default period type when clearing
            params.periodType = PeriodType.MONTH;
            setPeriodType(PeriodType.MONTH);
        } else if (!range.from || !range.to) {
            // Handle partial clearing (only one date selected)
            params.periodType = PeriodType.MONTH;
            setPeriodType(PeriodType.MONTH);
        } else {
            // Keep periodType parameter if date range is not cleared
            params.periodType = periodType;
        }

        // Handle quarterly parameters based on current period type
        if (periodType === PeriodType.QUARTER && !isClearing) {
            // If we're in Quarterly mode AND not clearing, keep using quarter and year parameters
            params.quarter = selectedQuarter.toString();
            params.year = selectedYear.toString();
        } else {
            // For Monthly mode or when clearing, ensure quarter and year are not included
            params.quarter = null;
            params.year = null;
        }

        // Update URL without changing period type
        updateURLParams(params);

        // We don't change the period type anymore - it stays as what the user selected
    };

    // Pagination - handle on frontend since we've already filtered the data
    const startIndex = (currentPage - 1) * PAGE_LIMIT;
    const endIndex = startIndex + PAGE_LIMIT;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredData.length / PAGE_LIMIT);

    // Handle page change
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        // Update URL parameter for page
        updateURLParams({ page: page.toString() });
        // Scroll to top of the table
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <h1 className="text-3xl font-semibold">Brokerage</h1>
                <div className="flex-col md:flex md:flex-row gap-4 items-center">
                    <CalculateBrokerageButton
                        onCalculationComplete={(data) => {
                            setCalculationResult(data);
                            toast.success("Brokerage calculation completed!");
                        }}
                        className="mb-2 md:mb-0"
                    />
                    <div className="flex min-w-50">
                        <Select
                            value={selectedClientId ? String(selectedClientId) : "all"}
                            onValueChange={(value) => {
                                const newClientId = value === "all" ? undefined : Number(value);
                                setSelectedClientId(newClientId);
                                setCurrentPage(1); // Reset to first page when changing client

                                // Update URL parameters, keeping other relevant parameters based on period type
                                const params: Record<string, string | null> = {
                                    clientId: newClientId ? String(newClientId) : null,
                                    page: "1",
                                };

                                updateURLParams(params);
                            }}
                        >
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder="All Clients" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients.map(client => (
                                    <SelectItem
                                        className="cursor-pointer text-sm"
                                        key={client.id}
                                        value={String(client.id)}
                                    >
                                        {client.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex min-w-50 ml-0 md:ml-2 mt-2 md:mt-0">
                        <Select
                            value={periodType}
                            onValueChange={(value) => {
                                const newPeriodType = value as PeriodType;
                                setPeriodType(newPeriodType);
                                setCurrentPage(1); // Reset to first page when changing period type

                                // Clear date range state regardless of period type
                                setDateRange({});

                                // Create an object with only the parameters needed for the new period type
                                const newParams: Record<string, string> = {
                                    periodType: newPeriodType,
                                    page: "1",
                                };

                                // Add relevant parameters based on period type
                                if (newPeriodType === PeriodType.QUARTER) {
                                    newParams.quarter = selectedQuarter.toString();
                                    newParams.year = selectedYear.toString();
                                }

                                // Add client ID if one is selected (this works for both period types)
                                if (selectedClientId) {
                                    newParams.clientId = selectedClientId.toString();
                                }

                                // Clear all existing URL parameters and set only the new ones
                                const queryString = new URLSearchParams(newParams).toString();
                                router.replace(`${pathname}?${queryString}`, { scroll: false });
                            }}
                        >
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder="Period Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={PeriodType.MONTH}>Monthly</SelectItem>
                                <SelectItem value={PeriodType.QUARTER}>Quarterly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Show year selector for quarterly view */}
                    {periodType === PeriodType.QUARTER && (
                        <div className="flex min-w-50 ml-0 md:ml-2 mt-2 md:mt-0">
                            <Select
                                value={selectedYear.toString()}
                                onValueChange={(value) => {
                                    const year = Number.parseInt(value);
                                    setSelectedYear(year);
                                    setCurrentPage(1); // Reset to first page when changing year

                                    // Keep all existing parameters, update year and page
                                    updateURLParams({
                                        year: year.toString(),
                                        page: "1",
                                    });
                                }}
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
                    )}

                    {/* Show quarter selector for quarterly view */}
                    {periodType === PeriodType.QUARTER && (
                        <div className="flex min-w-50 ml-0 md:ml-2 mt-2 md:mt-0">
                            <Select
                                value={selectedQuarter.toString()}
                                onValueChange={(value) => {
                                    const quarter = Number.parseInt(value);
                                    setSelectedQuarter(quarter);
                                    setCurrentPage(1); // Reset to first page when changing quarter

                                    // Keep all existing parameters, update quarter and page
                                    updateURLParams({
                                        quarter: quarter.toString(),
                                        page: "1",
                                    });
                                }}
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
                    )}

                    {/* Show month range picker for monthly view */}
                    {periodType === PeriodType.MONTH && (
                        <div className="md:w-1/2 w-full mt-2 md:mt-0">
                            <MonthRangePicker
                                onChange={handleDateChange}
                                from={dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined}
                                to={dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined}
                            />
                        </div>
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
                    label="Total Brokerage"
                />
            </div>

            {calculationResult
                ? (
                        <div className="mt-4 mb-6">
                            <BrokerageResults data={calculationResult} />
                        </div>
                    )
                : null}
            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                    <Table className="bg-white">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold  w-full justify-between items-center gap-4 rounded-lg py-3">
                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Total Brokerage</TableHead>
                                <TableHead className="rounded-tr-xl">{periodType === PeriodType.QUARTER ? "Quarter" : (periodType === PeriodType.MONTH ? "Month" : "Period")}</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading
                                ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8">Loading brokerage data...</TableCell>
                                        </TableRow>
                                    )
                                : paginatedData.length === 0
                                    ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8">No brokerage records found</TableCell>
                                            </TableRow>
                                        )
                                    : paginatedData.map((item: BrokerageItem, index: number) => {
                                            // Format the brokerage amount as currency
                                            const formattedAmount = new Intl.NumberFormat("en-IN", {
                                                style: "currency",
                                                currency: "INR",
                                                maximumFractionDigits: 2,
                                            }).format(item.brokerageAmount);

                                            return (
                                                <TableRow
                                                    // Create a unique composite key using clientId, date, and index to prevent duplicate key issues
                                                    key={`${item.clientId}-${item.date}-${index}`}
                                                    className="w-full py-10 gap-4 mx-3"
                                                >
                                                    <TableCell>{startIndex + index + 1}</TableCell>
                                                    <TableCell>{item.clientName}</TableCell>
                                                    <TableCell className="text-green-500">{formattedAmount}</TableCell>
                                                    <TableCell>{item.date}</TableCell>
                                                </TableRow>
                                            );
                                        })}

                        </TableBody>
                    </Table>
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            </div>

        </div>

    );
};

export default Brokerage;
