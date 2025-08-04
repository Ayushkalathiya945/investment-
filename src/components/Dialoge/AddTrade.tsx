"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";
import { z } from "zod";

import type { ClientDropdownItem } from "@/types/client";
import type { CreateTradeRequest, Trade, UpdateTradeRequest } from "@/types/trade";

import { getAllClientsForDropdown } from "@/api/client";
import { createTrade, formatDateForTradeApi, getStockSymbols, getTradeById, updateTrade } from "@/api/trades";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

import DatePicker from "../ui/datePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type AddTradeProps = {
    name?: string;
    onSuccess?: () => void;
    clientId?: number;
    editTradeId?: number;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

const tradeSchema = z.object({
    clientId: z.number().int().positive({ message: "Please select a valid client" }),
    symbol: z.string().min(1, { message: "Stock symbol is required" }),
    exchange: z.enum(["NSE", "BSE"], { message: "Please select an exchange" }),
    tradeType: z.enum(["BUY", "SELL"], { message: "Please select a trade type" }),
    quantity: z.number().int().positive({ message: "Quantity must be a positive number" }),
    price: z.number().positive({ message: "Price per share must be a positive number" }),
    tradeDate: z.string().min(1, { message: "Please select a date" }),
    notes: z.string().optional(),
    status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).default("COMPLETED").optional(),
});

type TradeFormValues = z.infer<typeof tradeSchema>;

function StockItem({ data, index, style }: { data: any; index: number; style: React.CSSProperties }) {
    const stock = data.items[index];
    const tradeForm = data.tradeForm;
    const setOpenStockPopover = data.setOpenStockPopover;

    return (
        <Button
            variant="ghost"
            className="w-full justify-start text-left hover:bg-secondary cursor-pointer"
            style={style}
            onClick={() => {
                tradeForm.setValue("exchange", stock.exchange);
                tradeForm.setValue("symbol", stock.value);
                setOpenStockPopover(false);
            }}
        >
            {stock.label}
        </Button>
    );
}

const AddTrade: React.FC<AddTradeProps> = ({
    name = "Add Trade",
    onSuccess,
    clientId,
    editTradeId,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
}) => {
    const [internalOpen, setInternalOpen] = useState(false);

    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = setControlledOpen || setInternalOpen;
    const [searchTerm, setSearchTerm] = useState("");
    const [openStockPopover, setOpenStockPopover] = useState(false);
    const [openClientPopover, setOpenClientPopover] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState("");
    const queryClient = useQueryClient();
    const isEditMode = Boolean(editTradeId);

    const tradeForm = useForm<TradeFormValues>({
        defaultValues: {
            clientId: clientId || undefined,
            symbol: "",
            exchange: undefined,
            tradeType: undefined,
            quantity: undefined,
            price: undefined,
            tradeDate: formatDateForTradeApi(new Date()),
            notes: "",
        },
        resolver: zodResolver(tradeSchema),
        mode: "onSubmit",
    });

    const { data: clientsDropdown = [], isLoading: loadingClients } = useQuery({
        queryKey: ["clientsDropdown"],
        queryFn: getAllClientsForDropdown,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: stockSymbols, isLoading: loadingStocks, error: stockError } = useQuery({
        queryKey: ["stockSymbols"],
        queryFn: async () => {
            try {
                const result = await getStockSymbols();

                if (!result || (typeof result !== "object")) {
                    console.error("Invalid stock symbols response format:", result);
                    throw new Error("Failed to fetch stock symbols: Invalid response format");
                }

                return result;
            } catch (error) {
                console.error("Error fetching stock symbols:", error);
                throw error;
            }
        },

        enabled: open,
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error: any) => {
            if (failureCount < 2 && error.message && !error.message.includes("Invalid response format")) {
                return true;
            }
            return false;
        },
        refetchOnWindowFocus: false,
    });

    const { data: tradeDetails, isLoading: loadingTradeDetails } = useQuery({
        queryKey: ["trade", editTradeId],
        queryFn: async () => {
            if (!editTradeId)
                return null;
            try {
                const trade = await getTradeById(editTradeId);
                return trade;
            } catch (error) {
                console.error(`Failed to fetch trade #${editTradeId}:`, error);
                toast.error(`Failed to load trade details: ${error instanceof Error ? error.message : "Unknown error"}`);
                throw error;
            }
        },
        enabled: isEditMode && open,
    });

    useEffect(() => {
        if (isEditMode && tradeDetails) {
            try {
                const tradeData = tradeDetails.trade ? tradeDetails.trade : tradeDetails;

                const exchange = (tradeData.exchange === "BSE")
                    ? "BSE" as const
                    : "NSE" as const;

                let formattedTradeDate = "";
                if (tradeData.tradeDate) {
                    if (typeof tradeData.tradeDate === "number") {
                        const dateObj = new Date(tradeData.tradeDate);
                        formattedTradeDate = dateObj.toISOString().split("T")[0];
                    } else if (typeof tradeData.tradeDate === "string") {
                        if (tradeData.tradeDate.includes("T")) {
                            formattedTradeDate = tradeData.tradeDate.split("T")[0];
                        } else {
                            formattedTradeDate = tradeData.tradeDate;
                        }
                    } else if (tradeData.tradeDate instanceof Date) {
                        formattedTradeDate = tradeData.tradeDate.toISOString().split("T")[0];
                    }
                } else {
                    console.warn("Trade date is missing, using current date");
                    formattedTradeDate = new Date().toISOString().split("T")[0];
                }

                tradeForm.reset({
                    clientId: tradeData.clientId,
                    symbol: tradeData.symbol,
                    exchange,
                    tradeType: tradeData.type,
                    quantity: tradeData.quantity,
                    price: tradeData.price,
                    tradeDate: formattedTradeDate,
                    notes: tradeData.notes || "",
                    status: tradeData.status || "COMPLETED",
                });
            } catch (error) {
                console.error("Error populating form with trade details:", error);
                toast.error("Failed to load trade details properly. Please try again.");
            }
        }
    }, [tradeDetails, isEditMode, tradeForm]);

    const formattedStocks = React.useMemo(() => {
        if (!stockSymbols)
            return [];

        try {
            const result = [];
            const nseArray = stockSymbols.nse || [];
            const bseArray = stockSymbols.bse || [];

            if (Array.isArray(nseArray) && nseArray.length > 0) {
                const nseStocks = nseArray.map(symbol => ({
                    label: `${symbol}-NSE`,
                    value: symbol,
                    exchange: "NSE" as const,
                }));
                result.push(...nseStocks);
            }

            if (Array.isArray(bseArray) && bseArray.length > 0) {
                const bseStocks = bseArray.map(symbol => ({
                    label: `${symbol}-BSE`,
                    value: symbol,
                    exchange: "BSE" as const,
                }));
                result.push(...bseStocks);
            }
            return result;
        } catch (error) {
            console.error("Error formatting stock symbols:", error);
            return [];
        }
    }, [stockSymbols]);

    const filteredClients = React.useMemo(() => {
        if (!clientSearchTerm || !clientsDropdown)
            return clientsDropdown;

        return clientsDropdown.filter(client =>
            client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
            || client.id.toString().includes(clientSearchTerm),
        );
    }, [clientsDropdown, clientSearchTerm]);

    const filteredStocks = React.useMemo(() => {
        if (!searchTerm)
            return formattedStocks;
        return formattedStocks.filter(stock =>
            stock.label.toLowerCase().includes(searchTerm.toLowerCase()),
        );
    }, [formattedStocks, searchTerm]);

    const createTradeMutation = useMutation({
        mutationFn: createTrade,
        onSuccess: (response: { data: Trade; message: string }) => {
            toast.success(response.message || "Trade created successfully");
            queryClient.invalidateQueries({ queryKey: ["trades"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });
            queryClient.invalidateQueries({ queryKey: ["client"] });
            queryClient.invalidateQueries({ queryKey: ["trade"] });

            tradeForm.reset();
            setOpen(false);
            if (onSuccess)
                onSuccess();
        },
        onError: (error: any) => {
            console.error("Trade creation error:", error);

            if (error.message && (
                error.message.includes("brokerage has already been calculated")
                || error.message.includes("brokerage calculation first")
                || error.isBrokerageConflict === true
            )) {
                toast.error(error.message, {
                    duration: 10000,
                    icon: "🚫",
                    style: {
                        border: "2px solid #f43f5e",
                        padding: "16px",
                        color: "#f43f5e",
                        fontWeight: "bold",
                    },
                });
                return;
            }

            if (error.message
                && !error.message.includes("Request failed with status code")
                && !error.message.includes("Failed to create trade")) {
                toast.error(error.message, {
                    duration: 7000,
                    icon: "⚠️",
                    style: {
                        border: "1px solid #f43f5e",
                        padding: "16px",
                        color: "#f43f5e",
                    },
                });
                return;
            }

            if (!error.message || error.message.includes("Request failed with status code")) {
                toast.error("Failed to create trade. Please try again.", {
                    duration: 3000,
                });
            } else {
                toast.error(error.message, { duration: 5000 });
            }

            if (error.error?.issues) {
                error.error.issues.forEach((issue: any) => {
                    toast.error(`${issue.path}: ${issue.message}`, {
                        duration: 5000,
                    });
                });
            }
        },
    });

    const onSubmit = async (data: TradeFormValues) => {
        const formattedTradeDate = formatDateForTradeApi(new Date(data.tradeDate)) || new Date().toISOString().split("T")[0];

        if (isEditMode && editTradeId) {
            const updateRequest: UpdateTradeRequest = {
                id: editTradeId,
                clientId: data.clientId,
                symbol: data.symbol,
                exchange: data.exchange,
                type: data.tradeType,
                quantity: data.quantity,
                price: data.price,
                tradeDate: formattedTradeDate,
                notes: data.notes || "",
            };

            try {
                const response = await updateTrade(editTradeId, updateRequest);
                toast.success(response.message || "Trade updated successfully");
                queryClient.invalidateQueries({ queryKey: ["trades"] });
                queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });
                queryClient.invalidateQueries({ queryKey: ["client"] });
                queryClient.invalidateQueries({ queryKey: ["trade"] });

                tradeForm.reset();

                setOpen(false);
                if (onSuccess)
                    onSuccess();
            } catch (error: any) {
                console.error("Trade update error:", error);

                if (error.message && (
                    error.message.includes("brokerage has already been calculated")
                    || error.message.includes("brokerage calculation first")
                    || error.isBrokerageConflict === true
                )) {
                    toast.error(error.message, {
                        duration: 10000,
                        icon: "🚫",
                        style: {
                            border: "2px solid #f43f5e",
                            padding: "16px",
                            color: "#f43f5e",
                            fontWeight: "bold",
                        },
                    });
                    return;
                }

                if (error.message
                    && !error.message.includes("Request failed with status code")
                    && !error.message.includes("Failed to update trade")) {
                    toast.error(error.message, {
                        duration: 7000,
                        icon: "⚠️",
                        style: {
                            border: "1px solid #f43f5e",
                            padding: "16px",
                            color: "#f43f5e",
                        },
                    });
                    return;
                }

                if (!error.message || error.message.includes("Request failed with status code")) {
                    toast.error("Failed to update trade. Please try again.", {
                        duration: 3000,
                    });
                } else {
                    toast.error(error.message, { duration: 5000 });
                }

                if (error.error?.issues) {
                    error.error.issues.forEach((issue: any) => {
                        toast.error(`${issue.path}: ${issue.message}`, {
                            duration: 5000,
                        });
                    });
                }
            }
        } else {
            const createRequest: CreateTradeRequest = {
                clientId: data.clientId,
                symbol: data.symbol,
                exchange: data.exchange,
                type: data.tradeType,
                quantity: data.quantity,
                price: data.price,
                tradeDate: formattedTradeDate,
                notes: data.notes || "",
            };

            createTradeMutation.mutate(createRequest);
        }
    };

    const calculateTotalValue = () => {
        const quantity = tradeForm.watch("quantity");
        const price = tradeForm.watch("price");

        if (quantity && price) {
            return quantity * price;
        }
        return 0;
    };

    useEffect(() => {
        if (open && !loadingStocks) {
            const hasValidData = stockSymbols
                && typeof stockSymbols === "object"
                && (Array.isArray(stockSymbols.nse) || Array.isArray(stockSymbols.bse));

            if (!hasValidData) {
                queryClient.invalidateQueries({ queryKey: ["stockSymbols"] });
            }
        }
    }, [stockSymbols, loadingStocks, queryClient, open]);

    useEffect(() => {
        if (open) {
            if (formattedStocks.length === 0) {
                queryClient.prefetchQuery({
                    queryKey: ["stockSymbols"],
                    queryFn: getStockSymbols,
                    staleTime: 5 * 60 * 1000,
                });
            }
        }
    }, [open, formattedStocks.length, queryClient]);

    const totalValue = calculateTotalValue();

    const [isButtonLoading, setIsButtonLoading] = useState(false);

    const handleDialogOpen = (newOpenState: boolean) => {
        if (newOpenState) {
            if (formattedStocks.length === 0) {
                setIsButtonLoading(true);

                queryClient.prefetchQuery({
                    queryKey: ["stockSymbols"],
                    queryFn: getStockSymbols,
                    staleTime: 5 * 60 * 1000,
                }).then(() => {
                    setIsButtonLoading(false);
                    setOpen(true);
                }).catch(() => {
                    setIsButtonLoading(false);
                    setOpen(true);
                });
            } else {
                setOpen(true);
            }
        } else {
            setOpen(false);

            if (isEditMode) {
                tradeForm.reset();
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogOpen}>
            {!isEditMode && (
                <DialogTrigger asChild>
                    <Button
                        className="ml-auto bg-primary px-5 md:px-8 rounded-xl"
                        disabled={isButtonLoading}
                    >
                        {isButtonLoading
                            ? (
                                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )
                            : (
                                    <Plus size={18} />
                                )}
                        <span className="hidden md:flex">{name}</span>
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-2xl min-w-[300px] p-6">

                <DialogHeader>
                    <DialogTitle className="text-xl font-medium">
                        {isEditMode
                            ? "Edit Trade"
                            : "Add Trade"}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(100vh-220px)]">
                    <div className="px-2">
                        {(isEditMode && loadingTradeDetails)

                            ? (
                                    <div className="flex justify-center p-4">Loading trade details...</div>
                                )

                            : (
                                    <Form {...tradeForm}>
                                        <form className="flex flex-col gap-4">
                                            <div className="flex flex-col md:flex-row w-full gap-4 items-center">
                                                <div className="w-full">
                                                    <FormField
                                                        control={tradeForm.control}
                                                        name="clientId"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col">
                                                                <FormLabel>Client</FormLabel>
                                                                <Popover open={openClientPopover} onOpenChange={setOpenClientPopover}>
                                                                    <PopoverTrigger asChild>
                                                                        <FormControl>
                                                                            <Button
                                                                                variant="outline"
                                                                                role="combobox"
                                                                                className="w-full justify-between"
                                                                                disabled={Boolean(clientId) || isEditMode}
                                                                                aria-expanded={openClientPopover}
                                                                                type="button"
                                                                            >
                                                                                {field.value && clientsDropdown

                                                                                    ? clientsDropdown.find(client => client.id === field.value)?.name || "Select client"

                                                                                    : "Select client"}
                                                                                <i className={`fa fa-chevron-${openClientPopover
                                                                                    ? "up"
                                                                                    : "down"}`}
                                                                                />
                                                                            </Button>
                                                                        </FormControl>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-[300px] p-2" style={{ maxHeight: "calc(100vh - 100px)", overflow: "visible" }}>
                                                                        <div className="space-y-2">
                                                                            <Input
                                                                                placeholder="Search client or enter ID..."
                                                                                className="h-9"
                                                                                value={clientSearchTerm}
                                                                                onChange={e => setClientSearchTerm(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === "Enter" && clientSearchTerm.trim() !== "") {
                                                                                        e.preventDefault();
                                                                                        const clientId = Number.parseInt(clientSearchTerm.trim());
                                                                                        if (!Number.isNaN(clientId) && clientId > 0) {
                                                                                            tradeForm.setValue("clientId", clientId);
                                                                                            setOpenClientPopover(false);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            />

                                                                            {filteredClients.length === 0 && (
                                                                                <Card className="border border-gray-200">
                                                                                    <CardContent className="p-2">
                                                                                        <div className="text-sm">No client found.</div>
                                                                                        {!Number.isNaN(Number.parseInt(clientSearchTerm.trim())) && Number.parseInt(clientSearchTerm.trim()) > 0 && (
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="outline"
                                                                                                className="mt-2 text-xs"
                                                                                                onClick={() => {
                                                                                                    const clientId = Number.parseInt(clientSearchTerm.trim());
                                                                                                    tradeForm.setValue("clientId", clientId);
                                                                                                    setOpenClientPopover(false);
                                                                                                }}
                                                                                            >
                                                                                                Use ID:
                                                                                                {" "}
                                                                                                {clientSearchTerm.trim()}
                                                                                            </Button>
                                                                                        )}
                                                                                    </CardContent>
                                                                                </Card>
                                                                            )}

                                                                            <ScrollArea className="h-64 overflow-auto border rounded-md" style={{ display: "block" }}>
                                                                                <div className="p-2 pb-3">
                                                                                    {loadingClients

                                                                                        ? (
                                                                                                <div className="p-2 text-center text-sm">Loading clients...</div>
                                                                                            )

                                                                                        : filteredClients?.length > 0 && (
                                                                                            <div className="space-y-1">
                                                                                                {filteredClients.map((client: ClientDropdownItem) => (
                                                                                                    <Button
                                                                                                        key={client.id}
                                                                                                        variant="ghost"
                                                                                                        className="w-full justify-start text-left hover:bg-secondary cursor-pointer"
                                                                                                        onClick={() => {
                                                                                                            tradeForm.setValue("clientId", client.id);
                                                                                                            setOpenClientPopover(false);
                                                                                                        }}
                                                                                                    >
                                                                                                        {client.name}
                                                                                                        {" "}
                                                                                                        (ID:
                                                                                                        {client.id}
                                                                                                        )
                                                                                                    </Button>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                </div>
                                                                            </ScrollArea>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <div className="w-full px-1">
                                                    <FormField
                                                        control={tradeForm.control}
                                                        name="tradeType"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Trade Type</FormLabel>
                                                                <FormControl>
                                                                    <Select
                                                                        value={field.value}
                                                                        onValueChange={(value: "BUY" | "SELL") => field.onChange(value)}
                                                                    >
                                                                        <SelectTrigger className="w-full ring-0 bg-secondary border-none rounded-lg h-11">
                                                                            <SelectValue placeholder="Select Type" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="BUY">Buy</SelectItem>
                                                                            <SelectItem value="SELL">Sell</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col md:flex-row w-full gap-4">
                                                <div className="w-full">
                                                    {/* Stock Symbol with Search */}
                                                    <FormField
                                                        control={tradeForm.control}
                                                        name="symbol"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col">
                                                                <FormLabel>Stock Symbol</FormLabel>
                                                                <Popover
                                                                    open={openStockPopover}
                                                                    onOpenChange={setOpenStockPopover}
                                                                >
                                                                    <PopoverTrigger asChild>
                                                                        <FormControl>
                                                                            <Button
                                                                                variant="outline"
                                                                                role="combobox"
                                                                                className="w-full justify-between h-11 bg-secondary border-none rounded-lg"
                                                                                disabled={loadingStocks}
                                                                                type="button"
                                                                            >
                                                                                <div className="flex justify-between w-full">
                                                                                    <span>
                                                                                        {loadingStocks

                                                                                            ? (
                                                                                                    <span className="flex items-center gap-2">
                                                                                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                                        </svg>
                                                                                                        Loading symbols...
                                                                                                    </span>
                                                                                                )

                                                                                            : (field.value

                                                                                                    ? (() => {
                                                                                                            const currentExchange = tradeForm.watch("exchange");

                                                                                                            const foundStock = formattedStocks.find(stock =>
                                                                                                                stock.value === field.value && stock.exchange === currentExchange,
                                                                                                            );

                                                                                                            if (foundStock) {
                                                                                                                return foundStock.label;
                                                                                                            }

                                                                                                            if (field.value && currentExchange) {
                                                                                                                return `${field.value}-${currentExchange}`;
                                                                                                            }

                                                                                                            return field.value
                                                                                                                ? field.value
                                                                                                                : "Select stock symbol";
                                                                                                        })()

                                                                                                    : "Select stock symbol")}
                                                                                    </span>
                                                                                    {loadingStocks

                                                                                        ? (
                                                                                                <span className="animate-spin mr-1">⟳</span>
                                                                                            )

                                                                                        : (
                                                                                                <i className={`fa fa-chevron-${openStockPopover
                                                                                                    ? "up"
                                                                                                    : "down"}`}
                                                                                                />
                                                                                            )}
                                                                                </div>
                                                                            </Button>
                                                                        </FormControl>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-[300px] p-2" style={{ maxHeight: "calc(100vh - 100px)", overflow: "auto" }}>
                                                                        <div className="space-y-2">
                                                                            <Input
                                                                                placeholder="Search or type stock symbol..."
                                                                                className="h-9 mb-2"
                                                                                value={searchTerm}
                                                                                onChange={e => setSearchTerm(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === "Enter" && searchTerm.trim() !== "") {
                                                                                        e.preventDefault();
                                                                                        const cleanSymbol = searchTerm.trim().replace(/-NSE|-BSE/i, "");

                                                                                        const hasBseIndicator
                                                                                        = searchTerm.toUpperCase().includes("-BSE")
                                                                                            || searchTerm.toUpperCase().endsWith("BSE")
                                                                                            || searchTerm.toLowerCase() === "bse"
                                                                                            || searchTerm.toLowerCase().includes(" bse");

                                                                                        const exchange = hasBseIndicator
                                                                                            ? "BSE" as const
                                                                                            : "NSE" as const;

                                                                                        tradeForm.setValue("exchange", exchange);
                                                                                        tradeForm.setValue("symbol", cleanSymbol);

                                                                                        setOpenStockPopover(false);
                                                                                    }
                                                                                }}
                                                                            />

                                                                            {stockError && (
                                                                                <Card className="border border-red-200 mb-2">
                                                                                    <CardContent className="p-2">
                                                                                        <div className="text-sm text-red-500">Error loading stocks</div>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="outline"
                                                                                            className="mt-2 text-xs w-full"
                                                                                            onClick={() => {
                                                                                                queryClient.invalidateQueries({ queryKey: ["stockSymbols"] });
                                                                                            }}
                                                                                        >
                                                                                            Retry loading
                                                                                        </Button>
                                                                                    </CardContent>
                                                                                </Card>
                                                                            )}

                                                                            <div className="h-72 overflow-hidden border rounded-md" style={{ display: "block" }}>
                                                                                {loadingStocks
                                                                                    ? (
                                                                                            <div className="flex items-center justify-center p-4 gap-2 text-sm">
                                                                                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                                </svg>
                                                                                                <span>Loading stock symbols...</span>
                                                                                            </div>
                                                                                        )
                                                                                    : (filteredStocks.length === 0 && !stockError)
                                                                                            ? (
                                                                                                    <div className="p-2 text-center text-sm">
                                                                                                        <p>
                                                                                                            {searchTerm.trim() !== ""
                                                                                                                ? "No matching stocks found."
                                                                                                                : "No stocks found."}
                                                                                                        </p>
                                                                                                        {searchTerm.trim() !== "" && (
                                                                                                            <p className="text-xs text-gray-500 mt-1">
                                                                                                                Press Enter to use "
                                                                                                                {searchTerm}
                                                                                                                " as a custom symbol.
                                                                                                            </p>
                                                                                                        )}
                                                                                                    </div>
                                                                                                )
                                                                                            : (
                                                                                                    <div className="space-y-2">
                                                                                                        {/* NSE Stocks */}
                                                                                                        {filteredStocks.filter(stock => stock.exchange === "NSE").length > 0 && (
                                                                                                            <>
                                                                                                                <div className="px-2 py-1 text-xs font-semibold bg-muted/50 rounded flex items-center justify-between">
                                                                                                                    <span>NSE</span>
                                                                                                                    <span className="text-xs text-gray-500">
                                                                                                                        {filteredStocks.filter(stock => stock.exchange === "NSE").length}
                                                                                                                        {" "}
                                                                                                                        stocks
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                                <div style={{
                                                                                                                    height: filteredStocks.filter(stock => stock.exchange === "BSE").length > 0
                                                                                                                        ? "120px"
                                                                                                                        : "200px",
                                                                                                                }}
                                                                                                                >
                                                                                                                    <AutoSizer>
                                                                                                                        {({ height, width }) => (
                                                                                                                            <List
                                                                                                                                height={height}
                                                                                                                                itemCount={filteredStocks.filter(stock => stock.exchange === "NSE").length}
                                                                                                                                itemSize={35}
                                                                                                                                width={width}
                                                                                                                                itemData={{
                                                                                                                                    items: filteredStocks.filter(stock => stock.exchange === "NSE"),
                                                                                                                                    tradeForm,
                                                                                                                                    setOpenStockPopover,
                                                                                                                                }}
                                                                                                                            >
                                                                                                                                {StockItem}
                                                                                                                            </List>
                                                                                                                        )}
                                                                                                                    </AutoSizer>
                                                                                                                </div>
                                                                                                            </>
                                                                                                        )}

                                                                                                        {/* BSE Stocks */}
                                                                                                        {filteredStocks.filter(stock => stock.exchange === "BSE").length > 0 && (
                                                                                                            <>
                                                                                                                <div className="px-2 py-1 text-xs font-semibold bg-muted/50 rounded flex items-center justify-between">
                                                                                                                    <span>BSE</span>
                                                                                                                    <span className="text-xs text-gray-500">
                                                                                                                        {filteredStocks.filter(stock => stock.exchange === "BSE").length}
                                                                                                                        {" "}
                                                                                                                        stocks
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                                <div style={{
                                                                                                                    height: filteredStocks.filter(stock => stock.exchange === "NSE").length > 0
                                                                                                                        ? "120px"
                                                                                                                        : "200px",
                                                                                                                }}
                                                                                                                >
                                                                                                                    <AutoSizer>
                                                                                                                        {({ height, width }) => (
                                                                                                                            <List
                                                                                                                                height={height}
                                                                                                                                itemCount={filteredStocks.filter(stock => stock.exchange === "BSE").length}
                                                                                                                                itemSize={35}
                                                                                                                                width={width}
                                                                                                                                itemData={{
                                                                                                                                    items: filteredStocks.filter(stock => stock.exchange === "BSE"),
                                                                                                                                    tradeForm,
                                                                                                                                    setOpenStockPopover,
                                                                                                                                }}
                                                                                                                            >
                                                                                                                                {StockItem}
                                                                                                                            </List>
                                                                                                                        )}
                                                                                                                    </AutoSizer>
                                                                                                                </div>
                                                                                                            </>
                                                                                                        )}
                                                                                                    </div>
                                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <div className="w-full">
                                                    <FormField
                                                        control={tradeForm.control}
                                                        name="quantity"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Quantity</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Quantity"
                                                                        {...field}
                                                                        value={
                                                                            field.value === undefined
                                                                                ? ""
                                                                                : field.value
                                                                        }
                                                                        onChange={(e) => {
                                                                            const value = e.target.value === ""
                                                                                ? undefined
                                                                                : Number(e.target.value);
                                                                            field.onChange(value);
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col md:flex-row w-full gap-4 items-center">
                                                <div className="w-full px-1">
                                                    <FormField
                                                        control={tradeForm.control}
                                                        name="tradeDate"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Date</FormLabel>
                                                                <FormControl>
                                                                    <DatePicker
                                                                        placeholder="Select Date"
                                                                        className="w-full bg-secondary hover:bg-secondary h-11"
                                                                        selected={field.value
                                                                            ? new Date(field.value)
                                                                            : undefined}
                                                                        onSelect={(date) => {
                                                                            if (date) {
                                                                                field.onChange(date.toISOString());
                                                                            }
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <div className="w-full">
                                                    <FormField
                                                        control={tradeForm.control}
                                                        name="price"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Price Per Share</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Price"
                                                                        step="0.01"
                                                                        {...field}
                                                                        value={
                                                                            field.value === undefined
                                                                                ? ""
                                                                                : field.value
                                                                        }
                                                                        onChange={(e) => {
                                                                            const value = e.target.value === ""
                                                                                ? undefined
                                                                                : Number(e.target.value);
                                                                            field.onChange(value);
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            {/* Total trade value calculation */}
                                            {(tradeForm.watch("quantity") && tradeForm.watch("price"))

                                                ? (
                                                        <div className="w-full px-3 py-2 bg-secondary/30 rounded-lg">
                                                            <div className="flex justify-between">
                                                                <span className="font-medium">Total Value:</span>
                                                                <span className="font-bold">
                                                                    ₹
                                                                    {" "}
                                                                    {totalValue.toLocaleString("en-IN", {
                                                                        maximumFractionDigits: 2,
                                                                        minimumFractionDigits: 2,
                                                                    })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )

                                                : null}

                                            <div className="w-full">
                                                <FormField
                                                    control={tradeForm.control}
                                                    name="notes"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Notes</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="Add notes (optional)"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </form>
                                    </Form>
                                )}
                    </div>
                </ScrollArea>

                <DialogFooter className="">
                    <div className="w-full flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setOpen(false);
                                tradeForm.reset(); // Reset form when canceling
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="bg-primary text-sm px-8 rounded-xl"
                            onClick={tradeForm.handleSubmit(onSubmit)}
                            disabled={tradeForm.formState.isSubmitting || createTradeMutation.isPending || loadingTradeDetails}
                        >
                            {createTradeMutation.isPending
                                ? "Saving..."
                                : (isEditMode
                                        ? "Update"
                                        : "Save")}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddTrade;
