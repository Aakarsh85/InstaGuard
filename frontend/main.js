const API_BASE = CONFIG.API_BASE;

const manualTab = document.getElementById("manualTab");
const bulkTab = document.getElementById("bulkTab");
const manualPanel = document.getElementById("manualPanel");
const bulkPanel = document.getElementById("bulkPanel");
const predictManualBtn = document.getElementById("predictManualBtn");
const predictBulkBtn = document.getElementById("predictBulkBtn");
const manualSkeleton = document.getElementById("manualSkeleton");
const manualResultCard = document.getElementById("manualResultCard");
const manualError = document.getElementById("manualError");
const manualErrorText = document.getElementById("manualErrorText");
const bulkSkeleton = document.getElementById("bulkSkeleton");
const bulkResults = document.getElementById("bulkResults");
const bulkError = document.getElementById("bulkError");
const bulkErrorText = document.getElementById("bulkErrorText");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const themeToggle = document.getElementById("themeToggle");
const apiStatusText = document.getElementById("apiStatus");
const apiStatusDot = document.querySelector(".status-dot");
const fileInput = document.getElementById("fileInput");
const fileSelectedInfo = document.getElementById("fileSelectedInfo");
const uploadZoneInner = document.getElementById("uploadZoneInner");
const selectedFileName = document.getElementById("selectedFileName");
const removeFileBtn = document.getElementById("removeFileBtn");
const uploadZone = document.getElementById("uploadZone");
const usernameInput = document.getElementById("usernameInput");

let sessionHistory = [];
let bulkData = [];
let currentPage = 1;
const PAGE_SIZE = CONFIG.PAGE_SIZE;
let currentFilter = "all";

const savedTheme = localStorage.getItem("ig-theme") || "light";
if (savedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");

(function initParticles() {
  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function makeParticles() {
    particles = Array.from({ length: 32 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      alpha: Math.random() * 0.35 + 0.08
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(79,142,247,${p.alpha})`
        : `rgba(59,99,247,${p.alpha * 0.55})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", () => { resize(); makeParticles(); });
  resize(); makeParticles(); draw();
}
)();

manualTab?.addEventListener("click", () => switchTab("manual"));
bulkTab?.addEventListener("click", () => switchTab("bulk"));

function initFormListeners() {
  document.getElementById("presetBotBtn")?.addEventListener("click", () => loadPreset("bot"));
  document.getElementById("presetRealBtn")?.addEventListener("click", () => loadPreset("real"));
  document.getElementById("presetEdgeBtn")?.addEventListener("click", () => loadPreset("edge"));


  ["profile_pic", "private", "external_url"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", function () {
      updateToggleBadge(this);
      updatePreview();
      if (id === "profile_pic") computeLiveHints();
    });
  });

  ["followers", "following", "posts"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", function () {
      validateField(this);
      updatePreview();
    });
  });

  document.getElementById("username_text")?.addEventListener("input", onUsernameInput);
  document.getElementById("fullname_text")?.addEventListener("input", onFullnameInput);
  document.getElementById("bio_text")?.addEventListener("input", onBioInput);

  document.getElementById("predictManualBtn")?.addEventListener("click", predictManual);
  document.getElementById("predictBulkBtn")?.addEventListener("click", predictFile);
  document.getElementById("exportBtn")?.addEventListener("click", exportResults);

}

function switchTab(mode) {
  if (mode === "manual") {
    manualTab.classList.add("active"); bulkTab.classList.remove("active");
    manualPanel.classList.remove("hidden"); bulkPanel.classList.add("hidden");
  } else {
    bulkTab.classList.add("active"); manualTab.classList.remove("active");
    bulkPanel.classList.remove("hidden"); manualPanel.classList.add("hidden");
  }
}

document.getElementById("resetForm")?.addEventListener("click", () => {
  ["followers", "following", "posts"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; clearFieldState(el); }
  });

  ["profile_pic", "private", "external_url"].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) { cb.checked = false; updateToggleBadge(cb); }
  });

  ["username_text", "fullname_text", "bio_text"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["hint_username", "hint_fullname", "hint_bio"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });

  if (usernameInput) usernameInput.value = "";
  resetPreview();
  hide(manualResultCard);
  hide(manualError);
});

clearHistoryBtn?.addEventListener("click", () => {
  sessionHistory = [];
  renderHistory();
});

uploadZone?.addEventListener("dragover", e => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
uploadZone?.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone?.addEventListener("drop", e => {
  e.preventDefault(); uploadZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
});
fileInput?.addEventListener("change", () => { if (fileInput.files[0]) handleFileSelect(fileInput.files[0]); });

function handleFileSelect(file) {
  const name = file.name;
  if (!name.endsWith(".csv") && !name.endsWith(".json")) {
    showBulkError("Only CSV or JSON files are supported."); return;
  }
  if (selectedFileName) selectedFileName.textContent = name;
  show(fileSelectedInfo);
  if (uploadZoneInner) uploadZoneInner.classList.add("hidden");
}

removeFileBtn?.addEventListener("click", e => {
  e.stopPropagation();
  if (fileInput) fileInput.value = "";
  hide(fileSelectedInfo);
  if (uploadZoneInner) uploadZoneInner.classList.remove("hidden");
});

checkHealth();

window.predictManual = predictManual;
window.predictFile = predictFile;
window.exportResults = exportResults;
window.goToPage = goToPage;
window.replayHistory = replayHistory;
window.loadPreset = loadPreset;
window.validateField = validateField;
window.validateRatio = validateRatio;
window.updatePreview = updatePreview;
window.updateToggleBadge = updateToggleBadge;
window.buildPayload = buildPayload;
window.onUsernameInput = onUsernameInput;
window.onFullnameInput = onFullnameInput;
window.onBioInput = onBioInput;
window.computeLiveHints = computeLiveHints;