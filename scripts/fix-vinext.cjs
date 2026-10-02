// Patch vinext to fix Windows/directory-with-spaces bug in app-dev-server.js
const fs = require("fs");
const path = require("path");

const targetFile = path.resolve(__dirname, "../node_modules/vinext/dist/server/app-dev-server.js");

if (!fs.existsSync(targetFile)) {
  process.exit(0);
}

let content = fs.readFileSync(targetFile, "utf8");

let modified = false;

// 1. Ensure fileURLToPath is imported
if (!content.includes('import { fileURLToPath } from "node:url";')) {
  content = content.replace('import fs from "node:fs";', 'import fs from "node:fs";\nimport { fileURLToPath } from "node:url";');
  modified = true;
}

// 2. Fix pathname bug
const bugPattern = 'new URL("./metadata-routes.js", import.meta.url).pathname.replace(/\\\\/g, "/")';
const fixPattern = 'fileURLToPath(new URL("./metadata-routes.js", import.meta.url)).replace(/\\\\/g, "/")';

if (content.includes(bugPattern)) {
  content = content.replaceAll(bugPattern, fixPattern);
  modified = true;
}

if (modified) {
  fs.writeFileSync(targetFile, content, "utf8");
  console.log("[fix-vinext] Successfully patched vinext for Windows path handling.");
}
