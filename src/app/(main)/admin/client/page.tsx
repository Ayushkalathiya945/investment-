"use client";
import type { DateRange } from "react-day-picker";

import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Loader2, Search, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import type { Client, ClientFilterRequest } from "@/types/client";

import { getAllClients, getClientAnalytics } from "@/api/client";
import AddClient from "@/components/Dialoge/AddClient";
import StatCard from "@/components/StatCard";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import RangeDatePicker from "@/components/ui/rangeDatePicker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT } from "@/lib/constants";

// Helper function to format date as YYYY-MM-DD
function formatDateToYYYYMMDD(date: Date | undefined): string | undefined {
    if (!date)
        return undefined;
    return date.toISOString().split("T")[0]; // Gets YYYY-MM-DD part only
}

const Client: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Extract query parameters
    const initialPage = searchParams.get("page") ? Number.parseInt(searchParams.get("page") as string, 10) : 1;
    const initialSearch = searchParams.get("search") || "";
    const initialStartDate = searchParams.get("startDate") || undefined;
    const initialEndDate = searchParams.get("endDate") || undefined;

    const [currentPage, setCurrentPage] = useState(initialPage);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [clientsData, setClientsData] = useState<Client[]>([]);

    // Track if search is being performed
    const [isSearching, setIsSearching] = useState(false);

    // Set up date range from URL params if available
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        if (initialStartDate && initialEndDate) {
            return {
                from: new Date(initialStartDate),
                to: new Date(initialEndDate),
            };
        }
        return undefined;
    });

    // Update URL with current filters
    const updateUrlParams = useCallback(() => {
        const params = new URLSearchParams();

        if (currentPage > 1) {
            params.set("page", currentPage.toString());
        }

        if (searchTerm) {
            params.set("search", searchTerm);
        }

        if (dateRange?.from) {
            params.set("startDate", formatDateToYYYYMMDD(dateRange.from) || "");
        }

        if (dateRange?.to) {
            params.set("endDate", formatDateToYYYYMMDD(dateRange.to) || "");
        }

        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        router.push(newUrl, { scroll: false });
    }, [currentPage, searchTerm, dateRange, router]);

    // Debounce search to prevent too many API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsSearching(false);
            updateUrlParams();
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, updateUrlParams]);

    // Update URL when filters change (except search which is debounced)
    useEffect(() => {
        if (!isSearching) {
            updateUrlParams();
        }
    }, [currentPage, dateRange, isSearching, updateUrlParams]);

    // Prepare filter params for API calls
    const filterParams: ClientFilterRequest = {
        page: currentPage,
        limit: PAGE_LIMIT,
        search: searchTerm.trim() || undefined,
        from: formatDateToYYYYMMDD(dateRange?.from),
        to: formatDateToYYYYMMDD(dateRange?.to),
    };

    // Fetch clients data
    const { data: clientsResponse, isLoading: isLoadingClients, error: clientsError } = useQuery({
        queryKey: ["clients", filterParams],
        queryFn: () => getAllClients(filterParams),
        refetchOnWindowFocus: false,
    });

    // Update local clients data when API response changes
    useEffect(() => {
        let mounted = true;
        if (clientsResponse?.data && mounted) {
            // Use a local variable first to avoid direct setState in useEffect
            const newData = clientsResponse.data;
            // Assign setTimeout to a variable for proper cleanup
            const timer = setTimeout(() => {
                if (mounted) {
                    setClientsData(newData);
                }
            }, 0);

            return () => {
                clearTimeout(timer);
                mounted = false;
            };
        }
        return () => {
            mounted = false;
        };
    }, [clientsResponse]);

    // Use server-side filtered data directly
    const filteredClients = useMemo(() => {
        return clientsData;
    }, [clientsData]);

    // Fetch analytics data
    const { data: analyticsResponse, error: analyticsError } = useQuery({
        queryKey: ["clientAnalytics", filterParams],
        queryFn: () => getClientAnalytics(filterParams),
        refetchOnWindowFocus: false,
        // Don't fail the query on error - we'll handle it gracefully
        retry: false,
    });

    // Handle errors
    useEffect(() => {
        if (clientsError) {
            const errorMessage = (clientsError as any)?.error?.issues?.[0]?.message
                || (clientsError as Error).message
                || "An error occurred while loading clients";
            toast.error(errorMessage);
        }

        if (analyticsError) {
            // Just log analytics errors, don't show to user since it's not critical
            console.error("Analytics error:", analyticsError);
        }
    }, [clientsError, analyticsError]);

    const handleDateChange = (date: DateRange) => {
        if (date?.from && date?.to) {
            const startDate = new Date(date.from.setHours(0, 0, 0, 0));
            const endDate = new Date(date.to.setHours(23, 59, 59, 999));
            setDateRange({ from: startDate, to: endDate });
        } else {
            setDateRange(undefined);
        }
        // Reset to first page when date filter changes
        setCurrentPage(1);
    };

    // Get total pages from API response
    const totalPages = clientsResponse?.metadata?.total
        ? Math.ceil(clientsResponse.metadata.total / PAGE_LIMIT)
        : 1;

    // filteredClients is already declared and used in the component

    // Analytics data with safe defaults
    const analytics = {
        totalClient: analyticsResponse?.data?.totalClient || 0,
        totalTradeAmount: analyticsResponse?.data.totalValue || 0,
        totalBrokerageAmount: analyticsResponse?.data.totalBrokerage || 0,
        totalPaymentAmount: analyticsResponse?.data.totalPayment || 0,
        remainingPurseAmount: analyticsResponse?.data.remainingPurseAmount || 0,
    };

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex justify-between w-full">
                <h1 className="text-3xl font-semibold">Clients</h1>
                <div className="flex gap-4 items-center">
                    <div className="md:w-1/2 w-full">
                        <RangeDatePicker
                            from={dateRange?.from?.toISOString()}
                            to={dateRange?.to?.toISOString()}
                            onChange={handleDateChange}
                        />
                    </div>
                    <AddClient name="Add Client" />
                </div>
            </div>
            <div className="grid xl:grid-cols-4 md:grid-cols-2 grid-cols-1 justify-between gap-3 px-2">
                <StatCard icon={<Users />} value={analytics.totalClient} label="Total Clients" />
                <StatCard
                    icon={<IndianRupee />}
                    value={typeof analytics.totalTradeAmount === "number" ? `₹${analytics.totalTradeAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Total Value"
                />
                <StatCard
                    icon={<TrendingUp />}
                    value={typeof analytics.totalBrokerageAmount === "number" ? `₹${analytics.totalBrokerageAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Total fees"
                />
                <StatCard
                    icon={<TrendingDown />}
                    value={typeof analytics.totalPaymentAmount === "number" ? `₹${analytics.totalPaymentAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Payments Received"
                />
            </div>
            <div className="relative w-full">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10 text-sm pointer-events-none">
                    <Search size={18} className="text-primary pos" />
                </div>
                <Input
                    placeholder="Search by name, email or PAN..."
                    value={searchTerm}
                    onChange={(e) => {
                        setIsSearching(true);
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="pl-10 rounded-xl bg-white border border-border text-sm"
                />
            </div>

            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                    <Table className="bg-white">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold w-full justify-between items-center gap-4 rounded-lg py-3">
                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>PAN No.</TableHead>
                                <TableHead>Mobile no.</TableHead>
                                <TableHead className="rounded-tr-xl">Email</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoadingClients || isSearching
                                ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8">
                                                <div className="flex justify-center items-center">
                                                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                    <span>{isSearching ? "Searching..." : "Loading clients..."}</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                : filteredClients.length === 0
                                    ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8">
                                                    No clients found
                                                </TableCell>
                                            </TableRow>
                                        )
                                    : (
                                            filteredClients.map((client, index) => (
                                                <TableRow
                                                    key={client.id}
                                                    className="w-full py-10 gap-4 mx-3 cursor-pointer"
                                                    onClick={() => { router.push(`/admin/client/${client.id}`); }}
                                                >
                                                    <TableCell>{(currentPage - 1) * PAGE_LIMIT + index + 1}</TableCell>
                                                    <TableCell>{client.name}</TableCell>
                                                    <TableCell>{client.pan}</TableCell>
                                                    <TableCell>{client.mobile}</TableCell>
                                                    <TableCell>{client.email}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={page => setCurrentPage(page)}
                    />
                )}
            </div>
        </div>
    );
};

export default Client;
