import { createAdminHandler } from "../server/admin-handler.ts";
export default { fetch: createAdminHandler(process.env) };
