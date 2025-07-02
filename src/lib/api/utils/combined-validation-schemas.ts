import { z } from "zod";

// Combined schema for both BSE and NSE files
export const combinedStocksFormSchema = z.object({
    bse: z.instanceof(File).refine(file => file.size > 0, { message: "BSE file is required" }).optional(),
    nse: z.instanceof(File).refine(file => file.size > 0, { message: "NSE file is required" }).optional(),
}).refine(data => data.bse || data.nse, {
    message: "At least one file (BSE or NSE) is required",
});
