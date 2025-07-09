"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
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
    const [open, setOpen] = useState(false);

    const [isEditing, setIsEditing] = useState(false);

    const queryClient = useQueryClient();

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);

        if (!newOpen) {
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
            purseAmount: undefined,
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

            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });

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

            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });
            queryClient.invalidateQueries({ queryKey: ["client"] });

            if (onSuccess)
                onSuccess();
        },
        onError: handleMutationError,
    });

    function handleMutationError(error: any) {
        console.error("Error details:", error);

        let errorMessage = isEditing ? "Failed to update client" : "Failed to create client";

        if (error.error?.issues && Array.isArray(error.error.issues)) {
            const firstError = error.error.issues[0];
            errorMessage = firstError.message || errorMessage;

            error.error.issues.forEach((issue: any) => {
                if (issue.path && issue.path.length > 0) {
                    const fieldName = issue.path[0];

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
            if (error.message.includes("Email already exists")) {
                errorMessage = "Email address already registered";
                addClientForm.setError("email", { message: "This email is already in use" });
            } else if (error.message.includes("Mobile number already exists")) {
                errorMessage = "Mobile number already registered";
                addClientForm.setError("mobileNo", { message: "This mobile number is already in use" });
            } else if (error.message.includes("PAN number already exists")) {
                errorMessage = "PAN number already registered";
                addClientForm.setError("panNo", { message: "This PAN number is already in use" });
            } else {
                errorMessage = error.message;
            }
        }

        if (error.data) {
            errorMessage = error.data.message || errorMessage;
        }

        toast.error(errorMessage);
    }

    const onSubmit = async (formData: AddClientField) => {
        addClientForm.clearErrors();

        const loadingToast = toast.loading(isEditing ? "Updating client..." : "Creating new client...");

        try {
            if (isEditing && data?.id) {
                const clientData: ClientUpdateRequest = {
                    id: Number.parseInt(data.id),
                    name: formData.name,
                    email: formData.email,
                    mobile: formData.mobileNo,
                    pan: formData.panNo,
                    address: formData.address && formData.address.trim() !== "" ? formData.address : undefined,
                    purseAmount: formData.purseAmount,
                };

                await updateClientMutation.mutateAsync(clientData);
            } else {
                const clientData: ClientCreateRequest = {
                    name: formData.name || "",
                    email: formData.email || "",
                    mobile: formData.mobileNo || "",
                    pan: formData.panNo || "",
                    address: formData.address && formData.address.trim() !== "" ? formData.address : undefined,
                    purseAmount: formData.purseAmount,
                };

                await createClientMutation.mutateAsync(clientData);
            }

            toast.dismiss(loadingToast);
        } catch (error: any) {
            toast.dismiss(loadingToast);

            console.error(isEditing ? "Client update error:" : "Client creation error:", error);
        }
    };

    useEffect(() => {
        if (open) {
            if (data && data.id) {
                const timer = setTimeout(() => {
                    setIsEditing(true);
                    addClientForm.setValue("name", data.name || "");
                    addClientForm.setValue("panNo", data.panNo || "");
                    addClientForm.setValue("mobileNo", data.mobileNo || "");
                    addClientForm.setValue("email", data.email || "");
                    addClientForm.setValue("address", data.address || "");
                    addClientForm.setValue("purseAmount", data.purseAmount || undefined);
                }, 0);

                return () => clearTimeout(timer);
            } else {
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
                <Button className="ml-auto bg-primary px-5 md:px-10 rounded-xl">
                    {name === "Edit" ? <Pencil size={14} /> : <Plus size={18} />}
                    <span className="hidden md:flex">{name}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl min-w-[300px] p-6">

                <DialogHeader>
                    <DialogTitle className="text-xl font-medium">
                        {isEditing ? "Edit Client" : "Add New Client"}
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[calc(100vh-220px)]">
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

                            <FormField
                                control={addClientForm.control}
                                name="purseAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="Purse Amount"
                                                value={field.value}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    field.onChange(value === "" ? "" : Number.parseFloat(value) || 0);
                                                }}
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
