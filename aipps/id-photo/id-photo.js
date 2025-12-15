import {
  generateIdPhoto,
  checkKey,
  redeemKey,
  startDownload,
} from "/aipps/id-photo/id-photo.api.js";

const els = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  bgRow: document.getElementById("bgRow"),
  btnGenerate: document.getElementById("btnGenerate"),
  btnReset: document.getElementById("btnReset"),
  statusBar: document.getElementById("statusBar"),

  previewEmpty: document.getElementById("previewEmpty"),
  previewBox: document.getElementById("previewBox"),
  previewImg: document.getElementById("previewImg"),
  pillBg: document.getElementById("pillBg"),

  unlockBlock: document.getElementById("unlockBlock"),
  keyInput: document.getElementById("keyInput"),
  btnCheckKey: document.getElementById("btnCheckKey"),
  btnRedeem: document.getElementById("btnRedeem"),
  keyMsg: document.getElementById("keyMsg"),

  btnRegen: document.getElementById("btnRegen"),
  btnDownload: document.getElementById("btnDownload"),
  wxTip: document.getElementById("wxTip"),
  downloadFallback: document.getElementById("downloadFallback"),
  hdInlineImg: document.getElementById("hdInlineImg"),
};

const state = {
  file: null,
  dataUrl: "",
  bgColor: "white",
  assetId: "",
  previewUrl: "",
  // redeem result
  downloadUrl: "",
  remainingUses: null,
  // ui
  busy: false,
};

const isWeChat = /MicroMessenger/i.test(navigator.userAgent || "");

init();

function init() {
  // Drag hover
  els.dropzone.addEventListener("dragenter", () => els.dropzone.classList.add("dragover"));
  els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("dragover"));
  els.dropzone.addEventListener("dragover", (e) => { e.preventDefault(); els.dropzone.classList.add("dragover"); });
  els.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("dragover");
    const f = e.dataTransfer?.files?.[0];
    if (f) onFilePicked(f);
  });

  // Click/keyboard to open file picker
  els.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") els.fileInput.click();
  });

  // File input
  els.fileInput.addEventListener("change", () => {
    const f = els.fileInput.files?.[0];
    if (f) onFilePicked(f);
  });

  // BG select
  els.bgRow.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-bg]");
    if (!btn) return;
    setBg(btn.dataset.bg);
  });

  // Actions
  els.btnGenerate.addEventListener("click", onGenerate);
  els.btnRegen.addEventListener("click", onGenerate);
  els.btnReset.addEventListener("click", resetAll);

  els.btnCheckKey.addEventListener("click", onCheckKey);
  els.keyInput.addEventListener("input", () => {
    els.btnRedeem.disabled = !state.assetId || !els.keyInput.value.trim();
    hideKeyMsg();
  });
  els.btnRedeem.addEventListener("click", onRedeem);

  els.btnDownload.addEventListener("click", onDownload);

  if (isWeChat) els.wxTip.hidden = false;
  render();
}

function setBg(bg) {
  if (!["white", "blue", "red"].includes(bg)) return;
  state.bgColor = bg;

  // UI highlight
  [...els.bgRow.querySelectorAll(".bgchip")].forEach(b => b.classList.toggle("selected", b.dataset.bg === bg));
  els.pillBg.textContent = bg === "white" ? "白底" : bg === "blue" ? "蓝底" : "红底";

  // Per your choice 1B: do NOT auto-generate
  showStatus("已切换底色，请点击「生成证件照」", "ok");
}

async function onFilePicked(file) {
  // basic guard
  if (file.size > 15 * 1024 * 1024) {
    showStatus("文件过大（>15MB），请压缩或换一张图片。", "bad");
    return;
  }

  // HEIC: browser support varies, warn early
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (name.endsWith(".heic") || type.includes("heic") || type.includes("heif")) {
    showStatus("检测到 HEIC/HEIF：部分浏览器不支持，请先转换为 JPG/PNG 再上传。", "bad");
    return;
  }

  state.file = file;
  state.dataUrl = await fileToDataUrl(file);
  state.assetId = "";
  state.previewUrl = "";
  state.downloadUrl = "";
  state.remainingUses = null;

  // enable generate
  showStatus("图片已就绪，请选择底色后点击「生成证件照」。", "ok");
  render();
}

async function onGenerate() {
  if (!state.dataUrl) return;
  if (state.busy) return;

  state.busy = true;
  state.assetId = "";
  state.previewUrl = "";
  state.downloadUrl = "";
  state.remainingUses = null;
  hideKeyMsg();
  showStatus("正在生成预览…", "");

  render();

  // rotate messages
  const tips = ["正在处理图像…", "正在生成证件照预览…", "即将完成…"];
  let tipIdx = 0;
  const tipTimer = setInterval(() => {
    if (!state.busy) return clearInterval(tipTimer);
    showStatus(tips[tipIdx++ % tips.length], "");
  }, 1200);

  try {
    const res = await generateIdPhoto({ dataUrl: state.dataUrl, bgColor: state.bgColor }, { timeoutMs: 60_000 });
    state.assetId = res.assetId;
    state.previewUrl = res.previewUrl;

    // show preview
    els.previewImg.src = state.previewUrl;
    els.previewImg.onload = () => {}; // keep for future
    showStatus("预览已生成。", "ok");

    // show unlock block (2A)
    els.unlockBlock.hidden = false;
    els.btnRedeem.disabled = !els.keyInput.value.trim();

    render();
  } catch (e) {
    const msg = normalizeErr(e);
    showStatus(`生成失败：${msg}`, "bad");
  } finally {
    state.busy = false;
    clearInterval(tipTimer);
    render();
  }
}

async function onCheckKey() {
  const key = els.keyInput.value.trim();
  if (!key) return showKeyMsg("请输入兑换码。", "bad");

  els.btnCheckKey.disabled = true;
  showKeyMsg("正在检查…", "");
  try {
    const res = await checkKey(key);
    if (res.ok) {
      showKeyMsg(`可用：剩余次数 ${res.remainingUses}`, "ok");
    } else {
      showKeyMsg(mapKeyError(res.error), "bad");
    }
  } catch (e) {
    showKeyMsg(`检查失败：${normalizeErr(e)}`, "bad");
  } finally {
    els.btnCheckKey.disabled = false;
  }
}

async function onRedeem() {
  if (!state.assetId) return showKeyMsg("请先生成预览。", "bad");
  const key = els.keyInput.value.trim();
  if (!key) return showKeyMsg("请输入兑换码。", "bad");

  els.btnRedeem.disabled = true;
  showKeyMsg("正在解锁…", "");
  try {
    const res = await redeemKey({ key, assetId: state.assetId }, { timeoutMs: 25_000 });
    if (!res.ok) {
      showKeyMsg(mapKeyError(res.error), "bad");
      els.btnRedeem.disabled = false;
      return;
    }

    state.downloadUrl = res.downloadUrl;
    state.remainingUses = res.remainingUses;

    showKeyMsg("解锁成功：请在 10 分钟内下载（一次性/限次）。", "ok");
    els.btnDownload.disabled = false;

    // WeChat: pre-show tip
    if (isWeChat) els.wxTip.hidden = false;
  } catch (e) {
    showKeyMsg(`解锁失败：${normalizeErr(e)}`, "bad");
    els.btnRedeem.disabled = false;
  } finally {
    render();
  }
}

function onDownload() {
  if (!state.downloadUrl) return;
  // attempt direct download
  try {
    startDownload(state.downloadUrl);
    // if WeChat blocks, user can still long-press fallback image
    if (isWeChat) enableInlineHdFallback();
  } catch (e) {
    enableInlineHdFallback();
    showStatus(`下载触发失败：${normalizeErr(e)}`, "bad");
  }
}

function enableInlineHdFallback() {
  // Show inline image for long-press save (WeChat-friendly)
  els.downloadFallback.hidden = false;
  els.hdInlineImg.src = state.downloadUrl;
}

function resetAll() {
  state.file = null;
  state.dataUrl = "";
  state.assetId = "";
  state.previewUrl = "";
  state.downloadUrl = "";
  state.remainingUses = null;
  state.busy = false;

  els.fileInput.value = "";
  els.unlockBlock.hidden = true;
  els.downloadFallback.hidden = true;
  els.hdInlineImg.src = "";
  hideKeyMsg();
  showStatus("", "");

  render();
}

function render() {
  const hasFile = !!state.dataUrl;
  const hasPreview = !!state.assetId && !!state.previewUrl;

  els.btnGenerate.disabled = !hasFile || state.busy;
  els.btnReset.disabled = !hasFile && !hasPreview ? true : state.busy;

  els.previewEmpty.hidden = hasPreview;
  els.previewBox.hidden = !hasPreview;

  els.btnRegen.disabled = !hasFile || state.busy;
  els.btnDownload.disabled = !state.downloadUrl;

  // unlock block only after preview (2A)
  els.unlockBlock.hidden = !hasPreview;

  // pill bg
  els.pillBg.textContent = state.bgColor === "white" ? "白底" : state.bgColor === "blue" ? "蓝底" : "红底";
}

function showStatus(text, kind) {
  if (!text) {
    els.statusBar.hidden = true;
    els.statusBar.textContent = "";
    els.statusBar.className = "status";
    return;
  }
  els.statusBar.hidden = false;
  els.statusBar.textContent = text;
  els.statusBar.className = "status" + (kind ? ` ${kind}` : "");
}

function showKeyMsg(text, kind) {
  els.keyMsg.hidden = false;
  els.keyMsg.textContent = text;
  els.keyMsg.className = "msg" + (kind ? ` ${kind}` : "");
}
function hideKeyMsg() {
  els.keyMsg.hidden = true;
  els.keyMsg.textContent = "";
  els.keyMsg.className = "msg";
}

function mapKeyError(code) {
  switch (code) {
    case "KEY_INVALID": return "兑换码无效。";
    case "KEY_EXPIRED": return "兑换码已过期。";
    case "KEY_USED_UP": return "兑换码已使用完。";
    case "ASSET_NOT_FOUND": return "预览已失效，请重新生成。";
    case "BAD_REQUEST": return "请求不完整，请重试。";
    default: return `操作失败（${code || "UNKNOWN"}）`;
  }
}

function normalizeErr(e) {
  const code = e?.payload?.error || e?.code || e?.message || "UNKNOWN";
  // If server returned detail, add short info
  const detail = e?.payload?.detail ? `：${String(e.payload.detail).slice(0, 120)}` : "";
  return String(code) + detail;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("READ_FILE_FAILED"));
    r.readAsDataURL(file);
  });
}
