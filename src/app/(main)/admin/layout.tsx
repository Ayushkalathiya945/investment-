"use client";

import { ChartLine, ChartNoAxesCombined, CreditCard, LogOut, Menu, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import AuthGuard from "@/components/AuthGuard";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BROKERAGE, CLIENT, PAYMENT_HISTORY, TRADE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <AdminLayoutContent children={children} />
        </AuthGuard>
    );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const [isLoggedOut, setIsLoggedOut] = useState<boolean>(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const navigation = [
        { name: "Client", href: CLIENT, icon: Users },
        { name: "Trade", href: TRADE, icon: ChartNoAxesCombined },
        { name: "Fees", href: BROKERAGE, icon: ChartLine },
        { name: "Payment History", href: PAYMENT_HISTORY, icon: CreditCard },
    ];

    const logout = async () => {
        try {
            // Clear local storage
            localStorage.removeItem("token");
            localStorage.removeItem("user");

            // Redirect to login page
            router.push("/auth");
        } catch (error) {
            console.error("Logout error:", error);
        }
        setIsLoggedOut(false);
    };

    return (
        <div className="min-h-screen bg-white font-dmsans">
            <div className="flex h-screen">
                {/* Mobile sidebar */}
                <div
                    className={cn(
                        "fixed inset-0 z-11 transition-transform duration-300 h-screen lg:hidden",
                        sidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
                    )}
                    onClick={() => setSidebarOpen(false)}
                >
                    <div
                        className="w-64 bg-white h-full shadow-md"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center px-4 pt-5">
                            <Logo width={100} height={50} />
                            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                                <X className="text-black" />
                            </Button>
                        </div>

                        <nav className="mt-6 px-4 space-y-2">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setSidebarOpen(false)}
                                        className={cn(
                                            "group flex items-center px-4 py-3 rounded-sm text-sm font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-primary text-white shadow-sm"
                                                : "hover:text-primary",
                                        )}
                                    >
                                        <item.icon className="mr-3 h-5 w-5" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="flex px-6 space-y-2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setIsLoggedOut(true);
                                    setSidebarOpen(false);
                                }}
                                className="w-full justify-start hover:text-[#002D65] mt-2  rounded-[3px]"
                            >
                                <LogOut className="mr-1 h-5 w-5" />
                                Log Out
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Desktop sidebar */}
                <div className="hidden lg:flex lg:flex-shrink-0 m-5 ">
                    <div className="flex flex-col w-64 bg-secondary rounded-2xl">
                        <Link href="/" className="flex items-center justify-start w-full py-5 px-5 ">
                            <Logo width={150} />
                        </Link>
                        <div className="flex flex-col flex-grow px-4">
                            <nav className="flex-1 space-y-2 mt-2">
                                {navigation.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={cn(
                                                "group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200",
                                                isActive
                                                    ? "bg-primary text-white shadow-lg"
                                                    : "hover:text-primary hover:bg-white/40",
                                            )}
                                        >
                                            <item.icon className="mr-3 h-5 w-5" />
                                            <span
                                                className={cn(
                                                    "transition-transform duration-300 group-hover:translate-x-2",
                                                    isActive ? "translate-x-0" : "group-hover:translate-x-2",
                                                )}
                                            >
                                                {item.name}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="mt-auto space-y-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsLoggedOut(true)}
                                    className="w-full justify-start hover:text-[#002D65] rounded-[3px] hover:bg-white/40 mb-6"
                                >
                                    <LogOut className="mr-3 h-5 w-5" />
                                    Log Out
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    <div className="p-3 lg:hidden flex items-center bg-white shadow-md justify-between">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                            <Menu className="h-6 w-6 text-[#002D65]" />
                        </Button>
                        <div className="flex-grow flex justify-center h-fit">
                            <Logo width={100} height={30} />
                        </div>
                        <div className="w-10" />
                    </div>

                    <main className="relative flex-1 overflow-y-auto focus:outline-none m-3 md:m-5 lg:my-5 lg:me-5 lg:ms-0 rounded-[10px]">
                        <div className="">
                            {children}
                        </div>
                    </main>
                </div>
            </div>

            {/* Logout Confirmation Dialog */}
            <Dialog
                open={isLoggedOut}
                onOpenChange={setIsLoggedOut}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Are you sure you want to log out?</DialogTitle>
                        <DialogDescription>
                            You will be logged out of your account.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 flex-row justify-end">
                        <Button variant="outline" onClick={() => setIsLoggedOut(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"

                            onClick={() => {
                                logout();
                            }}
                        >
                            Log Out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
