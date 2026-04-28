//C:\Users\acer\Desktop\pj\Final Year Project\frontend\script.js
// ============================================================
//  InstaGuard — script.js  (updated for new 11-feature model)
//  Features: history replay, demo presets, AI username fetch,
//            plain-English explanation, validation, session log,
//            hybrid engine breakdown
// ============================================================

const API_BASE = "https://instaguard-backend-2ldg.onrender.com/";

// ============================================================
// THEME PERSISTENCE — paste at the very top of script.js
// ============================================================

// 1. Apply saved theme immediately (runs before DOM is ready — prevents flash)
(function () {
  var saved = localStorage.getItem('ig-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// 2. Set a specific theme and save it
function setTheme(mode) {
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('ig-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('ig-theme', 'light');
  }
}

// 3. Toggle between light and dark
function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(isDark ? 'light' : 'dark');
}

// 4. Wire a toggle button by its ID (safe to call multiple times)
function initThemeToggle(btnId) {
  function attach() {
    var btn = document.getElementById(btnId);
    if (!btn || btn._themeInitialized) return;
    btn._themeInitialized = true;
    btn.addEventListener('click', toggleTheme);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
}

// 5. Auto-wire the toggle buttons used across all pages on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  initThemeToggle('themeToggle');
  initThemeToggle('navThemeToggle');
  initFormListeners();

  // landing.html + methodology.html — scroll nav + animations
  var nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // Landing page — metric bar scroll animation
  if (document.querySelector('.metrics-cards')) {
    var metricObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.mc-fill').forEach(function (bar) {
            bar.style.transition = 'width 1.1s cubic-bezier(0.16,1,0.3,1)';
          });
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.metrics-cards').forEach(function (el) {
      metricObserver.observe(el);
    });
  }

  // Methodology page — big metric bars + dataset bars scroll animation
  if (document.querySelector('.metrics-big-grid, .dataset-card')) {
    var mbgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.mbg-fill, .dsb-fill, .mc-fill').forEach(function (bar) {
            var w = bar.dataset.w;
            if (w) setTimeout(function () { bar.style.width = w + '%'; }, 100);
          });
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.metrics-big-grid, .dataset-card').forEach(function (el) {
      mbgObserver.observe(el);
    });
  }

  // Landing page — stagger card animations
  document.querySelectorAll('.step-card, .feature-card, .metric-card').forEach(function (el, i) {
    el.style.animationDelay = (i * 0.08) + 's';
  });

  // Methodology page — stagger pipeline steps
  document.querySelectorAll('.pipeline-step').forEach(function (el, i) {
    el.style.animationDelay = (i * 0.08) + 's';
  });
});

// ============================================================
// END THEME PERSISTENCE — your existing script.js code below
// ============================================================
// ── DOM refs ──────────────────────────────────────────────
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
// const fetchUsernameBtn = document.getElementById("fetchUsernameBtn");
const usernameInput = document.getElementById("usernameInput");

// ── State ─────────────────────────────────────────────────
let sessionHistory = [];
let bulkData = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let currentFilter = "all";

// ── Inject spin keyframe ───────────────────────────────────
//commented out because it is not needed
// const spinStyle = document.createElement("style");
// spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
// document.head.appendChild(spinStyle);

// ── Theme ─────────────────────────────────────────────────
const savedTheme = localStorage.getItem("ig-theme") || "light";
if (savedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");



// ── Health check ──────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      apiStatusText.textContent = "API Online";
      apiStatusDot.classList.add("online");
      apiStatusDot.classList.remove("offline");
    } else throw new Error();
  } catch {
    apiStatusText.textContent = "API Offline";
    apiStatusDot.classList.remove("online");
    apiStatusDot.classList.add("offline");
  }
}
checkHealth();

// ── Particle canvas ────────────────────────────────────────
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
})();

// ── Tab switching ─────────────────────────────────────────
manualTab?.addEventListener("click", () => switchTab("manual"));
bulkTab?.addEventListener("click", () => switchTab("bulk"));

// ── initFormListeners ──────────────────────────────────────
// Single place that wires ALL form interactions.
// Called once on DOMContentLoaded. Keeps HTML structure-only.
function initFormListeners() {
  // ── Preset buttons ──────────────────────────────────
  document.getElementById("presetBotBtn")?.addEventListener("click", () => loadPreset("bot"));
  document.getElementById("presetRealBtn")?.addEventListener("click", () => loadPreset("real"));
  document.getElementById("presetEdgeBtn")?.addEventListener("click", () => loadPreset("edge"));

  // ── AI estimator ────────────────────────────────────
  // document.getElementById("fetchUsernameBtn")?.addEventListener("click", fetchUsername);

  // ── Toggles ─────────────────────────────────────────
  ["profile_pic", "private", "external_url"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", function () {
      updateToggleBadge(this);
      updatePreview();
      if (id === "profile_pic") computeLiveHints();
    });
  });

  // ── Number inputs ────────────────────────────────────
  ["followers", "following", "posts"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", function () {
      validateField(this);
      updatePreview();
    });
  });

  // ── Text inputs ──────────────────────────────────────
  document.getElementById("username_text")?.addEventListener("input", onUsernameInput);
  document.getElementById("fullname_text")?.addEventListener("input", onFullnameInput);
  document.getElementById("bio_text")?.addEventListener("input", onBioInput);

  // ── Action buttons ───────────────────────────────────
  document.getElementById("predictManualBtn")?.addEventListener("click", predictManual);
  document.getElementById("predictBulkBtn")?.addEventListener("click", predictFile);
  document.getElementById("exportBtn")?.addEventListener("click", exportResults);

  // ── Username AI estimator — also triggers on Enter ───
  // usernameInput?.addEventListener("keydown", e => {
  //   if (e.key === "Enter") fetchUsername();
  // });
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

// ── Reset form ─────────────────────────────────────────────
document.getElementById("resetForm")?.addEventListener("click", () => {
  // Number inputs
  ["followers", "following", "posts"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; clearFieldState(el); }
  });

  // Toggle inputs
  ["profile_pic", "private", "external_url"].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) { cb.checked = false; updateToggleBadge(cb); }
  });

  // Text inputs
  ["username_text", "fullname_text", "bio_text"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear live hints
  ["hint_username", "hint_fullname", "hint_bio"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });

  if (usernameInput) usernameInput.value = "";
  resetPreview();
  hide(manualResultCard);
  hide(manualError);
});

// ── Validation ─────────────────────────────────────────────
const fieldRules = {
  followers: { max: 1e8 },
  following: { max: 1e8 },
  posts: { max: 1e6 },
  description_length: { max: 150 },
  fullname_words: { max: 20 },
};

function validateField(input) {
  const id = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb = document.getElementById(`fb_${id}`);
  const val = input.value.trim();
  if (!wrap || !fb) return true;
  if (val === "") { clearFieldState(input); fb.textContent = ""; fb.className = "field-feedback"; return true; }
  const num = Number(val);
  const rule = fieldRules[id];
  if (isNaN(num) || !isFinite(num)) { setInvalid(wrap, fb, "Must be a valid number."); return false; }
  if (num < 0) { setInvalid(wrap, fb, "Cannot be negative."); return false; }
  if (rule && num > rule.max) { setInvalid(wrap, fb, `Max: ${rule.max.toLocaleString()}`); return false; }
  if (id === "followers" && num === 0) { setWarn(wrap, fb, "0 followers — suspicious."); return true; }
  if (id === "following" && num > 5000) { setWarn(wrap, fb, "High following — possible bot."); return true; }
  setValid(wrap, fb, "✓");
  return true;
}

function validateRatio(input) {
  const id = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb = document.getElementById(`fb_${id}`);
  const val = input.value.trim();
  if (!wrap || !fb) return true;
  if (val === "") { clearFieldState(input); fb.textContent = ""; fb.className = "field-feedback"; return true; }
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) { setInvalid(wrap, fb, "Must be 0.0 – 1.0"); return false; }
  if (num < 0 || num > 1) { setInvalid(wrap, fb, "Value must be between 0 and 1"); return false; }
  if (num > 0.6) { setWarn(wrap, fb, "High ratio — unusual for real accounts."); return true; }
  setValid(wrap, fb, "✓");
  return true;
}

function setValid(w, f, m) { w.className = "field-input-wrap valid"; f.textContent = m; f.className = "field-feedback valid-msg"; }
function setInvalid(w, f, m) { w.className = "field-input-wrap invalid"; f.textContent = m; f.className = "field-feedback invalid-msg"; }
function setWarn(w, f, m) { w.className = "field-input-wrap"; f.textContent = "⚠ " + m; f.className = "field-feedback invalid-msg"; }

function clearFieldState(input) {
  const wrap = document.getElementById(`wrap_${input.id}`);
  if (wrap) wrap.className = "field-input-wrap";
}

function validateAll() {
  let ok = true;
  ["followers", "following", "posts"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateField(el)) ok = false;
  });
  return ok;
}

// ── Profile preview ────────────────────────────────────────
function updatePreview() {
  const followers = safeNum(document.getElementById("followers")?.value);
  const following = safeNum(document.getElementById("following")?.value);
  const posts = safeNum(document.getElementById("posts")?.value);
  const username = (document.getElementById("username_text")?.value || "").trim();
  const bio = (document.getElementById("bio_text")?.value || "").trim();
  const hasPic = document.getElementById("profile_pic")?.checked || false;

  document.getElementById("previewPosts").textContent = fmt(posts);
  document.getElementById("previewFollowers").textContent = fmt(followers);
  document.getElementById("previewFollowing").textContent = fmt(following);
  document.getElementById("previewName").textContent = username ? `@${username}` : "@username";

  const bioEl = document.getElementById("previewBio");
  if (bioEl) {
    if (!bio) bioEl.textContent = "No bio added.";
    else if (bio.length < 20) bioEl.textContent = `Short bio · ${bio.length} chars`;
    else bioEl.textContent = bio.length > 65 ? bio.substring(0, 65) + "…" : bio;
  }
}

// Now also factors in profile picture presence
function computeRiskSignal(followers, following, posts, bioLen, ratio, hasPic) {
  let score = 0;
  if (!hasPic) score += 0.35;   // No profile pic — strong signal
  if (followers < 20) score += 0.25;
  if (following > 2000) score += 0.20;
  if (posts < 3) score += 0.15;
  if (bioLen < 5) score += 0.10;
  if (ratio > 0.5) score += 0.20;
  return Math.min(score, 1);
}

function resetPreview() {
  ["previewPosts", "previewFollowers", "previewFollowing"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });
  const bio = document.getElementById("previewBio");
  const name = document.getElementById("previewName");
  const badge = document.getElementById("previewBadge");
  const avatar = document.getElementById("previewAvatar");
  if (bio) bio.textContent = "Bio will appear here...";
  if (name) name.textContent = "@username";
  if (badge) { badge.textContent = "?"; badge.className = "profile-preview-badge"; }
  if (avatar) { avatar.style.borderColor = ""; avatar.style.boxShadow = ""; avatar.style.background = ""; }
}

function updatePreviewBadge(label) {
  const badge = document.getElementById("previewBadge");
  const avatar = document.getElementById("previewAvatar");
  if (!badge || !avatar) return;
  if (label === "Real Account") {
    badge.textContent = "✓";
    badge.className = "profile-preview-badge real-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(5,150,105,0.12), rgba(5,150,105,0.04))";
    avatar.style.borderColor = "rgba(5,150,105,0.5)";
    avatar.style.boxShadow = "0 0 14px rgba(5,150,105,0.15)";
  } else {
    badge.textContent = "✕";
    badge.className = "profile-preview-badge fake-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(225,29,72,0.12), rgba(225,29,72,0.04))";
    avatar.style.borderColor = "rgba(225,29,72,0.5)";
    avatar.style.boxShadow = "0 0 14px rgba(225,29,72,0.2)";
  }
}

// ── Semicircle gauge ───────────────────────────────────────
function drawGauge(percentage, isFake) {
  const canvas = document.getElementById("gaugeCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 10, r = 78;
  const startAngle = Math.PI;
  const fillAngle = startAngle + (percentage / 100) * Math.PI;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(59,99,247,0.08)";
  ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();

  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  if (isFake) { grad.addColorStop(0, "#f59e0b"); grad.addColorStop(1, "#e11d48"); }
  else { grad.addColorStop(0, "#059669"); grad.addColorStop(1, "#3b63f7"); }

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.strokeStyle = grad; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();

  const tipX = cx + r * Math.cos(fillAngle);
  const tipY = cy + r * Math.sin(fillAngle);
  ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  ctx.fillStyle = isFake ? "#e11d48" : "#059669";
  ctx.shadowBlur = 12; ctx.shadowColor = ctx.fillStyle;
  ctx.fill(); ctx.shadowBlur = 0;
}

// ── Feature importance bars — updated for 11 new features ─
const FEATURE_LABELS = {
  // Original 11
  "profile pic": "Profile Picture",
  "nums/length username": "Username Num Ratio",
  "fullname words": "Full Name Words",
  "nums/length fullname": "Full Name Num Ratio",
  "name==username": "Name = Username",
  "description length": "Bio Length",
  "external URL": "External URL",
  "private": "Private Account",
  "#posts": "Posts",
  "#followers": "Followers",
  "#follows": "Following",
  // 7 Engineered features
  "username_suspicion": "Username Suspicion",
  "activity_score": "Activity Score",
  "follower_follow_ratio": "Follower/Follow Ratio",
  "follow_aggressiveness": "Follow Aggressiveness",
  "profile_completeness": "Profile Completeness",
  "name_authenticity": "Name Authenticity",
  "posts_per_follower": "Posts per Follower",
};

// ── Compute feature influence — uses real gain-based weights + directional scoring ──
function computeFeatureInfluence(payload, result) {
  const isFake = result.prediction === 1;
  const confidence = result.confidence.percentage / 100;

  // Read raw fields from payload
  const followers = payload["#followers"] || 0;
  const following = payload["#follows"] || 0;
  const posts = payload["#posts"] || 0;
  const hasPic = payload["profile pic"] === 1 ? 1 : 0;
  const bioLen = payload["description length"] || 0;
  const numRatioUser = payload["nums/length username"] || 0;
  const numRatioFull = payload["nums/length fullname"] || 0;
  const fnWords = payload["fullname words"] || 0;

  // Read engineered features — compute inline if not in payload (bulk upload case)
  const followerFollowRatio = payload["follower_follow_ratio"] !== undefined
    ? payload["follower_follow_ratio"] : followers / (following + 1);
  const postsPerFollower = payload["posts_per_follower"] !== undefined
    ? payload["posts_per_follower"] : posts / (followers + 1);
  const followAggressive = payload["follow_aggressiveness"] !== undefined
    ? payload["follow_aggressiveness"] : following / (followers + posts + 1);
  const profileComplete = payload["profile_completeness"] !== undefined
    ? payload["profile_completeness"]
    : hasPic + (bioLen > 0 ? 1 : 0) + (payload["external URL"] === 1 ? 1 : 0) + (fnWords > 0 ? 1 : 0);
  const userSuspicion = payload["username_suspicion"] !== undefined
    ? payload["username_suspicion"] : numRatioUser * (1 - hasPic);
  const nameAuth = payload["name_authenticity"] !== undefined
    ? payload["name_authenticity"]
    : fnWords * (1 - (payload["name==username"] === 1 ? 1 : 0));
  const activityScore = payload["activity_score"] !== undefined
    ? payload["activity_score"] : Math.log1p(posts) + Math.log1p(followers);

  // Weights from gain-based feature importance (Cell 10 — new retrained model)
  // directionScore: -1 = strong fake signal, +1 = strong real signal
  const features = [
    {
      key: "profile pic", weight: 0.4614,
      directionScore: hasPic ? 0.95 : -0.90,
    },
    {
      key: "username_suspicion", weight: 0.3104,
      directionScore: (() => {
        if (userSuspicion === 0) return 0.90;
        if (userSuspicion <= 0.05) return 0.60;
        if (userSuspicion <= 0.15) return 0.10;
        if (userSuspicion <= 0.30) return -0.40;
        if (userSuspicion <= 0.50) return -0.70;
        return -0.90;
      })(),
    },
    {
      key: "activity_score", weight: 0.0414,
      directionScore: (() => {
        if (activityScore >= 14) return 0.90;
        if (activityScore >= 10) return 0.76;
        if (activityScore >= 7) return 0.50;
        if (activityScore >= 4) return 0.10;
        if (activityScore >= 2) return -0.40;
        return -0.84;
      })(),
    },
    {
      key: "#posts", weight: 0.0289,
      directionScore: (() => {
        if (posts >= 100) return 0.90;
        if (posts >= 50) return 0.76;
        if (posts >= 20) return 0.56;
        if (posts >= 10) return 0.30;
        if (posts >= 5) return -0.10;
        if (posts >= 1) return -0.50;
        return -0.90;
      })(),
    },
    {
      key: "nums/length fullname", weight: 0.0270,
      directionScore: (() => {
        if (numRatioFull === 0) return 0.76;
        if (numRatioFull <= 0.10) return 0.36;
        if (numRatioFull <= 0.25) return -0.20;
        if (numRatioFull <= 0.40) return -0.56;
        return -0.84;
      })(),
    },
    {
      key: "nums/length username", weight: 0.0255,
      directionScore: (() => {
        if (numRatioUser === 0) return 0.84;
        if (numRatioUser <= 0.10) return 0.56;
        if (numRatioUser <= 0.20) return 0.10;
        if (numRatioUser <= 0.35) return -0.30;
        if (numRatioUser <= 0.50) return -0.64;
        return -0.88;
      })(),
    },
    {
      key: "profile_completeness", weight: 0.0228,
      directionScore: (() => {
        if (profileComplete >= 4) return 0.90;
        if (profileComplete >= 3) return 0.64;
        if (profileComplete >= 2) return 0.20;
        if (profileComplete >= 1) return -0.30;
        return -0.84;
      })(),
    },
    {
      key: "follow_aggressiveness", weight: 0.0221,
      directionScore: (() => {
        if (followAggressive > 50) return -0.90;
        if (followAggressive > 20) return -0.70;
        if (followAggressive > 10) return -0.50;
        if (followAggressive > 5) return -0.20;
        if (followAggressive > 2) return 0.10;
        if (followAggressive > 1) return 0.40;
        return 0.70;
      })(),
    },
    {
      key: "#followers", weight: 0.0159,
      directionScore: (() => {
        if (followers >= 5000) return 0.94;
        if (followers >= 1000) return 0.84;
        if (followers >= 500) return 0.64;
        if (followers >= 100) return 0.30;
        if (followers >= 50) return -0.10;
        if (followers >= 20) return -0.50;
        return -0.84;
      })(),
    },
    {
      key: "follower_follow_ratio", weight: 0.0137,
      directionScore: (() => {
        if (followerFollowRatio >= 10) return 0.90;
        if (followerFollowRatio >= 3) return 0.70;
        if (followerFollowRatio >= 1) return 0.40;
        if (followerFollowRatio >= 0.5) return -0.10;
        if (followerFollowRatio >= 0.2) return -0.50;
        return -0.80;
      })(),
    },
    {
      key: "description length", weight: 0.0066,
      directionScore: (() => {
        if (bioLen >= 80) return 0.84;
        if (bioLen >= 50) return 0.70;
        if (bioLen >= 30) return 0.44;
        if (bioLen >= 15) return 0.10;
        if (bioLen >= 5) return -0.30;
        return -0.84;
      })(),
    },
    {
      key: "private", weight: 0.0062, directionScore: 0.00,
    },
    {
      key: "fullname words", weight: 0.0055,
      directionScore: (() => {
        if (fnWords >= 3) return 0.76;
        if (fnWords >= 2) return 0.64;
        if (fnWords === 1) return 0.00;
        return -0.84;
      })(),
    },
    {
      key: "#follows", weight: 0.0046,
      directionScore: (() => {
        if (following > 7500) return -0.90;
        if (following > 5000) return -0.70;
        if (following > 2000) return -0.40;
        if (following > 1000) return 0.10;
        if (following >= 50 && following <= 1000) return 0.70;
        if (following >= 10) return 0.20;
        return -0.30;
      })(),
    },
    {
      key: "name_authenticity", weight: 0.0045,
      directionScore: (() => {
        if (nameAuth >= 3) return 0.70;
        if (nameAuth >= 2) return 0.50;
        if (nameAuth >= 1) return 0.20;
        return -0.40;
      })(),
    },
    {
      key: "posts_per_follower", weight: 0.0035,
      directionScore: (() => {
        if (postsPerFollower > 5) return -0.60;
        if (postsPerFollower > 1) return 0.10;
        if (postsPerFollower > 0.1) return 0.70;
        if (postsPerFollower > 0.01) return 0.40;
        return -0.50;
      })(),
    },
    { key: "name==username", weight: 0.000, directionScore: 0.00 },
    { key: "external URL", weight: 0.000, directionScore: 0.00 },
  ];

  // Tag each feature as supporting or opposing the prediction
  const scored = features.map(f => {
    const supporting = isFake ? f.directionScore < 0 : f.directionScore > 0;
    const magnitude = Math.abs(f.directionScore) * f.weight;
    return { ...f, supporting, magnitude };
  });

  // Normalize groups separately so opposing features don't overpower the verdict
  const maxSupport = Math.max(...scored.filter(f => f.supporting).map(f => f.magnitude), 0.001);
  const maxOppose = Math.max(...scored.filter(f => !f.supporting).map(f => f.magnitude), 0.001);
  const opposeScale = (1 - confidence) * 0.75;

  return scored.map(f => {
    const raw = f.supporting
      ? (f.magnitude / maxSupport) * confidence
      : (f.magnitude / maxOppose) * opposeScale;
    return { ...f, influence: Math.min(Math.max(raw, 0.02), 1.0) };
  }).sort((a, b) => b.influence - a.influence);
}

function renderFeatureImportance(payload, result) {
  const container = document.getElementById("featureBars");
  if (!container) return;

  const btn = document.getElementById("fbSeeMoreBtn");
  const btnText = document.getElementById("fbSeeMoreText");

  const scaled = computeFeatureInfluence(payload, result);
  const VISIBLE_COUNT = 5;
  const MAX_COUNT = 10;

  container.textContent = "";
  const tpl = document.getElementById("tpl-feature-bar-row");

  scaled.forEach((h, i) => {
    if (!tpl) return;
    const clone = tpl.content.cloneNode(true);
    const row = clone.querySelector(".feature-bar-row");
    const fill = clone.querySelector(".fb-fill");

    row.dataset.fbIndex = i;
    if (i >= VISIBLE_COUNT) row.classList.add("fb-hidden");
    if (h.supporting === false) fill.classList.add("opposing");

    clone.querySelector(".fb-name").textContent = FEATURE_LABELS[h.key] || h.key;
    fill.style.width = "0%";
    clone.querySelector(".fb-val").textContent = Math.round(h.influence * 100) + "%";

    container.appendChild(clone);
  });

  if (btn && btnText) {
    if (scaled.length > VISIBLE_COUNT) {
      btn.classList.remove("hidden");
      btn.classList.remove("expanded");
      btnText.textContent = "See Top 10 features";

      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      const newBtnText = newBtn.querySelector("#fbSeeMoreText");

      newBtn.addEventListener("click", () => {
        const isExpanded = newBtn.classList.toggle("expanded");
        container.querySelectorAll(".feature-bar-row").forEach((row, i) => {
          if (i >= VISIBLE_COUNT && i < MAX_COUNT) {
            if (isExpanded) {
              row.classList.remove("fb-hidden");
              const fill = row.querySelector(".fb-fill");
              if (fill) {
                const pct = Math.round(scaled[i]?.influence * 100 || 0);
                setTimeout(() => { fill.style.width = pct + "%"; }, 60 + (i - VISIBLE_COUNT) * 65);
              }
            } else {
              row.classList.add("fb-hidden");
            }
          }
        });
        newBtnText.textContent = isExpanded ? "Show less" : "See Top 10 features";
      });
    } else {
      btn.classList.add("hidden");
    }
  }

  // Animate only the initially visible bars
  requestAnimationFrame(() => {
    container.querySelectorAll(".fb-fill").forEach((el, i) => {
      if (i >= VISIBLE_COUNT) return; // hidden bars animate on reveal
      const pct = Math.round(scaled[i]?.influence * 100 || 0);
      setTimeout(() => { el.style.width = pct + "%"; }, 80 + i * 65);
    });
  });
}


// ── Plain-English Explanation — updated for new features ──
function generateExplanation(payload, result) {
  const isFake = result.prediction === 1;
  const level = result.confidence.level;
  const pct = result.confidence.percentage.toFixed(1);
  const flags = [];
  const reasons = [];

  const followers = payload["#followers"] || 0;
  const following = payload["#follows"] || 0;
  const posts = payload["#posts"] || 0;
  const bioLen = payload["description length"] || 0;
  const ratio = payload["nums/length username"] || 0;
  const hasPic = payload["profile pic"] === 1;
  const hasUrl = payload["external URL"] === 1;
  const fnWords = payload["fullname words"] || 0;

  // Profile picture — strongest signal
  if (!hasPic) {
    flags.push({ text: "No profile picture", type: "warning" });
    reasons.push("no profile picture");
  } else {
    flags.push({ text: "Has profile picture", type: "normal" });
  }

  // Followers
  if (followers < 20) {
    flags.push({ text: `Only ${followers} followers`, type: "suspicious" });
    reasons.push("very few followers");
  } else if (followers > 50000) {
    flags.push({ text: `${fmt(followers)} followers`, type: "normal" });
  }

  // Following
  if (following > 2000) {
    flags.push({ text: `Following ${fmt(following)} accounts`, type: "suspicious" });
    reasons.push(`mass-following ${fmt(following)} accounts`);
  } else if (following < 600 && following > 0) {
    flags.push({ text: `Normal following (${fmt(following)})`, type: "normal" });
  }

  // Posts
  if (posts === 0) {
    flags.push({ text: "0 posts", type: "suspicious" });
    reasons.push("no posts at all");
  } else if (posts < 5) {
    flags.push({ text: `Only ${posts} post${posts !== 1 ? "s" : ""}`, type: "warning" });
    reasons.push("very few posts");
  } else {
    flags.push({ text: `${fmt(posts)} posts`, type: "normal" });
  }

  // Username numeric ratio
  if (ratio > 0.5) {
    flags.push({ text: `High username digit ratio (${(ratio * 100).toFixed(0)}%)`, type: "suspicious" });
    reasons.push(`username is ${(ratio * 100).toFixed(0)}% digits`);
  } else if (ratio > 0.25) {
    flags.push({ text: `Some username digits (${(ratio * 100).toFixed(0)}%)`, type: "warning" });
  } else {
    flags.push({ text: "Clean username", type: "normal" });
  }

  // Bio
  if (bioLen < 5) {
    flags.push({ text: "No bio", type: "suspicious" });
    reasons.push("no profile bio");
  } else if (bioLen > 40) {
    flags.push({ text: "Detailed bio", type: "normal" });
  } else {
    flags.push({ text: "Questionable bio", type: "warning" });
  }

  // External URL
  if (hasUrl) {
    flags.push({ text: "Has website link", type: "normal" });
  }

  // Full name words
  if (fnWords === 0) {
    flags.push({ text: "No display name", type: "suspicious" });
    reasons.push("missing display name");
  } else if (fnWords >= 2) {
    flags.push({ text: `${fnWords}-word display name`, type: "normal" });
  }

  //isme changes karne h
  // Follower / following ratio
  if (following > 0 && followers > 0) {
    const ratio2 = following / followers;
    if (ratio2 > 5 && followers >= 150) {
      flags.push({ text: `Following ${ratio2.toFixed(1)}× more than followers`, type: "suspicious" });
      reasons.push(`follows ${ratio2.toFixed(1)}× more than follows back`);
    } else if (ratio2 > 2 && followers >= 100) {
      flags.push({ text: `Following ${ratio2.toFixed(1)}× more than followers`, type: "warning" });
      reasons.push(`follows ${ratio2.toFixed(1)}× more than follows back`);
    } else {
      flags.push({ text: `Following ${ratio2.toFixed(1)}× more than followers`, type: "normal" });
      reasons.push(`follows ${ratio2.toFixed(1)}× more than follows back`);
    }
  }

  // Build paragraph
  const explanationEl = document.getElementById("explanationText");
  const flagsEl = document.getElementById("explanationFlags");

  if (explanationEl) {
    explanationEl.textContent = "";
    const p1 = document.createElement("span");
    const p2 = document.createElement("strong");
    const p3 = document.createElement("span");
    const p4 = document.createElement("strong");
    const p5 = document.createElement("span");

    if (isFake) {
      if (reasons.length === 0) {
        p1.textContent = "The model predicted this as a ";
        p2.textContent = "fake account";
        p3.textContent = " with ";
        p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
        p5.textContent = ". The overall combination of feature values matched patterns commonly observed in inauthentic accounts.";
        explanationEl.append(p1, p2, p3, p4, p5);
      } else {
        p1.textContent = "This account was classified as ";
        p2.textContent = "fake";
        p3.textContent = " with ";
        p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
        const em = document.createElement("em");
        em.textContent = reasons.join(", ");
        p5.textContent = ". These patterns are strongly associated with bot or inauthentic accounts.";
        explanationEl.append(p1, p2, p3, p4, document.createTextNode(". The key signals driving this verdict were: "), em, p5);
      }
    } else {
      if (reasons.length === 0) {
        p1.textContent = "The model predicted this as a ";
        p2.textContent = "real account";
        p3.textContent = " with ";
        p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
        p5.textContent = ". The profile's feature values closely match patterns observed in authentic Instagram accounts.";
        explanationEl.append(p1, p2, p3, p4, p5);
      } else {
        p1.textContent = "This account appears to be ";
        p2.textContent = "real";
        p3.textContent = " with ";
        p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
        p5.textContent = `. The overall profile structure aligns with authentic behaviour. Some minor signals were present (${reasons.join(", ")}), but not sufficient to trigger a fake classification.`;
        explanationEl.append(p1, p2, p3, p4, p5);
      }
    }
  }

  if (flagsEl) {
    flagsEl.textContent = "";
    const tpl = document.getElementById("tpl-exp-flag");
    if (tpl) {
      flags.slice(0, 8).forEach((f, i) => {
        const clone = tpl.content.cloneNode(true);
        const span = clone.querySelector(".exp-flag");
        span.textContent = f.text;
        span.classList.add(f.type);
        span.style.animationDelay = `${i * 0.06}s`;
        flagsEl.appendChild(clone);
      });
    }
  }
}

// ── Render manual result ───────────────────────────────────
function renderManualResult(result, payload) {
  const isFake = result.prediction === 1;
  const pct = result.confidence.percentage;
  const level = result.confidence.level;

  const iconWrap = document.getElementById("resultIconWrap");
  const iconFake = document.getElementById("resultIconFake");
  const iconReal = document.getElementById("resultIconReal");

  if (iconWrap) iconWrap.className = `result-icon-wrap ${isFake ? "fake-icon" : "real-icon"}`;
  if (isFake) {
    iconFake?.classList.remove("hidden");
    iconReal?.classList.add("hidden");
  } else {
    iconFake?.classList.add("hidden");
    iconReal?.classList.remove("hidden");
  }

  const labelEl = document.getElementById("resultLabelText");
  if (labelEl) labelEl.textContent = result.label;

  const badge = document.getElementById("resultBadge");
  if (badge) {
    if (level === "High" && isFake) { badge.className = "result-badge fake"; badge.textContent = "High Risk"; }
    else if (level === "High" && !isFake) { badge.className = "result-badge real"; badge.textContent = "Verified Real"; }
    else if (level === "Medium" && isFake) { badge.className = "result-badge warn"; badge.textContent = "Medium Risk"; }
    else if (level === "Medium" && !isFake) { badge.className = "result-badge real"; badge.textContent = "Likely Real"; }
    else if (level === "Low" && isFake) { badge.className = "result-badge warn"; badge.textContent = "Low Risk"; }
    else if (level === "Low" && !isFake) { badge.className = "result-badge real"; badge.textContent = "Probably Real"; }
    else { badge.className = "result-badge"; badge.textContent = level; }
  }

  const card = document.getElementById("manualResultCard");
  if (card) card.className = `result-card ${isFake ? "glow-fake" : "glow-real"}`;

  // Animate gauge
  const gaugePctEl = document.getElementById("gaugePct");
  const gaugeLvlEl = document.getElementById("gaugeLevel");
  if (gaugePctEl) gaugePctEl.textContent = "0%";
  if (gaugeLvlEl) gaugeLvlEl.textContent = level;

  let startTime = null;
  const duration = 900;
  function animateGauge(ts) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const cur = Math.round(ease * pct);
    if (gaugePctEl) gaugePctEl.textContent = cur + "%";
    drawGauge(cur, isFake);
    if (progress < 1) requestAnimationFrame(animateGauge);
  }
  requestAnimationFrame(animateGauge);

  const realP = result.probabilities.real;
  const fakeP = result.probabilities.fake;
  const probRealEl = document.getElementById("probReal");
  const probFakeEl = document.getElementById("probFake");
  if (probRealEl) probRealEl.textContent = realP != null ? (realP * 100).toFixed(1) + "%" : "—";
  if (probFakeEl) probFakeEl.textContent = fakeP != null ? (fakeP * 100).toFixed(1) + "%" : "—";

  renderFeatureImportance(payload, result);
  generateExplanation(payload, result);

  // Render hybrid breakdown if backend returned it
  // if (result.breakdown) {
  //   renderHybridBreakdown(result.breakdown);
  // }

  show(card);
}

// ── Manual predict — uses buildPayload() from index.html ──
async function predictManual() {
  if (!validateAll()) {
    showManualError("Please fix the validation errors before predicting.");
    return;
  }

  hide(manualResultCard); hide(manualError);
  const manualSlowLoad = document.getElementById("manualSlowLoad");
  hide(manualSlowLoad);
  show(manualSkeleton);
  if (predictManualBtn) predictManualBtn.disabled = true;
  const manualSlowTimer = setTimeout(() => { show(manualSlowLoad); }, 8000);

  // buildPayload() is defined in index.html and maps UI → backend column names
  const payload = buildPayload();

  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Prediction failed.");

    const result = data.result;
    hide(manualSkeleton);
    renderManualResult(result, payload);
    addToHistory(result, payload);
    updatePreviewBadge(result.label);

  } catch (err) {
    hide(manualSkeleton);
    showManualError(err.message || "Connection error. Is the backend running?");
  } finally {
    clearTimeout(manualSlowTimer);
    const manualSlowLoad = document.getElementById("manualSlowLoad");
    hide(manualSlowLoad);
    if (predictManualBtn) predictManualBtn.disabled = false;
  }
}

// ── Bulk predict ───────────────────────────────────────────
async function predictFile() {
  if (!fileInput?.files.length) {
    showBulkError("Please select a CSV or JSON file first.");
    return;
  }

  hide(bulkResults); hide(bulkError);
  const bulkSlowLoad = document.getElementById("bulkSlowLoad");
  hide(bulkSlowLoad);
  show(bulkSkeleton);
  if (predictBulkBtn) predictBulkBtn.disabled = true;
  const bulkSlowTimer = setTimeout(() => { show(bulkSlowLoad); }, 8000);

  try {
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const res = await fetch(`${API_BASE}/predict-file`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "File upload failed.");

    hide(bulkSkeleton);
    bulkData = data.predictions || [];
    renderBulkResults(data.summary, bulkData);

  } catch (err) {
    hide(bulkSkeleton);
    showBulkError(err.message || "Connection error. Is the backend running?");
  } finally {
    clearTimeout(bulkSlowTimer);
    const bulkSlowLoad = document.getElementById("bulkSlowLoad");
    hide(bulkSlowLoad);
    if (predictBulkBtn) predictBulkBtn.disabled = false;
  }
}

function renderBulkResults(summary, predictions) {
  const el = id => document.getElementById(id);
  if (el("bssTotal")) el("bssTotal").textContent = summary.total ?? 0;
  if (el("bssReal")) el("bssReal").textContent = summary.real ?? 0;
  if (el("bssFake")) el("bssFake").textContent = summary.fake ?? 0;
  if (el("bssConf")) el("bssConf").textContent =
    summary.average_confidence ? (summary.average_confidence * 100).toFixed(1) + "%" : "—";

  const total = summary.total || 1;
  const realPct = ((summary.real / total) * 100).toFixed(1);
  const fakePct = ((summary.fake / total) * 100).toFixed(1);

  // Doughnut chart
  const doughnut = el("bulkDoughnut");
  if (doughnut) {
    const realDeg = (summary.real / total) * 360;
    doughnut.style.background = `conic-gradient(var(--real) 0deg ${realDeg}deg, var(--fake) ${realDeg}deg 360deg)`;
  }
  if (el("doughnutPct")) el("doughnutPct").textContent = realPct + "%";
  if (el("dlReal")) el("dlReal").textContent = summary.real ?? 0;
  if (el("dlFake")) el("dlFake").textContent = summary.fake ?? 0;

  setTimeout(() => {
    const sr = document.getElementById("splitReal");
    const sf = document.getElementById("splitFake");
    if (sr) sr.style.width = realPct + "%";
    if (sf) sf.style.width = fakePct + "%";
  }, 50);

  currentFilter = "all"; currentPage = 1;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('.filter-btn[data-filter="all"]')?.classList.add("active");
  renderTable();
  show(document.getElementById("bulkResults"));
}

function renderTable() {
  const filtered = currentFilter === "all"
    ? bulkData
    : bulkData.filter(r => currentFilter === "fake" ? r.prediction === 1 : r.prediction === 0);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const tbody = document.getElementById("predictionsBody");
  if (!tbody) return;

  tbody.textContent = "";
  const tpl = document.getElementById("tpl-prediction-row");
  if (!tpl) return;

  pageItems.forEach((r, i) => {
    const clone = tpl.content.cloneNode(true);
    const idx = (currentPage - 1) * PAGE_SIZE + i + 1;
    const isFake = r.prediction === 1;
    const pct = r.confidence.percentage.toFixed(1);
    const realP = r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(1) : "—";
    const fakeP = r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(1) : "—";
    const lvl = r.confidence.level.toLowerCase();

    clone.querySelector(".pr-idx").textContent = idx;

    const pill = clone.querySelector(".verdict-pill");
    pill.classList.add(isFake ? "fake" : "real");
    pill.textContent = isFake ? "✕ Fake" : "✓ Real";

    clone.querySelector(".confidence-mini-fill").classList.add(isFake ? "fake" : "real");
    clone.querySelector(".confidence-mini-fill").style.width = pct + "%";
    clone.querySelector(".pr-pct").textContent = pct + "%";

    clone.querySelector(".pr-real").textContent = realP + "%";
    clone.querySelector(".pr-fake").textContent = fakeP + "%";

    const tag = clone.querySelector(".level-tag");
    tag.classList.add(lvl);
    tag.textContent = r.confidence.level;

    tbody.appendChild(clone);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pg = document.getElementById("pagination");
  if (!pg) return;
  pg.textContent = "";
  if (totalPages <= 1) return;

  const tpl = document.getElementById("tpl-pagination-btn");
  if (!tpl) return;

  for (let i = 0; i < totalPages; i++) {
    const clone = tpl.content.cloneNode(true);
    const btn = clone.querySelector(".page-btn");
    btn.textContent = i + 1;
    if (i + 1 === currentPage) btn.classList.add("active");
    btn.addEventListener("click", () => goToPage(i + 1));
    pg.appendChild(clone);
  }
}

function goToPage(n) { currentPage = n; renderTable(); }

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    currentPage = 1;
    renderTable();
  });
});

// ── Export CSV — includes original columns + predictions + feature influence ──
function csvEscape(val) {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportResults() {
  if (!bulkData.length) return;

  // Feature influence column labels (sorted order matches computeFeatureInfluence output)
  const influenceKeys = [
    "Profile Picture Influence%", "Followers Influence%", "Posts Influence%",
    "Following Influence%", "Username Num Ratio Influence%", "Bio Length Influence%",
    "Full Name Words Influence%", "Full Name Num Ratio Influence%",
    "External URL Influence%", "Name=Username Influence%", "Private Account Influence%"
  ];

  // Collect all unique original-input column names (preserves upload order)
  const rawColSet = new Set();
  bulkData.forEach(r => {
    if (r.raw_input) Object.keys(r.raw_input).forEach(k => rawColSet.add(k));
  });
  const rawCols = [...rawColSet];

  // Build header: # | original columns | prediction columns | feature influence columns
  const headers = [
    "#", ...rawCols,
    "Label", "Confidence%", "Real%", "Fake%", "Level",
    ...influenceKeys
  ];

  const rows = bulkData.map((r, i) => {
    // Original input values
    const rawVals = rawCols.map(col => r.raw_input ? r.raw_input[col] : "");

    // Prediction values
    const predVals = [
      r.label,
      r.confidence.percentage.toFixed(2),
      r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(2) : "",
      r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(2) : "",
      r.confidence.level
    ];

    // Feature influence values — compute from raw_input if available
    let influenceVals = influenceKeys.map(() => "");
    if (r.raw_input) {
      const scored = computeFeatureInfluence(r.raw_input, r);
      // scored is sorted by influence desc; map back to the fixed column order
      const influenceMap = {};
      scored.forEach(s => {
        influenceMap[s.key] = Math.round(s.influence * 100);
      });
      const orderedKeys = [
        "profile pic", "#followers", "#posts", "#follows",
        "nums/length username", "description length", "fullname words",
        "nums/length fullname", "external URL", "name==username", "private"
      ];
      influenceVals = orderedKeys.map(k => influenceMap[k] != null ? influenceMap[k] : "");
    }

    return [i + 1, ...rawVals, ...predVals, ...influenceVals];
  });

  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "instaguard_predictions.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Session history ────────────────────────────────────────
function addToHistory(result, payload) {
  const item = {
    label: result.label,
    confidence: result.confidence.percentage.toFixed(1),
    isFake: result.prediction === 1,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    payload,
    result
  };
  sessionHistory.unshift(item);
  if (sessionHistory.length > 10) sessionHistory.pop();
  renderHistory();
}

function renderHistory() {
  const historyList = document.getElementById("historyList");
  const emptyState = document.getElementById("historyEmptyState");
  const container = document.getElementById("historyItemsContainer");

  if (!historyList || !emptyState || !container) return;

  container.textContent = "";

  if (!sessionHistory.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  const tpl = document.getElementById("tpl-history-item");
  if (!tpl) return;

  sessionHistory.forEach((item, idx) => {
    const clone = tpl.content.cloneNode(true);
    const div = clone.querySelector(".history-item");

    div.addEventListener("click", () => replayHistory(idx));

    clone.querySelector(".hi-dot").classList.add(item.isFake ? "fake" : "real");
    clone.querySelector(".hi-label").textContent = item.label;
    clone.querySelector(".hi-conf").textContent = `${item.confidence}% · ${item.time}`;

    container.appendChild(clone);
  });
}

// ── History replay ────────────────────────────────────────
function replayHistory(idx) {
  const item = sessionHistory[idx];
  if (!item || !item.payload || !item.result) return;

  switchTab("manual");

  const p = item.payload;

  // Restore number inputs
  const numMap = { followers: "#followers", following: "#follows", posts: "#posts" };
  Object.entries(numMap).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.value = p[key] ?? 0;
  });

  // Restore toggles
  const toggleMap = { profile_pic: "profile pic", private: "private", external_url: "external URL" };
  Object.entries(toggleMap).forEach(([elId, key]) => {
    const cb = document.getElementById(elId);
    if (cb) { cb.checked = p[key] === 1; updateToggleBadge(cb); }
  });

  // Restore text fields (stored under _-prefixed keys)
  const uEl = document.getElementById('username_text');
  const fEl = document.getElementById('fullname_text');
  const bEl = document.getElementById('bio_text');
  if (uEl) { uEl.value = p._username_text || ''; onUsernameInput(); }
  if (fEl) { fEl.value = p._fullname_text || ''; onFullnameInput(); }
  if (bEl) { bEl.value = p._bio_text || ''; onBioInput(); }

  updatePreview();
  hide(manualError);
  hide(manualSkeleton);
  renderManualResult(item.result, p);
  updatePreviewBadge(item.result.label);

  setTimeout(() => {
    document.getElementById("manualResultCard")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 150);
}

clearHistoryBtn?.addEventListener("click", () => {
  sessionHistory = [];
  renderHistory();
});

// ── AI Username Estimator ─────────────────────────────────
// async function fetchUsername() {
//   const username = usernameInput?.value.trim();
//   if (!username) {
//     if (usernameInput) {
//       usernameInput.style.borderColor = "var(--fake)";
//       setTimeout(() => { usernameInput.style.borderColor = ""; }, 1500);
//     }
//     return;
//   }

//   fetchUsernameBtn.disabled = true;
//   const origHTML = fetchUsernameBtn.innerHTML;
//   fetchUsernameBtn.innerHTML = `
//     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
//       style="animation:spin 0.8s linear infinite">
//       <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
//     </svg> Estimating...`;

//   try {
//     const response = await fetch("https://api.anthropic.com/v1/messages", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         model: "claude-sonnet-4-20250514",
//         max_tokens: 400,
//         messages: [{
//           role: "user",
//           content: `You are helping a fake Instagram account detection tool estimate realistic profile values from a username pattern.
// Return ONLY valid JSON — no explanation, no markdown, no backticks.

// Username: "${username}"

// Return exactly this JSON structure:
// {
//   "profile_pic": <0 or 1>,
//   "external_url": <0 or 1>,
//   "private": <0 or 1>,
//   "followers": <integer>,
//   "following": <integer>,
//   "posts": <integer>,
//   "fullname_text": <string — realistic display name, empty string if bot>,
//   "bio_text": <string — realistic bio text, empty string if bot, max 100 chars>
// }

// Rules:
// - Compute from the username "${username}" itself.
// - Bot-like username (many digits, random chars, long number strings like user738291): profile_pic:0, followers<30, following>2000, posts:0, fullname_text:"", bio_text:"".
// - Human-like username (real name pattern, words, underscores, few digits like john.smith): profile_pic:1, followers 200-5000, following 100-600, posts 20-300, fullname_text:"First Last", bio_text:"realistic short bio".
// - Edge cases get intermediate values.
// - fullname_text and bio_text must be plain strings.`
//         }]
//       })
//     });

//     const data   = await response.json();
//     const raw    = data.content?.map(i => i.text || "").join("") || "";
//     const clean  = raw.replace(/```json|```/g, "").trim();
//     const parsed = JSON.parse(clean);

//     // Set toggles
//     ['profile_pic', 'external_url', 'private'].forEach(id => {
//       const cb = document.getElementById(id);
//       if (cb) { cb.checked = parsed[id] === 1; updateToggleBadge(cb); }
//     });

//     // Set number inputs
//     ['followers', 'following', 'posts'].forEach(key => {
//       const el = document.getElementById(key);
//       if (el) el.value = parsed[key] ?? 0;
//     });

//     // Set text inputs and trigger live hints
//     const uEl = document.getElementById('username_text');
//     const fEl = document.getElementById('fullname_text');
//     const bEl = document.getElementById('bio_text');
//     if (uEl) { uEl.value = username;                 onUsernameInput(); }
//     if (fEl) { fEl.value = parsed.fullname_text || ''; onFullnameInput(); }
//     if (bEl) { bEl.value = parsed.bio_text      || ''; onBioInput(); }

//     updatePreview();

//     fetchUsernameBtn.innerHTML = `
//       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
//         <polyline points="20 6 9 17 4 12"/>
//       </svg> Done!`;
//     setTimeout(() => {
//       fetchUsernameBtn.innerHTML = origHTML;
//       fetchUsernameBtn.disabled  = false;
//     }, 1600);

//   } catch (err) {
//     fetchUsernameBtn.innerHTML = origHTML;
//     fetchUsernameBtn.disabled  = false;
//     showManualError("Could not estimate features. Please fill the form manually.");
//   }
// }



// ── File upload UI ─────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }
function showManualError(msg) { if (manualErrorText) manualErrorText.textContent = msg; show(manualError); }
function showBulkError(msg) { if (bulkErrorText) bulkErrorText.textContent = msg; show(bulkError); }
function safeNum(val) { const n = Number(val); return isFinite(n) ? n : 0; }
function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

// ── Code added from index.html ─────────────────────────────
// =============================================================
//  CODE EXTRACTED FROM index.html <script> BLOCK
//  Paste this into script.js.
//  Recommended position: BEFORE the "── Expose globals ──" block
//  at the very bottom of script.js, so these functions are
//  available when script.js calls them via window.loadPreset etc.
// =============================================================


// ── TOGGLE BADGE HELPER ──────────────────────────────────────
// Called by onchange="updateToggleBadge(this)" on every toggle
// checkbox in index.html. Updates the ON/OFF badge pill and the
// short status label text inside each toggle row.
function updateToggleBadge(checkbox) {
  const id = checkbox.id;
  const badge = document.getElementById(id + '_badge');
  const label = document.getElementById(id + '_label');

  const labels = {
    profile_pic: ['No profile picture', 'Has profile picture'],
    private: ['Public account', 'Private account'],
    external_url: ['No external URL', 'Has external URL'],
  };

  if (badge) {
    badge.textContent = checkbox.checked ? 'ON' : 'OFF';
    badge.classList.toggle('on', checkbox.checked);
  }
  if (label && labels[id]) {
    label.textContent = checkbox.checked ? labels[id][1] : labels[id][0];
  }
}


// ── NUMERIC RATIO HELPER ─────────────────────────────────────
// Count digits / total length. Used for username + fullname ratio computation.
function computeNumericRatio(str) {
  if (!str || str.length === 0) return 0;
  const digits = (str.match(/[0-9]/g) || []).length;
  return parseFloat((digits / str.length).toFixed(4));
}

// ── BUILD PAYLOAD ────────────────────────────────────────────
// Reads form inputs, computes all derived + engineered features,
// and returns a single flat object. Backend receives the 11 base
// features; the 7 engineered ones are also included so the frontend
// computeFeatureInfluence() can use them directly without re-computing.
// Text originals are stored under _-prefixed keys for history replay.
function buildPayload() {
  const username = (document.getElementById('username_text')?.value || '').trim();
  const fullname = (document.getElementById('fullname_text')?.value || '').trim();
  const bio = (document.getElementById('bio_text')?.value || '').trim();
  const hasPic = document.getElementById('profile_pic')?.checked ? 1 : 0;
  const hasUrl = document.getElementById('external_url')?.checked ? 1 : 0;
  const isPrivate = document.getElementById('private')?.checked ? 1 : 0;
  const followers = parseFloat(document.getElementById('followers')?.value) || 0;
  const following = parseFloat(document.getElementById('following')?.value) || 0;
  const posts = parseFloat(document.getElementById('posts')?.value) || 0;

  // Derived features — computed from text inputs
  const numRatioUsername = computeNumericRatio(username);
  const numRatioFullname = computeNumericRatio(fullname);
  const fullnameWords = fullname ? fullname.trim().split(/\s+/).filter(Boolean).length : 0;
  const descriptionLen = bio.length;
  const nameEqUsername = (username && fullname &&
    username.toLowerCase() === fullname.replace(/\s+/g, '').toLowerCase()) ? 1 : 0;

  // Engineered features — must mirror Python engineer_features() exactly
  const followerFollowRatio = followers / (following + 1);
  const postsPerFollower = posts / (followers + 1);
  const followAggressiveness = following / (followers + posts + 1);
  const profileCompleteness = hasPic + (descriptionLen > 0 ? 1 : 0) + hasUrl + (fullnameWords > 0 ? 1 : 0);
  const usernameSuspicion = numRatioUsername * (1 - hasPic);
  const nameAuthenticity = fullnameWords * (1 - nameEqUsername);
  const activityScore = Math.log1p(posts) + Math.log1p(followers);

  return {
    // ── 11 base features (backend column names) ──────────────
    "profile pic": hasPic,
    "nums/length username": numRatioUsername,
    "fullname words": fullnameWords,
    "nums/length fullname": numRatioFullname,
    "name==username": nameEqUsername,
    "description length": descriptionLen,
    "external URL": hasUrl,
    "private": isPrivate,
    "#posts": posts,
    "#followers": followers,
    "#follows": following,
    // ── 7 engineered features (for frontend visualisation) ───
    "follower_follow_ratio": followerFollowRatio,
    "posts_per_follower": postsPerFollower,
    "follow_aggressiveness": followAggressiveness,
    "profile_completeness": profileCompleteness,
    "username_suspicion": usernameSuspicion,
    "name_authenticity": nameAuthenticity,
    "activity_score": activityScore,
    // ── Text originals (for history replay, ignored by backend) ──
    "_username_text": username,
    "_fullname_text": fullname,
    "_bio_text": bio,
  };
}


// ── DEMO PRESET LOADER ───────────────────────────────────────
function loadPreset(type) {
  const presets = {
    bot: {
      profile_pic: false, private: false, external_url: false,
      followers: 12, following: 3400, posts: 0,
      username_text: 'sailesh738291', fullname_text: '', bio_text: '',
    },
    real: {
      profile_pic: true, private: false, external_url: true,
      followers: 4800, following: 320, posts: 287,
      username_text: 'ajay.kumar', fullname_text: 'Ajay Kumar',
      bio_text: 'Travel photographer based in Goa 📸',
    },
    edge: {
      profile_pic: true, private: true, external_url: false,
      followers: 180, following: 950, posts: 14,
      username_text: 'akash.22x', fullname_text: 'Akash',
      bio_text: 'Just me.',
    },
  };

  const p = presets[type];
  if (!p) return;

  // Toggles
  ['profile_pic', 'private', 'external_url'].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) { cb.checked = p[id]; updateToggleBadge(cb); }
  });

  // Number inputs
  ['followers', 'following', 'posts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = p[id];
  });

  // Text inputs — trigger hints after filling
  const uEl = document.getElementById('username_text');
  const fEl = document.getElementById('fullname_text');
  const bEl = document.getElementById('bio_text');
  if (uEl) { uEl.value = p.username_text; onUsernameInput(); }
  if (fEl) { fEl.value = p.fullname_text; onFullnameInput(); }
  if (bEl) { bEl.value = p.bio_text; onBioInput(); }

  updatePreview();
  setTimeout(() => { if (typeof predictManual === 'function') predictManual(); }, 150);
}


// ── LIVE HINT HELPERS ─────────────────────────────────────────
// Called on input events for the three text fields.
// Renders small chip tags under each field showing auto-computed values.

function renderHintChips(containerId, chips) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = chips.map(c =>
    `<span class="hint-chip hint-chip--${c.level}">${c.text}</span>`
  ).join('');
}

function onUsernameInput() {
  const username = (document.getElementById('username_text')?.value || '').trim();
  updatePreview();

  if (!username) { renderHintChips('hint_username', []); return; }

  const ratio = computeNumericRatio(username);
  const pct = Math.round(ratio * 100);
  const digitCnt = (username.match(/[0-9]/g) || []).length;

  const chips = [];

  // Length chip
  chips.push({ text: `${username.length} chars`, level: 'neutral' });

  // Digit ratio chip
  if (ratio === 0) {
    chips.push({ text: 'No numbers · clean', level: 'safe' });
  } else if (ratio <= 0.2) {
    chips.push({ text: `${digitCnt} numbers (${pct}%)`, level: 'safe' });
  } else if (ratio <= 0.4) {
    chips.push({ text: `${digitCnt} numbers (${pct}%) · suspicious`, level: 'warn' });
  } else {
    chips.push({ text: `${digitCnt} numbers (${pct}%) · high risk`, level: 'danger' });
  }

  // Name match chip — compare with fullname
  const fullname = (document.getElementById('fullname_text')?.value || '').trim();
  if (fullname) {
    const match = username.toLowerCase() === fullname.replace(/\s+/g, '').toLowerCase();
    chips.push(match
      ? { text: 'Name = username · flag', level: 'warn' }
      : { text: 'Name ≠ username · ok', level: 'safe' }
    );
  }

  renderHintChips('hint_username', chips);
}

function onFullnameInput() {
  const fullname = (document.getElementById('fullname_text')?.value || '').trim();
  updatePreview();

  if (!fullname) { renderHintChips('hint_fullname', []); return; }

  const words = fullname.split(/\s+/).filter(Boolean).length;
  const ratio = computeNumericRatio(fullname);
  const pct = Math.round(ratio * 100);
  const chips = [];

  // Word count
  if (words >= 2) chips.push({ text: `${words} words · looks real`, level: 'safe' });
  else if (words === 1) chips.push({ text: '1 word · borderline', level: 'warn' });
  else chips.push({ text: 'No name · suspicious', level: 'danger' });

  // Numeric ratio
  if (ratio === 0) chips.push({ text: 'No digits · clean', level: 'safe' });
  else if (ratio <= 0.1) chips.push({ text: `${pct}% digits`, level: 'safe' });
  else chips.push({ text: `${pct}% digits · suspicious`, level: 'warn' });

  // Name match update
  const username = (document.getElementById('username_text')?.value || '').trim();
  if (username) {
    const match = username.toLowerCase() === fullname.replace(/\s+/g, '').toLowerCase();
    chips.push(match
      ? { text: 'Matches username · flag', level: 'warn' }
      : { text: 'Differs from username', level: 'safe' }
    );
    // Also refresh username hints so name-match chip stays in sync
    onUsernameInput();
  }

  renderHintChips('hint_fullname', chips);
}

function onBioInput() {
  const bio = (document.getElementById('bio_text')?.value || '');
  const chars = bio.length;
  const chips = [];

  if (chars === 0) chips.push({ text: 'No bio · suspicious', level: 'danger' });
  else if (chars < 15) chips.push({ text: `${chars} chars · very short`, level: 'warn' });
  else if (chars < 40) chips.push({ text: `${chars} chars · ok`, level: 'safe' });
  else chips.push({ text: `${chars} chars · detailed`, level: 'safe' });

  renderHintChips('hint_bio', chips);
}

// Called when profile_pic toggle changes (so username suspicion hint refreshes)
function computeLiveHints() {
  onUsernameInput();
  onFullnameInput();
  onBioInput();
}

// ── Expose globals ─────────────────────────────────────────
window.predictManual = predictManual;
window.predictFile = predictFile;
window.exportResults = exportResults;
window.goToPage = goToPage;
window.replayHistory = replayHistory;
window.loadPreset = loadPreset;
// window.fetchUsername     = fetchUsername;
window.validateField = validateField;
window.validateRatio = validateRatio;
window.updatePreview = updatePreview;
window.updateToggleBadge = updateToggleBadge;
window.buildPayload = buildPayload;
window.onUsernameInput = onUsernameInput;
window.onFullnameInput = onFullnameInput;
window.onBioInput = onBioInput;
window.computeLiveHints = computeLiveHints;