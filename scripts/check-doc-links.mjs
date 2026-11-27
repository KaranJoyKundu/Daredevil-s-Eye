import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".next", ".vercel", "android/.gradle"]);
const failures = [];
const markdownFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(root, full).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name) && !relative.startsWith("android/.gradle")) walk(full);
    } else if (entry.isFile() && relative.toLowerCase().endsWith(".md")) {
      markdownFiles.push(full);
    }
  }
}

function slugHeading(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\`([^\`]*)\`/g, "$1")
    .replace(/\*\*|__|\*|_|~~/g, "")
    .replace(/&amp;/g, "&")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-")
    .replace(/-+/g, "-");
}

function headingIds(content) {
  const ids = new Set();
  const counts = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!match) continue;
    const base = slugHeading(match[1]);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    ids.add(count ? `${base}-${count}` : base);
  }
  return ids;
}

function resolveTarget(sourceFile, rawTarget) {
  let target = rawTarget.trim().replace(/^<|>$/g, "");
  if (!target || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(target)) return null;
  if (target.startsWith("//")) return null;

  const hashIndex = target.indexOf("#");
  const fragment = hashIndex >= 0 ? decodeURIComponent(target.slice(hashIndex + 1)) : "";
  let pathname = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  pathname = pathname.split("?")[0];
  if (!pathname) return { file: sourceFile, fragment };
  try { pathname = decodeURIComponent(pathname); } catch { /* Keep the original path for a useful error. */ }

  let resolved;
  if (pathname.startsWith("/")) {
    const route = pathname.replace(/^\/+|\/+$/g, "");
    if (!route) resolved = path.join(root, "web", "index.html");
    else {
      const candidates = [
        path.join(root, "web", route, "index.html"),
        path.join(root, "web", route),
        path.join(root, route)
      ];
      resolved = candidates.find(candidate => fs.existsSync(candidate)) ?? candidates[0];
    }
  } else {
    resolved = path.resolve(path.dirname(sourceFile), pathname);
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const candidates = [path.join(resolved, "README.md"), path.join(resolved, "index.md"), path.join(resolved, "index.html")];
    resolved = candidates.find(candidate => fs.existsSync(candidate)) ?? resolved;
  } else if (!path.extname(resolved) && !fs.existsSync(resolved)) {
    const candidates = [`${resolved}.md`, `${resolved}.html`, path.join(resolved, "README.md"), path.join(resolved, "index.html")];
    resolved = candidates.find(candidate => fs.existsSync(candidate)) ?? resolved;
  }
  return { file: resolved, fragment };
}

walk(root);
for (const file of markdownFiles) {
  const original = fs.readFileSync(file, "utf8");
  const content = original
    .replace(/^\`\`\`[\s\S]*?^\`\`\`\s*$/gm, "")
    .replace(/\`[^\`]*\`/g, "");
  const links = [...content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)];
  for (const match of links) {
    const raw = match[1].split(/\s+["']/)[0];
    const resolved = resolveTarget(file, raw);
    if (!resolved) continue;
    if (!fs.existsSync(resolved.file) || !fs.statSync(resolved.file).isFile()) {
      failures.push(`${path.relative(root, file)}: missing target ${raw}`);
      continue;
    }
    if (resolved.fragment && resolved.file.toLowerCase().endsWith(".md")) {
      const ids = headingIds(fs.readFileSync(resolved.file, "utf8"));
      if (!ids.has(slugHeading(resolved.fragment))) {
        failures.push(`${path.relative(root, file)}: missing heading #${resolved.fragment} in ${path.relative(root, resolved.file)}`);
      }
    }
  }
}

if (failures.length) {
  console.error(`Documentation link check failed with ${failures.length} issue(s):\n${failures.map(item => `- ${item}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation links OK — checked ${markdownFiles.length} Markdown files.`);
}
