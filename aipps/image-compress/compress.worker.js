// compress.worker.js (module)
// Browser Web Worker: decode -> resize -> iterative compress to target bytes
// No external libs.

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg?.type) return;

  try {
    if (msg.type === 'QUEUE') {
      const { profile, prefer, items } = msg;
      for (let i = 0; i < items.length; i++) {
        await processOne(items[i], profile, prefer);
      }
      self.postMessage({ type: 'ALL_DONE' });
      return;
    }

    if (msg.type === 'ONE') {
      const { profile, prefer, item } = msg;
      await processOne(item, profile, prefer);
      return;
    }
  } catch (err) {
    // If it's a queue-level error, we can't map to id reliably.
    self.postMessage({ type: 'ERROR', id: msg?.item?.id, error: String(err?.message || err) });
  }
};

async function processOne(item, profile, prefer) {
  const { id, type, buffer } = item;

  // progress
  self.postMessage({ type: 'PROGRESS', id, progress: 5 });

  // Decode
  const blob = new Blob([buffer], { type });
  const bitmap = await createImageBitmap(blob);

  self.postMessage({ type: 'PROGRESS', id, progress: 20 });

  // Resize (downscale if too large)
  const maxEdge = clamp(profile?.maxEdge ?? 2400, 800, 6000);
  const { width: w0, height: h0 } = bitmap;

  let w = w0, h = h0;
  const longEdge = Math.max(w0, h0);
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    w = Math.max(1, Math.round(w0 * scale));
    h = Math.max(1, Math.round(h0 * scale));
  }

  // Use OffscreenCanvas in worker
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  self.postMessage({ type: 'PROGRESS', id, progress: 45 });

  const targetBytes = clamp(profile?.targetBytes ?? 1024 * 1024, 100 * 1024, 10 * 1024 * 1024);

  // Decide output type
  // Prefer: social -> smart (jpeg/webp for photos; png/webp for png)
  // ecom -> webp or jpeg, tiny -> webp/jpegs
  const outType = pickOutputType(type, prefer);

  // Encode iteratively (quality search)
  const result = await encodeToTarget(canvas, outType, targetBytes, prefer, (p) => {
    self.postMessage({ type: 'PROGRESS', id, progress: p });
  });

  const outBlob = await result.blob.arrayBuffer(); // transfer-friendly
  self.postMessage({
    type: 'DONE',
    id,
    outBlob,
    outType: result.type,
    outSize: result.size,
    width: w,
    height: h
  }, [outBlob]);
}

function pickOutputType(inputType, prefer) {
  const isPng = inputType === 'image/png';
  const isJpeg = inputType === 'image/jpeg';
  const isWebp = inputType === 'image/webp';

  // If browser can't encode webp, fallback later; but modern browsers support it.
  // Rule-of-thumb:
  // - tiny: webp preferred
  // - ecom: webp preferred
  // - social: keep jpeg as jpeg, png as png unless huge, then webp
  if (prefer === 'tiny' || prefer === 'ecom') {
    return 'image/webp';
  }
  if (prefer === 'social') {
    if (isJpeg) return 'image/jpeg';
    if (isPng) return 'image/webp'; // often much smaller than png
    if (isWebp) return 'image/webp';
  }
  return 'image/webp';
}

async function encodeToTarget(canvas, mime, targetBytes, prefer, onProgress) {
  // If mime not supported by convertToBlob, fallback to jpeg
  const tryTypes = [mime, 'image/webp', 'image/jpeg', 'image/png'];

  // quality boundaries
  let qMin = 0.45, qMax = 0.92;
  if (prefer === 'ecom') { qMin = 0.6; qMax = 0.95; }
  if (prefer === 'tiny') { qMin = 0.25; qMax = 0.85; }

  // First pass: medium quality
  onProgress?.(60);

  let chosenType = null;
  let best = null;

  // Try a couple MIME options if needed
  for (const t of tryTypes) {
    const r = await searchQuality(canvas, t, targetBytes, qMin, qMax, onProgress);
    if (r?.blob) {
      chosenType = t;
      best = r;
      // If already under target, stop.
      if (r.blob.size <= targetBytes) break;
      // else keep trying other type (e.g., webp smaller than jpeg)
    }
  }

  // Last resort: if still larger, force downscale slightly and re-encode once
  if (best && best.blob.size > targetBytes) {
    onProgress?.(88);
    const { width, height } = canvas;
    const scale = Math.sqrt(targetBytes / best.blob.size); // heuristic
    const newW = Math.max(1, Math.floor(width * Math.min(0.95, Math.max(0.6, scale))));
    const newH = Math.max(1, Math.floor(height * Math.min(0.95, Math.max(0.6, scale))));
    const c2 = new OffscreenCanvas(newW, newH);
    const ctx2 = c2.getContext('2d', { alpha: true, desynchronized: true });
    ctx2.drawImage(canvas, 0, 0, newW, newH);
    const blob2 = await safeConvertToBlob(c2, chosenType || mime, clamp(best.q ?? 0.75, 0.2, 0.92));
    if (blob2) best = { blob: blob2, q: best.q ?? 0.75 };
  }

  onProgress?.(95);

  // finalize
  const out = best?.blob ?? await safeConvertToBlob(canvas, 'image/jpeg', 0.82);
  onProgress?.(100);

  return { blob: out, size: out.size, type: out.type };
}

async function searchQuality(canvas, type, targetBytes, qMin, qMax, onProgress) {
  // If PNG, quality ignored; just one shot
  if (type === 'image/png') {
    const b = await safeConvertToBlob(canvas, type, 0.92);
    return { blob: b, q: 1 };
  }

  // Binary search for quality
  let lo = qMin, hi = qMax;
  let best = null;

  for (let i = 0; i < 7; i++) {
    const q = (lo + hi) / 2;
    const b = await safeConvertToBlob(canvas, type, q);
    if (!b) return null;

    // progress mapping 60..85
    onProgress?.(60 + Math.round((i + 1) * 3.5));

    if (b.size <= targetBytes) {
      best = { blob: b, q };
      lo = q; // try higher quality
    } else {
      hi = q; // lower quality
    }
  }

  // If never got under target, return last attempt at lowest quality (hi)
  if (!best) {
    const b = await safeConvertToBlob(canvas, type, qMin);
    best = { blob: b, q: qMin };
  }
  return best;
}

async function safeConvertToBlob(canvas, type, quality) {
  try {
    return await canvas.convertToBlob({ type, quality });
  } catch {
    // fallback: try jpeg
    try { return await canvas.convertToBlob({ type: 'image/jpeg', quality: clamp(quality, 0.2, 0.92) }); }
    catch { return null; }
  }
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}
