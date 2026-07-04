import { createServer } from "node:http";
import { URL } from "node:url";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { resolveStaticFilePath } from "./static-server-path.mjs";

const root = process.cwd();
const outputDir = join(root, "docs", "screenshots");
mkdirSync(outputDir, { recursive: true });

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = existsSync(chromePath) ? { executablePath: chromePath } : {};
const demoPath = join(root, "examples", "fbo-postprocess", "index.html");

const verification = runVerification();
const codeSnippet = extractDemoSnippet(readFileSync(demoPath, "utf8"));

const html = String.raw`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: light;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #eef4f8;
        color: #17212b;
      }

      body {
        margin: 0;
        padding: 40px;
      }

      .panel {
        width: 1080px;
        border: 1px solid #d7e1e8;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 22px 60px rgba(17, 33, 48, 0.16);
        overflow: hidden;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 22px 28px;
        border-bottom: 1px solid #e3ebf0;
        background: #f8fbfd;
      }

      .title {
        margin: 0;
        font-size: 24px;
        font-weight: 750;
      }

      .meta {
        color: #52616f;
        font-size: 14px;
      }

      pre {
        margin: 0;
        padding: 28px;
        font:
          15px/1.62 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        white-space: pre-wrap;
      }

      .code {
        color: #243b53;
        background: #fbfdff;
      }

      .terminal {
        color: #d7f3ff;
        background: #101923;
      }
    </style>
  </head>
  <body>
    <section id="code" class="panel">
      <div class="header">
        <h1 class="title">Framebuffer example source</h1>
        <span class="meta">examples/fbo-postprocess/index.html</span>
      </div>
      <pre class="code"><code>${escapeHtml(codeSnippet)}</code></pre>
    </section>

    <section id="terminal" class="panel">
      <div class="header">
        <h1 class="title">Release verification</h1>
        <span class="meta">pnpm prepublishOnly</span>
      </div>
      <pre class="terminal"><code>${escapeHtml(verification)}</code></pre>
    </section>
  </body>
</html>`;

const server = await startStaticServer(root);
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader"],
  ...launchOptions
});

try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 780 },
    deviceScaleFactor: 1
  });
  await page.setContent(html, { waitUntil: "load" });

  await page.locator("#code").screenshot({
    path: join(outputDir, "code-snippet.png")
  });
  await page.locator("#terminal").screenshot({
    path: join(outputDir, "terminal-verification.png")
  });

  const demo = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 1
  });
  const errors = [];
  demo.on("pageerror", (error) => errors.push(error.message));
  demo.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await demo.goto(`${server.url}/examples/fbo-postprocess/index.html`, {
    waitUntil: "networkidle"
  });
  await demo.waitForFunction("window.__WEBGRAPHICLIBRARY_DEMO_READY__ === true");

  if (errors.length > 0) {
    throw new Error(`Demo produced browser errors:\n${errors.join("\n")}`);
  }

  await demo.locator(".frame").screenshot({
    path: join(outputDir, "fbo-postprocess-demo.png")
  });
} finally {
  await browser.close();
  await server.close();
}

function runVerification() {
  const result = spawnSync("pnpm", ["prepublishOnly"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      FORCE_COLOR: "0",
      NO_COLOR: "1"
    }
  });

  const output = stripAnsi(`${result.stdout}${result.stderr}`).trim();

  if (result.status !== 0) {
    throw new Error(output);
  }

  return limitTerminalOutput(output);
}

function extractDemoSnippet(source) {
  const lines = source.split("\n");
  const wanted = [
    'import { Framebuffer } from "../../dist/fbo.js";',
    "const fbo = new Framebuffer(gl, {",
    "fbo.withBound(() => {",
    "gl.bindTexture(gl.TEXTURE_2D, fbo.texture);"
  ];

  const snippets = wanted
    .map((needle) => {
      const index = lines.findIndex((line) => line.includes(needle));
      if (index === -1) {
        return "";
      }

      const end = needle.includes("{") ? Math.min(index + 8, lines.length) : index + 1;
      return lines
        .slice(index, end)
        .map((line) => line.replace(/^ {6}/, ""))
        .join("\n");
    })
    .filter(Boolean);

  return snippets.join("\n\n");
}

async function startStaticServer(root) {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const filePath = resolveStaticFilePath(root, requestUrl.pathname);

    if (filePath === null || !existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": contentType(filePath)
    });
    response.end(readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

function contentType(filePath) {
  const extension = extname(basename(filePath));

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".js") {
    return "text/javascript; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".png") {
    return "image/png";
  }

  return "application/octet-stream";
}

function stripAnsi(value) {
  const escape = String.fromCharCode(27);
  return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, "g"), "");
}

function limitTerminalOutput(output) {
  const lines = output.split("\n").filter((line) => !line.includes("Browserslist"));
  const importantStart = lines.findIndex((line) => line.includes("> webgraphiclibrary@"));
  const trimmed = importantStart > -1 ? lines.slice(importantStart) : lines;
  const maxLines = 44;

  if (trimmed.length <= maxLines) {
    return trimmed.join("\n");
  }

  return [...trimmed.slice(0, 18), "...", ...trimmed.slice(-25)].join("\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
