import { z } from "zod";

export const addClientSchema = z.object({
    name: z.string().optional(),
    panNo: z.string().optional(),
    mobileNo: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string(),
});

export type AddClientField = z.infer<typeof addClientSchema>;

export type AddClient = {
    id?: string;
    name?: string;
    panNo?: string;
    mobileNo?: string;
    email?: string;
    address?: string;
};
