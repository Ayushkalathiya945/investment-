"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

import type { ClientDropdownItem } from "@/types/client";
import type { TradeFilterRequest } from "@/types/trade";

import { getAllClientsForDropdown } from "@/api/client";
import { formatDateForTradeApi, getAllTrades } from "@/api/trades";
import AddTrade from "@/components/Dialoge/AddTrade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MonthRangePicker from "@/components/ui/monthRangePicker";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT, TYPE } from "@/lib/constants";

type MonthRange = {
    from?: Date;
    to?: Date;
};

const TradePage: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get filter values from URL query params
    const clientIdParam = searchParams.get("clientId");
    const symbolParam = searchParams.get("symbol");
    const typeParam = searchParams.get("type") as "BUY" | "SELL" | "";
    const pageParam = searchParams.get("page");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Parse dates from URL if they exist
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const [currentPage, setCurrentPage] = useState(pageParam ? Number.parseInt(pageParam) : 1);
    const [dateRange, setDateRange] = useState<MonthRange>({
        from: startDate,
        to: endDate,
    });
    const [searchTerm, setSearchTerm] = useState(symbolParam || "");
    const [tradeType, setTradeType] = useState<"BUY" | "SELL" | "">(typeParam || "");
    const [clientId, setClientId] = useState<number | undefined>(
        clientIdParam ? Number.parseInt(clientIdParam) : undefined,
    );
    const [clients, setClients] = useState<ClientDropdownItem[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    // State to track which trade is being edited
    const [editTradeId, setEditTradeId] = useState<number | undefined>();
    const [showEditDialog, setShowEditDialog] = useState(false);

    // Function to handle edit button click
    const handleEditTrade = (tradeId: number) => {
        setEditTradeId(tradeId);
        setShowEditDialog(true);
    };

    // Function to handle dialog close
    const handleDialogOpenChange = (open: boolean) => {
        setShowEditDialog(open);
        if (!open) {
            // Reset the edit trade ID when dialog is closed
            setTimeout(() => {
                setEditTradeId(undefined);
            }, 300); // Small delay to ensure dialog animation completes
        }
    };

    // Update URL with current filters
    const updateUrlWithFilters = () => {
        const params = new URLSearchParams();

        if (clientId)
            params.set("clientId", clientId.toString());
        if (searchTerm)
            params.set("symbol", searchTerm);
        if (tradeType)
            params.set("type", tradeType);
        if (currentPage > 1)
            params.set("page", currentPage.toString());
        if (dateRange.from)
            params.set("startDate", formatDateForTradeApi(dateRange.from) || "");
        if (dateRange.to)
            params.set("endDate", formatDateForTradeApi(dateRange.to) || "");

        router.push(`?${params.toString()}`);
    };

    useEffect(() => {
        updateUrlWithFilters();
    }, [clientId, searchTerm, tradeType, currentPage, dateRange]);

    // Fetch clients for dropdown
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

    const filterParams: TradeFilterRequest = {
        page: currentPage,
        pageSize: PAGE_LIMIT,
        ...(dateRange.from && dateRange.to && {
            startDate: formatDateForTradeApi(dateRange.from),
            endDate: formatDateForTradeApi(dateRange.to),
        }),
        ...(clientId && { clientId }),
        ...(searchTerm && { stockSymbol: searchTerm }),
        ...(tradeType && { type: tradeType }),
    };

    // Fetch trades with React Query
    const {
        data: tradesResponse,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["trades", filterParams],
        queryFn: () => getAllTrades(filterParams),
        staleTime: 30000, // 30 seconds
    });

    // Log the response for debugging
    console.log("Trades response:", tradesResponse);

    // Get trade data and pagination from response
    const trades = tradesResponse?.data || [];

    // Access pagination data - API returns pagination mapped from metadata
    const pagination = (tradesResponse as any)?.pagination || {
        total: 0,
        currentPage,
        pageSize: PAGE_LIMIT,
        totalPages: 0,
    };

    // Filter trades by search term client name or stock symbol
    const filteredTrades = trades.filter((trade) => {
        if (!searchTerm)
            return true;
        const searchLower = searchTerm.toLowerCase();

        return (
            trade.symbol.toLowerCase().includes(searchLower)
            || String(trade.id).includes(searchLower)
        );
    });

    // Handle date range changes
    const handleDateChange = (range: MonthRange) => {
        setDateRange(range);
        setCurrentPage(1);
    };

    // Handle page change
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    // Handle trade type filter
    const handleTradeTypeChange = (value: string) => {
        if (value === "ALL") {
            setTradeType("");
        } else {
            setTradeType(value as "BUY" | "SELL");
        }
        setCurrentPage(1);
    };

    function formatDate(date: Date): string {
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    const handleClientChange = (value: string) => {
        if (value === "all") {
            setClientId(undefined);
        } else {
            const numValue = Number.parseInt(value);
            if (!Number.isNaN(numValue)) {
                setClientId(numValue);
            }
        }
        setCurrentPage(1);
    };

    useEffect(() => {
        if (isError && error) {
            const errorMessage = error instanceof Error
                ? error.message
                : (typeof error === "object" && error && error !== null && "message" in error)
                        ? String((error as { message: string }).message)
                        : "Failed to fetch trades";

            toast.error(errorMessage);
        }
    }, [isError, error]);

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">

            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <h1 className="text-3xl font-semibold">Trade</h1>
                <div className="flex items-center gap-4">
                    <div className="md:w-1/2 w-full">
                        <MonthRangePicker
                            onChange={handleDateChange}
                            from={dateRange.from?.toISOString()}
                            to={dateRange.to?.toISOString()}
                        />
                    </div>
                    <AddTrade
                        name="Add Trade"
                        onSuccess={() => refetch()}
                    />

                    {/* Separate dialog for editing trades */}
                    {editTradeId && (
                        <AddTrade
                            name="Edit Trade"
                            editTradeId={editTradeId}
                            onSuccess={() => {
                                refetch();
                                setShowEditDialog(false);
                                setTimeout(() => setEditTradeId(undefined), 300);
                            }}
                            open={showEditDialog}
                            onOpenChange={handleDialogOpenChange}
                        />
                    )}
                </div>
            </div>

            <div className="relative flex-col md:flex md:flex-row w-full gap-3 flex items-start md:items-center">
                <div className="w-full md:w-1/3">
                    <div className="absolute hidden md:block left-5 top-1/2 -translate-y-1/2 z-10 text-sm pointer-events-none">
                        <Search size={18} className="text-primary" />
                    </div>
                    <Input
                        placeholder="Search by symbol..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-10 rounded-xl bg-white border border-border text-sm"
                    />
                </div>
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
                <div className="flex min-w-50 w-full md:w-1/3">
                    <Select value={tradeType || "ALL"} onValueChange={handleTradeTypeChange}>
                        <SelectTrigger className="w-full ring-0">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All</SelectItem>
                            {TYPE.map(item => (
                                <SelectItem
                                    className="cursor-pointer"
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                {isLoading
                    ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        )
                    : filteredTrades.length === 0
                        ? (
                                <div className="flex items-center justify-center h-64 text-gray-500">
                                    No trades found.
                                </div>
                            )
                        : (
                                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                                    <Table className="bg-white">
                                        <TableHeader>
                                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold w-full justify-between items-center gap-4 rounded-lg py-3">
                                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                                <TableHead>ClientName </TableHead>
                                                <TableHead>Stock</TableHead>
                                                <TableHead>Exchange</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Quantity</TableHead>
                                                <TableHead>Share Price</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="rounded-tr-xl">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {filteredTrades.map((trade, index) => {
                                            // Format the date for display
                                                const tradeDate = trade.tradeDate instanceof Date
                                                    ? formatDate(trade.tradeDate)
                                                    : formatDate(new Date(trade.tradeDate));

                                                return (
                                                    <TableRow key={trade.id} className="w-full py-10 gap-4 mx-3">
                                                        <TableCell>{(pagination.currentPage - 1) * PAGE_LIMIT + index + 1}</TableCell>
                                                        <TableCell>{trade.clientName}</TableCell>
                                                        <TableCell>{trade.symbol}</TableCell>
                                                        <TableCell>{trade.exchange}</TableCell>
                                                        <TableCell>
                                                            {trade.type === "BUY"
                                                                ? (
                                                                        <div className="flex rounded-xl text-green-500 bg-green-100 py-1 px-5 w-fit items-center">
                                                                            <TrendingUp size={15} className="mr-2" />
                                                                            {trade.type}
                                                                        </div>
                                                                    )
                                                                : (
                                                                        <div className="flex rounded-xl text-red-500 bg-red-100 py-1 px-5 w-fit items-center">
                                                                            <TrendingDown size={15} className="mr-2" />
                                                                            {trade.type}
                                                                        </div>
                                                                    )}
                                                        </TableCell>
                                                        <TableCell>{trade.quantity}</TableCell>
                                                        <TableCell>{trade.price}</TableCell>
                                                        <TableCell>{tradeDate}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">

                                                                <Button
                                                                    className="h-8 bg-primary px-5 md:px-10 rounded-xl"
                                                                    onClick={() => handleEditTrade(trade.id)}
                                                                >
                                                                    <Pencil size={14} />
                                                                    <span className="hidden md:flex">Edit</span>
                                                                </Button>

                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}

                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                {pagination.totalPages > 1 && (
                    <Pagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        onPageChange={handlePageChange}
                    />
                )}
            </div>

        </div>

    );
};

export default TradePage;
