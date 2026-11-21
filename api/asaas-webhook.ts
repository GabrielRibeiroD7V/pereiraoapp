import { waitUntil } from "@vercel/functions";
import { createSandboxWebhookHandler } from "../server/sandbox-handlers.ts";
export default { fetch: createSandboxWebhookHandler(process.env, waitUntil) };
