import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { URL } from "node:url";
import { chromium } from "playwright";
import { resolveStaticFilePath } from "./static-server-path.mjs";

// Real-browser verification: runs the self-test harness against a live WebGL
// context (pixel readback, texture uploads, error paths) and smoke-tests every
// example for load errors. Requires a built dist and Playwright Chromium.

const root = process.cwd();
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = existsSync(chromePath) ? { executablePath: chromePath } : {};

const EXAMPLES = [
  "examples/fbo-postprocess/index.html",
  "examples/minimal-triangle/index.html",
  "examples/pipeline/index.html",
  "examples/picking/index.html",
  "examples/postprocessing/index.html",
  "examples/gbuffer/index.html",
  "examples/antialiasing/index.html",
  "examples/instancing/index.html"
];

if (!existsSync(join(root, "dist"))) {
  throw new Error("dist/ not found. Run `pnpm build` before the browser checks.");
}

const server = await startStaticServer(root);
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  ...launchOptions
});

const problems = [];

try {
  await runSelfTest();
  for (const example of EXAMPLES) {
    await runExample(example);
  }
} finally {
  await browser.close();
  await server.close();
}

if (problems.length > 0) {
  throw new Error(`Browser checks failed:\n- ${problems.join("\n- ")}`);
}

console.log("OK browser self-test and example smoke checks passed");

async function runSelfTest() {
  const page = await newPage("self-test", "examples/self-test/index.html");
  await page.waitForFunction("window.__WGL_RESULT__ !== undefined", undefined, { timeout: 15000 });
  const result = await page.evaluate("window.__WGL_RESULT__");
  for (const failure of result.failures ?? []) {
    problems.push(`self-test: ${failure}`);
  }
  await page.close();
}

async function runExample(example) {
  const label = basename(example.replace(/\/index\.html$/, ""));
  const page = await newPage(label, example);
  try {
    await page.waitForFunction("window.__WEBGRAPHICLIBRARY_DEMO_READY__ === true", undefined, {
      timeout: 15000
    });
  } catch {
    problems.push(`${label}: did not signal ready`);
  }
  await page.close();
}

async function newPage(label, path) {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on("pageerror", (error) => problems.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`${label}: ${message.text()}`);
    }
  });
  await page.goto(`${server.url}/${path}`, { waitUntil: "load" });
  return page;
}

async function startStaticServer(directory) {
  const httpServer = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const filePath = resolveStaticFilePath(directory, requestUrl.pathname);
    if (filePath === null || !existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(readFileSync(filePath));
  });

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve()))
      )
  };
}

function contentType(filePath) {
  const extension = extname(basename(filePath));
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".png") return "image/png";
  return "application/octet-stream";
}
