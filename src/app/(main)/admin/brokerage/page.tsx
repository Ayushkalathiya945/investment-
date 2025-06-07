"use client";
import { Copy, Edit, IndianRupee, Search, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_LIMIT, TYPE } from "@/lib/constants";
import RangeDatePicker from "@/components/ui/rangeDatePicker";
import { DateRange } from "react-day-picker";
import AddClient from "@/components/Dialoge/AddClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const data = [
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "8768945783",
    },
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "8768945783",
    },
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "8768945783",
    },
    {
        id: "1",
        client: "Varun Sharma",
        totalBrokerage: "VS Fashion Hub",
        date: "8768945783",
    }
]

const Brokerage: React.FC = () => {
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const [searchTerm, setSearchTerm] = useState("");
    const filteredData = data.filter((item) => {
        const matchesDate = (() => {
            if (!dateRange?.from || !dateRange?.to) return true;
            const itemDate = new Date();
            return (
                itemDate >= dateRange.from &&
                itemDate <= dateRange.to
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
            <div className="flex justify-between w-full">
                <h1 className="text-3xl font-semibold">Brokerage</h1>
                <div className="flex gap-4">
                    <div className="flex min-w-50 ">
                        <Select>
                            <SelectTrigger className="w-full ring-0">
                                <SelectValue placeholder="All Client" />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPE.map((item) => (
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
                    <div className="md:w-1/2 w-full">
                        <RangeDatePicker
                            from={dateRange?.from?.toISOString()}
                            to={dateRange?.to?.toISOString()}
                            onChange={handleDateChange}
                        />
                    </div>
                </div>
            </div>
            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1  justify-between gap-3 px-2">
                <StatCard icon={<TrendingUp />} value={"₹ 1,00,000"} label="Total Brokerage" />
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
                            {paginatedData.map((item) => {
                                return (
                                    <TableRow key={item.id} className="w-full py-10 gap-4 mx-3 cursor-pointer" onClick={() => { router.push(`/admin/client/${item.id}`); }}>
                                        <TableCell>{item.id}</TableCell>
                                        <TableCell>{item.client}</TableCell>
                                        <TableCell className="text-green-500">{item.totalBrokerage}</TableCell>
                                        <TableCell>{item.date}</TableCell>
                                    </TableRow>
                                )
                            })}

                        </TableBody>
                    </Table>
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(page) => setCurrentPage(page)}
                />
            </div>

        </div>

    );
};

export default Brokerage;
