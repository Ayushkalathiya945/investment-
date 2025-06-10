"use client";

import { Search, TrendingDown, TrendingUp } from "lucide-react";
import React, { useState } from "react";

import AddTrade from "@/components/Dialoge/AddTrade";
import { Input } from "@/components/ui/input";
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
        stock: "VS Fashion Hub",
        type: "BUY",
        quantity: "Surat, Gujarat",
        sharePrice: "Surat, Gujarat",
        date: "January 2024",
    },
    {
        id: "1",
        client: "Varun Sharma",
        stock: "VS Fashion Hub",
        type: "SALE",
        quantity: "Surat, Gujarat",
        sharePrice: "Surat, Gujarat",
        date: "January 2025",
    },
    {
        id: "1",
        client: "Varun Sharma",
        stock: "VS Fashion Hub",
        type: "BUY",
        quantity: "Surat, Gujarat",
        sharePrice: "Surat, Gujarat",
        date: "January 2024",
    },
    {
        id: "1",
        client: "Varun Sharma",
        stock: "VS Fashion Hub",
        type: "BUY",
        quantity: "Surat, Gujarat",
        sharePrice: "Surat, Gujarat",
        date: "January 2024",
    },
];

const Trade: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [dateRange, setDateRange] = useState<MonthRange>({});

    const [searchTerm, setSearchTerm] = useState("");
    const filteredData = data.filter((item) => {
        const matchesSearch
            = item.client.toLowerCase().includes(searchTerm.toLowerCase())
                || item.id.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = (() => {
            if (!dateRange?.from || !dateRange?.to)
                return true;
            const itemDate = new Date(`${item.date} 01`);
            const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 1);
            const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth() + 1, 0);
            return itemDate >= fromDate && itemDate <= toDate;
        })();

        return matchesSearch && matchesDate;
    });

    const startIndex = (currentPage - 1) * PAGE_LIMIT;
    const endIndex = startIndex + PAGE_LIMIT;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredData.length / PAGE_LIMIT);

    const handleDateChange = (range: MonthRange) => {
        setDateRange(range);
    };

    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">

            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <h1 className="text-3xl font-semibold">Trade</h1>
                <div className="flex items-center gap-4">
                    <div className="md:w-1/2 w-full">
                        <MonthRangePicker
                            onChange={handleDateChange}
                        />
                    </div>
                    <AddTrade name="Add Trade" />
                </div>
            </div>

            <div className="relative flex-col md:flex md:flex-row w-full gap-3 flex items-start md:items-center">
                <div className=" w-full">
                    <div className="absolute hidden md:block left-5 top-1/2 -translate-y-1/2 z-10 text-sm pointer-events-none">
                        <Search size={18} className="text-primary" />
                    </div>
                    <Input
                        placeholder="Search by name..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-10 rounded-xl bg-white border border-border text-sm"
                    />
                </div>
                <div className="flex min-w-50 ">
                    <Select>
                        <SelectTrigger className="w-full ring-0">
                            <SelectValue placeholder="Type" />
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

            </div>

            <div className="h-full flex flex-col flex-grow gap-10 justify-between">
                <div className="w-full h-full flex flex-col justify-between border rounded-xl border-[#EFF6FF]">
                    <Table className="bg-white">
                        <TableHeader>
                            <TableRow className="bg-[#F9F9F9] text-[16px] font-semibold  w-full justify-between items-center gap-4 rounded-lg py-3">
                                <TableHead className="rounded-tl-xl">No.</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Share Price</TableHead>
                                <TableHead className="rounded-tr-xl">Date</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {paginatedData.map((item, index) => {
                                return (
                                    <TableRow key={item.id} className="w-full py-10 gap-4 mx-3">
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{item.client}</TableCell>
                                        <TableCell>{item.stock}</TableCell>
                                        <TableCell>
                                            {item.type === "BUY"
                                                ? (
                                                        <div className="flex rounded-xl text-green-500 bg-green-100 py-1 px-5 w-fit items-center">
                                                            <TrendingUp size={15} className="mr-2" />
                                                            {item.type}
                                                        </div>
                                                    )
                                                : (
                                                        <div className="flex rounded-xl text-red-500 bg-red-100 py-1 px-5 w-fit items-center">
                                                            <TrendingDown size={15} className="mr-2" />
                                                            {item.type}
                                                        </div>
                                                    )}
                                        </TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{item.sharePrice}</TableCell>
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

export default Trade;
