// main.js v2.0 - 支持中英文切换
// 包含：数据加载、卡片渲染、搜索、排序、国际化(i18n)

/* =========================================
   1. Translation Dictionary (翻译字典)
   ========================================= */
const i18nData = {
  en: {
    brandSub: "AI-generated apps for everyone",
    navBrowse: "Browse",
    navUpload: "Upload",
    navAbout: "About",
    heroLabel: "Platform for AI-generated apps",
    heroTitle: "AI-generated apps for everyone, <br><span>simple, fast and ready when you are.</span>",
    heroSubtitle: "Aifura is where you discover AI-generated apps designed to be lightweight, easy to use and instantly helpful — from PDFs and spreadsheets to everyday workflows.",
    searchPlaceholder: "Search: pdf, excel, image, merge, split...",
    btnSearch: "Search AIPPs",
    btnUpload: "+ Upload your AIPP",
    sortLabel: "Sort by:",
    sortHeat: "Trending",
    sortStars: "Top rated",
    sortDate: "Newest",
    panelTitle: "What is an AIPP?",
    panelList1: "• Small, practical apps created with the help of AI",
    panelList2: "• Run instantly in your browser, with no installation",
    panelList3: "• Easy to use and easy to share",
    panelList4: "• Built for people today and AI workflows tomorrow",
    valueTitle: "Why AIPPs matter",
    valueP1: "<strong>Made by everyone, made for everyone.</strong><br>AIPPs are created by people and enhanced by AI — small, practical apps anyone can build and share.",
    valueP2: "<strong>Local-first. Private by design.</strong><br>Most AIPPs run entirely in your browser with no server processing. Your files never leave your device.",
    secTitle: "Latest AIPPs",
    secSubtitle: "AI-generated apps that do the work for you. Click into details to see how each one works and start using it.",
    btnRun: "Run App",
    btnDetail: "Details",
    footerText: "AI-generated apps for everyone.",
    footerLinks: "More tools at aifura.com"
  },
  zh: {
    brandSub: "人人皆可用的 AI 微应用",
    navBrowse: "浏览",
    navUpload: "上传",
    navAbout: "关于",
    heroLabel: "AI 微应用分发平台",
    heroTitle: "人人皆可用的 AI 微应用，<br><span>简单、快速，随时待命。</span>",
    heroSubtitle: "在 Aifura 发现轻量级、无需安装的 AI 生成工具——从 PDF 处理、Excel 整理到日常工作流，即开即用。",
    searchPlaceholder: "搜索: pdf, excel, 图片处理, 合并...",
    btnSearch: "搜索应用",
    btnUpload: "+ 上传你的应用",
    sortLabel: "排序:",
    sortHeat: "热度最高",
    sortStars: "评分最高",
    sortDate: "最新上传",
    panelTitle: "什么是 AIPP?",
    panelList1: "• AI 辅助生成的小型实用工具",
    panelList2: "• 浏览器内即开即用，无需安装",
    panelList3: "• 易于使用，便于分享",
    panelList4: "• 为当下而生，为 AI 工作流铺路",
    valueTitle: "为什么需要 AIPP?",
    valueP1: "<strong>人人创造，人人享用。</strong><br>AIPP 是由人类构思、AI 编写的实用小工具。在 Aifura，每个人都可以成为创造者。",
    valueP2: "<strong>本地优先，隐私至上。</strong><br>绝大多数 AIPP 纯前端运行，无服务器交互。你的文件永远不会离开你的设备，安全且私密。",
    secTitle: "最新应用",
    secSubtitle: "这些工具将自动化你的繁琐工作。点击详情查看使用方法。",
    btnRun: "打开应用",
    btnDetail: "查看详情",
    footerText: "人人皆可用的 AI 微应用。",
    footerLinks: "更多工具尽在 aifura.com"
  }
};

let allApps = [];
let currentLang = localStorage.getItem("aifura_lang") || "en"; // 默认英语

document.addEventListener("DOMContentLoaded", () => {
  // 1. 初始化语言
  applyLanguage(currentLang);
  setupLanguageSwitcher();

  // 2. 加载数据
  fetch("aipps.json")
    .then((res) => res.json())
    .then((data) => {
      allApps = data || [];
      renderCards(allApps);
    })
    .catch((err) => {
      console.error("Error loading aipps.json:", err);
      const grid = document.getElementById("app-list");
      if (grid) grid.innerHTML = `<div style="color:#9ca3af;">Failed to load data.</div>`;
    });

  setupSearch();
  setupSort();
});

/* =========================================
   2. i18n Logic (语言切换核心)
   ========================================= */
function setupLanguageSwitcher() {
  const btn = document.getElementById("lang-toggle");
  if (!btn) return;

  // 初始化按钮文字
  updateBtnText(btn);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    // 切换语言状态
    currentLang = currentLang === "en" ? "zh" : "en";
    localStorage.setItem("aifura_lang", currentLang); // 记住选择
    
    // 应用新语言
    applyLanguage(currentLang);
    updateBtnText(btn);
    
    // 重新渲染卡片（因为卡片内容也需要变）
    renderCards(allApps);
  });
}

function updateBtnText(btn) {
  // 如果当前是英文，按钮显示 "中" 提示可以切中文，反之亦然
  btn.textContent = currentLang === "en" ? "中" : "EN";
}

function applyLanguage(lang) {
  const dict = i18nData[lang];
  if (!dict) return;

  // 1. 查找所有带有 data-i18n 属性的元素并替换文本
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      // 如果是innerHTML (比如带有 <br> 或 <strong>)
      if (key === 'heroTitle' || key.startsWith('valueP')) {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // 2. 特殊处理：Input 的 placeholder
  const heroInput = document.getElementById("hero-search-input");
  if (heroInput) heroInput.placeholder = dict.searchPlaceholder;
  
  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) {
      sortSelect.options[0].text = dict.sortHeat;
      sortSelect.options[1].text = dict.sortStars;
      sortSelect.options[2].text = dict.sortDate;
  }
}

/* =========================================
   3. Render Cards (渲染卡片 - 支持双语)
   ========================================= */
function renderCards(list) {
  const grid = document.getElementById("app-list");
  if (!grid) return;

  grid.innerHTML = "";

  if (!list || list.length === 0) {
    grid.innerHTML = `<div style="font-size:12px;color:#9ca3af;">No AIPPs found.</div>`;
    return;
  }

  // 获取当前语言的按钮文字
  const dict = i18nData[currentLang];

  list.forEach((app) => {
    const card = document.createElement("article");
    card.className = "app-card";
    
    // 根据当前语言选择标题和描述
    // 如果是中文模式且有 title_cn，就用中文，否则回退到 title
    const displayTitle = (currentLang === 'zh' && app.title_cn) ? app.title_cn : app.title;
    const displayDesc = (currentLang === 'zh' && app.description_cn) ? app.description_cn : app.description;

    const authorName = escapeHtml(app.author || "Anonymous");
    const contactLink = app.contact 
      ? `<a href="${app.contact}" target="_blank" class="author-contact-link">Contact</a>` 
      : "";

    const tagsHtml = (app.tags || [])
      .map((tag) => `<span class="tag-pill">${tag}</span>`)
      .join("");

    card.innerHTML = `
      <div class="app-card-header">
        <div class="app-card-badge">HTML</div>
      </div>

      <div class="app-card-title">${escapeHtml(displayTitle)}</div>
      <div class="app-card-desc">${escapeHtml(displayDesc)}</div>
      
      <div class="app-card-meta">
        <span>★ ${app.stars || 0}</span>
        <span>· Heat ${app.heat || 0}</span>
        <span style="opacity:0.3; margin:0 2px;">|</span>
        <span>By ${authorName}</span>
        ${contactLink}
      </div>
      
      <div class="app-card-tags">${tagsHtml}</div>

      <div style="margin-top:auto; padding-top:12px; display:flex; gap:8px;">
        <a href="${app.fileUrl || "#"}" target="_blank" class="btn btn-xs btn-primary" style="flex:1;">
          ${dict.btnRun}
        </a>
        <a href="detail.html?id=${encodeURIComponent(app.id)}" class="btn btn-xs btn-outline">
          ${dict.btnDetail}
        </a>
      </div>
    `;

    grid.appendChild(card);
  });
}

// ...Search 和 Sort 逻辑保持不变...
function setupSearch() {
  const heroInput = document.getElementById("hero-search-input");
  const heroBtn = document.getElementById("hero-search-btn");
  const headerInput = document.getElementById("header-search-input");

  function doSearch(keyword) {
    if (!allApps || allApps.length === 0) return;
    const kw = (keyword || "").toLowerCase().trim();
    if (!kw) { renderCards(allApps); return; }

    const filtered = allApps.filter((app) => {
      // 搜索时同时匹配中文和英文标题
      const tEn = (app.title || "").toLowerCase();
      const tCn = (app.title_cn || "").toLowerCase();
      const dEn = (app.description || "").toLowerCase();
      const dCn = (app.description_cn || "").toLowerCase();
      const tags = (app.tags || []).join(" ").toLowerCase();
      return (
        tEn.includes(kw) || tCn.includes(kw) ||
        dEn.includes(kw) || dCn.includes(kw) ||
        tags.includes(kw)
      );
    });
    renderCards(filtered);
  }

  if (heroBtn && heroInput) {
    heroBtn.addEventListener("click", () => doSearch(heroInput.value));
    heroInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(heroInput.value); });
  }
  if (headerInput) {
    headerInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(headerInput.value); });
  }
}

function setupSort() {
  const select = document.getElementById("sort-select");
  if (!select) return;
  select.addEventListener("change", () => {
    // 排序逻辑不变，因为是基于数字/日期的
    if (!allApps) return;
    const type = select.value; // heat, stars, date
    // 注意：这里简单处理，实际上value是根据options text变的吗？
    // 为了稳健，我们在applyLanguage里只改了text，value还是 'heat', 'stars' 等，所以逻辑不用变。
    let list = [...allApps];
    if (type === "stars") list.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    else if (type === "heat") list.sort((a, b) => (b.heat || 0) - (a.heat || 0));
    else if (type === "date") list.sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime());
    
    renderCards(list);
  });
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
