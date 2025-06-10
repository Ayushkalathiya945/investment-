import { ArrowUpRight, ChevronLeft, CreditCard, IndianRupee, Mail, MapPin, Phone, TrendingDown, TrendingUp } from "lucide-react";
import React from "react";

import AddClient from "@/components/Dialoge/AddClient";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";

const ClientDetail: React.FC = () => {
    return (
        <div className="flex flex-col w-full min-h-[94vh] gap-5">
            <div className="flex-col md:flex md:flex-row justify-between w-full">
                <div className="flex gap-2 items-center">
                    <div className="flex items-center shrink-0 justify-center border border-border bg-white text-sm hover:bg-secondary text-primary rounded-full w-10 h-10">
                        <ChevronLeft size={20} />
                    </div>
                    <h1 className="text-xl font-semibold ">Rajesh Kumar</h1>
                </div>
                <div className="flex-col md:flex md:flex-row gap-2 mt-3 md:mt-0">
                    <Button className="ml-auto mx-3 md:mx-0 bg-transparent shadow-none text-red-400 border border-red-300 hover:bg-red-50 px-10 rounded-xl">Delete</Button>
                    <AddClient name="Edit" />
                </div>
            </div>
            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1  justify-between gap-3 px-2">
                <StatCard icon={<IndianRupee />} value="₹2,00,000" label="Total Portfolio Value" />
                <StatCard icon={<TrendingUp />} value="₹1,00,000" label="Total Brokerage" />
                <StatCard icon={<TrendingDown />} value="₹90,000" label="Brokerage Remaining" />
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
                            <div className="mt-1 font-medium text-base text-black">8694498567</div>
                        </div>
                        <div className="hidden md:flex justify-center">
                            <div className="w-px bg-[#e0e7ff] relative mx-6">
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2  w-2 h-2 rounded-full bg-[#c7d2fe]"></div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Mail size={16} />
                                <span>Email Address</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black">rajesh.kumar@email.com</div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-5">
                        <div className="flex flex-col gap-1 min-w-30">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <CreditCard size={16} />
                                <span>PAN No</span>
                            </div>
                            <div className="mt-1 font-medium text-base text-black">ABCDE1234F</div>
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
                            <div className="mt-1 font-medium text-base text-black">123 MG Road, Bangalore, Karnataka 560001</div>
                        </div>
                    </div>
                </div>

                {/* Buttons section */}
                <div className="flex flex-wrap items-start justify-start md:justify-end w-full lg:w-fit gap-3 py-5 px-5">
                    <div className="flex gap-2 items-center hover:bg-secondary rounded-full px-2 py-1 cursor-pointer">
                        <span className="text-sm">Trade</span>
                        <div className="bg-primary text-white h-fit p-2 rounded-full">
                            <ArrowUpRight size={15} />
                        </div>
                    </div>
                    <div className="flex gap-2 items-center hover:bg-secondary rounded-full px-2 py-1 cursor-pointer">
                        <span className="text-sm">Brokerage</span>
                        <div className="bg-primary text-white h-fit p-2 rounded-full">
                            <ArrowUpRight size={15} />
                        </div>
                    </div>
                    <div className="flex gap-2 items-center hover:bg-secondary rounded-full px-2 py-1 cursor-pointer">
                        <span className="text-sm">Payment</span>
                        <div className="bg-primary text-white h-fit p-2 rounded-full">
                            <ArrowUpRight size={15} />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ClientDetail;
