"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BarChart2, ChartNoAxesCombined, ChevronLeft, CreditCard, IndianRupee, Loader2, Mail, MapPin, Phone, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

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
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const { data: client, isLoading, error } = useQuery({
        queryKey: ["client", clientId],
        queryFn: () => getClientById(clientId),
        refetchOnWindowFocus: false,
        enabled: !Number.isNaN(clientId),
    });

    const deleteClientMutation = useMutation({
        mutationFn: (id: number) => deleteClient(id),
        onSuccess: () => {
            toast.success("Client deleted successfully");
            router.push("/admin/client");
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["clientAnalytics"] });
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to delete client");
        },
    });

    const handleDeleteClient = async () => {
        if (clientId) {
            deleteClientMutation.mutate(clientId);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleEditSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    };

    const handleBackClick = () => {
        router.push("/admin/client");
    };

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
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full px-5 py-5 gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleBackClick}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-xl sm:text-2xl font-bold text-black">{client.name}</h1>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-none">
                        <AddClient
                            name="Edit"
                            data={{
                                id: client.id.toString(),
                                name: client.name,
                                panNo: client.pan,
                                mobileNo: client.mobile,
                                email: client.email,
                                address: client.address,
                                purseAmount: client.purseAmount,
                            }}
                            onSuccess={handleEditSuccess}
                        />

                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="flex items-center bg-stone-50 gap-2 flex-1 sm:flex-none border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-6 py-3 text-sm sm:text-base"
                    >
                        Delete
                    </Button>

                </div>
            </div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 px-4">
                <StatCard
                    icon={<ChartNoAxesCombined className="h-6 w-6" />}
                    value={`₹${client.totalPortfolioAmount?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }) || "0"}`}
                    label="Total Portfolio Value"
                />
                <StatCard
                    icon={<BarChart2 className="h-6 w-6" />}
                    value={`₹${client.totalProfit?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }) || "0"}`}
                    label="Total Profit"
                />
                <StatCard
                    icon={<TrendingUp className="h-6 w-6" />}
                    value={`₹${client.totalNetInvestedAmount != null && client.totalNetInvestedAmount !== 0
                        ? (-client.totalNetInvestedAmount).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })
                        : "0.00"}`}
                    label="Total Invested Amount"
                />
                <StatCard
                    icon={<CreditCard className="h-6 w-6" />}
                    value={`₹${client.purseAmount?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }) || "0"}`}
                    label="Initial Purse Amount"
                />
                <StatCard
                    icon={<Wallet className="h-6 w-6" />}
                    value={`₹${client.remainingPurseAmount?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }) || "0"}`}
                    label="Remaining Purse Amount"
                />
                <StatCard
                    icon={<IndianRupee className="h-6 w-6 " />}
                    value={`₹${client.totalBrokerageAmount?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }) || "0"}`}
                    label="Total Fees"
                />
                <StatCard
                    icon={<CreditCard className="h-6 w-6 text-indigo-600" />}
                    value={`₹${client.totalPaymentAmount?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }) || "0"}`}
                    label="Total Payments"
                />
            </div>

            {/* Client Details */}
            <div className="bg-white rounded-lg shadow-sm border mx-5">
                <div className="p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-black mb-4">Client Information</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Phone size={16} />
                                <span>Mobile</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black break-all">{client.mobile}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Mail size={16} />
                                <span>Email</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black break-all">{client.email}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <CreditCard size={16} />
                                <span>PAN Number</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black break-all">{client.pan}</div>
                        </div>
                        <div className="lg:col-span-2 flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <MapPin size={16} />
                                <span>Address</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black">{client.address}</div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons section */}
                <div className="border-t bg-gray-50 px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                        <div className="grid grid-cols-2 sm:flex gap-3">
                            <Link
                                href={`/admin/trade?clientId=${client.id}`}
                                className="flex gap-2 items-center justify-center hover:bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-pointer transition-colors"
                            >
                                <span className="text-sm font-medium">Trade</span>
                                <div className="bg-primary text-white h-fit p-1.5 rounded-full">
                                    <ArrowUpRight size={12} />
                                </div>
                            </Link>
                            <Link
                                href={`/admin/brokerage?clientId=${client.id}`}
                                className="flex gap-2 items-center justify-center hover:bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-pointer transition-colors"
                            >
                                <span className="text-sm font-medium">Fees</span>
                                <div className="bg-primary text-white h-fit p-1.5 rounded-full">
                                    <ArrowUpRight size={12} />
                                </div>
                            </Link>
                            <Link
                                href={`/admin/payment-history?clientId=${client.id}`}
                                className="flex gap-2 items-center justify-center hover:bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-pointer transition-colors"
                            >
                                <span className="text-sm font-medium">Payment</span>
                                <div className="bg-primary text-white h-fit p-1.5 rounded-full">
                                    <ArrowUpRight size={12} />
                                </div>
                            </Link>
                            <div className="flex items-center justify-center">
                                <AddPayment
                                    name="Add Payment"
                                    clientId={clientId}
                                />
                            </div>
                        </div>
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
