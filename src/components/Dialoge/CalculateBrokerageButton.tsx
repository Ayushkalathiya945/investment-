import { Calendar } from "lucide-react";
import React, { useState } from "react";

import type { BrokerageCalculateResponse } from "@/types/brokerage";

import { Button } from "../ui/button";
import CalculateBrokerageDialog from "./CalculateBrokerage";

type CalculateBrokerageButtonProps = {
    onCalculationComplete?: (data: BrokerageCalculateResponse) => void;
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
};

export default function CalculateBrokerageButton({
    onCalculationComplete,
    className,
    variant = "default",
}: CalculateBrokerageButtonProps) {
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleSuccess = (data: BrokerageCalculateResponse) => {
        if (onCalculationComplete) {
            onCalculationComplete(data);
        }
    };

    return (
        <>
            <Button
                onClick={() => setDialogOpen(true)}
                className={className}
                variant={variant}
            >
                <Calendar className="mr-2 h-4 w-4" />
                {" "}
                Calculate Brokerage
            </Button>

            <CalculateBrokerageDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={handleSuccess}
            />
        </>
    );
}
