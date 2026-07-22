import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { URL } from "node:url";
import { chromium } from "playwright";
import { resolveStaticFilePath } from "./static-server-path.mjs";

// Renders the showcase example pages (real WebGL output + HTML labels) and
// captures each card into docs/screenshots for the README. Run after `pnpm build`.

const root = process.cwd();
const outputDir = join(root, "docs", "screenshots");
mkdirSync(outputDir, { recursive: true });

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = existsSync(chromePath) ? { executablePath: chromePath } : {};

const SHOTS = [
  { name: "postprocessing", path: "examples/postprocessing/index.html", w: 1360, h: 700 },
  { name: "gbuffer", path: "examples/gbuffer/index.html", w: 1360, h: 780 },
  { name: "antialiasing", path: "examples/antialiasing/index.html", w: 1360, h: 700 },
  { name: "instancing", path: "examples/instancing/index.html", w: 1360, h: 700 },
  { name: "picking", path: "examples/picking/index.html", w: 1000, h: 720 },
  { name: "architecture", path: "docs/diagrams/pipeline.html", w: 1360, h: 640 },
  {
    name: "minimal-triangle",
    path: "examples/minimal-triangle/index.html",
    w: 1000,
    h: 660,
    sel: "canvas"
  }
];

// Allow capturing a subset: `node scripts/capture-showcase.mjs postprocessing gbuffer`
const only = process.argv.slice(2);
const shots = only.length > 0 ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;

if (!existsSync(join(root, "dist"))) {
  throw new Error("dist/ not found. Run `pnpm build` before capturing showcases.");
}

const server = await startStaticServer(root);
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  ...launchOptions
});

try {
  for (const shot of shots) {
    if (!existsSync(join(root, shot.path))) {
      console.log(`skip ${shot.name} (no ${shot.path})`);
      continue;
    }

    const page = await browser.newPage({
      viewport: { width: shot.w, height: shot.h },
      deviceScaleFactor: 2
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto(`${server.url}/${shot.path}`, { waitUntil: "load" });
    await page.waitForFunction("window.__WEBGRAPHICLIBRARY_DEMO_READY__ === true", undefined, {
      timeout: 15000
    });

    if (errors.length > 0) {
      throw new Error(`${shot.name} produced browser errors:\n${errors.join("\n")}`);
    }

    await page
      .locator(shot.sel ?? ".card")
      .first()
      .screenshot({ path: join(outputDir, `${shot.name}-demo.png`) });
    await page.close();
    console.log(`OK captured ${shot.name}-demo.png`);
  }
} finally {
  await browser.close();
  await server.close();
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
