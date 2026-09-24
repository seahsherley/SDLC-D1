#!/usr/bin/env node
// Assembles the generated `bundle/` submodule (self-contained deployable copy
// of backend + built frontend + cli) from the backend/frontend/cli submodules,
// then commits the result and bumps the superproject's submodule pointers.
// Safe to re-run: each commit step is skipped when there is nothing staged.
"use strict";

import { execSync, spawnSync } from "node:child_process";
import { existsSync, cpSync, rmSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const PUSH = process.argv.includes("--push");

function run(command, cwd) {
    console.log(`$ ${command}${cwd ? `  (in ${path.relative(ROOT, cwd) || "."})` : ""}`);
    execSync(command, { cwd, stdio: "inherit" });
}

function shortSha(cwd) {
    return execSync("git rev-parse --short HEAD", { cwd }).toString().trim();
}

// Stages the given paths and commits only if something is actually staged.
function commitIfChanged(cwd, addArgs, message) {
    run(`git add ${addArgs}`, cwd);
    const diff = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd });
    if (diff.status === 0) {
        console.log(`Nothing to commit in ${path.relative(ROOT, cwd) || "."}`);
        return false;
    }
    run(`git commit -m "${message}"`, cwd);
    return true;
}

function main() {
    const backendDir = path.join(ROOT, "backend");
    const frontendDir = path.join(ROOT, "frontend");
    const cliDir = path.join(ROOT, "cli");
    const bundleDir = path.join(ROOT, "bundle");

    // 1. Update backend/frontend/cli submodules to their branch tips.
    run("git submodule update --init --remote backend frontend cli", ROOT);

    // 2. Build the frontend.
    run("npm install", frontendDir);
    run("npm run build", frontendDir);

    const browserDir = path.join(frontendDir, "dist", "snip-frontend", "browser");
    const indexHtml = path.join(browserDir, "index.html");
    if (!existsSync(indexHtml)) {
        console.error(`Frontend build did not produce ${path.relative(ROOT, indexHtml)}`);
        process.exit(1);
    }

    // 3. Assemble bundle/.
    const bundlePublicDir = path.join(bundleDir, "public");
    rmSync(bundlePublicDir, { recursive: true, force: true });
    mkdirSync(bundlePublicDir, { recursive: true });
    cpSync(browserDir, bundlePublicDir, { recursive: true });

    copyFileSync(path.join(backendDir, "server.js"), path.join(bundleDir, "server.js"));
    copyFileSync(path.join(cliDir, "cli.js"), path.join(bundleDir, "cli.js"));

    writeFileSync(path.join(bundleDir, ".env"), "PUBLIC_DIR=./public\n");

    writeFileSync(
        path.join(bundleDir, "package.json"),
        JSON.stringify(
            {
                name: "snip-bundle",
                version: "1.0.0",
                private: true,
                description: "Generated deployable bundle of the Snip backend, UI, and CLI",
                scripts: { start: "bun server.js" },
            },
            null,
            2
        ) + "\n"
    );

    writeFileSync(
        path.join(bundleDir, "Dockerfile"),
        `FROM oven/bun:1-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "server.js"]
`
    );

    writeFileSync(
        path.join(bundleDir, ".dockerignore"),
        "node_modules\n.git\n"
    );

    writeFileSync(
        path.join(bundleDir, "railway.json"),
        JSON.stringify(
            {
                $schema: "https://railway.app/railway.schema.json",
                build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
            },
            null,
            2
        ) + "\n"
    );

    // 4. Commit inside bundle/, then bump submodule pointers in the superproject.
    const message = `Regenerate bundle (backend@${shortSha(backendDir)}, frontend@${shortSha(
        frontendDir
    )}, cli@${shortSha(cliDir)})`;
    const bundleCommitted = commitIfChanged(bundleDir, "-A", message);
    const superCommitted = commitIfChanged(
        ROOT,
        "backend frontend cli bundle",
        "Update submodule pointers"
    );

    if (!bundleCommitted && !superCommitted) {
        console.log("Nothing changed; build-bundle is a no-op.");
    }

    // 5. Push when requested. Submodule checkouts are often detached, so push
    // the bundle submodule's HEAD explicitly to its branch.
    if (PUSH) {
        run("git push origin HEAD:bundle", bundleDir);
        run("git push origin main", ROOT);
    }
}

main();
