"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import type { AddClient, AddClientField, ClientCreateRequest, ClientUpdateRequest } from "@/types/client";

import { createClient, updateClient } from "@/api/client";
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
import { Textarea } from "@/components/ui/textarea";
import { addClientSchema } from "@/types/client";

type AddClientProps = {
    data?: AddClient;
    name?: string;
    onSuccess?: () => void;
};

const AddClient: React.FC<AddClientProps> = ({
    data,
    name,
    onSuccess,
}) => {
    // Add state for dialog open/close
    const [open, setOpen] = useState(false);
    // State to track if we're editing
    const [isEditing, setIsEditing] = useState(false);
    // Get query client for cache invalidation
    const queryClient = useQueryClient();

    // Handle dialog open/close to properly reset editing state
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        // If dialog is closing, reset editing state
        if (!newOpen) {
            // Small delay to ensure smooth closing animation
            setTimeout(() => {
                setIsEditing(false);
            }, 300);
        }
    };

    const addClientForm = useForm<AddClientField>({
        defaultValues: {
            name: "",
            panNo: "",
            mobileNo: "",
            email: "",
            address: "",
        },
        resolver: zodResolver(addClientSchema),
        mode: "onSubmit",
    });

    // Setup the mutation for creating a client
    const createClientMutation = useMutation({
        mutationFn: (clientData: ClientCreateRequest) => createClient(clientData),
        onSuccess: () => {
            toast.success("Client created successfully");
            addClientForm.reset();
            setOpen(false);

            // Invalidate queries to refetch data
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });

            // Call the onSuccess callback if provided
            if (onSuccess)
                onSuccess();
        },
        onError: handleMutationError,
    });

    // Setup the mutation for updating a client
    const updateClientMutation = useMutation({
        mutationFn: (clientData: ClientUpdateRequest) => updateClient(clientData),
        onSuccess: () => {
            toast.success("Client updated successfully");
            addClientForm.reset();
            setOpen(false);

            // Invalidate queries to refetch data
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });
            queryClient.invalidateQueries({ queryKey: ["client"] }); // For the client detail page

            // Call the onSuccess callback if provided
            if (onSuccess)
                onSuccess();
        },
        onError: handleMutationError,
    });

    // Common error handler for both mutations
    function handleMutationError(error: any) {
        console.error("Error details:", error);

        let errorMessage = isEditing ? "Failed to update client" : "Failed to create client";

        // Handle Zod validation errors returned from the backend
        if (error.error?.issues && Array.isArray(error.error.issues)) {
            // Get first validation error message
            const firstError = error.error.issues[0];
            errorMessage = firstError.message || errorMessage;

            // Set form errors for the specific fields
            error.error.issues.forEach((issue: any) => {
                if (issue.path && issue.path.length > 0) {
                    const fieldName = issue.path[0];

                    // Map backend field names to form field names if needed
                    const formField = fieldName === "mobile"
                        ? "mobileNo"
                        : fieldName === "pan" ? "panNo" : fieldName;

                    if (formField && addClientForm.getValues(formField as any) !== undefined) {
                        addClientForm.setError(formField as any, {
                            message: issue.message,
                        });
                    }
                }
            });
        } else if (error.message) {
            // Check if the error message contains our specific backend messages
            if (error.message.includes("Email already exists")) {
                errorMessage = "Email address already registered";
                // Set the form error for the specific field
                addClientForm.setError("email", { message: "This email is already in use" });
            } else if (error.message.includes("Mobile number already exists")) {
                errorMessage = "Mobile number already registered";
                addClientForm.setError("mobileNo", { message: "This mobile number is already in use" });
            } else if (error.message.includes("PAN number already exists")) {
                errorMessage = "PAN number already registered";
                addClientForm.setError("panNo", { message: "This PAN number is already in use" });
            } else {
                // Use the error message from the server if available
                errorMessage = error.message;
            }
        }

        // If we have data from the server response, use that for more specific errors
        if (error.data) {
            errorMessage = error.data.message || errorMessage;
        }

        toast.error(errorMessage);
    }

    const onSubmit = async (formData: AddClientField) => {
        // Clear any previous form errors before submission
        addClientForm.clearErrors();

        // Show loading toast
        const loadingToast = toast.loading(isEditing ? "Updating client..." : "Creating new client...");

        try {
            if (isEditing && data?.id) {
                // Update existing client
                const clientData: ClientUpdateRequest = {
                    id: Number.parseInt(data.id),
                    name: formData.name,
                    email: formData.email,
                    mobile: formData.mobileNo,
                    pan: formData.panNo,
                    address: formData.address,
                };

                // Execute the update mutation
                await updateClientMutation.mutateAsync(clientData);
            } else {
                // Create new client
                const clientData: ClientCreateRequest = {
                    name: formData.name || "",
                    email: formData.email || "",
                    mobile: formData.mobileNo || "",
                    pan: formData.panNo || "",
                    address: formData.address || "",
                };

                // Execute the create mutation
                await createClientMutation.mutateAsync(clientData);
            }

            // Dismiss the loading toast on success
            toast.dismiss(loadingToast);
        } catch (error: any) {
            // Dismiss the loading toast on error
            toast.dismiss(loadingToast);

            // Additional error handling if needed
            console.error(isEditing ? "Client update error:" : "Client creation error:", error);

            // Error is handled by the mutation's onError callback
        }
    };

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            if (data && data.id) {
                // We're editing an existing client
                const timer = setTimeout(() => {
                    setIsEditing(true);
                    // Set form values
                    addClientForm.setValue("name", data.name || "");
                    addClientForm.setValue("panNo", data.panNo || "");
                    addClientForm.setValue("mobileNo", data.mobileNo || "");
                    addClientForm.setValue("email", data.email || "");
                    addClientForm.setValue("address", data.address || "");
                }, 0);

                return () => clearTimeout(timer);
            } else {
                // We're creating a new client
                const timer = setTimeout(() => {
                    setIsEditing(false);
                    addClientForm.reset();
                }, 0);

                return () => clearTimeout(timer);
            }
        }
    }, [open, data, addClientForm]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="ml-auto bg-primary px-5 md:px-8 rounded-xl">
                    {!data?.id && "+"}
                    <span className="hidden md:flex">{name}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl min-w-[300px] p-6">

                <DialogHeader>
                    <DialogTitle className="text-xl font-medium">
                        {isEditing ? "Edit Client" : "Add New Client"}
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[calc(100vh-220px)] overflow-y-scroll">
                    <Form {...addClientForm}>
                        <form className="flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row w-full gap-4">
                                <div className="w-full">
                                    <FormField
                                        control={addClientForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Full Name"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="w-full">
                                    <FormField
                                        control={addClientForm.control}
                                        name="panNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        placeholder="PAN No."
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row w-full gap-4">
                                <div className="w-full">
                                    <FormField
                                        control={addClientForm.control}
                                        name="mobileNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Mobile No."
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="w-full">
                                    <FormField
                                        control={addClientForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Email"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <FormField
                                control={addClientForm.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Address"
                                                {...field ?? undefined}
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
                            onClick={addClientForm.handleSubmit(onSubmit)}
                            disabled={addClientForm.formState.isSubmitting || createClientMutation.isPending || updateClientMutation.isPending}
                        >
                            {(createClientMutation.isPending || updateClientMutation.isPending)
                                ? "Saving..."
                                : "Save"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddClient;
