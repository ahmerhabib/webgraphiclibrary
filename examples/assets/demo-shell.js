// Tiny helpers shared by the demo pages. No library code here — the demos
// import webgraphiclibrary itself from ../../dist.

/** Wire a range input to `onChange(value)` and mirror its value in <output>. */
export function bindRange(id, onChange, format = (v) => String(v)) {
  const input = document.getElementById(id);
  const output = input.parentElement.querySelector("output");
  const apply = () => {
    const value = Number(input.value);
    if (output) output.textContent = format(value);
    onChange(value);
  };
  input.addEventListener("input", apply);
  apply();
  return input;
}

/** Wire a <select> to `onChange(value)` and fire once with the initial value. */
export function bindSelect(id, onChange) {
  const select = document.getElementById(id);
  const apply = () => onChange(select.value);
  select.addEventListener("change", apply);
  apply();
  return select;
}

/** Wire an aria-pressed toggle button to `onChange(pressed)`. */
export function bindToggle(id, onChange) {
  const button = document.getElementById(id);
  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(next));
    onChange(next);
  });
  onChange(button.getAttribute("aria-pressed") === "true");
  return button;
}

/**
 * Start a render loop that calls `render(elapsedSeconds)` each frame and
 * flags the page ready for the test harness after the first frame.
 */
export function startLoop(render) {
  const start = performance.now();
  const frame = () => {
    render((performance.now() - start) / 1000);
    if (window.__WEBGRAPHICLIBRARY_DEMO_READY__ !== true) {
      window.__WEBGRAPHICLIBRARY_DEMO_READY__ = true;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
