import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("plugin manifest and entry implement Workbench Plugin API v1", async () => {
  const manifest = JSON.parse(await readFile("plugin.json", "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "worktable");
  assert.equal(manifest.version, "0.6.0");
  assert.equal(manifest.apiVersion, "1");
  assert.equal(manifest.publisher, "LYWork");
  assert.equal(manifest.entry, "dist/index.js");
  assert.equal(manifest.style, "dist/styles.css");
  assert.equal(manifest.permissions.includes("files.read"), true);
  const plugin = await import(`../dist/index.js?test=${Date.now()}`);
  assert.equal(typeof plugin.activate, "function");
});

test("build output matches the plugin source", async () => {
  const [sourceCore, builtCore, sourceScript, builtScript, sourceStyles, builtStyles] = await Promise.all([
    readFile("src/core.js", "utf8"),
    readFile("dist/core.js", "utf8"),
    readFile("src/index.js", "utf8"),
    readFile("dist/index.js", "utf8"),
    readFile("src/styles.css", "utf8"),
    readFile("dist/styles.css", "utf8"),
  ]);
  assert.equal(builtCore, sourceCore);
  assert.equal(builtScript, sourceScript);
  assert.equal(builtStyles, sourceStyles);
});

test("user apps preserve interaction while authenticating artifact bridge messages", async () => {
  const source = await readFile("src/index.js", "utf8");
  assert.doesNotMatch(source, /setAttribute\("sandbox"/);
  assert.match(source, /frames\.get\(event\.source\)/);
  assert.match(source, /request\.nonce !== artifact\.nonce/);
  assert.match(source, /frame\.setAttribute\("referrerpolicy", "no-referrer"\)/);
});
