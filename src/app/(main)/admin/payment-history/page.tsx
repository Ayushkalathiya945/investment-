"use client";
import type { DateRange } from "react-day-picker";

import React, { useState } from "react";

import AddPayment from "@/components/Dialoge/AddPayment";
import { Pagination } from "@/components/ui/pagination";
import RangeDatePicker from "@/components/ui/rangeDatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT, TYPE } from "@/lib/constants";

const data = [
    {
        id: "1",
        client: "Varun Sharma",
        amount: "VS Fashion Hub",
        date: "02-03-2024",
    },
    {
        id: "1",
        client: "Varun Sharma",
        amount: "VS Fashion Hub",
        date: "02-03-2024",
    },
    {
        id: "1",
        client: "Varun Sharma",
        amount: "VS Fashion Hub",
        date: "02-03-2024",
    },
    {
        id: "1",
        client: "Varun Sharma",
        amount: "VS Fashion Hub",
        date: "02-03-2024",
    },
];

const PaymentHistory: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const filteredData = data.filter(() => {
        const matchesDate = (() => {
            if (!dateRange?.from || !dateRange?.to)
                return true;
            const itemDate = new Date();
            return (
                itemDate >= dateRange.from
                && itemDate <= dateRange.to
            );
        })();
        return matchesDate;
    });

    const startIndex = (currentPage - 1) * PAGE_LIMIT;
    const endIndex = startIndex + PAGE_LIMIT;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredData.length / PAGE_LIMIT);

    const handleDateChange = (date: DateRange) => {
        if (date?.from && date?.to) {
            const startDate = new Date(date.from.setHours(0, 0, 0, 0));
            const endDate = new Date(date.to.setHours(23, 59, 59, 999));
            setDateRange({ from: startDate, to: endDate });
        } else {
            setDateRange(undefined);
        }
    };

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full items-center">
                <h1 className="text-3xl font-semibold">Payment History</h1>
                <div className="flex-col md:flex md:flex-row gap-4 items-center">
                    <div className="flex min-w-50 ">
                        <Select>
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder="All Client" />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPE.map(item => (
                                    <SelectItem
                                        className="cursor-pointer"
                                        key={item}
                                        value={item}
                                    >
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:w-1/2 w-full my-3 md:my-0">
                        <RangeDatePicker
                            from={dateRange?.from?.toISOString()}
                            to={dateRange?.to?.toISOString()}
                            onChange={handleDateChange}
                        />
                    </div>
                    <AddPayment name="+Add Payment" />
                </div>
            </div>

            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                    <Table className="bg-white">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold  w-full justify-between items-center gap-4 rounded-lg py-3">
                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="rounded-tr-xl">Date</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {paginatedData.map((item, index) => {
                                return (
                                    <TableRow key={item.id} className="w-full py-10 gap-4 mx-3">
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{item.client}</TableCell>
                                        <TableCell>{item.amount}</TableCell>
                                        <TableCell>{item.date}</TableCell>
                                    </TableRow>
                                );
                            })}

                        </TableBody>
                    </Table>
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={page => setCurrentPage(page)}
                />
            </div>

        </div>

    );
};

export default PaymentHistory;
