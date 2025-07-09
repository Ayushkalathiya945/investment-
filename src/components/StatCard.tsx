import React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardProps = {
    icon: React.ReactNode;
    value: number | string;
    label: string;
    className?: string;
    isLoading?: boolean;
};

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, className, isLoading = false }) => {
    return (
        <div
            className={cn(
                "group flex flex-col items-center justify-between gap-2 rounded-xl border-t border-x border-gray-100 bg-white p-4 shadow-xl w-full md:max-w-xs hover:bg-gradient-to-t from-[#e5f8ff] via-[#EFF6FF] to-[#cef2ff]",
                className,
            )}
        >
            <div className="flex w-full justify-start items-center gap-5">
                <div className="flex items-center shrink-0 justify-center bg-secondary text-sm p-4 group-hover:bg-white text-primary rounded-full w-13 h-13">
                    {icon}
                </div>
                {isLoading
                    ? (
                            <div className="w-full">
                                <Skeleton className="h-8 w-3/4" />
                            </div>
                        )
                    : (
                            <p className="w-full text-2xl text-start leading-loose group-hover:text-primary font-semibold">{value}</p>
                        )}
            </div>
            {isLoading
                ? (
                        <div className="w-full flex justify-end">
                            <Skeleton className="h-4 w-1/3" />
                        </div>
                    )
                : (
                        <p className="w-full text-end text-sm font-medium text-black">{label}</p>
                    )}
        </div>
    );
};

export default StatCard;
