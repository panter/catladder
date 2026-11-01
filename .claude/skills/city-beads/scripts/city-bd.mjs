#!/usr/bin/env node
// No dependencies, Node >= 18. Config (later wins): ../config.json next to this script ({"url", "rig"}),
// then CITY_BD_URL / CITY_BD_RIG, then --rig. Token: CITY_BD_TOKEN or ~/.config/city-bd/<host>.token (0600),
// written by `city-bd login`.
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const usage = `usage: city-bd [--rig <city>/<rig>] <command>
  login                         sign in with Google in the browser (like gh auth login)
  status                        what is going on: in progress, waiting for a human, ready, closed in the last 24 h
  whoami | rigs                 who the token belongs to | reachable cities and rigs
  help                          allowed read commands and flags
  reads, bd syntax, JSON out:   list | search <q> | show <id>... | ready | blocked | count | dep tree <id>
  sql "<SELECT ...>"            one read-only statement (tables: issues, labels, comments, dependencies, events)
  create <title> [--type T] [--priority N] [--label L]... [--parent ID]
         [--description D | --description-file F] [--acceptance A | --acceptance-file F] [--design D | --design-file F]
  comment <id> <text>           text "-" reads stdin
  label add <id> <label>        never approved / triage-checked (use approve)
  approve <id> <quote>          ONLY when the person explicitly asked; quote = their exact words
  update|close|reopen|defer|undefer <id> [bd flags]   bead edits as with local bd, e.g. close ev-1 --reason "done"
  label remove <id> <label> | dep add <id> --blocked-by <id> | dep remove <id> <id>
  Files: "-" means stdin.`;
const here = dirname(fileURLToPath(import.meta.url));
const config = (() => { const file = join(here, "..", "config.json"); try { return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}; } catch { return {}; } })();
const url = (process.env.CITY_BD_URL ?? config.url ?? "https://colab-city.angora-dojo.ts.net").replace(/\/$/, "");
const origin = new URL(url);
if (origin.origin !== url || origin.protocol !== "https:") die("CITY_BD_URL must be an exact HTTPS origin");
const tokenFile = join(homedir(), ".config/city-bd", `${new URL(url).host.replace(/[^\w.-]/g, "_")}.token`);
function token() {
  if (process.env.CITY_BD_TOKEN) return process.env.CITY_BD_TOKEN.trim();
  try {
    if ((statSync(tokenFile).mode & 0o077) !== 0) die(`${tokenFile} must not be readable by others (chmod 600)`);
    return readFileSync(tokenFile, "utf8").trim();
  } catch (error) { if (error.code === "ENOENT") notSignedIn(); throw error; }
}
const self = `node ${relative(process.cwd(), fileURLToPath(import.meta.url)) || fileURLToPath(import.meta.url)}`;
/** Exit code 3 = setup needed. The text is written for the agent to relay to the human. */
function notSignedIn(reason = "no login on this machine yet") {
  console.error(`city-bd: SETUP NEEDED (${reason}).
Tell the human: "Bead access needs a one-time sign-in. I'm opening it in your browser; sign in with your panter.ch Google account and click Allow."
Then run: ${self} login
(it opens the browser and waits up to 5 minutes; afterwards repeat the original command)
Prerequisites: Tailscale on, access to ${url}, an entry in the city's people.toml.`);
  process.exit(3);
}
async function fetchOrExplain(target, init) {
  try { return await fetch(target, { ...init, redirect: "error", signal: AbortSignal.timeout(30000) }); }
  catch { die(`cannot reach ${url}. Is Tailscale on and the dashboard up? (Do not fall back to a local bead store.)`, 4); }
}
const readText = file => readFileSync(file === "-" ? 0 : file, "utf8");
function die(message, code = 2) { console.error(`city-bd: ${message}`); process.exit(code); }
async function call(method, path, body) {
  const response = await fetchOrExplain(`${url}/api/beads/v0/${path}`, {
    method, headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, redirect: "error",
  });
  const text = await response.text();
  let value; try { value = JSON.parse(text); } catch { die(`HTTP ${response.status}: non-JSON response (is the URL right?)`, 1); }
  if (response.status === 401 && !process.env.CITY_BD_TOKEN) notSignedIn("the login expired or was revoked");
  if (!response.ok) die(`HTTP ${response.status}: ${value.error ?? "request failed"}${response.headers.has("retry-after") ? `; retry after ${response.headers.get("retry-after")} seconds` : ""}`, 1);
  return value;
}
// OAuth 2.1 + PKCE against the dashboard, the same flow MCP clients use; the token lands in ~/.config/city-bd/token.
async function login() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const redirect = `http://127.0.0.1:${server.address().port}/callback`;
  const registration = await fetchOrExplain(`${url}/api/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "city-bd CLI", redirect_uris: [redirect] }) });
  if (!registration.ok) die(`registration failed: HTTP ${registration.status}`, 1);
  const { client_id } = await registration.json();
  const verifier = randomBytes(32).toString("base64url"), state = randomBytes(16).toString("base64url");
  const authorize = new URL(`${url}/oauth/authorize`);
  for (const [key, value] of Object.entries({ client_id, redirect_uri: redirect, response_type: "code", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", scope: "beads", resource: `${url}/mcp` })) authorize.searchParams.set(key, value);
  console.error(`Opening the browser to sign in. If it does not open, visit:\n${authorize}`);
  if (!process.env.CITY_BD_NO_BROWSER) execFile(process.platform === "darwin" ? "open" : "xdg-open", [authorize.toString()], () => {});
  const timeout = setTimeout(() => die("login timed out after 5 minutes; run login again", 1), 300_000);
  const code = await new Promise((resolve, reject) => server.on("request", (request, response) => {
    const callback = new URL(request.url, redirect), query = callback.searchParams;
    if (callback.pathname !== "/callback" || query.get("state") !== state) { response.writeHead(404); response.end(); return; }
    if (query.has("iss") && query.get("iss") !== url) { response.writeHead(400); response.end("Wrong issuer"); return; }
    response.end(query.get("code") ? "Signed in. You can close this tab." : "Sign-in was not completed.");
    if (!query.get("code")) reject(new Error("Authorization denied")); else resolve(query.get("code"));
  }));
  server.close();
  clearTimeout(timeout);
  const token = await fetchOrExplain(`${url}/api/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id, code_verifier: verifier, resource: `${url}/mcp` }) });
  const body = await token.json();
  if (!token.ok) die(`token exchange failed: ${body.error}`, 1);
  mkdirSync(dirname(tokenFile), { recursive: true, mode: 0o700 });
  writeFileSync(tokenFile, body.access_token + "\n", { mode: 0o600 });
  console.error(`Signed in to ${url}. Token stored in ${tokenFile} (expires in ${Math.round(body.expires_in / 86400)} days).`);
}
let args = process.argv.slice(2);
let rig = process.env.CITY_BD_RIG ?? config.rig;
if (args[0] === "--rig") { rig = args[1]; args = args.slice(2); }
if (!args.length || args[0] === "--help" || args[0] === "-h") { console.log(usage); process.exit(0); }
const print = value => console.log(JSON.stringify(value, null, 2));
if (args[0] === "login") { await login(); process.exit(0); }
if (args[0] === "help") { print((await call("GET", "help")).commands); process.exit(0); }
if (args[0] === "whoami") { print(await call("GET", "whoami")); process.exit(0); }
if (args[0] === "rigs") { print((await call("GET", "rigs")).rigs); process.exit(0); }
if (!rig || !/^[\w.-]+\/[\w.-]+$/.test(rig)) die("set --rig <city>/<rig> or CITY_BD_RIG");
const [command, ...rest] = args;
if (command === "status") {
  // One overview for "what is going on?": work in progress, beads waiting for a human, ready work, recent closes.
  const since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const read = async argv => (await call("POST", `${rig}/bd`, { args: argv })).result;
  const brief = items => (Array.isArray(items) ? items : []).map(b => ({ id: b.id, title: b.title, type: b.issue_type, priority: b.priority, ...(b.assignee ? { assignee: b.assignee } : {}) }));
  const [counts, inProgress, human, ready, closed] = await (async () => {
    const results = [];
    for (const argv of [
    ["count", "--by-status"], ["list", "--status", "in_progress", "--limit", "50", "--brief"],
    ["list", "--status", "open", "-l", "human", "--limit", "50", "--brief"], ["ready", "--limit", "100", "--brief"],
    ["list", "--status", "closed", "--closed-after", since, "--limit", "30", "--brief"],
    ]) { results.push(await read(argv)); await new Promise(resolve => setTimeout(resolve, 400)); }
    return results;
  })();
  print({ rig, counts: Object.fromEntries((counts.groups ?? []).map(g => [g.group, g.count])), inProgress: brief(inProgress),
    waitingForHuman: brief(human), readyToStart: { count: Array.isArray(ready) ? (ready.length >= 100 ? "100+" : ready.length) : 0, top: brief(ready).slice(0, 10) },
    closedSince: { since, items: brief(closed) } });
  process.exit(0);
}
if (command === "sql") print((await call("POST", `${rig}/sql`, { query: rest.join(" ") })).rows);
else if (command === "comment") {
  if (rest.length < 2) die("comment <id> <text>");
  print((await call("POST", `${rig}/comment`, { id: rest[0], text: rest[1] === "-" && rest.length === 2 ? readText("-") : rest.slice(1).join(" ") })).result);
} else if (command === "label" && rest[0] === "add") {
  if (rest[0] !== "add" || rest.length !== 3) die("label add <id> <label>");
  print((await call("POST", `${rig}/label`, { id: rest[1], label: rest[2] })).result);
} else if (["update", "close", "reopen", "defer", "undefer"].includes(command) || (command === "label" && rest[0] === "remove") || command === "dep" && ["add", "remove", "rm"].includes(rest[0])) {
  const args = [command, ...rest].map(arg => arg === "rm" ? "remove" : arg);
  for (let i = 0; i < args.length; i++) if (/^--[\w-]+-file$|^--stdin$/.test(args[i])) {
    // Read local files here; the server never reads files.
    if (args[i] === "--stdin" || args[i] === "--body-file") { args.splice(i, 2, `--description=${readText(args[i] === "--stdin" ? "-" : args[i + 1])}`); continue; }
    args.splice(i, 2, `${args[i].replace(/-file$/, "")}=${readText(args[i + 1])}`);
  }
  print((await call("POST", `${rig}/write`, { args })).result);
} else if (command === "approve") {
  if (rest.length < 2) die("approve <id> <quote: the person's exact words>");
  print((await call("POST", `${rig}/approve`, { id: rest[0], quote: rest.slice(1).join(" ") })).result);
} else if (command === "create") {
  const input = { labels: [] };
  const names = { "--description": "description", "-d": "description", "--acceptance": "acceptance", "--design": "design", "--type": "type", "-t": "type", "--priority": "priority", "-p": "priority", "--parent": "parent", "--label": "labels", "-l": "labels", "--labels": "labels", "--title": "title",
    "--description-file": "description@", "--body-file": "description@", "--acceptance-file": "acceptance@", "--design-file": "design@" };
  for (let i = 0; i < rest.length; i++) {
    const [flag, inline] = rest[i].startsWith("-") && rest[i].includes("=") ? [rest[i].slice(0, rest[i].indexOf("=")), rest[i].slice(rest[i].indexOf("=") + 1)] : [rest[i], undefined];
    const key = names[flag];
    if (!flag.startsWith("-")) { input.title = input.title ? `${input.title} ${flag}` : flag; continue; }
    if (!key) die(`unknown create flag ${flag}`);
    const value = inline ?? rest[++i];
    if (value === undefined) die(`${flag} needs a value`);
    if (key.endsWith("@")) input[key.slice(0, -1)] = readText(value);
    else if (key === "labels") input.labels.push(...value.split(","));
    else input[key] = key === "priority" ? Number(String(value).replace(/^P/i, "")) : value;
  }
  const response = await call("POST", `${rig}/create`, input);
  print({ ...response.result, approvalGuard: response.approvalGuard });
} else print((await call("POST", `${rig}/bd`, { args })).result);
