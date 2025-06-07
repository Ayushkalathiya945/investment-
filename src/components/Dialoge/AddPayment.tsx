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
import { AddClient, AddClientField, addClientSchema } from "@/types/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";

interface AddPaymentProps {
    data?: AddClient;
    name?: string;
}

const AddOrder: React.FC<AddPaymentProps> = ({
    data,
    name,
}) => {

    const addClientForm = useForm<AddClientField>({
        defaultValues: {
            name: "",
            panNo: "",
            mobileNo: "",
            email: "",
            address: "",
        },
        resolver: zodResolver(addClientSchema),
        mode: "onSubmit",
    });

    // const onSubmit = async (data: AddClientField) => {
    //     console.log(data);
    // };

    // useEffect(() => {
    //     if (data) {
    //         addClientForm.setValue("name", data.name ?? undefined);
    //         addClientForm.setValue("panNo", data.panNo ?? undefined);
    //         addClientForm.setValue("mobileNo", data.mobileNo ?? undefined);
    //         addClientForm.setValue("email", data.email ?? undefined);
    //         addClientForm.setValue("address", data.address || "");
    //     }
    // }, [data]);

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
                    <Form {...addClientForm}>
                        <form className="flex flex-col gap-4 w-full">

                                <FormField
                                    control={addClientForm.control}
                                    name="name"
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
                                    control={addClientForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="Date"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={addClientForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="Amount"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={addClientForm.control}
                                    name="address"
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
                            // onClick={addClientForm.handleSubmit(onSubmit)}
                            disabled={addClientForm.formState.isSubmitting}
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
