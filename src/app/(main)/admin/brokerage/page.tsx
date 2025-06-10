"use client";

import { TrendingUp } from "lucide-react";
import React, { useState } from "react";

import StatCard from "@/components/StatCard";
import MonthRangePicker from "@/components/ui/monthRangePicker";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT, TYPE } from "@/lib/constants";

type MonthRange = {
    from?: Date;
    to?: Date;
};

const data = [
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "January 2023",
    },
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "March 2025",

    },
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "April 2023",

    },
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "June 2023",

    },
];

const Brokerage: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [dateRange, setDateRange] = useState<MonthRange>({});

    const filteredData = data.filter((item) => {
        const { from, to } = dateRange ?? {};

        if (!from || !to)
            return true;

        const itemDate = new Date(`${item.date} 01`);
        const fromDate = new Date(from.getFullYear(), from.getMonth(), 1);
        const toDate = new Date(to.getFullYear(), to.getMonth() + 1, 0);

        return itemDate >= fromDate && itemDate <= toDate;
    });

    const handleDateChange = (range: MonthRange) => {
        setDateRange(range);
    };

    const startIndex = (currentPage - 1) * PAGE_LIMIT;
    const endIndex = startIndex + PAGE_LIMIT;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredData.length / PAGE_LIMIT);

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <h1 className="text-3xl font-semibold">Brokerage</h1>
                <div className="flex-col md:flex md:flex-row gap-4 items-center">
                    <div className="flex min-w-50 ">
                        <Select>
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder="All Client" />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPE.map(item => (
                                    <SelectItem
                                        className="cursor-pointer text-sm"
                                        key={item}
                                        value={item}
                                    >
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:w-1/2 w-full mt-2 md:mt-0">
                        <MonthRangePicker
                            onChange={handleDateChange}
                        />
                    </div>
                </div>
            </div>
            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1  justify-between gap-3 px-2">
                <StatCard icon={<TrendingUp />} value="₹ 1,00,000" label="Total Brokerage" />
            </div>

            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                    <Table className="bg-white">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold  w-full justify-between items-center gap-4 rounded-lg py-3">
                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Total Brokerage</TableHead>
                                <TableHead className="rounded-tr-xl">Date</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {paginatedData.map((item, index) => {
                                return (
                                    <TableRow key={item.id} className="w-full py-10 gap-4 mx-3">
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{item.client}</TableCell>
                                        <TableCell className="text-green-500">{item.totalBrokerage}</TableCell>
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

export default Brokerage;
