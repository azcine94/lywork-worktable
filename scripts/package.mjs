import assert from "node:assert/strict";
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, "release");
const assetName = "lywork-worktable.lywork-plugin";

const crcTable = Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
	return value >>> 0;
});

function crc32(buffer) {
	let value = 0xffffffff;
	for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
	return (value ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries) {
	const localParts = [];
	const centralParts = [];
	let offset = 0;
	for (const [name, data] of entries) {
		const nameBytes = Buffer.from(name);
		const checksum = crc32(data);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt32LE(checksum, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBytes.length, 26);
		localParts.push(local, nameBytes, data);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt32LE(checksum, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBytes.length, 28);
		central.writeUInt32LE(offset, 42);
		centralParts.push(central, nameBytes);
		offset += local.length + nameBytes.length + data.length;
	}
	const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralSize, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...localParts, ...centralParts, end]);
}

await import(`file://${join(root, "scripts", "verify.mjs").replaceAll("\\", "/")}`);
const update = JSON.parse(await readFile(join(root, "update.json"), "utf8"));
const included = ["plugin.json", "dist/core.js", "dist/index.js", "dist/styles.css", "LICENSE"];
const entries = await Promise.all(included.map(async (name) => [name, await readFile(join(root, ...name.split("/")))]));
const manifest = JSON.parse(entries[0][1].toString("utf8"));
if (process.env.GITHUB_REF_TYPE === "tag") {
	assert.equal(process.env.GITHUB_REF_NAME, `v${manifest.version}`, "release tag must match plugin version");
}
const archive = createStoredZip(entries);
const digest = createHash("sha256").update(archive).digest("hex");
const manifestDigest = createHash("sha256").update(entries[0][1]).digest("hex");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await writeFile(join(outputRoot, assetName), archive);
await writeFile(join(outputRoot, `${assetName}.sha256`), `${digest}  ${assetName}\n`, "utf8");

if (process.argv.includes("--sign")) {
	const encodedKey = process.env.WORKTABLE_SIGNING_PRIVATE_KEY_PEM;
	assert.ok(encodedKey, "WORKTABLE_SIGNING_PRIVATE_KEY_PEM is required for a signed release");
	const privateKey = createPrivateKey(encodedKey.replaceAll("\\n", "\n"));
	const actualPublicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).trim();
	assert.equal(actualPublicKey, update.publicKeyPem.trim(), "release signing key does not match update.json");
	const signature = sign(null, Buffer.from(digest, "utf8"), privateKey).toString("base64");
	await writeFile(join(outputRoot, `${assetName}.sig`), `${signature}\n`, "utf8");
}

await writeFile(join(outputRoot, "release.json"), `${JSON.stringify({
	pluginId: "worktable",
	version: manifest.version,
	asset: assetName,
	sha256: digest,
	manifestSha256: manifestDigest,
	signed: process.argv.includes("--sign"),
}, null, 2)}\n`, "utf8");
console.log(`Created ${assetName} (${digest}).`);
