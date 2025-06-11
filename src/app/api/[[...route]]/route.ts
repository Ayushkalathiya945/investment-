import { handle } from "hono/vercel";

import api from "@/api";

// This is the handler for all API routes
// It catches all requests to /api/* and forwards them to the Hono app
export const GET = handle(api);
export const POST = handle(api);
export const PUT = handle(api);
export const DELETE = handle(api);
export const PATCH = handle(api);
export const OPTIONS = handle(api);

// Add runtime config for Edge compatibility
export const runtime = "nodejs";
