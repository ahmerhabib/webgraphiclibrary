# Comparison

webgraphiclibrary is a low-level WebGL resource wrapper. It is **not** a scene graph, engine, or charting library, so it does not compete with Three.js, Babylon.js, PixiJS, Konva, Fabric, D3, or Chart.js — those operate a layer (or several) above raw WebGL and manage the very resources this library exposes.

Its actual neighbors are the low-level WebGL/WebGL2 helper libraries.

| Library               | Category                | Backend         | TS-native | Subpath tree-shaking | Notes                                                       |
| --------------------- | ----------------------- | --------------- | :-------: | :------------------: | ----------------------------------------------------------- |
| **webgraphiclibrary** | Typed resource wrappers | WebGL / WebGL2  |    Yes    |         Yes          | Explicit lifecycle, state-restoration guarantees, zero deps |
| twgl.js               | Helper functions        | WebGL1 + 2      |   JSDoc   |          No          | Excellent ergonomics; JS with generated types; one bundle   |
| regl                  | Declarative commands    | WebGL1          | community |          No          | Stateless, state-minimizing; no WebGL2                      |
| picogl.js             | WebGL2 resource objects | WebGL2          | ships JS  |       Partial        | Closest architectural model; low recent activity            |
| OGL                   | Mini scene graph        | WebGL2 (+1)     |  add-on   |          No          | Higher-level: `Mesh`, `Camera`, `Transform`                 |
| luma.gl               | Portable GPU toolkit    | WebGL2 + WebGPU |    Yes    |       Partial        | Powers deck.gl; larger, dataviz-oriented                    |

## Where webgraphiclibrary fits

- **You want types first.** Written in TypeScript with precise, hand-authored declarations rather than generated ones.
- **You want a small bundle.** Per-resource subpath exports mean importing `Texture2D` does not pull in framebuffer or program code.
- **You want predictable state.** Helpers restore the bindings they touch, so wrappers compose with hand-written WebGL without surprises.
- **You want to stay close to WebGL.** Raw handles are always exposed; there is no scene graph or renderer to adopt.

## Where it does not fit

- You want uniform/attribute **introspection and auto-binding** from reflection (twgl's `setUniforms`), geometry primitives, or a math library bundled in — those are out of scope today (a small optional math helper is on the roadmap).
- You need **WebGPU** — target luma.gl, TypeGPU, or Three.js's WebGPU renderer. webgraphiclibrary is deliberately WebGL/WebGL2 for reach and teaching today, with a backend-portable surface as a roadmap goal.
- You want a **scene graph, materials, or a full engine** — use Three.js, Babylon.js, PixiJS, or OGL.

Popularity and activity figures for the libraries above change frequently; check each project's repository and the npm registry for current numbers.
