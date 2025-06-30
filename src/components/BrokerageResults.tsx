import { format } from "date-fns";
import React from "react";

import type { BrokerageCalculateResponse, BrokerageDetailType } from "@/types/brokerage";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type BrokerageResultsProps = {
    data: BrokerageCalculateResponse;
};

export default function BrokerageResults({ data }: BrokerageResultsProps) {
    // Handle potential undefined or null data
    if (!data || !data.data) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Brokerage Calculation Results</CardTitle>
                    <CardDescription>No calculation data available</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>No brokerage calculation data found. Please try calculating again.</p>
                </CardContent>
            </Card>
        );
    }

    const {
        totalBrokerage = 0,
        details = [],
        totalHoldingValue = 0,
        totalHoldingDays = 0,
        totalTrades = 0,
        totalTurnover = 0,
    } = data.data;

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    // Format date with error handling
    const formatDate = (date: string | Date | null | undefined) => {
        if (!date)
            return "N/A";
        try {
            return format(new Date(date), "dd MMM yyyy");
        } catch (error) {
            console.error("Error formatting date:", error);
            return "Invalid Date";
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Brokerage Calculation Results</CardTitle>
                <CardDescription>
                    Calculation period:
                    {" "}
                    {data.data?.calculationPeriod || "Monthly brokerage calculation"}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Brokerage</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <p className="text-2xl font-bold">{formatCurrency(totalBrokerage || 0)}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Holding Value</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <p className="text-2xl font-bold">{formatCurrency(totalHoldingValue || 0)}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Trades</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <p className="text-2xl font-bold">{totalTrades || 0}</p>
                        </CardContent>
                    </Card>
                </div>

                <ScrollArea className="h-[500px] rounded-md border">
                    <Table>
                        <TableCaption>Detailed breakdown of all positions</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Symbol</TableHead>
                                <TableHead>Exchange</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Buy Date</TableHead>
                                <TableHead>Days Held</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>Brokerage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {details.map((detail: BrokerageDetailType, index: number) => (
                                <TableRow key={`detail-${detail.tradeId || index}`}>
                                    <TableCell>{detail.symbol || "N/A"}</TableCell>
                                    <TableCell>{detail.exchange || "N/A"}</TableCell>
                                    <TableCell>{detail.quantity || 0}</TableCell>
                                    <TableCell>{formatDate(detail.buyDate)}</TableCell>
                                    <TableCell>
                                        {detail.holdingDays || 0}
                                        /
                                        {detail.totalDaysInMonth || 30}
                                    </TableCell>
                                    <TableCell>{formatCurrency(detail.positionValue || 0)}</TableCell>
                                    <TableCell>{formatCurrency(detail.brokerageAmount || 0)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
            <CardFooter className="flex justify-between">
                <div>
                    <p className="text-sm">
                        Total Holding Days:
                        <span className="font-semibold">{totalHoldingDays || 0}</span>
                    </p>
                </div>
                <div>
                    <p className="text-sm">
                        Total Turnover:
                        <span className="font-semibold">{formatCurrency(totalTurnover || 0)}</span>
                    </p>
                </div>
            </CardFooter>
        </Card>
    );
}
