"use client";

import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";

import type { StockUploadResponse } from "@/types/stocks";

import { uploadBseStocks, uploadNseStocks } from "@/api/stocks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExchangeType } from "@/types/stocks";

// Utility function to validate CSV files
function isValidCSVFile(file: File): boolean {
    // Check file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv")) {
        return false;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        return false;
    }

    return true;
}

type StockCSVUploaderProps = {
    onSuccess?: () => void;
};

const StockCSVUploader: React.FC<StockCSVUploaderProps> = ({ onSuccess }) => {
    const [exchange, setExchange] = useState<ExchangeType | string>("");
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<StockUploadResponse | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const truncate = (str: string, maxLength: number) =>
        str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;

    // Reset form to initial state
    const resetForm = () => {
        setFile(null);
        setExchange("");
        setUploadResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            // Check if file is CSV - case insensitive check for .csv, .CSV extensions
            const fileName = selectedFile.name.toLowerCase();
            if (!fileName.endsWith(".csv") && !fileName.endsWith(".CSV")) {
                toast.error("Please select a CSV file");
                return;
            }

            // Additional check for MIME type if available
            if (selectedFile.type
                && selectedFile.type !== "text/csv"
                && selectedFile.type !== "application/csv"
                && selectedFile.type !== "application/vnd.ms-excel"
                && selectedFile.type !== "application/octet-stream") {
                console.warn(`File MIME type: ${selectedFile.type} - proceeding anyway`);
            }

            setFile(selectedFile);
            toast.success(`File selected: ${truncate(selectedFile.name, 30)}`);
        }
    };

    const handleSelectExchange = (value: string) => {
        setExchange(value);
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("Please select a CSV file first");
            return;
        }

        if (!exchange) {
            toast.error("Please select an exchange (NSE or BSE)");
            return;
        }

        // Extra validation to ensure it's a CSV file
        if (!isValidCSVFile(file)) {
            toast.error("Invalid file format. Please select a proper CSV file");
            return;
        }

        setIsUploading(true);
        setUploadResult(null);

        // Log what we're about to do
        // //console.log(`Uploading ${exchange} stock CSV file: ${file.name}`);

        toast.loading(`Uploading ${truncate(file.name, 30)} for ${exchange} exchange...`);

        try {
            let response: StockUploadResponse;

            if (exchange === ExchangeType.NSE) {
                response = await uploadNseStocks(file);
            } else if (exchange === ExchangeType.BSE) {
                response = await uploadBseStocks(file);
            } else {
                throw new Error("Invalid exchange selected");
            }

            // Dismiss all loading toasts
            toast.dismiss();
            setUploadResult(response);

            if (response.success) {
                toast.success(response.message);
                if (onSuccess)
                    onSuccess();

                // Auto reset the form on successful upload after a brief delay
                // to allow the user to see the success message
                setTimeout(() => {
                    resetForm();
                }, 2000);
            } else {
                toast.error(response.error || "Upload failed");
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            toast.error(error.message || "An unexpected error occurred during upload");
            setUploadResult({
                success: false,
                message: "Upload failed",
                error: error.message || "An unexpected error occurred",
            });
        } finally {
            setIsUploading(false);
            // Make sure all loading toasts are dismissed
            toast.dismiss();
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Upload Stocks CSV</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="exchange">Select Exchange</Label>
                        <Select
                            value={exchange.toString()}
                            onValueChange={handleSelectExchange}
                            disabled={isUploading}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Exchange" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ExchangeType.NSE}>NSE</SelectItem>
                                <SelectItem value={ExchangeType.BSE}>BSE</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="csv-file">CSV File</Label>
                        <div className="flex items-center space-x-2">
                            <input
                                id="csv-file"
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.CSV"
                                onChange={handleFileChange}
                                disabled={isUploading}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                            />
                        </div>
                        {file && (
                            <p className="text-xs text-slate-500 mt-1">
                                Selected file:
                                {" "}
                                {file.name}
                                {" "}
                                (
                                {(file.size / 1024).toFixed(2)}
                                {" "}
                                KB)
                            </p>
                        )}
                    </div>
                    {/*
                    {!file && !isUploading && (
                        <div className="p-3 rounded-md text-sm bg-blue-50 text-blue-800">
                            <p className="font-medium">File Format Requirements:</p>
                            <div className="mt-1 space-y-1 text-xs">
                                <p><strong>NSE CSV:</strong> Must include SYMBOL, Security Name, Close Price/Paid up value(Rs.)</p>
                                <p><strong>BSE CSV:</strong> Must include TckrSymb, FinInstrmNm, ClsPric</p>
                                <p>Column names are case-sensitive and must match exactly.</p>
                            </div>
                        </div>
                    )} */}

                    {uploadResult && (
                        <div className={`p-3 rounded-md text-sm ${uploadResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                            <div className="flex items-center gap-2">
                                {uploadResult.success
                                    ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        )
                                    : (
                                            <AlertCircle className="h-4 w-4" />
                                        )}
                                <span className="font-medium">{uploadResult.message}</span>
                            </div>

                            {uploadResult.success && (
                                <div className="mt-2">
                                    {uploadResult.nse && (
                                        <div className="text-xs space-y-1">
                                            <p>
                                                Total NSE records:
                                                {uploadResult.nse.totalRecords}
                                            </p>
                                            <p>
                                                Successfully inserted:
                                                {uploadResult.nse.inserted}
                                            </p>
                                            {uploadResult.nse.invalidRecords && uploadResult.nse.invalidRecords.length > 0 && (
                                                <p>
                                                    Invalid records:
                                                    {uploadResult.nse.invalidRecords.length}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {uploadResult.bse && (
                                        <div className="text-xs space-y-1">
                                            <p>
                                                Total BSE records:
                                                {uploadResult.bse.totalRecords}
                                            </p>
                                            <p>
                                                Successfully inserted:
                                                {uploadResult.bse.inserted}
                                            </p>
                                            {uploadResult.bse.invalidRecords && uploadResult.bse.invalidRecords.length > 0 && (
                                                <p>
                                                    Invalid records:
                                                    {uploadResult.bse.invalidRecords.length}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!uploadResult.success && uploadResult.error && (
                                <p className="text-xs mt-1">{uploadResult.error}</p>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
                <Button
                    variant="outline"
                    onClick={resetForm}
                    disabled={isUploading}
                >
                    Reset
                </Button>
                <Button
                    onClick={handleUpload}
                    disabled={!file || !exchange || isUploading}
                >
                    {isUploading
                        ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            )
                        : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload
                                </>
                            )}
                </Button>
            </CardFooter>
        </Card>
    );
};

export default StockCSVUploader;
