"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { LoginField } from "@/types/auth.types";

import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/types/auth.types";
import { useRouter } from "next/navigation";

const Auth: React.FC = () => {
    const router = useRouter();
    const form = useForm<LoginField>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
        mode: "onSubmit",
    });

    const onSubmit = (data: LoginField) => {
        console.log(data);
        form.reset();
        router.push("/admin/client");
    };

    return (
        <div className=" grid grid-cols-1 lg:grid-cols-2 h-screen w-screen items-center justify-center p-2 md:p-5">
            <div className="hidden lg:flex flex-col w-full h-full bg-gradient-to-tr from-[#E0FFE5] to-[#E0EAFF] rounded-lg">
                <div className="z-10 h-fit">
                    <h1 className="text-3xl md:text-2xl lg:text-5xl pt-10 ps-10 font-semibold leading-tight">
                        Secure Access to Smarter Investments.
                    </h1>
                    <div className="flex gap-2 items-start md:gap-4 pe-10 justify-end">
                        <p className="text-2xl font-stretch-semi-condensed">———</p>
                        <p className="font-medium tracking-tight text-2xl">
                            Invest with purpose.
                            <br />
                            Access with confidence.
                        </p>
                    </div>
                </div>
                <div className="relative w-full h-full">
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-10">
                        <Image src="/auth_girl.png" alt="auth" width={200} height={200} className="w-90 h-100" />
                    </div>

                    <div className="absolute left-0 top-0 w-fit h-fit ">
                        <Image src="/auth_finance_planning.png" alt="auth" width={200} height={200} className="w-75 h-80" />
                    </div>

                    <div className="absolute right-0 bottom-0 w-fit">
                        <Image src="/auth_chart.png" alt="auth" width={200} height={200} className="w-70 h-53" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center w-full h-full justify-center gap-5 bg-gradient-to-tr from-[#E0FFE5] to-[#E0EAFF] lg:bg-none lg:from-none lg:to-none rounded-lg lg:rounded-none">
                <div className="flex flex-col justify-center gap-5 w-full px-3 md:px-30">
                    <div className="flex items-center justify-between w-full mb-13">
                        <Logo />
                    </div>
                    <h3 className="font-medium text-start text-xl lg:text-3xl w-full">
                        Welcome to InvestaSure
                    </h3>
                    <p className="text-gray-600 text-sm sm:text-base text-start">Login to your account</p>
                    <FormProvider {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input {...field} type="email" placeholder="johndoe@gmail.com" className="bg-white lg:bg-secondary text-sm w-full" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input {...field} type="password" placeholder="******" className="bg-white lg:bg-secondary text-sm w-full" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="bg-primary hover:bg-primary/95 w-full mt-3">
                                Login
                            </Button>

                        </form>
                    </FormProvider>
                </div>
            </div>

        </div>
    );
};

export default Auth;
