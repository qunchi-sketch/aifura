export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCORS(env, request, new Response(null, { status: 204 }));
    }

    try {
      await ensureAuxTables(env);

      if (url.pathname === "/api/id/generate" && request.method === "POST") {
        return withCORS(env, request, await handleGenerate(request, env));
      }

      const pm = url.pathname.match(/^\/api\/id\/asset\/([^/]+)\/preview$/);
      if (pm && request.method === "GET") {
        return withCORS(env, request, await handlePreview(pm[1], env));
      }

      // (Optional debug) Input proxy endpoint (kept, not used by main flow)
      const im = url.pathname.match(/^\/api\/id\/input\/([^/]+)$/);
      if (im && request.method === "GET") {
        return withCORS(env, request, await handleInputFetch(im[1], request, env));
      }

      if (url.pathname === "/api/id/key/check" && request.method === "POST") {
        return withCORS(env, request, await handleKeyCheck(request, env));
      }

      if (url.pathname === "/api/id/key/redeem" && request.method === "POST") {
        return withCORS(env, request, await handleRedeem(request, env));
      }

      const dm = url.pathname.match(/^\/api\/id\/dl\/([^/]+)$/);
      if (dm && request.method === "GET") {
        return withCORS(env, request, await handleDownload(dm[1], request, env));
      }

      if (url.pathname === "/api/admin/keys/create" && request.method === "POST") {
        return withCORS(env, request, await handleAdminCreateKeys(request, env));
      }

      return withCORS(env, request, json({ ok: false, error: "NOT_FOUND" }, 404));
    } catch (e) {
      return withCORS(env, request, json({ ok: false, error: "SERVER_ERROR", detail: String(e?.message || e) }, 500));
    }
  }
};

// -------------------- basics --------------------

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function withCORS(env, req, resp) {
  const origin = req.headers.get("Origin") || "";
  const allow = String(env.ALLOW_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const h = new Headers(resp.headers);
  if (allow.includes(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Credentials", "true");
  }
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return new Response(resp.body, { status: resp.status, headers: h });
}

function nowISO() { return new Date().toISOString(); }
function addSecondsISO(sec) { return new Date(Date.now() + sec * 1000).toISOString(); }
function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  // fallback
  const a = crypto.getRandomValues(new Uint8Array(16));
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  const hex = [...a].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}


function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    out[k] = decodeURIComponent(v.join("=") || "");
  }
  return out;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function hintCode(code) {
  const c = String(code || "").replace(/\s+/g, "");
  return c.slice(0, 5) + "…" + c.slice(-4);
}

async function getOrCreateUserId(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  let userId = cookies["user_id"];
  let setCookie = null;

  if (!userId || userId.length < 10) {
    userId = uuid();
    setCookie = `user_id=${encodeURIComponent(userId)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`;
  }

  await env.DB.prepare("INSERT OR IGNORE INTO users(user_id, created_at) VALUES(?,?)")
    .bind(userId, nowISO()).run();

  return { userId, setCookie };
}

async function decodeDataUrlToBytes(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error("BAD_DATA_URL");
  const mime = m[1] || "application/octet-stream";
  const b64 = m[2];
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return { bytes: bin, mime };
}

async function fetchBytesFromUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FETCH_IMG_${r.status}`);
  const ct = r.headers.get("content-type") || "image/png";
  const ab = await r.arrayBuffer();
  return { bytes: new Uint8Array(ab), mime: ct };
}

// -------------------- base64/dataURL helpers --------------------

function bytesToBase64(bytes) {
  // chunk to avoid call stack issues
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function toDataUrl(mime, bytes) {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

// -------------------- input downscale --------------------
// reduce payload; improves Ark acceptance + speed

async function downscaleToJpeg(bytes, mime, opts = {}) {
  const MAX_EDGE = Number(opts.maxEdge || 1280);
  const QUALITY1 = Number(opts.quality1 || 0.85);
  const QUALITY2 = Number(opts.quality2 || 0.7);
  const MAX_BYTES = Number(opts.maxBytes || 2_000_000);

  try {
    const blob = new Blob([bytes], { type: mime });
    const bmp = await createImageBitmap(blob);

    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);

    let outBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: QUALITY1 });
    let ab = await outBlob.arrayBuffer();
    let outBytes = new Uint8Array(ab);

    if (outBytes.length > MAX_BYTES) {
      outBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: QUALITY2 });
      ab = await outBlob.arrayBuffer();
      outBytes = new Uint8Array(ab);
    }

    return { bytes: outBytes, mime: "image/jpeg" };
  } catch {
    // fallback: no image APIs in runtime, return original
    return { bytes, mime };
  }
}

// -------------------- DB aux table --------------------

let _auxReady = false;
async function ensureAuxTables(env) {
  if (_auxReady) return;

  // short-lived token table (kept for debugging input endpoint)
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS id_inputs (
      asset_id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_id_inputs_expires ON id_inputs(expires_at);`).run();

  _auxReady = true;
}

// -------------------- prompt --------------------

function buildIdPhotoPrompt(bgColor) {
  const bg = { white: "纯白色极简背景", blue: "纯蓝色极简背景", red: "纯红色极简背景" }[bgColor] || "纯白色极简背景";

  return `根据上传的照片人物，生成一张真实、专业的职业证件照，用于正式证件与职业场景。

人物一致性要求：
人物五官、脸型与原照片保持一致，
不得改变人物的性别、年龄、身份特征或整体气质。
表情自然、沉稳，嘴角轻微上扬，
呈现温和、自信但不夸张的职业微笑。
眼神正视正前方，神态稳定、可信。

发型与面部状态：
保持原照片中的发型结构与长度，仅做轻微整理，
头发自然服帖、干净利落，无碎发、无明显造型痕迹。
发际线与发量保持真实，不做夸张美化。
在不改变真实骨相的前提下，
对因拍摄角度或表情造成的轻微面部不对称进行自然校正，
仅恢复自然中立状态，不进行明显对称化或美颜处理。

构图与头部完整性：
构图为正面职业胸像（头部与上胸区域），人物居中。
如参考照片中头顶存在裁切，
请在保持人物五官与脸型一致的前提下，
自然补全头部上方区域，
为头部保留合理留白空间，避免贴近画面边缘。

穿着风格：
深色商务西装外套，内搭浅色衬衫，
整体正式、简洁、职业，不时尚化、不夸张。

背景与灯光：
${bg}，干净通透，无任何杂物。
画面中不得出现摄影灯、灯架、影棚设备或拍摄器材。
采用专业商业人像摄影的柔和均匀布光效果，
光线自然明亮，无明显硬阴影，
仅呈现灯光效果，不出现任何灯光设备。

画面规格：
画面比例为 2:3（aspect ratio 2:3），竖幅 portrait 2:3。
整体风格接近高质量职业证件照，
真实、克制、专业，适合长期用于正式场合。`;
}

// -------------------- Volc Ark --------------------

async function callVolcArkImageToImage({ prompt, image }, env) {
  const endpoint = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
  const body = {
    model: String(env.ARK_MODEL || "doubao-seedream-4-5-251128").trim(),
    prompt,
    image, // <= DataURL/base64 or URL (we use DataURL now)
    size: String(env.ARK_SIZE || "2K").trim(),
    watermark: false
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.ARK_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data?.data?.[0]?.url) {
    throw new Error("ARK_RESPONSE_ERROR: " + JSON.stringify(data).slice(0, 2000));
  }
  return { url: data.data[0].url, size: data.data[0].size || "" };
}

// -------------------- handlers --------------------

async function handleGenerate(request, env) {
  const { userId, setCookie } = await getOrCreateUserId(request, env);
  const body = await request.json().catch(() => null);

  const bgColor = String(body?.bgColor || "white");
  if (!["white", "blue", "red"].includes(bgColor)) {
    return json({ ok: false, error: "BAD_BG_COLOR" }, 400, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  const imgDataUrl = body?.images?.[0];
  if (!imgDataUrl) {
    return json({ ok: false, error: "MISSING_IMAGE" }, 400, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  const assetId = "id_" + uuid().replace(/-/g, "").slice(0, 16);

  // 1) Decode and downscale input
  let { bytes: inBytes, mime: inMime } = await decodeDataUrlToBytes(imgDataUrl);
  ({ bytes: inBytes, mime: inMime } = await downscaleToJpeg(inBytes, inMime, {
    maxEdge: 1280,
    quality1: 0.85,
    quality2: 0.7,
    maxBytes: 1_500_000
  }));

  // 2) Save input to R2 for auditing/debug (optional but useful)
  const inputKey = `idphoto/${assetId}/input.jpg`;
  await env.BUCKET.put(inputKey, inBytes, { httpMetadata: { contentType: inMime } });

  // 3) Create a short-lived token entry (for optional /api/id/input debug)
  const inputTTL = parseInt(env.INPUT_TTL_SECONDS || "600", 10);
  const token = "t_" + uuid().replace(/-/g, "");
  const expiresAt = addSecondsISO(inputTTL);
  await env.DB.prepare(
    "INSERT OR REPLACE INTO id_inputs(asset_id, token, expires_at, created_at) VALUES(?,?,?,?)"
  ).bind(assetId, token, expiresAt, nowISO()).run();

  // 4) Build prompt
  const prompt = buildIdPhotoPrompt(bgColor);

  // 5) IMPORTANT: send input as DataURL (avoid Ark downloading your workers.dev)
  const inputDataUrl = toDataUrl(inMime, inBytes);

  const out = await callVolcArkImageToImage({ prompt, image: inputDataUrl }, env);

  // 6) Fetch output image and store to R2
  const { bytes: outBytes, mime: outMime } = await fetchBytesFromUrl(out.url);

  const previewKey = `idphoto/${assetId}/preview.png`;
  const hdKey = `idphoto/${assetId}/hd.png`;

  await env.BUCKET.put(hdKey, outBytes, { httpMetadata: { contentType: outMime } });
  await env.BUCKET.put(previewKey, outBytes, { httpMetadata: { contentType: outMime } });

  await env.DB.prepare(
    "INSERT INTO id_assets(asset_id, created_at, bg_color, preview_r2_key, hd_r2_key, meta) VALUES(?,?,?,?,?,?)"
  )
    .bind(assetId, nowISO(), bgColor, previewKey, hdKey, JSON.stringify({ arkSize: out.size }))
    .run();

  await env.DB.prepare("INSERT INTO logs(id, user_id, event, meta, created_at) VALUES(?,?,?,?,?)")
    .bind(uuid(), userId, "id_generate", JSON.stringify({ assetId, bgColor }), nowISO())
    .run();

  const previewUrl = `/api/id/asset/${assetId}/preview`;
  return json({ ok: true, assetId, previewUrl }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
}

async function handleInputFetch(assetId, request, env) {
  // debug endpoint only (not used by main flow)
  const u = new URL(request.url);
  const token = u.searchParams.get("token") || "";

  const row = await env.DB.prepare("SELECT token, expires_at FROM id_inputs WHERE asset_id=?")
    .bind(assetId).first();
  if (!row) return new Response("not found", { status: 404 });

  if (!token || token !== row.token) return new Response("forbidden", { status: 403 });
  if (row.expires_at <= nowISO()) return new Response("expired", { status: 403 });

  const inputKey = `idphoto/${assetId}/input.jpg`;
  const obj = await env.BUCKET.get(inputKey);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (obj.size != null) headers.set("Content-Length", String(obj.size));
  headers.set("Cache-Control", "private, max-age=0");
  return new Response(obj.body, { status: 200, headers });
}

async function handlePreview(assetId, env) {
  const row = await env.DB.prepare("SELECT preview_r2_key FROM id_assets WHERE asset_id=?")
    .bind(assetId).first();
  if (!row) return json({ ok: false, error: "ASSET_NOT_FOUND" }, 404);

  const obj = await env.BUCKET.get(row.preview_r2_key);
  if (!obj) return json({ ok: false, error: "PREVIEW_NOT_FOUND" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(obj.body, { status: 200, headers });
}

async function handleKeyCheck(request, env) {
  const body = await request.json().catch(() => null);
  const key = String(body?.key || "").trim();
  if (!key) return json({ ok: false, error: "BAD_REQUEST" }, 400);

  const hash = await sha256Hex(key);
  const row = await env.DB.prepare("SELECT total_uses, used_uses, expires_at FROM redeem_codes WHERE code_hash=?")
    .bind(hash).first();

  if (!row) return json({ ok: false, error: "KEY_INVALID" }, 200);
  if (row.expires_at && row.expires_at <= nowISO()) return json({ ok: false, error: "KEY_EXPIRED" }, 200);

  const remaining = Math.max(0, Number(row.total_uses) - Number(row.used_uses));
  if (remaining <= 0) return json({ ok: false, error: "KEY_USED_UP" }, 200);

  return json({ ok: true, remainingUses: remaining }, 200);
}

async function handleRedeem(request, env) {
  const { userId, setCookie } = await getOrCreateUserId(request, env);
  const body = await request.json().catch(() => null);

  const key = String(body?.key || "").trim();
  const assetId = String(body?.assetId || "").trim();
  if (!key || !assetId) return json({ ok: false, error: "BAD_REQUEST" }, 400, setCookie ? { "Set-Cookie": setCookie } : {});

  const asset = await env.DB.prepare("SELECT hd_r2_key FROM id_assets WHERE asset_id=?").bind(assetId).first();
  if (!asset) return json({ ok: false, error: "ASSET_NOT_FOUND" }, 404, setCookie ? { "Set-Cookie": setCookie } : {});

  const hash = await sha256Hex(key);
  const now = nowISO();

  const res = await env.DB.prepare(
    `UPDATE redeem_codes
     SET used_uses = used_uses + 1
     WHERE code_hash = ?
       AND (expires_at IS NULL OR expires_at > ?)
       AND used_uses < total_uses`
  ).bind(hash, now).run();

  if (!res.success || res.meta.changes !== 1) {
    const row = await env.DB.prepare("SELECT total_uses, used_uses, expires_at FROM redeem_codes WHERE code_hash=?")
      .bind(hash).first();
    if (!row) return json({ ok: false, error: "KEY_INVALID" }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
    if (row.expires_at && row.expires_at <= now) return json({ ok: false, error: "KEY_EXPIRED" }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
    const remaining = Math.max(0, Number(row.total_uses) - Number(row.used_uses));
    if (remaining <= 0) return json({ ok: false, error: "KEY_USED_UP" }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
    return json({ ok: false, error: "KEY_REDEEM_FAILED" }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  const row2 = await env.DB.prepare("SELECT total_uses, used_uses FROM redeem_codes WHERE code_hash=?")
    .bind(hash).first();
  const remainingUses = row2 ? Math.max(0, Number(row2.total_uses) - Number(row2.used_uses)) : 0;

  const grantId = "g_" + uuid().replace(/-/g, "").slice(0, 18);
  const ttl = parseInt(env.GRANT_TTL_SECONDS || "600", 10);

  await env.DB.prepare(
    "INSERT INTO grants(grant_id, user_id, asset_id, kind, expires_at, used_at, created_at) VALUES(?,?,?,?,?,?,?)"
  ).bind(grantId, userId, assetId, "redeem", addSecondsISO(ttl), null, nowISO()).run();

  await env.DB.prepare("INSERT INTO logs(id, user_id, event, meta, created_at) VALUES(?,?,?,?,?)")
    .bind(uuid(), userId, "id_grant_redeem", JSON.stringify({ grantId, assetId, codeHint: hintCode(key) }), nowISO())
    .run();

  return json({ ok: true, remainingUses, downloadUrl: `/api/id/dl/${grantId}` }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
}

async function handleDownload(grantId, request, env) {
  const { userId, setCookie } = await getOrCreateUserId(request, env);

  const MAX_DOWNLOADS = parseInt(env.GRANT_MAX_DOWNLOADS || "3", 10);

  const g = await env.DB.prepare(
    "SELECT asset_id, expires_at, used_at, download_count FROM grants WHERE grant_id=? AND user_id=?"
  ).bind(grantId, userId).first();

  if (!g) {
    return json({ ok: false, error: "GRANT_NOT_FOUND" }, 404, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  if (g.expires_at <= nowISO()) {
    return json({ ok: false, error: "GRANT_EXPIRED" }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  const currentCount = Number(g.download_count || 0);

  // If already hit limit, block
  if (currentCount >= MAX_DOWNLOADS) {
    return json({ ok: false, error: "GRANT_DOWNLOAD_LIMIT" }, 200, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  const asset = await env.DB.prepare("SELECT hd_r2_key FROM id_assets WHERE asset_id=?")
    .bind(g.asset_id).first();

  if (!asset) {
    return json({ ok: false, error: "ASSET_NOT_FOUND" }, 404, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  // Increment download_count BEFORE returning the file, so retries are counted deterministically.
  // (If you want to be even more user-friendly, you can count after successful R2 get.)
  const newCount = currentCount + 1;

  await env.DB.prepare(
    "UPDATE grants SET download_count=?, used_at=? WHERE grant_id=?"
  ).bind(
    newCount,
    newCount >= MAX_DOWNLOADS ? nowISO() : null,
    grantId
  ).run();

  const obj = await env.BUCKET.get(asset.hd_r2_key);
  if (!obj) {
    return json({ ok: false, error: "HD_NOT_FOUND" }, 404, setCookie ? { "Set-Cookie": setCookie } : {});
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=0");
  headers.set("Content-Disposition", `attachment; filename="aifura_idphoto_${g.asset_id}.png"`);
  if (setCookie) headers.set("Set-Cookie", setCookie);

  return new Response(obj.body, { status: 200, headers });
}


// -------------------- admin: keys --------------------

async function handleAdminCreateKeys(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!env.ADMIN_API_KEY || token !== env.ADMIN_API_KEY) {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const body = await request.json().catch(() => null);
  const count = Math.min(5000, Math.max(1, Number(body?.count || 200)));
  const totalUses = Math.max(1, Number(body?.totalUses || 1));
  const expiresDays = body?.expiresDays ? Number(body.expiresDays) : null;
  const note = String(body?.note || "");

  const keys = [];
  const createdAt = nowISO();
  const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null;

  for (let i = 0; i < count; i++) {
    const raw = `AIFURA-${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
    const h = await sha256Hex(raw);

    await env.DB.prepare(
      "INSERT OR IGNORE INTO redeem_codes(code_hash, code_hint, total_uses, used_uses, expires_at, created_at, note) VALUES(?,?,?,?,?,?,?)"
    ).bind(h, hintCode(raw), totalUses, 0, expiresAt, createdAt, note).run();

    keys.push(raw);
  }

  return json({ ok: true, keys, totalUses, expiresAt }, 200);
}

