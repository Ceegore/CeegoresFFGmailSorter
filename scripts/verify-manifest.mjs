import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const allowedPermissions = new Set(["storage"]);
const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
if (manifest.version !== packageJson.version) fail("manifest and package versions differ");
if (!Array.isArray(manifest.permissions)) fail("permissions must be an array");
for (const permission of manifest.permissions ?? []) {
  if (!allowedPermissions.has(permission)) fail(`Unexpected permission: ${permission}`);
}
if (!manifest.permissions?.includes("storage")) fail("storage permission is required");
const cs = manifest.content_scripts?.[0];
if (!cs) fail("content_scripts must have at least one entry");
if (!cs.matches?.includes("https://mail.google.com/*")) fail("content_scripts must match Gmail");
if (!cs.js?.includes("content.js")) fail("content_scripts must include content.js");
if (cs.run_at !== "document_idle") fail("content_scripts run_at must be document_idle");
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(["https://mail.google.com/*"]))
  fail("host_permissions must be exactly Gmail");
if (manifest.incognito !== "not_allowed") fail("incognito must be not_allowed");
if (manifest.browser_specific_settings?.gecko?.id !== "{a3f84f1e-3947-4fe6-8d31-6d5deff1ae71}")
  fail("stable Gecko ID mismatch");
if (manifest.browser_specific_settings?.gecko?.strict_min_version !== "142.0")
  fail("strict_min_version must be 142.0");
const dataPermissions = manifest.browser_specific_settings?.gecko?.data_collection_permissions;
if (JSON.stringify(dataPermissions?.required) !== JSON.stringify(["none"]))
  fail('data_collection_permissions.required must be ["none"] pending PRIV-AMO-01');
if (JSON.stringify(manifest.background?.scripts) !== JSON.stringify(["background.js"]))
  fail("background.scripts must be exactly background.js");
if (manifest.background?.service_worker) fail("Firefox-only V1 must not declare service_worker");
if (manifest.update_url) fail("update_url is forbidden for AMO release");
if (manifest.content_security_policy?.extension_pages?.includes("unsafe-eval"))
  fail("unsafe-eval is forbidden");
// GATE-002: tighten the manifest contract.
if (manifest.optional_permissions && manifest.optional_permissions.length > 0)
  fail("optional_permissions must be empty");
if (manifest.externally_connectable) fail("externally_connectable is forbidden");
if (manifest.web_accessible_resources) fail("web_accessible_resources is forbidden");
if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 1)
  fail("content_scripts must have exactly one entry");
if (process.exitCode) process.exit(process.exitCode);
console.log("Manifest contract verified.");
