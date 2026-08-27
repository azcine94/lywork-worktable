import assert from "node:assert/strict";
import { createPublicKey } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(root, "plugin.json"), "utf8"));
const update = JSON.parse(await readFile(join(root, "update.json"), "utf8"));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

assert.equal(manifest.id, "worktable");
assert.equal(manifest.version, packageJson.version, "plugin.json and package.json versions must match");
assert.equal(manifest.apiVersion, "1");
assert.equal(update.schemaVersion, 1);
assert.equal(update.packageAsset, "lywork-worktable.lywork-plugin");
assert.equal(update.sha256Asset, `${update.packageAsset}.sha256`);
assert.equal(update.signatureAsset, `${update.packageAsset}.sig`);
assert.match(update.publicKeyPem, /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/);
assert.equal(createPublicKey(update.publicKeyPem).asymmetricKeyType, "ed25519", "update key must be Ed25519");

for (const relativePath of [manifest.entry, manifest.style, "LICENSE"]) {
	assert.equal((await stat(join(root, ...relativePath.split("/")))).isFile(), true, `${relativePath} must be a file`);
}

await import(`file://${join(root, manifest.entry).replaceAll("\\", "/")}`);
console.log(`Verified LYWork Worktable ${manifest.version}.`);
