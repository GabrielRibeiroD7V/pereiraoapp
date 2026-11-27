import { createOneoffHandler } from "../server/oneoff-billing.ts";
export default {fetch:createOneoffHandler(process.env)};
