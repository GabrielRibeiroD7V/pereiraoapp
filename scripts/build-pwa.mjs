import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export async function buildPwa(directory = resolve("dist")) {
  const staticFiles = [
    "offline.html",
    "pwa/offline.css",
    "pwa/offline-retry.js",
    "images/brand/pereirao-384.png",
    "images/pwa/icon-192.png",
    "images/pwa/icon-512.png",
    "images/pwa/maskable-512.png",
    "images/pwa/apple-touch-icon.png",
  ];
  const built = await readdir(resolve(directory, "assets"));
  staticFiles.push(
    ...built
      .filter((name) => /^[a-zA-Z0-9_-]+\.(?:js|css|woff2)$/.test(name))
      .map((name) => "assets/" + name),
  );
  staticFiles.sort();
  const template = await readFile(
    new URL("../src/pwa/service-worker.js", import.meta.url),
    "utf8",
  );
  const hash = createHash("sha256")
    .update(template)
    .update(await readFile(resolve(directory, "manifest.webmanifest")));
  for (const file of staticFiles)
    hash.update(file).update(await readFile(resolve(directory, file)));
  const version = hash.digest("hex").slice(0, 20);
  const worker = template
    .replace("__PWA_VERSION__", version)
    .replace(
      "__STATIC_ASSETS__",
      JSON.stringify(staticFiles.map((file) => "/" + file)),
    );
  await writeFile(resolve(directory, "sw.js"), worker);
  return { version, assets: staticFiles.length };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log("PEREIRAO_PWA_BUILD " + JSON.stringify(await buildPwa()));
