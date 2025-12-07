// main.js v2.1 - 全站通用：支持首页、详情页、上传页的中英文切换
// 包含：数据加载、卡片渲染、搜索、排序、国际化(i18n)

/* =========================================
   1. Translation Dictionary (翻译字典)
   ========================================= */
const i18nData = {
  en: {
    // --- Global / Header / Footer ---
    brandSub: "AI-generated apps for everyone",
    navBrowse: "Browse",
    navUpload: "Upload",
    navAbout: "About",
    footerText: "AI-generated apps for everyone.",
    footerLinks: "More tools at aifura.com",
    
    // --- Home (Index) ---
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

    // --- Detail Page ---
    detailTagline: "AI-generated app · AIPP",
    detailWhat: "What this AIPP does",
    detailHow: "How to use this AIPP",
    detailBtnOpen: "Open AIPP",
    detailBtnDown: "Download HTML",
    detailMetaP: "• Open the app directly in your browser, no installation required.<br>• Follow the on-screen steps to upload files or enter the information it needs.<br>• Use it whenever you want a quick, repeatable way to handle this type of task.",

    // --- Upload Page ---
    uploadTitle: "Submit your AIPP",
    uploadSubtitle: "Join the 'Made by everyone' movement. Currently, we review every submission manually to ensure safety and quality.",
    uploadGuideTitle: "How to upload?",
    uploadList1: "<strong>Prepare your file:</strong> Ensure your AIPP works locally.",
    uploadList2: "<strong>Choose a method:</strong> Use the form (recommended) or send us an email.",
    uploadList3: "<strong>Wait for approval:</strong> We usually review and publish new tools within 24 hours.",
    uploadBtnForm: "Fill out Google Form",
    uploadBtnEmail: "Submit via Email",
    uploadEmailNote: "Sent to chiqun1995@foxmail.com",
    uploadLegal: "By submitting, you represent that you have the right to share this tool, and you agree to license it for free use on Aifura. We reserve the right to decline tools that are unsafe or low quality."
  },
  
  zh: {
    // --- 全局 ---
    brandSub: "人人皆可用的 AI 微应用",
    navBrowse: "浏览",
    navUpload: "上传",
    navAbout: "关于",
    footerText: "人人皆可用的 AI 微应用。",
    footerLinks: "更多工具尽在 aifura.com",

    // --- 首页 ---
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

    // --- 详情页 ---
    detailTagline: "AI 生成应用 · AIPP",
    detailWhat: "功能介绍",
    detailHow: "使用指南",
    detailBtnOpen: "打开应用",
    detailBtnDown: "下载源码",
    detailMetaP: "• 直接在浏览器中打开，无需安装。<br>• 按屏幕提示操作，上传文件或输入信息。<br>• 随时随地，快速处理重复性任务。",

    // --- 上传页 ---
    uploadTitle: "提交你的 AIPP",
    uploadSubtitle: "加入“人人创造”的浪潮。目前，我们会人工审核每一次提交，以确保安全和质量。",
    uploadGuideTitle: "如何上传？",
    uploadList1: "<strong>准备文件：</strong> 确保你的 AIPP 在本地可以正常运行。",
    uploadList2: "<strong>选择方式：</strong> 推荐使用 Google 表单，也可以发送邮件。",
    uploadList3: "<strong>等待审核：</strong> 我们通常会在 24 小时内审核并发布新工具。",
    uploadBtnForm: "填写 Google 表单",
    uploadBtnEmail: "通过邮件提交",
    uploadEmailNote: "发送至 chiqun1995@foxmail.com",
    uploadLegal: "提交即代表你拥有分享该工具的权利，并同意授权 Aifura 免费发布。我们保留拒绝不安全或低质量工具的权利。"
  }
};

let allApps = [];
let currentLang = localStorage.getItem("aifura_lang") || "en";

document.addEventListener("DOMContentLoaded", () => {
  // 1. 初始化语言 (所有页面都会执行)
  applyLanguage(currentLang);
  setupLanguageSwitcher();

  // 2. 如果是首页(有 app-list)，则加载数据
  const grid = document.getElementById("app-list");
  if (grid) {
    fetch("aipps.json")
      .then((res) => res.json())
      .then((data) => {
        allApps = data || [];
        renderCards(allApps);
      })
      .catch((err) => {
        console.error("Error loading aipps.json:", err);
        grid.innerHTML = `<div style="color:#9ca3af;">Failed to load data.</div>`;
      });
      
    setupSearch();
    setupSort();
  }
});

/* =========================================
   2. i18n Logic
   ========================================= */
function setupLanguageSwitcher() {
  const btn = document.getElementById("lang-toggle");
  if (!btn) return;

  updateBtnText(btn);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    currentLang = currentLang === "en" ? "zh" : "en";
    localStorage.setItem("aifura_lang", currentLang);
    
    applyLanguage(currentLang);
    updateBtnText(btn);
    
    // 如果在首页，重绘卡片以更新中英文内容
    if (document.getElementById("app-list")) {
      renderCards(allApps);
    }
    // 如果在详情页，刷新页面(简单粗暴)或者通知 detail.js 更新？
    // 为了简单，详情页切换语言后，建议重载页面，或者由 detail.js 监听变化
    // 这里我们做一个简单的处理：如果是详情页，直接刷新，让 detail.js 重新获取数据
    if (document.getElementById("detail-title")) {
       location.reload(); 
    }
  });
}

function updateBtnText(btn) {
  btn.textContent = currentLang === "en" ? "中" : "EN";
}

function applyLanguage(lang) {
  const dict = i18nData[lang];
  if (!dict) return;

  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      // 允许 HTML 的字段
      if (['heroTitle', 'valueP1', 'valueP2', 'detailMetaP', 'uploadList1', 'uploadList2', 'uploadList3'].includes(key)) {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // Handle placeholders / options
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
   3. Render Cards
   ========================================= */
function renderCards(list) {
  const grid = document.getElementById("app-list");
  if (!grid) return;

  grid.innerHTML = "";
  if (!list || list.length === 0) {
    grid.innerHTML = `<div style="font-size:12px;color:#9ca3af;">No AIPPs found.</div>`;
    return;
  }

  const dict = i18nData[currentLang];

  list.forEach((app) => {
    const card = document.createElement("article");
    card.className = "app-card";
    
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

// Search & Sort logic (unchanged)
function setupSearch() {
  const heroInput = document.getElementById("hero-search-input");
  const heroBtn = document.getElementById("hero-search-btn");
  const headerInput = document.getElementById("header-search-input");

  function doSearch(keyword) {
    if (!allApps || allApps.length === 0) return;
    const kw = (keyword || "").toLowerCase().trim();
    if (!kw) { renderCards(allApps); return; }

    const filtered = allApps.filter((app) => {
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
    if (!allApps) return;
    const type = select.value;
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
