// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it.each(["sandbox-billing", "asaas-webhook"])(
  "inicializa %s em Node ESM e falha fechado sem configuração",
  (name) => {
    const code = `const {default:api}=await import('./api/${name}.ts');const response=await api.fetch(new Request('https://preview.example/api/${name}',{method:'POST'}));if(response.status!==403)throw Error('Unexpected status');console.log(await response.text());`;
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", code],
      { cwd: process.cwd(), env: {}, encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ code: "SANDBOX_DISABLED" });
  },
);
it("mantém checagem estrita de APIs e servidor no build principal antes do empacotamento", () => {
  const config = JSON.parse(readFileSync("tsconfig.json", "utf8")),
    pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(config.include).toEqual(expect.arrayContaining(["api", "server"]));
  expect(config.compilerOptions.strict).toBe(true);
  expect(config.compilerOptions.noCheck).not.toBe(true);
  expect(pkg.scripts.build).toMatch(/^tsc --noEmit &&/);
  expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
});
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

it.each(['asaas-production-webhook','production-billing-recovery'])('Production %s inicializa sem segredo e falha fechado',name=>{
 const code=`const {default:api}=await import('./api/${name}.ts');const response=await api.fetch(new Request('https://pereirao.vercel.app/api/${name}',{method:'POST'}));if(response.status!==403)throw Error('Unexpected status');console.log(await response.text());`;
 const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{cwd:process.cwd(),env:{},encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);expect(JSON.parse(result.stdout)).toEqual({code:'DISABLED'});
});

it.each(['admin-oneoff-billing','asaas-admin-oneoff-webhook'])('Oneoff %s initializes without provisioning or activation',name=>{
 const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`const {default:api}=await import('./api/${name}.ts');const r=await api.fetch(new Request('https://preview.example/api/${name}'));if(r.status!==405)throw Error('Unexpected status');`],{cwd:process.cwd(),encoding:'utf8',env:{...process.env}});
 expect(result.status,result.stderr).toBe(0);
});

it('oneoff API routes precede the SPA fallback',()=>{
 const v=JSON.parse(readFileSync('vercel.json','utf8'));
 for(const name of ['admin-oneoff-billing','asaas-admin-oneoff-webhook']){
  const route=v.rewrites.findIndex((r:{source:string})=>r.source==='/api/'+name);
  expect(route).toBeGreaterThanOrEqual(0);expect(route).toBeLessThan(v.rewrites.findIndex((r:{source:string})=>r.source==='/(.*)'));
  expect(v.rewrites[route].destination).toBe('/api/'+name);
 }
});
