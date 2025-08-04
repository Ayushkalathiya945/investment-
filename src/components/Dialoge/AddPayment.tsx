"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import type { ClientFilterRequest } from "@/types/client";
import type { AddPaymentField, PaymentCreateRequest } from "@/types/payment";

import { getAllClients } from "@/api/client";
import { createPayment, formatDateForPaymentApi, getPaymentById, updatePayment } from "@/api/payment";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { addPaymentSchema } from "@/types/payment";

import DatePicker from "../ui/datePicker";

type AddPaymentProps = {
    name?: string;
    clientId?: number;
    editPaymentId?: number;
    open?: boolean;
    onSuccess?: () => void;
    onOpenChange?: (open: boolean) => void;
};

const AddPayment: React.FC<AddPaymentProps> = ({
    name = "Add Payment",
    clientId,
    editPaymentId,
    open,
    onSuccess,
    onOpenChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [isLoadingPayment, setIsLoadingPayment] = useState(false);

    const queryClient = useQueryClient();

    // Use controlled open state if provided, otherwise use internal state
    const dialogOpen = open !== undefined ? open : isOpen;
    const setDialogOpen = onOpenChange || setIsOpen;

    const isEditMode = !!editPaymentId;

    const addPaymentForm = useForm<AddPaymentField>({
        resolver: zodResolver(addPaymentSchema),
        defaultValues: {
            client: clientId ? String(clientId) : "",
            date: new Date().toISOString(),
            amount: undefined,
            description: "",
        },
    });

    const fetchClients = async () => {
        setIsLoadingClients(true);
        try {
            const filterParams: ClientFilterRequest = {
                page: 1,
                limit: 20,
            };

            const response = await getAllClients(filterParams);
            if (response && response.data) {
                const clientOptions = response.data.map(client => ({
                    id: client.id,
                    name: client.name,
                }));
                setClients(clientOptions);
            }
        } catch (error) {
            console.error("Failed to load clients:", error);
            toast.error("Failed to load clients list");
        } finally {
            setIsLoadingClients(false);
        }
    };

    const fetchPaymentData = async (paymentId: number) => {
        setIsLoadingPayment(true);
        try {
            const payment = await getPaymentById(paymentId);

            // Update form with payment data
            addPaymentForm.reset({
                client: String(payment.clientId),
                date: new Date(payment.paymentDate).toISOString(),
                amount: payment.amount,
                description: payment.description || "",
            });
        } catch (error) {
            console.error("Failed to load payment data:", error);
            toast.error("Failed to load payment data");
        } finally {
            setIsLoadingPayment(false);
        }
    };

    useEffect(() => {
        if (dialogOpen) {
            fetchClients();

            if (isEditMode && editPaymentId) {
                fetchPaymentData(editPaymentId);
            } else {
                // Reset form for new payment
                addPaymentForm.reset({
                    client: clientId ? String(clientId) : "",
                    date: new Date().toISOString(),
                    amount: undefined,
                    description: "",
                });
            }
        }
    }, [dialogOpen, clientId, editPaymentId, isEditMode, addPaymentForm]);

    const createPaymentMutation = useMutation({
        mutationFn: (paymentData: PaymentCreateRequest) => {
            if (isEditMode && editPaymentId) {
                return updatePayment(editPaymentId, paymentData);
            } else {
                return createPayment(paymentData);
            }
        },
        onSuccess: () => {
            toast.success(isEditMode ? "Payment updated successfully" : "Payment recorded successfully");
            addPaymentForm.reset();
            setDialogOpen(false);

            queryClient.invalidateQueries({ queryKey: ["payments"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });
            queryClient.invalidateQueries({ queryKey: ["client"] });

            if (onSuccess) {
                onSuccess();
            }
        },
        onError: (error: any) => {
            console.error("Payment mutation error:", error);

            if (error.error?.issues) {
                const issues = error.error.issues;
                issues.forEach((issue: any) => {
                    const fieldName = issue.path[0] as keyof AddPaymentField;
                    if (fieldName && addPaymentForm.setError) {
                        addPaymentForm.setError(fieldName, { message: issue.message });
                    }
                });
                toast.error("Please fix the errors in the form");
            } else {
                const errorMessage = error.message || "Failed to record payment";
                toast.error(errorMessage);
            }
        },
    });

    const onSubmit = async (data: AddPaymentField) => {
        addPaymentForm.clearErrors();

        const selectedClientId = clientId || Number.parseInt(data.client || "0");
        if (!selectedClientId) {
            addPaymentForm.setError("client", { message: "Please select a client" });
            return;
        }

        if (!data.amount || data.amount <= 0) {
            addPaymentForm.setError("amount", { message: "Amount must be greater than 0" });
            return;
        }

        if (!data.date) {
            addPaymentForm.setError("date", { message: "Please select a date" });
            return;
        }

        const loadingToast = toast.loading("Recording payment...");

        try {
            const paymentData: PaymentCreateRequest = {
                clientId: selectedClientId,
                amount: data.amount || 0,
                paymentDate: formatDateForPaymentApi(new Date(data.date)) || new Date().toISOString().split("T")[0],
                description: data.description || undefined,
            };

            await createPaymentMutation.mutateAsync(paymentData);
            toast.dismiss(loadingToast);
        } catch {
            toast.dismiss(loadingToast);
        }
    };

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {!open && !isEditMode && (
                <DialogTrigger asChild>
                    <Button className="ml-auto bg-primary px-5 md:px-8 rounded-xl">
                        <Plus size={18} />
                        <span className="hidden md:flex">{name}</span>
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">

                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                        {isEditMode ? "Edit Payment" : name}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {
                    // (isLoadingClients || isLoadingPayment) && (
                    //     <div className="flex justify-center items-center py-4">
                    //         <Loader2 className="h-6 w-6 animate-spin" />
                    //         <span className="ml-2">Loading...</span>
                    //     </div>
                    // )
                    }
                    <Form {...addPaymentForm}>
                        <form className="flex flex-col gap-4 w-full">

                            <FormField
                                control={addPaymentForm.control}
                                name="client"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            {isLoadingClients
                                                ? (
                                                        <Skeleton className="h-11 w-full" />
                                                    )
                                                : clientId
                                                    ? (
                                                            <div className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                                                {clients.find(c => c.id === clientId)?.name
                                                                    || `Client ID: ${clientId} (loading...)`}
                                                            </div>
                                                        )
                                                    : (
                                                            <Select
                                                                value={field.value}
                                                                onValueChange={field.onChange}
                                                            >
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select Client" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {clients.map(client => (
                                                                        <SelectItem
                                                                            key={client.id}
                                                                            value={String(client.id)}
                                                                        >
                                                                            {client.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={addPaymentForm.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            {isLoadingPayment
                                                ? (
                                                        <Skeleton className="h-11 w-full" />
                                                    )
                                                : (
                                                        <DatePicker
                                                            placeholder="Date"
                                                            className="w-full bg-secondary hover:bg-secondary h-11"
                                                            selected={field.value ? new Date(field.value) : undefined}
                                                            onSelect={date => field.onChange(date?.toISOString() ?? "")}
                                                        />
                                                    )}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={addPaymentForm.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            {isLoadingPayment
                                                ? (
                                                        <Skeleton className="h-11 w-full" />
                                                    )
                                                : (
                                                        <Input
                                                            type="number"
                                                            placeholder="Amount"
                                                            {...field}
                                                            value={field.value === undefined ? "" : field.value}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value === "") {
                                                                    field.onChange(undefined);
                                                                } else {
                                                                    const num = Number.parseFloat(value);
                                                                    field.onChange(Number.isNaN(num) ? undefined : num);
                                                                }
                                                            }}
                                                        />
                                                    )}

                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={addPaymentForm.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            {isLoadingPayment
                                                ? (
                                                        <Skeleton className="h-20 w-full" />
                                                    )
                                                : (
                                                        <Textarea
                                                            placeholder="Description"
                                                            {...field}
                                                            className="border-none ring-0 focus:ring-0 focus:ring-offset-0"
                                                        />
                                                    )}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </div>

                <DialogFooter className="">
                    <div className="w-full flex items-center justify-end">
                        {(isLoadingPayment || isLoadingClients)
                            ? (
                                    <Skeleton className="h-10 w-20" />
                                )
                            : (
                                    <Button
                                        type="button"
                                        className="bg-primary text-sm px-8 rounded-xl"
                                        onClick={addPaymentForm.handleSubmit(onSubmit)}
                                        disabled={addPaymentForm.formState.isSubmitting || createPaymentMutation.isPending}
                                    >
                                        {createPaymentMutation.isPending
                                            ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        {isEditMode ? "Updating..." : "Saving..."}
                                                    </>
                                                )
                                            : (
                                                    isEditMode ? "Update" : "Save"
                                                )}
                                    </Button>
                                )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddPayment;
