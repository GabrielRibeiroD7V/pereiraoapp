// @vitest-environment node
import { spawnSync } from "node:child_process";
import { it, expect } from "vitest";
it("inicializa a API em Node ESM real sem depender do bundler do frontend", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      "const {default:api}=await import('./api/admin.ts');const response=await api.fetch(new Request('https://preview.example/api/admin'));if(response.status!==405)throw Error('Unexpected status');console.log(await response.text());",
    ],
    { cwd: process.cwd(), env: {}, encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ code: "METHOD_NOT_ALLOWED" });
});
