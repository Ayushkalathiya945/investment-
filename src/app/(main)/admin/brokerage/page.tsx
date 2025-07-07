"use client";

import { format } from "date-fns";
import { TrendingUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type { BrokerageItem } from "@/types/brokerage";

import { getAllPeriodicBrokerage, getBrokerageRecords } from "@/api/brokerage";
import { getAllClientsForDropdown } from "@/api/client";
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
    const [brokerageData, setBrokerageData] = useState<BrokerageItem[]>([]);
    const [periodType, setPeriodType] = useState<PeriodType>(initialPeriodType);
    const [totalBrokerageAmount, setTotalBrokerageAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedClientId, setSelectedClientId] = useState<number | undefined>(initialClientId);
    const [selectedQuarter, setSelectedQuarter] = useState<number>(initialQuarter);
    const [selectedYear, setSelectedYear] = useState<number>(initialYear);
    const [clients, setClients] = useState<Array<{ id: number; name: string }>>([]);
    const [serverPaginationData, setServerPaginationData] = useState<{
        totalPages: number;
    }>({ totalPages: 1 });

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
                        page: currentPage,
                        limit: PAGE_LIMIT,
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
                        response = await getAllPeriodicBrokerage(
                            periodType,
                            selectedQuarter,
                            selectedYear,
                            currentPage,
                            PAGE_LIMIT,
                        );
                    } else if (periodType === PeriodType.MONTH) {
                        if (dateRange.from && dateRange.to) {
                            const filterParams = {
                                page: currentPage,
                                limit: PAGE_LIMIT,
                                periodType: PeriodType.MONTH,
                                from: formatDateString(dateRange.from),
                                to: formatDateString(dateRange.to),
                            };

                            response = await getBrokerageRecords(filterParams);
                        } else if (searchParams.get("from") && searchParams.get("to") && Object.keys(dateRange).length > 0) {
                            const fromParam = searchParams.get("from");
                            const toParam = searchParams.get("to");

                            const fromDate = fromParam ? parseDateFromString(fromParam) : undefined;
                            const toDate = toParam ? parseDateFromString(toParam) : undefined;

                            const filterParams = {
                                page: currentPage,
                                limit: PAGE_LIMIT,
                                periodType: PeriodType.MONTH,
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
                            const currentDate = new Date();
                            const defaultMonth = currentDate.getMonth() + 1;
                            const defaultYear = currentDate.getFullYear();

                            const isEmptyDateRange = Object.keys(dateRange).length === 0;

                            if (isEmptyDateRange) {
                                const cleanParams = {
                                    page: currentPage,
                                    limit: PAGE_LIMIT,
                                    periodType: PeriodType.MONTH,
                                };

                                response = await getBrokerageRecords(cleanParams);
                            } else {
                                response = await getAllPeriodicBrokerage(
                                    PeriodType.MONTH,
                                    defaultMonth,
                                    defaultYear,
                                    currentPage,
                                    PAGE_LIMIT,
                                );
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

                    // Update pagination data from the server response
                    if (response.metadata) {
                        setServerPaginationData({
                            totalPages: response.metadata.totalPages || Math.ceil(response.metadata.total / PAGE_LIMIT),
                        });
                    }
                } else {
                    setBrokerageData([]);
                    setTotalBrokerageAmount(0);
                    setServerPaginationData({ totalPages: 1 });
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
    }, [periodType, selectedClientId, dateRange, selectedQuarter, selectedYear, currentPage]);

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
                updateURLParams({
                    from: formatDateString(dateRange.from),
                    to: formatDateString(dateRange.to),
                    quarter: null,
                    year: null,
                });
            } else if (Object.keys(dateRange).length === 0) {
                updateURLParams({
                    from: null,
                    to: null,
                    periodType: PeriodType.MONTH,
                });
            }
        }
    }, [selectedQuarter, selectedYear, periodType, dateRange, updateURLParams]);

    const handleDateChange = (range: MonthRange) => {
        const isClearing = !range.from && !range.to;

        if (isClearing) {
            setDateRange({});
        } else {
            setDateRange(range);
        }

        setCurrentPage(1);

        const params: Record<string, string | null> = {
            page: "1",
        };

        if (range.from && range.to) {
            params.from = formatDateString(range.from);
            params.to = formatDateString(range.to);
        } else {
            params.from = null;
            params.to = null;
        }

        if (selectedClientId) {
            params.clientId = selectedClientId.toString();
        }

        if (isClearing) {
            params.periodType = PeriodType.MONTH;
            setPeriodType(PeriodType.MONTH);
        } else if (!range.from || !range.to) {
            params.periodType = PeriodType.MONTH;
            setPeriodType(PeriodType.MONTH);
        } else {
            params.periodType = periodType;
        }

        if (periodType === PeriodType.QUARTER && !isClearing) {
            params.quarter = selectedQuarter.toString();
            params.year = selectedYear.toString();
        } else {
            params.quarter = null;
            params.year = null;
        }

        updateURLParams(params);
    };

    const paginatedData = brokerageData;

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        updateURLParams({ page: page.toString() });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <h1 className="text-3xl font-semibold">Fees</h1>
                <div className="flex-col md:flex md:flex-row gap-4 items-center">
                    <div className="flex min-w-50">
                        <Select
                            value={selectedClientId ? String(selectedClientId) : "all"}
                            onValueChange={(value) => {
                                const newClientId = value === "all" ? undefined : Number(value);
                                setSelectedClientId(newClientId);
                                setCurrentPage(1);

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
                                setCurrentPage(1);

                                setDateRange({});

                                const newParams: Record<string, string> = {
                                    periodType: newPeriodType,
                                    page: "1",
                                };

                                if (newPeriodType === PeriodType.QUARTER) {
                                    newParams.quarter = selectedQuarter.toString();
                                    newParams.year = selectedYear.toString();
                                }

                                if (selectedClientId) {
                                    newParams.clientId = selectedClientId.toString();
                                }

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
                                    setCurrentPage(1);

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
                                    setCurrentPage(1);

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
                    label="Total Fees"
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
                                                    <TableCell>{((currentPage - 1) * PAGE_LIMIT) + index + 1}</TableCell>
                                                    <TableCell>{item.clientName}</TableCell>
                                                    <TableCell className="text-green-500">{formattedAmount}</TableCell>
                                                    <TableCell>{item.date}</TableCell>
                                                </TableRow>
                                            );
                                        })}

                        </TableBody>
                    </Table>
                </div>

                {serverPaginationData.totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={serverPaginationData.totalPages}
                        onPageChange={handlePageChange}
                    />
                )}
            </div>

        </div>

    );
};

export default Brokerage;
