import { z } from "zod";

/* <----- Login Schema -----> */
export const loginSchema = z.object({
    email: z.string().email().nonempty("Email is required"),
    password: z.string().nonempty("Password is required"),
});
export type LoginField = z.infer<typeof loginSchema>;
