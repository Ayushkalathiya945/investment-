"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import React from "react";
import { useForm } from "react-hook-form";

import type { AddTradeField } from "@/types/trade";

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
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TYPE } from "@/lib/constants";
import { addTradeSchema } from "@/types/trade";

import DatePicker from "../ui/datePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type AddTradeProps = {
    name?: string;
};

const AddTrade: React.FC<AddTradeProps> = ({
    name,
}) => {
    const addTradeForm = useForm<AddTradeField>({
        defaultValues: {
            client: "",
            trade: "",
            stock: "",
            quantity: "",
            date: "",
            pricePerShare: 0,
        },
        resolver: zodResolver(addTradeSchema),
        mode: "onSubmit",
    });

    const onSubmit = async (data: AddTradeField) => {
        console.log(data);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="ml-auto bg-primary px-5 md:px-8 rounded-xl">
                    +
                    <span className="hidden md:flex">{name}</span>
                </Button>
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
                            <div className="flex flex-col md:flex-row w-full gap-4 items-center">
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

                                <div className="w-full px-1">
                                    <FormField
                                        control={addTradeForm.control}
                                        name="trade"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                        <SelectTrigger className="w-full ring-0 bg-secondary border-none rounded-lg h-11">
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

                            <div className="flex flex-col md:flex-row w-full gap-4 items-center">
                                <div className="w-full px-1">
                                    <FormField
                                        control={addTradeForm.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <DatePicker
                                                        placeholder="Date"
                                                        className="w-full bg-secondary hover:bg-secondary h-11"
                                                        selected={field.value ? new Date(field.value) : undefined}
                                                        onSelect={(date) => {
                                                            if (date) {
                                                                field.onChange(date.toISOString());
                                                            }
                                                        }}
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
                                        name="pricePerShare"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Price Per Share"
                                                        {...field ?? undefined}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                            </div>

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
