// detail.js
// 详情页：根据 URL 参数 id 从 aipps.json 里找到对应 AIPP 并填充页面

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  if (!id) {
    showError("Missing AIPP id in URL.");
    return;
  }

  fetch("aipps.json")
    .then((res) => res.json())
    .then((data) => {
      const app = (data || []).find((item) => item.id === id);
      if (!app) {
        showError("AIPP not found. Please go back to Browse page.");
        return;
      }
      renderDetail(app);
    })
    .catch((err) => {
      console.error("加载 aipps.json 出错:", err);
      showError("Failed to load AIPP data.");
    });
});

function renderDetail(app) {
  const titleEl = document.getElementById("detail-title");
  const descEl = document.getElementById("detail-description");
  const timeEl = document.getElementById("detail-upload-time");
  const tagsEl = document.getElementById("detail-tags");
  const starsEl = document.getElementById("detail-stars");
  const heatEl = document.getElementById("detail-heat");
  const openBtn = document.getElementById("detail-open-app");
  const downloadBtn = document.getElementById("detail-download-app");

  if (titleEl) titleEl.textContent = app.title || "Untitled AIPP";
  if (descEl) descEl.textContent = app.description || "";
  if (timeEl)
    timeEl.textContent =
      "Uploaded: " +
      (app.uploadTime ? new Date(app.uploadTime).toLocaleString() : "");
  if (tagsEl) tagsEl.textContent = "Tags: " + (app.tags || []).join(", ");
  if (starsEl) starsEl.textContent = "★ " + (app.stars || 0) + " stars";
  if (heatEl) heatEl.textContent = "Heat: " + (app.heat || 0);

  if (openBtn && app.fileUrl) openBtn.href = app.fileUrl;
  if (downloadBtn && app.fileUrl) downloadBtn.href = app.fileUrl;
}

function showError(msg) {
  const titleEl = document.getElementById("detail-title");
  const descEl = document.getElementById("detail-description");
  if (titleEl) titleEl.textContent = "AIPP Not Found";
  if (descEl) descEl.textContent = msg;
}
