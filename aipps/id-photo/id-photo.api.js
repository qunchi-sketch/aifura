// assets/aipps/id-photo/id-photo.api.js
// Aifura ID Photo API client (same-origin /api/*)
// Requires: Pages Functions provides /api/... on https://aifura.com

const API_BASE = ""; // same-origin. Keep it empty so it always follows current domain.
const DEFAULT_TIMEOUT_MS = 45_000;

function withTimeout(signal, ms = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error("TIMEOUT")), ms);

  // If caller provided a signal, forward aborts.
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener("abort", () => ctrl.abort(signal.reason), { once: true });
  }

  return { signal: ctrl.signal, cleanup: () => clearTimeout(t) };
}

async function readJsonSafely(resp) {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return await resp.json().catch(() => null);
  }
  const text = await resp.text().catch(() => "");
  // Sometimes errors might be HTML (misroute). Provide diagnostics.
  return { ok: false, error: "NON_JSON_RESPONSE", detail: text.slice(0, 500) };
}

function httpError(code, payload, resp) {
  const e = new Error(payload?.error || `HTTP_${resp.status}`);
  e.code = code;
  e.status = resp.status;
  e.payload = payload;
  return e;
}

async function postJson(path, body, { signal, timeoutMs } = {}) {
  const { signal: s, cleanup } = withTimeout(signal, timeoutMs);
  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body || {}),
      signal: s,
    });

    const payload = await readJsonSafely(resp);
    if (!resp.ok) throw httpError("HTTP_ERROR", payload, resp);
    if (payload && payload.ok === false) {
      // API uses ok:false for logical failures too
      throw httpError(payload.error || "API_ERROR", payload, resp);
    }
    return payload;
  } finally {
    cleanup();
  }
}

export function buildPreviewUrl(assetId) {
  return `/api/id/asset/${encodeURIComponent(assetId)}/preview`;
}

/**
 * Generate ID photo
 * @param {Object} params
 * @param {string} params.dataUrl - input image as data URL (data:image/...;base64,...)
 * @param {"white"|"blue"|"red"} params.bgColor
 * @returns {Promise<{ok:true, assetId:string, previewUrl:string}>}
 */
export async function generateIdPhoto({ dataUrl, bgColor = "white" }, opts = {}) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw Object.assign(new Error("MISSING_IMAGE"), { code: "MISSING_IMAGE" });
  }
  if (!["white", "blue", "red"].includes(bgColor)) {
    throw Object.assign(new Error("BAD_BG_COLOR"), { code: "BAD_BG_COLOR" });
  }
  const payload = await postJson("/api/id/generate", { bgColor, images: [dataUrl] }, opts);
  // Worker returns relative previewUrl; ensure fallback
  if (!payload.previewUrl && payload.assetId) payload.previewUrl = buildPreviewUrl(payload.assetId);
  return payload;
}

/**
 * Check redeem key validity and remaining uses
 * @returns {Promise<{ok:true, remainingUses:number} | {ok:false, error:string}>}
 */
export async function checkKey(key, opts = {}) {
  const k = String(key || "").trim();
  if (!k) return { ok: false, error: "BAD_REQUEST" };
  // Your API returns ok:false with KEY_INVALID etc but still HTTP 200.
  // postJson() treats ok:false as throw, so we call fetch directly to preserve result.
  const { signal: s, cleanup } = withTimeout(opts.signal, opts.timeoutMs || 15_000);
  try {
    const resp = await fetch("/api/id/key/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key: k }),
      signal: s,
    });
    const payload = await readJsonSafely(resp);
    // key/check uses 200 for logical errors; only throw on non-200 network-level errors
    if (!resp.ok) throw httpError("HTTP_ERROR", payload, resp);
    return payload;
  } finally {
    cleanup();
  }
}

/**
 * Redeem key for a specific asset -> returns downloadUrl (/api/id/dl/:grantId) + remainingUses
 * @returns {Promise<{ok:true, remainingUses:number, downloadUrl:string}>}
 */
export async function redeemKey({ key, assetId }, opts = {}) {
  const k = String(key || "").trim();
  const a = String(assetId || "").trim();
  if (!k || !a) {
    throw Object.assign(new Error("BAD_REQUEST"), { code: "BAD_REQUEST" });
  }
  // redeem returns ok:false with KEY_INVALID/KEY_EXPIRED/KEY_USED_UP and still HTTP 200.
  // We want to return that payload (for UI) instead of throwing.
  const { signal: s, cleanup } = withTimeout(opts.signal, opts.timeoutMs || 20_000);
  try {
    const resp = await fetch("/api/id/key/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key: k, assetId: a }),
      signal: s,
    });
    const payload = await readJsonSafely(resp);
    if (!resp.ok) throw httpError("HTTP_ERROR", payload, resp);
    return payload;
  } finally {
    cleanup();
  }
}

/**
 * Trigger file download (or open image) for grant downloadUrl.
 * In WeChat, "attachment download" may fail; UI should fallback to showing <img src=downloadUrl> for long-press save.
 */
export function startDownload(downloadUrl) {
  if (!downloadUrl) throw Object.assign(new Error("MISSING_DOWNLOAD_URL"), { code: "MISSING_DOWNLOAD_URL" });

  // Use a real click to improve compatibility.
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Helper: check if a URL looks like our grant download URL
 */
export function isGrantDownloadUrl(url) {
  return typeof url === "string" && /\/api\/id\/dl\/[^/]+$/.test(url);
}
