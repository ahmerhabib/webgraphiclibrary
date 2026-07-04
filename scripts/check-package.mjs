import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Verifies the built package the way a consumer sees it: every public subpath
// imports from dist with its declarations present, and the packed npm tarball
// installs and imports cleanly from a fresh Node project. Run after `pnpm build`.

const root = process.cwd();

const SUBPATH_EXPORTS = {
  "index.js": [
    "Framebuffer",
    "FBO",
    "Shader",
    "Program",
    "GLBuffer",
    "Texture2D",
    "readTexturePixels",
    "readTexturePixelsInto",
    "WebGLError",
    "DisposedResourceError",
    "withSavedBindings",
    "isWebGL2"
  ],
  "core.js": [
    "WebGLError",
    "DisposedResourceError",
    "isWebGL2",
    "isWebGLContext",
    "withSavedBindings"
  ],
  "fbo.js": ["Framebuffer", "FBO"],
  "shader.js": ["Shader"],
  "program.js": ["Program"],
  "buffer.js": ["GLBuffer"],
  "texture.js": ["Texture2D", "readTexturePixels", "readTexturePixelsInto"]
};

await checkDistExports();
checkPackedTarball();

async function checkDistExports() {
  const dist = join(root, "dist");
  if (!existsSync(dist)) {
    throw new Error("dist/ not found. Run `pnpm build` before checking the package.");
  }

  for (const [file, names] of Object.entries(SUBPATH_EXPORTS)) {
    const module = await import(pathToFileURL(join(dist, file)).href);

    for (const name of names) {
      if (!(name in module)) {
        throw new Error(`dist/${file} is missing the expected export "${name}".`);
      }
    }

    const declaration = file.replace(/\.js$/, ".d.ts");
    if (!existsSync(join(dist, declaration))) {
      throw new Error(`dist/${declaration} type declaration is missing.`);
    }
  }

  console.log("OK dist subpath exports and type declarations present");
}

function checkPackedTarball() {
  const packOutput = execFileSync("npm", ["pack", "--pack-destination", root], {
    cwd: root,
    encoding: "utf8"
  });
  const tarball = packOutput.trim().split("\n").pop();
  const tarballPath = join(root, tarball);
  const temp = mkdtempSync(join(tmpdir(), "webgraphiclibrary-pack-"));

  try {
    writeFileSync(
      join(temp, "package.json"),
      `${JSON.stringify(
        { name: "webgraphiclibrary-consumer", version: "1.0.0", type: "module", private: true },
        null,
        2
      )}\n`
    );
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--silent", tarballPath], {
      cwd: temp,
      encoding: "utf8"
    });

    const consumer = join(temp, "consume.mjs");
    writeFileSync(
      consumer,
      [
        'import { Framebuffer, FBO } from "webgraphiclibrary/fbo";',
        'import { Shader } from "webgraphiclibrary/shader";',
        'import { Program } from "webgraphiclibrary/program";',
        'import { GLBuffer } from "webgraphiclibrary/buffer";',
        'import { Texture2D, readTexturePixels } from "webgraphiclibrary/texture";',
        'import { WebGLError } from "webgraphiclibrary/core";',
        'import * as root from "webgraphiclibrary";',
        "",
        "const values = [Framebuffer, FBO, Shader, Program, GLBuffer, Texture2D, readTexturePixels, WebGLError];",
        'if (values.some((value) => typeof value !== "function")) {',
        '  throw new Error("A subpath export is missing from the packed tarball.");',
        "}",
        'if (typeof root.Framebuffer !== "function") {',
        '  throw new Error("The root export is missing from the packed tarball.");',
        "}",
        'console.log("OK packed tarball installs and imports cleanly from Node");'
      ].join("\n")
    );

    execFileSync("node", [consumer], { cwd: temp, encoding: "utf8", stdio: "inherit" });
  } finally {
    rmSync(tarballPath, { force: true });
    rmSync(temp, { recursive: true, force: true });
  }
}
