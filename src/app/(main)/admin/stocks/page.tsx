"use client";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import StockCSVUploader from "@/components/StockCSVUploader";

export default function StockManagementPage() {
    const queryClient = useQueryClient();

    // Handle successful upload - invalidate stock-related queries
    const handleUploadSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ["stockSymbols"] });
    };

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">Stock Management</h1>

            <div className="grid gap-8 md:grid-cols-2">
                <div>
                    <h2 className="text-xl font-semibold mb-4">Upload Stock Data</h2>
                    <p className="mb-4 text-slate-600">
                        Upload stock data from CSV files for NSE or BSE exchanges. The uploaded data will replace any existing stock data for the selected exchange.
                    </p>
                    <div className="mt-6">
                        <StockCSVUploader onSuccess={handleUploadSuccess} />
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">CSV Format Requirements</h2>

                    <div className="mb-4">
                        <h3 className="font-medium text-lg">NSE Format:</h3>
                        <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                            <li>
                                <strong>SYMBOL</strong>
                                : Stock symbol/ticker
                            </li>
                            <li>
                                <strong>Security Name</strong>
                                : Company name
                            </li>
                            <li>
                                <strong>Close Price/Paid up value(Rs.)</strong>
                                : Stock price
                            </li>
                        </ul>
                    </div>

                    <div className="mb-4">
                        <h3 className="font-medium text-lg">BSE Format:</h3>
                        <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                            <li>
                                <strong>TckrSymb</strong>
                                : Stock symbol/ticker
                            </li>
                            <li>
                                <strong>FinInstrmNm</strong>
                                : Company name
                            </li>
                            <li>
                                <strong>ClsPric</strong>
                                : Stock price
                            </li>
                        </ul>
                    </div>

                    <div className="p-3 bg-amber-50 text-amber-800 rounded-md mt-4 text-sm">
                        <p className="font-medium">Important Notes:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Ensure all column names match exactly as specified</li>
                            <li>All existing data for the selected exchange will be replaced</li>
                            <li>The CSV must be properly formatted with headers</li>
                        </ul>
                    </div>

                    <div className="mt-6">
                        <h3 className="text-sm font-medium mb-2">Sample Files:</h3>
                        <div className="flex flex-col gap-2">
                            <a
                                href="/sample_nse.csv"
                                download
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                            >
                                Download NSE Sample CSV
                            </a>
                            <a
                                href="/sample_bse.csv"
                                download
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                            >
                                Download BSE Sample CSV
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
