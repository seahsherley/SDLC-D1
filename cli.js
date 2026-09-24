#!/usr/bin/env node
"use strict";

const { execFile } = require("child_process");

const BASE_URL = (process.env.SNIP_API || "http://localhost:3000").replace(/\/$/, "");

const USAGE = `Usage: snip <command> [args]

Commands:
  add <url>    Shorten a URL
  ls           List all shortened links
  open <code>  Resolve a short code and open it in the browser
  help         Show this usage text
`;

function fail(message) {
    console.error(message);
    process.exit(1);
}

function openInBrowser(url) {
    const platform = process.platform;
    let command;
    let args;
    if (platform === "win32") {
        command = "cmd";
        args = ["/c", "start", "", url];
    } else if (platform === "darwin") {
        command = "open";
        args = [url];
    } else {
        command = "xdg-open";
        args = [url];
    }
    execFile(command, args, (err) => {
        if (err) fail(`Failed to open browser: ${err.message}`);
    });
}

async function cmdAdd(url) {
    if (!url) fail("Usage: snip add <url>");

    let res;
    try {
        res = await fetch(`${BASE_URL}/api/links`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
    } catch (err) {
        fail(`Could not reach backend at ${BASE_URL}: ${err.message}`);
        return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        fail(data?.error || `Request failed with status ${res.status}`);
        return;
    }

    console.log(data.shortUrl);
}

async function cmdLs() {
    let res;
    try {
        res = await fetch(`${BASE_URL}/api/links`);
    } catch (err) {
        fail(`Could not reach backend at ${BASE_URL}: ${err.message}`);
        return;
    }

    if (!res.ok) {
        fail(`Request failed with status ${res.status}`);
        return;
    }

    const links = await res.json();
    if (!Array.isArray(links) || links.length === 0) {
        console.log("No links yet.");
        return;
    }

    const codeWidth = Math.max(4, ...links.map((l) => l.code.length));
    const hitsWidth = Math.max(4, ...links.map((l) => String(l.hits).length));

    const header = `${"CODE".padEnd(codeWidth)}  ${"HITS".padEnd(hitsWidth)}  URL`;
    console.log(header);
    for (const link of links) {
        console.log(
            `${link.code.padEnd(codeWidth)}  ${String(link.hits).padEnd(hitsWidth)}  ${link.url}`
        );
    }
}

async function cmdOpen(code) {
    if (!code) fail("Usage: snip open <code>");

    let res;
    try {
        res = await fetch(`${BASE_URL}/${code}`, { redirect: "manual" });
    } catch (err) {
        fail(`Could not reach backend at ${BASE_URL}: ${err.message}`);
        return;
    }

    const location = res.headers.get("location");
    if (res.status !== 302 || !location) {
        fail(`Unknown code: ${code}`);
        return;
    }

    console.log(location);
    openInBrowser(location);
}

async function main() {
    const [command, arg] = process.argv.slice(2);

    switch (command) {
        case "add":
            await cmdAdd(arg);
            break;
        case "ls":
            await cmdLs();
            break;
        case "open":
            await cmdOpen(arg);
            break;
        case "help":
        case undefined:
            console.log(USAGE);
            break;
        default:
            fail(`Unknown command: ${command}\n\n${USAGE}`);
    }
}

main().catch((err) => fail(err.message));
