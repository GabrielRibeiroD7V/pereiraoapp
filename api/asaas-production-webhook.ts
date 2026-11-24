import { waitUntil } from "@vercel/functions";
import { createProductionWebhook } from "../server/production-billing-handlers.ts";
export default { fetch: createProductionWebhook(process.env, waitUntil) };
