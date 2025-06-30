/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z, ZodError } from "zod";

const EnvSchema = z.object({
    TURSO_DATABASE_URL: z.string().nonempty(),
    TURSO_AUTH_TOKEN: z.string().nonempty(),
    JWT_SECRET: z.string().nonempty(),
    ADMIN_PASSWORD: z.string().nonempty(),
    NEXT_PUBLIC_BACKEND_URL: z.string().url().nonempty().optional().or(z.undefined()),
});
export type EnvSchema = z.infer<typeof EnvSchema>;

expand(config());

try {
    EnvSchema.parse(process.env);
} catch (error) {
    if (error instanceof ZodError) {
        let message = "Missing required values in .env:\n";
        error.issues.forEach((issue) => {
            message += `${issue.path[0]}\n`;
        });
        const e = new Error(message);
        e.stack = "";
        throw e;
    } else {
        console.error(error);
    }
}

export default EnvSchema.parse(process.env);
