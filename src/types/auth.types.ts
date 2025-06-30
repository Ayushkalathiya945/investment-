import { z } from "zod";

/* <----- Login Schema -----> */
export const loginSchema = z.object({
    email: z.string().email().nonempty("Email is required"),
    password: z.string().nonempty("Password is required"),
});
export type LoginField = z.infer<typeof loginSchema>;

export type AdminLogin = {
    email: string;
    password: string;
};

export type LoginResponse = {
    success: boolean;
    message: string;
    data: {
        token: string;
        admin: {
            id: number;
            email: string;
        };
    };
};

export type LoginData = LoginResponse["data"];

/* <----- Token Verification Schema -----> */
export const verifyTokenSchema = z.object({
    token: z.string().nonempty("Token is required"),
});

export type VerifyTokenRequest = {
    token: string;
};

export type VerifyTokenResponse = {
    success: boolean;
    message: string;
    data?: {
        admin: {
            id: number;
            email: string;
        };
        tokenExpiry: string;
    };
    error?: string;
};

export type VerifyTokenData = VerifyTokenResponse["data"];
