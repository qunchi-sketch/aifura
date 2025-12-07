// main.js
// 首页逻辑：加载 aipps.json、渲染卡片、搜索、排序

let allApps = [];

// 1. 页面加载完成后，先读取 aipps.json
document.addEventListener("DOMContentLoaded", () => {
  fetch("aipps.json")
    .then((res) => res.json())
    .then((data) => {
      allApps = data || [];
      renderCards(allApps);
    })
    .catch((err) => {
      console.error("加载 aipps.json 出错:", err);
      const grid = document.getElementById("app-list");
      if (grid) {
        grid.innerHTML = `<div style="font-size:12px;color:#9ca3af;">
          Failed to load AIPPs (aipps.json). Please check the file path.
        </div>`;
      }
    });

  setupSearch();
  setupSort();
});

// 2. 渲染卡片
function renderCards(list) {
  const grid = document.getElementById("app-list");
  if (!grid) return;

  grid.innerHTML = "";

  if (!list || list.length === 0) {
    grid.innerHTML = `<div style="font-size:12px;color:#9ca3af;">
      No AIPPs found. Try another keyword or upload your own AIPP.
    </div>`;
    return;
  }

  list.forEach((app) => {
    const card = document.createElement("article");
    card.className = "app-card";

    // 排序用的数据
    card.dataset.id = app.id;
    card.dataset.stars = app.stars || 0;
    card.dataset.heat = app.heat || 0;
    card.dataset.date = app.uploadTime || "";

    const tagsHtml = (app.tags || [])
      .map((tag) => `<span class="tag-pill">${tag}</span>`)
      .join("");

    // 处理作者和联系方式
    const authorName = escapeHtml(app.author || "Anonymous");
    const contactLink = app.contact 
      ? `<a href="${app.contact}" target="_blank" class="author-contact-link">Contact</a>` 
      : "";

    // 修改了这里：
    // 1. 删除了 header 里的作者信息
    // 2. 将作者信息移动到了 app-card-meta 中
    card.innerHTML = `
      <div class="app-card-header">
        <div class="app-card-badge">HTML</div>
      </div>

      <div class="app-card-title">${escapeHtml(app.title || "Untitled AIPP")}</div>
      <div class="app-card-desc">
        ${escapeHtml(app.description || "")}
      </div>
      
      <div class="app-card-meta">
        <span>★ ${(app.stars || 0).toString()}</span>
        <span>· Heat ${(app.heat || 0).toString()}</span>
        
        <span style="opacity:0.3; margin:0 2px;">|</span>
        <span>By ${authorName}</span>
        ${contactLink}
      </div>
      
      <div class="app-card-tags">
        ${tagsHtml}
      </div>

      <div style="margin-top:auto; padding-top:12px; display:flex; gap:8px;">
        <a href="${app.fileUrl || "#"}" target="_blank" class="btn btn-xs btn-primary" style="flex:1;">
          Run App
        </a>
        <a href="detail.html?id=${encodeURIComponent(app.id)}" class="btn btn-xs btn-outline">
          Details
        </a>
      </div>
    `;

    grid.appendChild(card);
  });
}
// 3. 搜索逻辑：绑定首页大搜索框 + 顶部小搜索框
function setupSearch() {
  const heroInput = document.getElementById("hero-search-input");
  const heroBtn = document.getElementById("hero-search-btn");
  const headerInput = document.getElementById("header-search-input");

  function doSearch(keyword) {
    if (!allApps || allApps.length === 0) return;
    const kw = (keyword || "").toLowerCase().trim();

    if (!kw) {
      renderCards(allApps);
      return;
    }

    const filtered = allApps.filter((app) => {
      const title = (app.title || "").toLowerCase();
      const desc = (app.description || "").toLowerCase();
      const tags = (app.tags || []).join(" ").toLowerCase();
      return (
        title.includes(kw) ||
        desc.includes(kw) ||
        tags.includes(kw)
      );
    });

    renderCards(filtered);
  }

  if (heroBtn && heroInput) {
    heroBtn.addEventListener("click", () => doSearch(heroInput.value));
    heroInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch(heroInput.value);
    });
  }

  if (headerInput) {
    headerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch(headerInput.value);
    });
  }
}

// 4. 排序逻辑：和下拉框 #sort-select 绑定
function setupSort() {
  const select = document.getElementById("sort-select");
  if (!select) return;

  select.addEventListener("change", () => {
    sortList(select.value);
  });
}

function sortList(type) {
  if (!allApps || allApps.length === 0) return;
  const list = [...allApps];

  if (type === "stars") {
    list.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  } else if (type === "heat") {
    list.sort((a, b) => (b.heat || 0) - (a.heat || 0));
  } else if (type === "date") {
    list.sort(
      (a, b) =>
        new Date(b.uploadTime || 0).getTime() -
        new Date(a.uploadTime || 0).getTime()
    );
  }

  renderCards(list);
}

// 5. 简单转义，防止 title/description 里有特殊符号
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


