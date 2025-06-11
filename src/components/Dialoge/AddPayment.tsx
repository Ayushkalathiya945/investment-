"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import React from "react";
import { useForm } from "react-hook-form";

import type { AddPaymentField } from "@/types/payment";

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
import { Textarea } from "@/components/ui/textarea";
import { addPaymentSchema } from "@/types/payment";

import DatePicker from "../ui/datePicker";

type AddPaymentProps = {
    name?: string;
};

const AddOrder: React.FC<AddPaymentProps> = ({
    name,
}) => {
    const addPaymentForm = useForm<AddPaymentField>({
        defaultValues: {
            client: "",
            date: "",
            amount: 0,
            description: "",
        },
        resolver: zodResolver(addPaymentSchema),
        mode: "onSubmit",
    });

    const onSubmit = async (data: AddPaymentField) => {
        console.log(data);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="ml-auto bg-primary px-8 rounded-xl">{name}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm min-w-[150px] p-6">

                <DialogHeader>
                    <DialogTitle className="text-xl font-medium">
                        Add payment
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[calc(100vh-220px)] overflow-y-scroll">
                    <Form {...addPaymentForm}>
                        <form className="flex flex-col gap-4 w-full">

                            <FormField
                                control={addPaymentForm.control}
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

                            <FormField
                                control={addPaymentForm.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <DatePicker
                                                placeholder="Date"
                                                className="w-full bg-secondary hover:bg-secondary h-11"
                                                selected={field.value ? new Date(field.value) : undefined}
                                                onSelect={date => field.onChange(date?.toISOString() ?? "")}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={addPaymentForm.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={addPaymentForm.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Description"
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
                            onClick={addPaymentForm.handleSubmit(onSubmit)}
                            disabled={addPaymentForm.formState.isSubmitting}
                        >
                            Save
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddOrder;
