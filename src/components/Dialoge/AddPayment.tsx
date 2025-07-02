"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import type { ClientFilterRequest } from "@/types/client";
import type { AddPaymentField, PaymentCreateRequest } from "@/types/payment";

import { getAllClients } from "@/api/client";
import { createPayment, formatDateForPaymentApi } from "@/api/payment";
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
import { Textarea } from "@/components/ui/textarea";
import { addPaymentSchema } from "@/types/payment";

import DatePicker from "../ui/datePicker";

type AddPaymentProps = {
    name?: string;
    clientId?: number; // Optional client ID if coming from a specific client page
    onSuccess?: () => void;
};

const AddPayment: React.FC<AddPaymentProps> = ({
    name = "Add Payment",
    clientId,
    onSuccess,
}) => {
    const [open, setOpen] = useState(false);
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    const queryClient = useQueryClient();

    // Define the form with validation schema
    const addPaymentForm = useForm<AddPaymentField>({
        resolver: zodResolver(addPaymentSchema),
        defaultValues: {
            client: clientId ? String(clientId) : "",
            date: new Date().toISOString(),
            amount: 0,
            description: "",
        },
    });

    // Fetch clients list for the dropdown
    const fetchClients = async () => {
        setIsLoadingClients(true);
        try {
            const filterParams: ClientFilterRequest = {
                page: 1,
                limit: 100, // Get a large number to have all clients
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

    // Fetch clients when dialog opens
    useEffect(() => {
        if (open) {
            fetchClients();
            // Reset form when dialog opens with default values
            addPaymentForm.reset({
                client: clientId ? String(clientId) : "",
                date: new Date().toISOString(),
                amount: 0,
                description: "",
            });

            // if (clientId) {
            //     //console.log("Client ID provided through props:", clientId);
            // }
        }
    }, [open, clientId, addPaymentForm]);

    // Set up the create payment mutation
    const createPaymentMutation = useMutation({
        mutationFn: (paymentData: PaymentCreateRequest) => createPayment(paymentData),
        onSuccess: () => {
            toast.success("Payment recorded successfully");
            addPaymentForm.reset();
            setOpen(false);

            // Invalidate queries to refetch payment data
            queryClient.invalidateQueries({ queryKey: ["payments"] });

            // If this payment was for a specific client, also invalidate that client's data
            if (clientId) {
                queryClient.invalidateQueries({ queryKey: ["client", clientId] });
            }

            // Call the onSuccess callback if provided
            if (onSuccess)
                onSuccess();
        },
        onError: (error: any) => {
            console.error("Payment mutation error:", error);

            // Handle detailed validation errors
            if (error.error?.issues) {
                // Handle Zod validation errors
                const issues = error.error.issues;
                issues.forEach((issue: any) => {
                    const fieldName = issue.path[0] as keyof AddPaymentField;
                    if (fieldName && addPaymentForm.setError) {
                        addPaymentForm.setError(fieldName, { message: issue.message });
                    }
                });
                toast.error("Please fix the errors in the form");
            } else {
                // Handle general error
                const errorMessage = error.message || "Failed to record payment";
                toast.error(errorMessage);
            }
        },
    });

    const onSubmit = async (data: AddPaymentField) => {
        // Clear any previous form errors
        addPaymentForm.clearErrors();

        // Get client ID - first try from props, then from form data
        // If clientId prop is provided, use that (for when adding from client detail page)
        // Otherwise use the selected client from the dropdown
        const selectedClientId = clientId || Number.parseInt(data.client || "0");
        if (!selectedClientId) {
            addPaymentForm.setError("client", { message: "Please select a client" });
            return;
        }

        // Validate amount
        if (!data.amount || data.amount <= 0) {
            addPaymentForm.setError("amount", { message: "Amount must be greater than 0" });
            return;
        }

        // Validate date
        if (!data.date) {
            addPaymentForm.setError("date", { message: "Please select a date" });
            return;
        }

        // Show loading toast
        const loadingToast = toast.loading("Recording payment...");

        try {
            // Prepare payment data for API
            const paymentData: PaymentCreateRequest = {
                clientId: selectedClientId,
                amount: data.amount || 0,
                paymentDate: formatDateForPaymentApi(new Date(data.date)) || new Date().toISOString().split("T")[0],
                description: data.description || undefined,
            };

            console.error("Submitting payment data:", paymentData);

            // Submit payment
            await createPaymentMutation.mutateAsync(paymentData);
            toast.dismiss(loadingToast);
        } catch {
            toast.dismiss(loadingToast);
            // Error is handled by the mutation's onError callback
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="ml-auto bg-primary px-5 md:px-8 rounded-xl">
                    <Plus size={18} />
                    <span className="hidden md:flex">{name}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm min-w-[150px] p-6">

                <DialogHeader>
                    <DialogTitle className="text-xl font-medium">
                        Add Payment
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[calc(100vh-220px)]">
                    <Form {...addPaymentForm}>
                        <form className="flex flex-col gap-4 w-full">

                            <FormField
                                control={addPaymentForm.control}
                                name="client"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            {clientId
                                                ? (
                                                    // If clientId is provided via props, show the client name or a placeholder
                                                        <div className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                                            {clients.find(c => c.id === clientId)?.name
                                                                || `Client ID: ${clientId} (loading...)`}
                                                        </div>
                                                    )
                                                : (
                                                    // Otherwise show the dropdown
                                                        <Select
                                                            disabled={isLoadingClients}
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
                                            <DatePicker
                                                placeholder="Date"
                                                className="w-full bg-secondary hover:bg-secondary h-11"
                                                selected={field.value ? new Date(field.value) : undefined}
                                                onSelect={date => field.onChange(date?.toISOString() ?? "")}
                                            />
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
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                {...field}
                                                onChange={(e) => {
                                                    const value = Number.parseFloat(e.target.value);
                                                    field.onChange(Number.isNaN(value) ? 0 : value);
                                                }}
                                            />
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
                                            <Textarea
                                                placeholder="Description"
                                                {...field}
                                                className="border-none ring-0 focus:ring-0 focus:ring-offset-0"
                                            />
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
                        <Button
                            type="button"
                            className="bg-primary text-sm px-8 rounded-xl"
                            onClick={addPaymentForm.handleSubmit(onSubmit)}
                            disabled={addPaymentForm.formState.isSubmitting || createPaymentMutation.isPending}
                        >
                            {createPaymentMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddPayment;
