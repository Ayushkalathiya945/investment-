"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";

import type { LoginField } from "@/types/auth.types";

import { Adminlogin, checkAuth } from "@/api/auth";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/types/auth.types";

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

    // login mutation
    const { mutateAsync: loginMutation } = useMutation({
        mutationFn: Adminlogin,
    });

    const onSubmit = async (data: LoginField) => {
        try {
            const result = await toast.promise(
                loginMutation(data), // mutation promise
                {
                    loading: "Signing in...",
                    success: "Login successful!",
                    error: "Login failed. Please try again.",
                },
            );

            if (result.token) {
                localStorage.setItem("token", `Bearer ${result.token}`);
                localStorage.setItem("user", JSON.stringify(result.admin));
                router.push("/admin/client");
            } else {
                toast.error("Invalid login response"); // fallback if no token returned
            }
        } catch (err) {
            console.error("Login error:", err);
            toast.error("Login failed. Please check your credentials and try again.");
        }
    };

    // State to track loading during authentication check
    const [isAuthChecking, setIsAuthChecking] = useState(true);

    // Check if user is already logged in and verify token
    useEffect(() => {
        async function verifyAuthentication() {
            try {
                setIsAuthChecking(true);

                const isAuthenticated = await checkAuth();

                if (isAuthenticated) {
                    router.push("/admin/client");
                }
            } catch (error) {
                console.error("Authentication verification failed:", error);
                if (typeof window !== "undefined") {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                }
            } finally {
                setIsAuthChecking(false);
            }
        }

        if (typeof window !== "undefined") {
            verifyAuthentication();
        } else {
            // Use a timeout to avoid direct setState in useEffect
            const timer = setTimeout(() => {
                setIsAuthChecking(false);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [router]);

    // Show loading state during authentication check
    if (isAuthChecking) {
        return (
            <div className="h-screen w-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

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
