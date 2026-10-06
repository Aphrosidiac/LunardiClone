// Modules 206154 + 159299. The Playground's sandboxed iframe document: a strict CSP that only
// lets scripts, styles and fonts come from esm.sh, an import map pinning React/ReactDOM (and any
// declared dependency, built against that React), and a tiny runner that executes the compiled
// module it is sent over postMessage and reports errors back to the parent.

export const REACT_VERSION = '19.3.0';
export const REACT_DOM_VERSION = '19.3.0';
export const PLAYGROUND_MESSAGE_SOURCE = 'portfolio-playground';
export const DEFAULT_PLAYGROUND_HEIGHT = 420;

export const PLAYGROUND_FRAME_PERMISSIONS = [
  'accelerometer',
  'autoplay',
  'camera',
  'clipboard-read',
  'clipboard-write',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'geolocation',
  'gyroscope',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'picture-in-picture',
  'publickey-credentials-get',
  'screen-wake-lock',
  'usb',
  'xr-spatial-tracking',
]
  .map((feature) => `${feature} 'none'`)
  .join('; ');

const ESM_CDN = 'https://esm.sh';
const DEPS_QUERY = `&deps=react@${REACT_VERSION},react-dom@${REACT_DOM_VERSION}`;
const DEPENDENCY_PATTERN = /^(@[a-zA-Z0-9][\w.-]*\/)?[a-zA-Z0-9][\w.-]*(@[a-zA-Z0-9^~][\w.^~+-]*)?$/;

export function isValidDependency(spec: string): boolean {
  return DEPENDENCY_PATTERN.test(spec);
}

const CONTENT_SECURITY_POLICY = `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' ${ESM_CDN} blob:; style-src 'unsafe-inline' ${ESM_CDN}; font-src ${ESM_CDN} data:; img-src ${ESM_CDN} data: blob:; media-src data: blob:; connect-src ${ESM_CDN} data: blob:; worker-src blob:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'`;

function splitSpec(spec: string): { name: string; spec: string } {
  const at = spec.lastIndexOf('@');
  return at > 0 ? { name: spec.slice(0, at), spec } : { name: spec, spec };
}

function buildImportMap(dependencies: string[]): { imports: Record<string, string> } {
  const imports: Record<string, string> = {
    react: `${ESM_CDN}/react@${REACT_VERSION}`,
    'react/': `${ESM_CDN}/react@${REACT_VERSION}/`,
    'react-dom': `${ESM_CDN}/react-dom@${REACT_DOM_VERSION}`,
    'react-dom/': `${ESM_CDN}/react-dom@${REACT_DOM_VERSION}/`,
  };
  for (const dependency of dependencies) {
    const trimmed = dependency.trim();
    if (!isValidDependency(trimmed)) continue;
    const { name, spec } = splitSpec(trimmed);
    imports[name] = `${ESM_CDN}/${spec}${DEPS_QUERY}`;
    imports[`${name}/`] = `${ESM_CDN}/${spec}${DEPS_QUERY}/`;
  }
  return { imports };
}

export function buildRunnerDocument(dependencies: string[] = []): string {
  const importMap = JSON.stringify(buildImportMap(dependencies)).split('</').join('<\\/');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />
<script type="importmap">${importMap}</script>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: transparent;
    color: CanvasText;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px;
  }
  #root { height: 100%; }
  #error {
    display: none;
    margin: 0;
    padding: 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    color: #d92d20;
  }
  @media (prefers-color-scheme: dark) { #error { color: #ff6b6b; } }
</style>
</head>
<body>
<div id="root"></div>
<pre id="error"></pre>
<script type="module">
  const SOURCE = ${JSON.stringify(PLAYGROUND_MESSAGE_SOURCE)};
  const post = (message) => parent.postMessage(Object.assign({ source: SOURCE }, message), "*");
  const errorEl = document.getElementById("error");

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.style.display = "block";
    post({ type: "error", message: String(message).slice(0, 2000) });
  };

  window.addEventListener("error", (event) => showError(event.message));
  window.addEventListener("unhandledrejection", (event) => showError(String(event.reason)));

  window.addEventListener("message", (event) => {
    // Same tag the frame stamps on its own messages, so neither side acts on a stray one.
    if (event.source !== parent || event.data?.source !== SOURCE || event.data.type !== "run") {
      return;
    }

    if (typeof event.data.code !== "string") {
      return;
    }

    errorEl.style.display = "none";

    const script = document.createElement("script");
    script.type = "module";
    script.textContent = event.data.code;
    document.body.appendChild(script);
  });

  post({ type: "ready" });
</script>
</body>
</html>`;
}
