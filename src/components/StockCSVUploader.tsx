"use client";

import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import React, { useRef, useState } from "react";
import toast from "react-hot-toast";

import type { StockUploadResponse, ValidationError } from "@/types/stocks";

import { uploadBothStocks } from "@/api/stocks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

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
    const [nseFile, setNseFile] = useState<File | null>(null);
    const [bseFile, setBseFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<StockUploadResponse | null>(null);
    const nseFileInputRef = useRef<HTMLInputElement>(null);
    const bseFileInputRef = useRef<HTMLInputElement>(null);

    const truncate = (str: string, maxLength: number) =>
        str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;

    // Reset form to initial state
    const resetForm = () => {
        setNseFile(null);
        setBseFile(null);
        setUploadResult(null);
        if (nseFileInputRef.current) {
            nseFileInputRef.current.value = "";
        }
        if (bseFileInputRef.current) {
            bseFileInputRef.current.value = "";
        }
    };

    // Handle NSE file selection
    const handleNseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && isValidCSVFile(selectedFile)) {
            setNseFile(selectedFile);
            toast.success(`NSE file selected: ${truncate(selectedFile.name, 30)}`, { duration: 1500 });
        } else if (selectedFile) {
            toast.error("Please select a valid CSV file for NSE");
        }
    };

    // Handle BSE file selection
    const handleBseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && isValidCSVFile(selectedFile)) {
            setBseFile(selectedFile);
            toast.success(`BSE file selected: ${truncate(selectedFile.name, 30)}`);
        } else if (selectedFile) {
            toast.error("Please select a valid CSV file for BSE");
        }
    };

    // Only supporting upload of both NSE and BSE files together

    // Upload both NSE and BSE files
    const handleUploadBoth = async () => {
        if (!nseFile || !bseFile) {
            toast.error("Please select both NSE and BSE CSV files");
            return;
        }

        setIsUploading(true);
        setUploadResult(null);

        const loadingToast = toast.loading("Uploading both NSE and BSE files...");

        try {
            const response = await uploadBothStocks(nseFile, bseFile);

            // Dismiss loading toast
            toast.dismiss(loadingToast);
            setUploadResult(response);

            if (response.success) {
                toast.success(response.message || "Files uploaded successfully");
                if (onSuccess)
                    onSuccess();

                // Auto reset the form after success
                setTimeout(() => {
                    resetForm();
                }, 2000);
            } else {
                // Display primary error message
                toast.error(response.error || "Upload failed");

                // If there are validation errors, we'll display them in the UI
                // rather than as additional toasts to avoid overwhelming the user
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
            toast.dismiss(loadingToast);
        }
    };

    // Helper to render validation errors
    const renderValidationErrors = (validationErrors?: ValidationError[]) => {
        if (!validationErrors || validationErrors.length === 0)
            return null;

        return (
            <div className="mt-3 space-y-2">
                <p className="font-medium text-sm text-red-800">Validation Errors:</p>
                <ul className="list-disc pl-5 text-xs space-y-1 text-red-700">
                    {validationErrors.map((error, index) => (
                        <li key={index}>
                            <span className="font-semibold">{error.fileType}</span>
                            :
                            {error.message}
                            {error.missingColumns && error.missingColumns.length > 0 && (
                                <ul className="list-disc pl-5 mt-1">
                                    {error.missingColumns.map((column, colIndex) => (
                                        <li key={colIndex}>{column}</li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">Upload Stock Files</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="nse-file">NSE CSV File</Label>
                            <div className="flex items-center space-x-2">
                                <input
                                    id="nse-file"
                                    ref={nseFileInputRef}
                                    type="file"
                                    accept=".csv,.CSV"
                                    onChange={handleNseFileChange}
                                    disabled={isUploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:cursor-pointer hover:file:bg-slate-100"
                                />
                            </div>
                            {nseFile && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Selected NSE file:
                                    {" "}
                                    {nseFile.name}
                                    {" "}
                                    (
                                    {(nseFile.size / 1024).toFixed(2)}
                                    {" "}
                                    KB)
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bse-file">BSE CSV File</Label>
                            <div className="flex items-center space-x-2">
                                <input
                                    id="bse-file"
                                    ref={bseFileInputRef}
                                    type="file"
                                    accept=".csv,.CSV"
                                    onChange={handleBseFileChange}
                                    disabled={isUploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:cursor-pointer hover:file:bg-slate-100"
                                />
                            </div>
                            {bseFile && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Selected BSE file:
                                    {" "}
                                    {bseFile.name}
                                    {" "}
                                    (
                                    {(bseFile.size / 1024).toFixed(2)}
                                    {" "}
                                    KB)
                                </p>
                            )}
                        </div>

                        {uploadResult && (
                            <div className={`p-3 rounded-md text-sm ${uploadResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                                <div className="flex items-center gap-2">
                                    {uploadResult.success
                                        ? <CheckCircle2 className="h-4 w-4" />
                                        : <AlertCircle className="h-4 w-4" />}
                                    <span className="font-medium">{uploadResult.message}</span>
                                </div>

                                {uploadResult.success && (
                                    <div className="mt-2">
                                        {uploadResult.nse && (
                                            <div className="text-xs space-y-1">
                                                <p>
                                                    Total NSE records:
                                                    {" "}
                                                    {uploadResult.nse.totalRecords}
                                                </p>
                                                <p>
                                                    Successfully inserted:
                                                    {" "}
                                                    {uploadResult.nse.inserted}
                                                </p>
                                                {uploadResult.nse.invalidRecords && uploadResult.nse.invalidRecords.length > 0 && (
                                                    <p>
                                                        Invalid records:
                                                        {" "}
                                                        {uploadResult.nse.invalidRecords.length}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {uploadResult.bse && (
                                            <div className="text-xs space-y-1 mt-2">
                                                <p>
                                                    Total BSE records:
                                                    {" "}
                                                    {uploadResult.bse.totalRecords}
                                                </p>
                                                <p>
                                                    Successfully inserted:
                                                    {" "}
                                                    {uploadResult.bse.inserted}
                                                </p>
                                                {uploadResult.bse.invalidRecords && uploadResult.bse.invalidRecords.length > 0 && (
                                                    <p>
                                                        Invalid records:
                                                        {" "}
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

                                {/* Render validation errors */}
                                {!uploadResult.success && uploadResult.validationErrors
                                    && renderValidationErrors(uploadResult.validationErrors)}
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex flex-wrap justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={resetForm}
                        disabled={isUploading}
                        size="sm"
                    >
                        Reset
                    </Button>

                    {/* Upload both files button */}
                    <Button
                        onClick={handleUploadBoth}
                        disabled={!nseFile || !bseFile || isUploading}
                        size="sm"
                    >
                        {isUploading
                            ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )
                            : (
                                    <Upload className="mr-2 h-4 w-4" />
                                )}
                        Upload Both Files
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default StockCSVUploader;
