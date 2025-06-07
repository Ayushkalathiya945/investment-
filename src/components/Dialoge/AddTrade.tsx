"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddTradeField, addTradeSchema } from "@/types/trade";
import type { AddTrade } from "@/types/trade";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";

interface AddTradeProps {
    data?: AddTrade;
    name?: string;
}

const AddTrade: React.FC<AddTradeProps> = ({
    data,
    name,
}) => {

    const addTradeForm = useForm<AddTradeField>({
        defaultValues: {
            client: "",
            trade: "",
            stock: "",
            quantity: "",
            pricePerShare: "",
        },
        resolver: zodResolver(addTradeSchema),
        mode: "onSubmit",   
    });

    const onSubmit = async (data: AddTradeField) => {
        console.log(data);
    };

    useEffect(() => {
        if (data) {
            addTradeForm.setValue("client", data.client ?? undefined);
            addTradeForm.setValue("trade", data.trade ?? undefined);
            addTradeForm.setValue("stock", data.stock ?? undefined);
            addTradeForm.setValue("quantity", data.quantity ?? undefined);
            addTradeForm.setValue("pricePerShare", data.pricePerShare || "");
        }
    }, [data]);

    return (
            <Dialog>
                <DialogTrigger asChild>
                    <Button className="ml-auto bg-primary px-8 rounded-xl">{name}</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl min-w-[300px] p-6">

                    <DialogHeader>
                        <DialogTitle className="text-xl font-medium">
                            Add Trade
                        </DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[calc(100vh-220px)] overflow-y-scroll">
                        <Form {...addTradeForm}>
                            <form className="flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row w-full gap-4">
                                    <div className="w-full">
                                        <FormField
                                            control={addTradeForm.control}
                                            name="client"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Client Name"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="w-full">
                                        <FormField
                                            control={addTradeForm.control}
                                            name="trade"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Trade Type"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row w-full gap-4">
                                    <div className="w-full">
                                        <FormField
                                            control={addTradeForm.control}
                                            name="stock"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Stock"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="w-full">
                                        <FormField
                                            control={addTradeForm.control}
                                            name="quantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Quantity"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <FormField
                                    control={addTradeForm.control}
                                    name="pricePerShare"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Price Per Share"
                                                    {...field ?? undefined}
                                                    className="border-none ring-0 focus:ring-0 focus:ring-offset-0"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                            </form>
                        </Form>
                    </div>
                    <DialogFooter className="">
                        <div className="w-full flex items-center justify-end">
                            <Button
                                type="button"
                                className="bg-primary text-sm px-8 rounded-xl"
                                onClick={addTradeForm.handleSubmit(onSubmit)}
                                disabled={addTradeForm.formState.isSubmitting}
                            >
                                Save
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    );
};

export default AddTrade;
