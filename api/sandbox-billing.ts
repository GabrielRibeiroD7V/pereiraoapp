import { createSandboxBillingHandler } from "../server/sandbox-handlers.ts";
export default { fetch: createSandboxBillingHandler(process.env) };
