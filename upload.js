// upload.js
// 上传页：当前版本仅做前端校验 + 提示，将来接 API 再补后端逻辑

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("upload-form");
  const statusEl = document.getElementById("upload-status");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = document.getElementById("aipp-title").value.trim();
    const desc = document.getElementById("aipp-description").value.trim();
    const tagsStr = document.getElementById("aipp-tags").value.trim();
    const fileInput = document.getElementById("aipp-file");
    const file = fileInput.files[0];

    if (!title || !desc || !tagsStr || !file) {
      setStatus("Please fill in all required fields.", true);
      return;
    }

    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);

    const newItem = {
      id: Date.now().toString(),
      title,
      description: desc,
      tags,
      fileName: file.name,
      uploadTime: new Date().toISOString(),
      stars: 0,
      heat: 0
    };

    console.log("模拟要上传的 AIPP 元数据:", newItem);
    console.log("模拟要上传的文件对象:", file);

    setStatus(
      "Frontend MVP only: form validated. In the real online version, this will upload your HTML and update aipps.json.",
      false
    );

    form.reset();
  });

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? "#f97373" : "#9ca3af";
  }
});
