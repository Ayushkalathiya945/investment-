"use client";
import type { DateRange } from "react-day-picker";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import type { ClientFilterRequest } from "@/types/client";
import type { PaymentFilterRequest } from "@/types/payment";

import { getAllClients } from "@/api/client";
import { formatDateForPaymentApi, getAllPayments } from "@/api/payment";
import AddPayment from "@/components/Dialoge/AddPayment";
import { Pagination } from "@/components/ui/pagination";
import RangeDatePicker from "@/components/ui/rangeDatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT } from "@/lib/constants";

const PaymentHistory: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Extract query parameters
    const initialPage = searchParams.get("page") ? Number.parseInt(searchParams.get("page") as string, 10) : 1;
    const initialClientId = searchParams.get("clientId") ? Number.parseInt(searchParams.get("clientId") as string, 10) : undefined;
    const initialFrom = searchParams.get("from") || undefined;
    const initialTo = searchParams.get("to") || undefined;

    // State for filters and pagination
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [selectedClientId, setSelectedClientId] = useState<number | undefined>(initialClientId);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        if (initialFrom && initialTo) {
            try {
                // Ensure proper date parsing - format is expected to be YYYY-MM-DD
                const from = new Date(initialFrom);
                from.setHours(0, 0, 0, 0);

                const to = new Date(initialTo);
                to.setHours(23, 59, 59, 999);

                // Only set date range if dates are valid
                if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
                    return { from, to };
                }
            } catch (error) {
                console.error("Failed to parse date range from URL:", error);
            }
        }
        return undefined;
    });

    // State for clients dropdown
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    // Update URL with current filters
    const updateUrlParams = useCallback(() => {
        const params = new URLSearchParams();

        if (currentPage > 1) {
            params.set("page", currentPage.toString());
        }

        if (selectedClientId) {
            params.set("clientId", selectedClientId.toString());
        }

        // Add date parameters only if both dates are set and valid
        if (dateRange?.from && dateRange?.to) {
            try {
                // Create formatted dates for URL parameters
                const formattedFrom = formatDateForPaymentApi(dateRange.from);
                const formattedTo = formatDateForPaymentApi(dateRange.to);

                // Only add params if both dates are valid
                if (formattedFrom && formattedTo) {
                    params.set("from", formattedFrom);
                    params.set("to", formattedTo);
                } else {
                    console.error("Failed to format dates for URL:", {
                        from: dateRange.from,
                        to: dateRange.to,
                        formattedFrom,
                        formattedTo,
                    });
                }
            } catch (e) {
                console.error("Error setting date params:", e);
            }
        } else {
            // Remove date params if not filtered by date
            params.delete("from");
            params.delete("to");
        }

        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        router.push(newUrl, { scroll: false });
    }, [currentPage, selectedClientId, dateRange, router]);

    // Update URL when filters change - use a ref to track first render to avoid initial update
    const isFirstRender = React.useRef(true);

    useEffect(() => {
        // Skip the first render to avoid infinite loops with URL params
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Debounce URL updates to prevent rapid changes
        const timeoutId = setTimeout(() => {
            updateUrlParams();
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [currentPage, selectedClientId, dateRange, updateUrlParams]);

    // Fetch all clients for the dropdown
    useEffect(() => {
        async function fetchClients() {
            setIsLoadingClients(true);
            try {
                const clientFilterParams: ClientFilterRequest = {
                    page: 1,
                    limit: 15,
                };

                const response = await getAllClients(clientFilterParams);
                if (response && response.data) {
                    const clientOptions = response.data.map(client => ({
                        id: client.id,
                        name: client.name,
                    }));
                    setClients(clientOptions);
                }
            } catch (error) {
                console.error("Failed to load clients for filter:", error);
                toast.error("Failed to load client filter options");
            } finally {
                setIsLoadingClients(false);
            }
        }

        fetchClients();
    }, []);

    const fromDateFormatted = dateRange?.from ? formatDateForPaymentApi(dateRange.from) : undefined;
    const toDateFormatted = dateRange?.to ? formatDateForPaymentApi(dateRange.to) : undefined;

    const filterParams: PaymentFilterRequest = {
        page: currentPage,
        limit: PAGE_LIMIT,
        clientId: selectedClientId,
        from: fromDateFormatted,
        to: toDateFormatted,
    };

    const {
        data: paymentsResponse,
        isLoading,
        isFetching,
        error,
    } = useQuery({
        queryKey: ["payments", filterParams],
        queryFn: () => getAllPayments(filterParams),
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (error) {
            toast.error(`Failed to load payments: ${(error as Error).message}`);
        }
    }, [error]);

    const isHandlingDateChange = React.useRef(false);

    const handleDateChange = (date: DateRange) => {
        if (isHandlingDateChange.current)
            return;

        isHandlingDateChange.current = true;

        try {
            if (date?.from && date?.to) {
                const startDate = new Date(date.from);
                startDate.setHours(0, 0, 0, 0);

                const endDate = new Date(date.to);
                endDate.setHours(23, 59, 59, 999);

                if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                    console.error("Invalid date received:", { date, startDate, endDate });
                    return;
                }

                const formattedStart = formatDateForPaymentApi(startDate);
                const formattedEnd = formatDateForPaymentApi(endDate);

                if (!formattedStart || !formattedEnd) {
                    console.error("Date formatting failed:", { startDate, endDate });
                    return;
                }

                setDateRange({ from: startDate, to: endDate });
            } else {
                // console.error("Clearing date range");
                setDateRange(undefined);
            }

            setCurrentPage(1);
        } finally {
            setTimeout(() => {
                isHandlingDateChange.current = false;
            }, 100);
        }
    };

    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId === "all" ? undefined : Number.parseInt(clientId));
        setCurrentPage(1);
    };

    const totalPages = paymentsResponse?.pagination?.total
        ? Math.ceil(paymentsResponse.pagination.total / PAGE_LIMIT)
        : 1;

    const payments = paymentsResponse?.data || [];

    // Format date for display
    const formatDate = (dateStr: string | number): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full items-center">
                <h1 className="text-3xl font-semibold">Payment History</h1>
                <div className="flex-col md:flex md:flex-row gap-4 items-center">
                    <div className="flex min-w-50 ">
                        <Select
                            value={selectedClientId ? String(selectedClientId) : "all"}
                            onValueChange={handleClientChange}
                            disabled={isLoadingClients}
                        >
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder={isLoadingClients ? "Loading clients..." : "All Clients"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients.map(client => (
                                    <SelectItem
                                        className="cursor-pointer"
                                        key={client.id}
                                        value={String(client.id)}
                                    >
                                        {client.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:w-1/2 w-full my-3 md:my-0">
                        <RangeDatePicker
                            from={dateRange?.from ? dateRange.from.toISOString() : undefined}
                            to={dateRange?.to ? dateRange.to.toISOString() : undefined}
                            onChange={handleDateChange}
                        />
                    </div>
                    <AddPayment
                        name="Add Payment"
                        clientId={selectedClientId}
                    />
                </div>
            </div>

            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                    <Table className="bg-white">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold w-full justify-between items-center gap-4 rounded-lg py-3">
                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="rounded-tr-xl">Date</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading || isFetching
                                ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8">
                                                <div className="flex justify-center items-center">
                                                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                    <span>Loading payments...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                : error
                                    ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8">
                                                    <div className="flex justify-center items-center text-red-500">
                                                        <AlertCircle className="h-5 w-5 mr-2" />
                                                        <span>Error loading payments. Please try again.</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    : payments.length === 0
                                        ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8">
                                                        No payments found
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        : (
                                                payments.map((payment, index) => {
                                                    const client = clients.find(c => c.id === payment.clientId)?.name || `Client ${payment.clientId}`;

                                                    return (
                                                        <TableRow key={payment.id} className="w-full py-10 gap-4 mx-3">
                                                            <TableCell>{(currentPage - 1) * PAGE_LIMIT + index + 1}</TableCell>
                                                            <TableCell>{client}</TableCell>
                                                            <TableCell>
                                                                ₹
                                                                {payment.amount.toLocaleString("en-IN")}
                                                            </TableCell>
                                                            <TableCell>{payment.description || "-"}</TableCell>
                                                            <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Only show pagination if we have more than one page and no errors */}
                {!error && totalPages > 1 && (
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

export default PaymentHistory;
