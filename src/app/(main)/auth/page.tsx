"use client"
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { LoginField, loginSchema } from '@/types/auth.types'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FormProvider, useForm } from 'react-hook-form'

const Auth: React.FC = () => {
    const form = useForm<LoginField>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
        mode: "onSubmit",
    });

    const onSubmit = (data: LoginField) => {
        console.log(data)
    };


    return (
        <div className=' grid grid-cols-2 h-screen w-screen items-center justify-center p-5'>
            <div className='flex flex-col w-full h-full bg-gradient-to-tr from-[#E0FFE5] to-[#E0EAFF] rounded-lg'>
                <div className="z-10 h-fit">
                    <h1 className="text-3xl md:text-2xl lg:text-5xl pt-10 ps-10 font-semibold leading-tight">
                        Secure Access to Smarter Investments.
                    </h1>
                    <div className="flex gap-2 items-start md:gap-4 pe-10 justify-end">
                        <p className='text-2xl font-stretch-semi-condensed'>———</p>
                        <p className="font-medium tracking-tight text-2xl">
                            Invest with purpose.<br />Access with confidence.
                        </p>
                    </div>
                </div>
                <div className="relative w-full h-full">
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-10">
                        <Image src="/auth_girl.png" alt="auth" width={200} height={200} className='w-90 h-100' />
                    </div>

                    <div className='absolute left-0 top-0 w-fit h-fit '>
                        <Image src="/auth_finance_planning.png" alt="auth" width={200} height={200} className='w-75 h-80' />
                    </div>

                    <div className='absolute right-0 bottom-0 w-fit'>
                        <Image src="/auth_chart.png" alt="auth" width={200} height={200} className='w-70 h-53' />
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-5">
                <div className="flex items-center justify-between w-full mb-13">
                    {/* <Logo /> */}
                </div>

                <div className='flex flex-col justify-start gap-5'>
                    <h3 className="font-medium text-start md:text-xl lg:text-3xl w-full">
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
                                            <Input {...field} type="email" placeholder="johndoe@gmail.com" className="w-100" />
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
                                            <Input {...field} type="password" placeholder="******" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="bg-primary hover:bg-primary/95 w-full mt-3">
                                Sign in
                            </Button>

                        </form>
                    </FormProvider>
                </div>

            </div>

        </div>
    )
}

export default Auth
