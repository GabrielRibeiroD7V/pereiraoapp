import { waitUntil } from "@vercel/functions";
import { createOneoffWebhook } from "../server/oneoff-billing.ts";
export default {fetch:createOneoffWebhook(process.env,waitUntil)};
