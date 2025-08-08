"use client";

import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { Loader2, TrendingUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type {
    DailyBrokerageRecord,
    MonthlyBrokerageSummary,
    QuarterlyBrokerageSummary,
} from "@/types/brokerage";

import { getPeriodicBrokerage } from "@/api/brokerage";
import { getAllClientsForDropdown } from "@/api/client";
import StatCard from "@/components/StatCard";
import MonthRangePicker from "@/components/ui/monthRangePicker";
import { Pagination } from "@/components/ui/pagination";
import RangeDatePicker from "@/components/ui/rangeDatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT } from "@/lib/constants";
import { PeriodType as ApiPeriodType } from "@/types/brokerage";

function formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    // console.log("Date to format:", date);

    // console.log("Formatted date:", `${yyyy}-${mm}-${dd}`);

    return `${yyyy}-${mm}-${dd}`;
}

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

    const updateURL = useCallback((params: Record<string, string | number | undefined>) => {
        const newSearchParams = new URLSearchParams(searchParams.toString());

        const currentClientId = searchParams.get("clientId");

        const filterKeys = ["periodType", "page", "selectedMonthYear", "monthFrom", "monthTo", "selectedQuarter", "selectedQuarterYear", "dateFrom", "dateTo"];
        filterKeys.forEach(key => newSearchParams.delete(key));

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                newSearchParams.set(key, value.toString());
            }
        });

        if (currentClientId && !("clientId" in params)) {
            newSearchParams.set("clientId", currentClientId);
        }

        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

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
            clientId: searchParams.get("clientId"),
        };
    }, [searchParams]);

    const [periodType, setPeriodType] = useState<PeriodType>(() => {
        const urlParams = initializeFromURL();
        return urlParams.periodType;
    });

    const [currentPage, setCurrentPage] = useState(() => {
        const urlParams = initializeFromURL();
        return urlParams.page;
    });
    const [totalPages, setTotalPages] = useState(1);

    const [clientId, setClientId] = useState<number | undefined>(() => {
        const urlParams = initializeFromURL();
        return urlParams.clientId ? Number.parseInt(urlParams.clientId) : undefined;
    });

    const [selectedDateRange, setSelectedDateRange] = useState<{ from?: Date; to?: Date }>(() => {
        const urlParams = initializeFromURL();
        return {
            from: urlParams.dateFrom ? new Date(urlParams.dateFrom) : startOfMonth(new Date()),
            to: urlParams.dateTo ? new Date(urlParams.dateTo) : new Date(),
        };
    });

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
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    const syncStateToURL = useCallback(() => {
        const params: Record<string, string | number | undefined> = {
            periodType,
            page: currentPage,
        };

        switch (periodType) {
            case "DAILY":
                if (selectedDateRange.from)
                    params.dateFrom = formatDate(selectedDateRange.from);
                if (selectedDateRange.to)
                    params.dateTo = formatDate(selectedDateRange.to);
                break;
            case "MONTHLY":
                params.selectedMonthYear = selectedMonthYear;
                params.monthFrom = formatDate(monthRange.from);
                params.monthTo = formatDate(monthRange.to);
                break;
            case "QUARTERLY":
                params.selectedQuarter = selectedQuarter;
                params.selectedQuarterYear = selectedQuarterYear;
                break;
        }

        updateURL(params);
    }, [periodType, currentPage, selectedDateRange, selectedMonthYear, monthRange, selectedQuarter, selectedQuarterYear, updateURL]);

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoadingClients(true);
            try {
                const clientsData = await getAllClientsForDropdown();
                setClients(clientsData);
            } catch (error) {
                console.error("Error fetching clients:", error);
                toast.error("Failed to load client list");
            } finally {
                setIsLoadingClients(false);
            }
        };

        fetchClients();
    }, []);

    const handleClientChange = (value: string) => {
        if (value === "all") {
            setClientId(undefined);
            updateURL({ clientId: undefined });
        } else {
            const numValue = Number.parseInt(value);
            if (!Number.isNaN(numValue)) {
                setClientId(numValue);
                updateURL({ clientId: value });
            }
        }
        setCurrentPage(1);
    };

    const fetchBrokerageData = useCallback(async () => {
        setIsLoading(true);
        syncStateToURL();
        try {
            let apiPeriodType: ApiPeriodType;
            let period: number | undefined;
            let year: number | undefined;

            switch (periodType) {
                case "DAILY":
                    apiPeriodType = ApiPeriodType.DAILY;
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

            const response = await getPeriodicBrokerage(
                clientId?.toString(),
                apiPeriodType,
                period,
                year,
                currentPage,
                PAGE_LIMIT,
                periodType === "QUARTERLY" ? selectedQuarter : undefined,
                periodType === "QUARTERLY" ? selectedQuarterYear : undefined,
                periodType === "MONTHLY" ? (monthRange.from.getMonth() + 1) : undefined,
                periodType === "MONTHLY" ? monthRange.from.getFullYear() : undefined,
                periodType === "MONTHLY" ? (monthRange.to.getMonth() + 1) : undefined,
                periodType === "MONTHLY" ? monthRange.to.getFullYear() : undefined,
                periodType === "DAILY" && selectedDateRange.from ? formatDate(selectedDateRange.from) : undefined, // startDate
                periodType === "DAILY" && selectedDateRange.to ? formatDate(selectedDateRange.to) : undefined, // endDate
                periodType === "DAILY" && selectedDateRange.from ? formatDate(selectedDateRange.from) : undefined, // from
                periodType === "DAILY" && selectedDateRange.to ? formatDate(selectedDateRange.to) : undefined, // to
            );

            if (response.success && response.data) {
                let dataArray: (DailyBrokerageRecord | MonthlyBrokerageSummary | QuarterlyBrokerageSummary)[] = [];

                if (Array.isArray(response.data)) {
                    dataArray = response.data;
                } else if (typeof response.data === "object" && response.data !== null) {
                    if (response.data.daily) {
                        dataArray = response.data.daily.map(item => ({
                            id: item.id,
                            clientId: item.clientId,
                            clientName: item.clientName,
                            date: new Date(item.date),
                            totalDailyBrokerage: item.totalDailyBrokerage,
                            totalHoldingAmount: item.totalHoldingAmount,
                            totalUnusedAmount: item.totalUnusedAmount,
                        }));
                    } else if (response.data.quarterly) {
                        dataArray = response.data.quarterly.map(item => ({
                            clientId: item.clientId,
                            clientName: `Client ${item.clientId}`,
                            period: {
                                quarter: item.quarter,
                                year: item.year,
                            },
                            brokerageAmount: item.totalBrokerage,
                            totalHoldingAmount: item.totalHoldingAmount,
                            totalUnusedAmount: item.totalUnusedAmount,
                        }));
                    }
                }

                setBrokerageData(dataArray);

                const total = dataArray.reduce((sum: number, item: any) => {
                    if ("totalDailyBrokerage" in item) {
                        return sum + item.totalDailyBrokerage;
                    } else if ("brokerageAmount" in item) {
                        return sum + item.brokerageAmount;
                    }
                    return sum;
                }, 0);
                setTotalBrokerageAmount(total);

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
    }, [clientId, periodType, selectedMonthYear, monthRange, selectedQuarter, selectedQuarterYear, currentPage, selectedDateRange, syncStateToURL]);

    useEffect(() => {
        fetchBrokerageData();
    }, [fetchBrokerageData]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePeriodTypeChange = (newPeriodType: PeriodType) => {
        setPeriodType(newPeriodType);
        setCurrentPage(1);

        const params: Record<string, string | number | undefined> = {
            periodType: newPeriodType,
            page: 1,
        };

        updateURL(params);

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

                    <div className="w-full md:w-1/3">
                        <Select
                            value={clientId ? String(clientId) : "all"}
                            onValueChange={handleClientChange}
                        >
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder="Select Client" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients.map(client => (
                                    <SelectItem
                                        key={client.id}
                                        value={String(client.id)}
                                    >
                                        {client.name}
                                    </SelectItem>
                                ))}
                                {isLoadingClients && (
                                    <div className="flex items-center justify-center p-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
                                        Loading clients...
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

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

                    {periodType === "DAILY" && (
                        <div className="w-full md:w-auto">

                            <RangeDatePicker
                                from={selectedDateRange.from ? formatDate(selectedDateRange.from) : undefined}
                                to={selectedDateRange.to ? formatDate(selectedDateRange.to) : undefined}
                                onChange={(range: { from?: Date; to?: Date }) => setSelectedDateRange(range)}
                            />

                        </div>
                    )}

                    {periodType === "MONTHLY" && (
                        <>

                            <div className="md:w-1/2 w-full mt-2 md:mt-0">
                                <MonthRangePicker
                                    onChange={(range) => {
                                        if (range.from && range.to) {
                                            setMonthRange({ from: new Date(range.from), to: new Date(range.to) });
                                        }
                                    }}
                                    from={monthRange.from ? formatDate(monthRange.from) : undefined}
                                    to={monthRange.to ? formatDate(monthRange.to) : undefined}
                                />
                            </div>
                        </>
                    )}

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
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                    }).format(totalBrokerageAmount)}
                    label="Total Fees"
                    isLoading={isLoading}
                />
            </div>
            <div className="h-full flex flex-col flex-grow gap-6 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF] overflow-hidden">
                    <Table className="bg-white w-full">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[14px] font-semibold border-b border-gray-200">
                                <TableHead className="rounded-tl-xl py-4 px-6 text-left font-medium text-gray-700 w-[8%]">No.</TableHead>
                                <TableHead className="py-4 px-6 text-left font-medium text-gray-700 w-[20%]">Client</TableHead>
                                <TableHead className="py-4 px-6 text-left font-medium text-gray-700 w-[18%]">Total Holding Amount</TableHead>
                                <TableHead className="py-4 px-6 text-left font-medium text-gray-700 w-[18%]">Total Deployed Amount</TableHead>
                                <TableHead className="py-4 px-6 text-left font-medium text-gray-700 w-[18%]">Total Fees</TableHead>
                                <TableHead className="rounded-tr-xl py-4 px-6 text-left font-medium text-gray-700 w-[18%]">
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
                                        <TableRow className="border-b border-gray-100">
                                            <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                : brokerageData.length === 0
                                    ? (
                                            <TableRow className="border-b border-gray-100">
                                                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                                    No data available
                                                </TableCell>
                                            </TableRow>
                                        )
                                    : (
                                            brokerageData.map((item, index) => {
                                                const serialNumber = (currentPage - 1) * PAGE_LIMIT + index + 1;

                                                let clientName = "";
                                                let amount = 0;
                                                let periodDisplay = "";
                                                let totalHoldingAmount = 0;
                                                let totalUnusedAmount = 0;

                                                if ("totalDailyBrokerage" in item) {
                                                    clientName = item.clientName;
                                                    amount = item.totalDailyBrokerage;
                                                    periodDisplay = new Date(item.date).toLocaleDateString("en-GB", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                    });

                                                    totalHoldingAmount = item.totalHoldingAmount;
                                                    totalUnusedAmount = item.totalUnusedAmount;
                                                } else if ("brokerageAmount" in item) {
                                                    clientName = item.clientName;
                                                    amount = item.brokerageAmount;
                                                    totalHoldingAmount = item.totalHoldingAmount;
                                                    totalUnusedAmount = item.totalUnusedAmount;

                                                    if ("period" in item && typeof item.period === "object") {
                                                        if ("quarter" in item.period) {
                                                            periodDisplay = `Q${item.period.quarter} ${item.period.year}`;
                                                        } else if ("month" in item.period) {
                                                            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                            periodDisplay = `${monthNames[item.period.month - 1]} ${item.period.year}`;
                                                        }
                                                    }
                                                }

                                                const uniqueKey = `client-${item.clientId}-period-${periodDisplay.replace(/\s+/g, "-").toLowerCase()}`;
                                                return (
                                                    <TableRow key={uniqueKey} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                        <TableCell className="py-4 px-6 text-sm text-gray-900 font-medium">{serialNumber}</TableCell>
                                                        <TableCell className="py-4 px-6 text-sm text-gray-900 font-medium">{clientName}</TableCell>
                                                        <TableCell className="py-4 px-6 text-sm text-gray-700">
                                                            {new Intl.NumberFormat("en-IN", {
                                                                maximumFractionDigits: 2,
                                                            }).format(totalHoldingAmount)}
                                                        </TableCell>
                                                        <TableCell className="py-4 px-6 text-sm text-gray-700">
                                                            {new Intl.NumberFormat("en-IN", {
                                                                maximumFractionDigits: 2,
                                                            }).format(totalUnusedAmount)}
                                                        </TableCell>
                                                        <TableCell className="py-4 px-6 text-sm text-green-600">
                                                            {new Intl.NumberFormat("en-IN", {
                                                                style: "currency",
                                                                currency: "INR",
                                                                maximumFractionDigits: 2,
                                                            }).format(amount)}
                                                        </TableCell>
                                                        <TableCell className="py-4 px-6 text-sm text-gray-700">{periodDisplay}</TableCell>
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
