"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, CreditCard, IndianRupee, Loader2, Mail, MapPin, Phone, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

import type { AddClient as ClientType } from "@/types/client";

import { deleteClient, getClientById } from "@/api/client";
import AddClient from "@/components/Dialoge/AddClient";
import AddPayment from "@/components/Dialoge/AddPayment";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ClientDetail: React.FC = () => {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const clientId = Number(params.id);
    const [editClientData, setEditClientData] = useState<ClientType | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Fetch client data
    const { data: client, isLoading, error } = useQuery({
        queryKey: ["client", clientId],
        queryFn: () => getClientById(clientId),
        refetchOnWindowFocus: false,
        enabled: !Number.isNaN(clientId),
    });

    // Delete client mutation
    const deleteClientMutation = useMutation({
        mutationFn: (id: number) => deleteClient(id),
        onSuccess: () => {
            toast.success("Client deleted successfully");
            // Navigate back to clients list
            router.push("/admin/client");
            // Invalidate client queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to delete client");
        },
    });

    // Handle delete confirmation
    const handleDeleteClient = async () => {
        if (clientId) {
            deleteClientMutation.mutate(clientId);
            setIsDeleteDialogOpen(false);
        }
    };

    // Prepare client data for editing
    const handleEditClick = () => {
        if (client) {
            setEditClientData({
                id: client.id.toString(),
                name: client.name,
                panNo: client.pan,
                mobileNo: client.mobile,
                email: client.email,
                address: client.address,
                purseAmount: client.purseAmount,
            });
        }
    };

    // Handle successful client edit
    const handleEditSuccess = () => {
        // Refetch client data after edit
        queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    };

    // Go back to clients page
    const handleBackClick = () => {
        router.push("/admin/client");
    };

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex justify-center items-center w-full min-h-[94vh]">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>Loading client details...</p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error || !client) {
        return (
            <div className="flex flex-col items-center justify-center w-full min-h-[94vh] gap-4">
                <p className="text-red-500">Failed to load client details</p>
                <Button onClick={handleBackClick}>Back to Clients</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <div className="flex gap-2 items-center">
                    <div
                        className="flex items-center shrink-0 justify-center border border-border bg-white text-sm hover:bg-secondary text-primary rounded-full w-10 h-10 cursor-pointer"
                        onClick={handleBackClick}
                    >
                        <ChevronLeft size={20} />
                    </div>
                    <h1 className="text-xl font-semibold ">{client.name}</h1>
                </div>

                <div className="flex-col md:flex md:flex-row gap-2 mt-3 md:mt-0">

                    <Button
                        className="ml-auto mx-3 md:mx-0 bg-transparent shadow-none text-red-400 border border-red-300 hover:bg-red-50 px-10 rounded-xl"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        disabled={deleteClientMutation.isPending}
                    >
                        {deleteClientMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                    <div onClick={handleEditClick}>
                        <AddClient
                            name="Edit"
                            data={editClientData || undefined}
                            onSuccess={handleEditSuccess}
                        />
                    </div>
                </div>
            </div>
            <div className="grid lg:grid-cols-5 md:grid-cols-2 grid-cols-1 justify-between gap-3 px-2">
                <StatCard
                    icon={<IndianRupee />}
                    value={typeof client.totalTradeAmount === "number" ? `₹${client.totalTradeAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Total Portfolio Value"
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<Wallet />}
                    value={typeof client.purseAmount === "number" ? `₹${client.purseAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Initial Purse Amount"
                    isLoading={isLoading}
                />
                {/* Show remaining purse amount from API */}
                <StatCard
                    icon={<Wallet />}
                    value={typeof client.remainingPurseAmount === "number"
                        ? `₹${client.remainingPurseAmount.toLocaleString("en-IN")}`
                        : "₹0"}
                    label="Remaining Purse Amount"
                    isLoading={isLoading}
                />
                {/* Display total sold stock amount */}
                {/* <StatCard
                    icon={<TrendingUp />}
                    value={typeof client.totalSoldAmount === "number" ?
                        `₹${client.totalSoldAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Sold Stock Amount"
                    isLoading={isLoading}
                /> */}
                <StatCard
                    icon={<TrendingUp />}
                    value={typeof client.totalBrokerageAmount === "number" ? `₹${client.totalBrokerageAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Total Fees"
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<CreditCard />}
                    value={typeof client.totalPaymentAmount === "number" ? `₹${client.totalPaymentAmount.toLocaleString("en-IN")}` : "₹0"}
                    label="Total Payments"
                    isLoading={isLoading}
                />
            </div>

            <div className="flex flex-col-reverse lg:flex-row border border-border rounded-2xl w-full justify-between mt-5">
                {/* Info section */}
                <div className="flex flex-col w-full lg:w-2/3 gap-5 p-3 md:p-5 lg:p-10">
                    <div className="flex flex-col md:flex-row gap-5">
                        <div className="flex flex-col gap-1 min-w-30">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Phone size={16} />
                                <span>Mobile No</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black">{client.mobile}</div>
                        </div>
                        <div className="hidden md:flex justify-center">
                            <div className="w-px bg-[#e0e7ff] relative mx-6">
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full bg-[#c7d2fe]"></div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Mail size={16} />
                                <span>Email Address</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black">{client.email}</div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-5">
                        <div className="flex flex-col gap-1 min-w-30">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <CreditCard size={16} />
                                <span>PAN No</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black">{client.pan}</div>
                        </div>
                        <div className="hidden md:flex justify-center">
                            <div className="w-px bg-[#e0e7ff] relative mx-6">
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full bg-[#c7d2fe]"></div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <MapPin size={16} />
                                <span>Address</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black">{client.address}</div>
                        </div>
                    </div>
                </div>

                {/* Buttons section */}
                <div className="flex flex-wrap items-start justify-start md:justify-end w-full lg:w-fit gap-3 py-5 px-5">
                    <Link href={`/admin/trade?clientId=${client.id}`} className="flex gap-2 items-center hover:bg-secondary rounded-full px-2 py-1 cursor-pointer">
                        <span className="text-sm">Trade</span>
                        <div className="bg-primary text-white h-fit p-2 rounded-full">
                            <ArrowUpRight size={15} />
                        </div>
                    </Link>
                    <Link href={`/admin/brokerage?clientId=${client.id}`} className="flex gap-2 items-center hover:bg-secondary rounded-full px-2 py-1 cursor-pointer">
                        <span className="text-sm">Fees</span>
                        <div className="bg-primary text-white h-fit p-2 rounded-full">
                            <ArrowUpRight size={15} />
                        </div>
                    </Link>
                    <Link href={`/admin/payment-history?clientId=${client.id}`} className="flex gap-2 items-center hover:bg-secondary rounded-full px-2 py-1 cursor-pointer">
                        <span className="text-sm">Payment</span>
                        <div className="bg-primary text-white h-fit p-2 rounded-full">
                            <ArrowUpRight size={15} />
                        </div>
                    </Link>
                    <div className="flex gap-2 items-center">
                        <AddPayment
                            name="Add Payment"
                            clientId={clientId}
                        />
                    </div>

                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Client</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete
                            {" "}
                            {client.name}
                            ? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row justify-end gap-2 mt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteClient}
                            disabled={deleteClientMutation.isPending}
                        >
                            {deleteClientMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default ClientDetail;
