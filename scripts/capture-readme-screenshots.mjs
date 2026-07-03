import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const outputDir = join(root, "docs", "screenshots");
mkdirSync(outputDir, { recursive: true });

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = existsSync(chromePath) ? { executablePath: chromePath } : {};
const workflowImage = `data:image/png;base64,${readFileSync(join(root, "docs", "assets", "fbo-workflow.png")).toString("base64")}`;

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
        border-radius: 18px;
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
          16px/1.7 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
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

      .terminal .muted {
        color: #7f99aa;
      }

      .workflow {
        padding: 24px;
        background: #f7fafc;
      }

      .workflow img {
        display: block;
        width: 100%;
        border-radius: 12px;
      }
    </style>
  </head>
  <body>
    <section id="code" class="panel">
      <div class="header">
        <h1 class="title">Scoped framebuffer rendering</h1>
        <span class="meta">webgraphiclibrary/fbo</span>
      </div>
      <pre class="code"><code>import { Framebuffer } from "webgraphiclibrary/fbo";

const fbo = new Framebuffer(gl, {
  width: canvas.width,
  height: canvas.height,
  depth: true
});

fbo.withBound(() => {
  gl.viewport(0, 0, fbo.width, fbo.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  renderScene();
});

fbo.resizeToCanvas(canvas);
gl.bindTexture(gl.TEXTURE_2D, fbo.texture);</code></pre>
    </section>

    <section id="terminal" class="panel">
      <div class="header">
        <h1 class="title">Release verification</h1>
        <span class="meta">local package check</span>
      </div>
      <pre class="terminal"><code>$ pnpm prepublishOnly
$ eslint .
$ tsc -p tsconfig.base.json --noEmit
$ vitest run

 ✓ packages/core/src/index.test.ts (6 tests)
 ✓ packages/fbo/src/framebuffer.test.ts (14 tests)

 Test Files  2 passed (2)
      Tests  20 passed (20)

$ tsup
ESM Build success
DTS Build success</code></pre>
    </section>

    <section id="workflow" class="panel">
      <div class="header">
        <h1 class="title">Framebuffer workflow</h1>
        <span class="meta">off-screen pass to screen pass</span>
      </div>
      <div class="workflow">
        <img src="${workflowImage}" alt="Framebuffer workflow" />
      </div>
    </section>
  </body>
</html>`;

const browser = await chromium.launch({
  headless: true,
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
  await page.locator("#workflow").screenshot({
    path: join(outputDir, "fbo-workflow-card.png")
  });
} finally {
  await browser.close();
}
