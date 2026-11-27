import fs from "node:fs";
import path from "node:path";

const routes = [
  "/", "/action/", "/blind/", "/sos/", "/medicine/", "/devices/",
  "/admin/", "/diagnostics/", "/documentation/", "/account/",
  "/help/", "/privacy/", "/terms/", "/support/", "/contact/",
  "/sos-receiver/"
];
const missing = [];
for (const route of routes) {
  const slug = route.replace(/^\/+|\/+$/g, "");
  const file = slug ? path.join("web", slug, "index.html") : path.join("web", "index.html");
  if (!fs.existsSync(file)) missing.push(`${route} -> ${file}`);
}
if (missing.length) {
  console.error("Route smoke check failed:\n" + missing.map(item => "- " + item).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Route smoke check OK — ${routes.length} canonical/compatibility routes exist.`);
}
