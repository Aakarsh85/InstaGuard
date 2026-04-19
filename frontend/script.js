//C:\Users\acer\Desktop\pj\Final Year Project\frontend\script.js
// ============================================================
//  InstaGuard — script.js  (updated for new 11-feature model)
//  Features: history replay, demo presets, AI username fetch,
//            plain-English explanation, validation, session log,
//            hybrid engine breakdown
// ============================================================

const API_BASE = "https://instafake-backend-4tmw.onrender.com";

// ── DOM refs ──────────────────────────────────────────────
const manualTab        = document.getElementById("manualTab");
const bulkTab          = document.getElementById("bulkTab");
const manualPanel      = document.getElementById("manualPanel");
const bulkPanel        = document.getElementById("bulkPanel");
const predictManualBtn = document.getElementById("predictManualBtn");
const predictBulkBtn   = document.getElementById("predictBulkBtn");
const manualSkeleton   = document.getElementById("manualSkeleton");
const manualResultCard = document.getElementById("manualResultCard");
const manualError      = document.getElementById("manualError");
const manualErrorText  = document.getElementById("manualErrorText");
const bulkSkeleton     = document.getElementById("bulkSkeleton");
const bulkResults      = document.getElementById("bulkResults");
const bulkError        = document.getElementById("bulkError");
const bulkErrorText    = document.getElementById("bulkErrorText");
const historyList      = document.getElementById("historyList");
const clearHistoryBtn  = document.getElementById("clearHistory");
const themeToggle      = document.getElementById("themeToggle");
const apiStatusText    = document.getElementById("apiStatus");
const apiStatusDot     = document.querySelector(".status-dot");
const fileInput        = document.getElementById("fileInput");
const fileSelectedInfo = document.getElementById("fileSelectedInfo");
const uploadZoneInner  = document.getElementById("uploadZoneInner");
const selectedFileName = document.getElementById("selectedFileName");
const removeFileBtn    = document.getElementById("removeFileBtn");
const uploadZone       = document.getElementById("uploadZone");
const fetchUsernameBtn = document.getElementById("fetchUsernameBtn");
const usernameInput    = document.getElementById("usernameInput");

// ── State ─────────────────────────────────────────────────
let sessionHistory = [];
let bulkData       = [];
let currentPage    = 1;
const PAGE_SIZE    = 10;
let currentFilter  = "all";

// ── Inject spin keyframe ───────────────────────────────────
const spinStyle = document.createElement("style");
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);

// ── Theme ─────────────────────────────────────────────────
const savedTheme = localStorage.getItem("ig-theme") || "light";
if (savedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");

themeToggle?.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("ig-theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("ig-theme", "dark");
  }
});

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
    W = canvas.width  = window.innerWidth;
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
bulkTab?.addEventListener("click",   () => switchTab("bulk"));

function switchTab(mode) {
  if (mode === "manual") {
    manualTab.classList.add("active");    bulkTab.classList.remove("active");
    manualPanel.classList.remove("hidden"); bulkPanel.classList.add("hidden");
  } else {
    bulkTab.classList.add("active");    manualTab.classList.remove("active");
    bulkPanel.classList.remove("hidden"); manualPanel.classList.add("hidden");
  }
}

// ── Reset form ─────────────────────────────────────────────
document.getElementById("resetForm")?.addEventListener("click", () => {
  // Number inputs
  ["followers", "following", "posts", "description_length",
   "fullname_words", "nums_length_username", "nums_length_fullname"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; clearFieldState(el); }
  });

  // Toggle inputs
  ["profile_pic", "private", "external_url", "name_eq_username"].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) { cb.checked = false; updateToggleBadge(cb); }
  });

  if (usernameInput) usernameInput.value = "";
  resetPreview();
  hide(manualResultCard);
  hide(manualError);

  // Hide hybrid breakdown
  const hb = document.getElementById("hybridBreakdown");
  if (hb) hb.style.display = "none";
});

// ── Validation ─────────────────────────────────────────────
const fieldRules = {
  followers:          { max: 1e8 },
  following:          { max: 1e8 },
  posts:              { max: 1e6 },
  description_length: { max: 150 },
  fullname_words:     { max: 20 },
};

function validateField(input) {
  const id   = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb   = document.getElementById(`fb_${id}`);
  const val  = input.value.trim();
  if (!wrap || !fb) return true;
  if (val === "") { clearFieldState(input); fb.textContent = ""; fb.className = "field-feedback"; return true; }
  const num  = Number(val);
  const rule = fieldRules[id];
  if (isNaN(num) || !isFinite(num)) { setInvalid(wrap, fb, "Must be a valid number."); return false; }
  if (num < 0)                      { setInvalid(wrap, fb, "Cannot be negative.");      return false; }
  if (rule && num > rule.max)       { setInvalid(wrap, fb, `Max: ${rule.max.toLocaleString()}`); return false; }
  if (id === "followers" && num === 0)   { setWarn(wrap, fb, "0 followers — suspicious."); return true; }
  if (id === "following" && num > 5000)  { setWarn(wrap, fb, "High following — possible bot."); return true; }
  setValid(wrap, fb, "✓");
  return true;
}

function validateRatio(input) {
  const id   = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb   = document.getElementById(`fb_${id}`);
  const val  = input.value.trim();
  if (!wrap || !fb) return true;
  if (val === "") { clearFieldState(input); fb.textContent = ""; fb.className = "field-feedback"; return true; }
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) { setInvalid(wrap, fb, "Must be 0.0 – 1.0"); return false; }
  if (num < 0 || num > 1)           { setInvalid(wrap, fb, "Value must be between 0 and 1"); return false; }
  if (num > 0.6) { setWarn(wrap, fb, "High ratio — unusual for real accounts."); return true; }
  setValid(wrap, fb, "✓");
  return true;
}

function setValid  (w, f, m) { w.className = "field-input-wrap valid";   f.textContent = m; f.className = "field-feedback valid-msg"; }
function setInvalid(w, f, m) { w.className = "field-input-wrap invalid"; f.textContent = m; f.className = "field-feedback invalid-msg"; }
function setWarn   (w, f, m) { w.className = "field-input-wrap";          f.textContent = "⚠ " + m; f.className = "field-feedback invalid-msg"; }

function clearFieldState(input) {
  const wrap = document.getElementById(`wrap_${input.id}`);
  if (wrap) wrap.className = "field-input-wrap";
}

function validateAll() {
  let ok = true;
  ["followers", "following", "posts", "description_length", "fullname_words"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateField(el)) ok = false;
  });
  ["nums_length_username", "nums_length_fullname"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateRatio(el)) ok = false;
  });
  return ok;
}

// ── Profile preview ────────────────────────────────────────
function updatePreview() {
  const followers = safeNum(document.getElementById("followers")?.value);
  const following = safeNum(document.getElementById("following")?.value);
  const posts     = safeNum(document.getElementById("posts")?.value);
  const bioLen    = safeNum(document.getElementById("description_length")?.value);
  const username  = usernameInput?.value.trim() || "";
  const ratio     = safeNum(document.getElementById("nums_length_username")?.value);
  const hasPic    = document.getElementById("profile_pic")?.checked || false;

  document.getElementById("previewPosts").textContent     = fmt(posts);
  document.getElementById("previewFollowers").textContent = fmt(followers);
  document.getElementById("previewFollowing").textContent = fmt(following);
  document.getElementById("previewName").textContent      = username ? `@${username}` : "@username";

  const bioEl = document.getElementById("previewBio");
  if (bioEl) {
    if (bioLen === 0)     bioEl.textContent = "No bio added.";
    else if (bioLen < 20) bioEl.textContent = `Short bio (${bioLen} chars)`;
    else                  bioEl.textContent = `Has a bio of ${bioLen} characters.`;
  }

  // Live avatar border
  const avatar = document.getElementById("previewAvatar");
  if (avatar) {
    const risk = computeRiskSignal(followers, following, posts, bioLen, ratio, hasPic);
    if (risk > 0.65) {
      avatar.style.borderColor = "rgba(225,29,72,0.5)";
      avatar.style.boxShadow   = "0 0 14px rgba(225,29,72,0.2)";
    } else if (risk > 0.35) {
      avatar.style.borderColor = "rgba(217,119,6,0.5)";
      avatar.style.boxShadow   = "0 0 14px rgba(217,119,6,0.15)";
    } else if (followers > 0 || following > 0) {
      avatar.style.borderColor = "rgba(5,150,105,0.5)";
      avatar.style.boxShadow   = "0 0 14px rgba(5,150,105,0.15)";
    } else {
      avatar.style.borderColor = "";
      avatar.style.boxShadow   = "";
    }
  }
}

// Now also factors in profile picture presence
function computeRiskSignal(followers, following, posts, bioLen, ratio, hasPic) {
  let score = 0;
  if (!hasPic)          score += 0.35;   // No profile pic — strong signal
  if (followers < 20)   score += 0.25;
  if (following > 2000) score += 0.20;
  if (posts < 3)        score += 0.15;
  if (bioLen < 5)       score += 0.10;
  if (ratio > 0.5)      score += 0.20;
  return Math.min(score, 1);
}

function resetPreview() {
  ["previewPosts", "previewFollowers", "previewFollowing"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });
  const bio    = document.getElementById("previewBio");
  const name   = document.getElementById("previewName");
  const badge  = document.getElementById("previewBadge");
  const avatar = document.getElementById("previewAvatar");
  if (bio)    bio.textContent  = "Bio will appear here...";
  if (name)   name.textContent = "@username";
  if (badge)  { badge.innerHTML = "?"; badge.className = "profile-preview-badge"; }
  if (avatar) { avatar.style.borderColor = ""; avatar.style.boxShadow = ""; avatar.style.background = ""; }
}

function updatePreviewBadge(label) {
  const badge  = document.getElementById("previewBadge");
  const avatar = document.getElementById("previewAvatar");
  if (!badge || !avatar) return;
  if (label === "Real Account") {
    badge.innerHTML         = "✓";
    badge.className         = "profile-preview-badge real-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(5,150,105,0.12), rgba(5,150,105,0.04))";
  } else {
    badge.innerHTML         = "✕";
    badge.className         = "profile-preview-badge fake-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(225,29,72,0.12), rgba(225,29,72,0.04))";
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
  const fillAngle  = startAngle + (percentage / 100) * Math.PI;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(59,99,247,0.08)";
  ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();

  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  if (isFake) { grad.addColorStop(0, "#f59e0b"); grad.addColorStop(1, "#e11d48"); }
  else        { grad.addColorStop(0, "#059669"); grad.addColorStop(1, "#3b63f7"); }

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.strokeStyle = grad; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();

  const tipX = cx + r * Math.cos(fillAngle);
  const tipY = cy + r * Math.sin(fillAngle);
  ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  ctx.fillStyle  = isFake ? "#e11d48" : "#059669";
  ctx.shadowBlur = 12; ctx.shadowColor = ctx.fillStyle;
  ctx.fill(); ctx.shadowBlur = 0;
}

// ── Feature importance bars — updated for 11 new features ─
const FEATURE_LABELS = {
  "profile pic":           "Profile Picture",
  "nums/length username":  "Username Num Ratio",
  "fullname words":        "Full Name Words",
  "nums/length fullname":  "Full Name Num Ratio",
  "name==username":        "Name = Username",
  "description length":    "Bio Length",
  "external URL":          "External URL",
  "private":               "Private Account",
  "#posts":                "Posts",
  "#followers":            "Followers",
  "#follows":              "Following",
};

function renderFeatureImportance(payload, result) {
  const container = document.getElementById("featureBars");
  if (!container) return;

  const isFake = result.prediction === 1;
  const score  = result.confidence.score;

  // Heuristic influence scores for each feature
  const heuristics = [
    { key: "profile pic",          val: payload["profile pic"],          inf: payload["profile pic"] === 0 ? 0.9 : 0.1 },
    { key: "#followers",           val: payload["#followers"],           inf: isFake ? (payload["#followers"] < 50 ? 0.85 : 0.3) : (payload["#followers"] > 500 ? 0.8 : 0.4) },
    { key: "#follows",             val: payload["#follows"],             inf: isFake ? (payload["#follows"] > 2000 ? 0.9 : 0.4) : (payload["#follows"] < 500 ? 0.6 : 0.3) },
    { key: "#posts",               val: payload["#posts"],               inf: isFake ? (payload["#posts"] < 5 ? 0.8 : 0.3) : (payload["#posts"] > 30 ? 0.7 : 0.35) },
    { key: "nums/length username", val: payload["nums/length username"], inf: payload["nums/length username"] > 0.4 ? 0.85 : payload["nums/length username"] > 0.2 ? 0.5 : 0.15 },
    { key: "description length",   val: payload["description length"],   inf: isFake ? (payload["description length"] < 5 ? 0.7 : 0.25) : (payload["description length"] > 30 ? 0.65 : 0.3) },
    { key: "fullname words",       val: payload["fullname words"],       inf: isFake ? (payload["fullname words"] === 0 ? 0.7 : 0.3) : (payload["fullname words"] >= 2 ? 0.6 : 0.3) },
    { key: "nums/length fullname", val: payload["nums/length fullname"], inf: payload["nums/length fullname"] > 0.3 ? 0.75 : 0.15 },
    { key: "name==username",       val: payload["name==username"],       inf: payload["name==username"] === 1 ? 0.45 : 0.1 },
    { key: "external URL",         val: payload["external URL"],         inf: payload["external URL"] === 1 ? 0.15 : 0.35 },
    { key: "private",              val: payload["private"],              inf: 0.2 },
  ].map(f => ({ ...f, influence: Math.min(f.inf * score + 0.05, 1.0) }))
   .sort((a, b) => b.influence - a.influence);

  container.innerHTML = heuristics.map(h => {
    const pct = Math.round(h.influence * 100);
    return `<div class="feature-bar-row">
      <span class="fb-name">${FEATURE_LABELS[h.key] || h.key}</span>
      <div class="fb-track"><div class="fb-fill" style="width:0%"></div></div>
      <span class="fb-val">${pct}%</span>
    </div>`;
  }).join("");

  requestAnimationFrame(() => {
    container.querySelectorAll(".fb-fill").forEach((el, i) => {
      const pct = Math.round(heuristics[i]?.influence * 100 || 0);
      setTimeout(() => { el.style.width = pct + "%"; }, 80 + i * 65);
    });
  });
}

// ── Hybrid Engine Breakdown renderer ──────────────────────
function renderHybridBreakdown(breakdown) {
  const el = document.getElementById("hybridBreakdown");
  if (!breakdown || !el) return;
  el.style.display = "block";

  const mlPct    = Math.round((breakdown.ml?.fake_probability || 0) * 100);
  const rulePct  = Math.round((breakdown.rules?.score || 0) * 100);
  const finalPct = Math.round(
    ((breakdown.ml?.fake_probability || 0) * 0.6 +
     (breakdown.rules?.score         || 0) * 0.4) * 100
  );

  document.getElementById("hybridBarML").style.width    = mlPct + "%";
  document.getElementById("hybridValML").textContent    = mlPct + "%";
  document.getElementById("hybridBarRules").style.width = rulePct + "%";
  document.getElementById("hybridValRules").textContent = rulePct + "%";
  document.getElementById("hybridBarFinal").style.width = finalPct + "%";
  document.getElementById("hybridValFinal").textContent = finalPct + "%";

  const list = document.getElementById("rulesFiredList");
  if (!list) return;
  list.innerHTML = "";

  const rules = breakdown.rules?.rules_fired || [];
  if (rules.length === 0) {
    list.innerHTML = `<span style="font-size:12px;color:rgba(255,255,255,0.3);">No rules triggered</span>`;
  } else {
    rules.forEach(r => {
      const item = document.createElement("div");
      item.className = "rule-fired-item";
      item.innerHTML = `
        <span class="rule-dot ${r.signal}"></span>
        ${r.rule}
        <span style="margin-left:auto;opacity:0.4;font-size:11px;">${r.signal}</span>`;
      list.appendChild(item);
    });
  }
}

// ── Plain-English Explanation — updated for new features ──
function generateExplanation(payload, result) {
  const isFake = result.prediction === 1;
  const level  = result.confidence.level;
  const pct    = result.confidence.percentage.toFixed(1);
  const flags  = [];
  const reasons = [];

  const followers = payload["#followers"]           || 0;
  const following = payload["#follows"]             || 0;
  const posts     = payload["#posts"]               || 0;
  const bioLen    = payload["description length"]   || 0;
  const ratio     = payload["nums/length username"] || 0;
  const hasPic    = payload["profile pic"]          === 1;
  const hasUrl    = payload["external URL"]         === 1;
  const fnWords   = payload["fullname words"]       || 0;

  // Profile picture — strongest signal
  if (!hasPic) {
    flags.push({ text: "No profile picture", type: "suspicious" });
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

  // Follower / following ratio
  if (following > 0 && followers > 0) {
    const ratio2 = following / followers;
    if (ratio2 > 5) {
      flags.push({ text: `Follows ${ratio2.toFixed(1)}× more than followers`, type: "suspicious" });
      reasons.push(`follows ${ratio2.toFixed(1)}× more than follows back`);
    }
  }

  // Build paragraph
  let text = "";
  if (isFake) {
    if (reasons.length === 0) {
      text = `The model predicted this as a <strong>fake account</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The overall combination of feature values matched patterns commonly observed in inauthentic accounts.`;
    } else {
      text = `This account was classified as <strong>fake</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The key signals driving this verdict were: <em>${reasons.join(", ")}</em>. These patterns are strongly associated with bot or inauthentic accounts.`;
    }
  } else {
    if (reasons.length === 0) {
      text = `The model predicted this as a <strong>real account</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The profile's feature values closely match patterns observed in authentic Instagram accounts.`;
    } else {
      text = `This account appears to be <strong>real</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The overall profile structure aligns with authentic behaviour. Some minor signals were present (${reasons.join(", ")}), but not sufficient to trigger a fake classification.`;
    }
  }

  const explanationEl = document.getElementById("explanationText");
  const flagsEl       = document.getElementById("explanationFlags");
  if (explanationEl) explanationEl.innerHTML = text;
  if (flagsEl) {
    flagsEl.innerHTML = flags.slice(0, 8).map((f, i) =>
      `<span class="exp-flag ${f.type}" style="animation-delay:${i * 0.06}s">${f.text}</span>`
    ).join("");
  }
}

// ── Render manual result ───────────────────────────────────
function renderManualResult(result, payload) {
  const isFake = result.prediction === 1;
  const pct    = result.confidence.percentage;
  const level  = result.confidence.level;

  const iconWrap = document.getElementById("resultIconWrap");
  const icon     = document.getElementById("resultIcon");
  if (iconWrap) iconWrap.className = `result-icon-wrap ${isFake ? "fake-icon" : "real-icon"}`;
  if (icon) {
    icon.innerHTML = isFake
      ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
      : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
  }

  const labelEl = document.getElementById("resultLabelText");
  if (labelEl) labelEl.textContent = result.label;

  const badge = document.getElementById("resultBadge");
  if (badge) {
    if      (level === "High"   && isFake)  { badge.className = "result-badge fake"; badge.textContent = "High Risk"; }
    else if (level === "High"   && !isFake) { badge.className = "result-badge real"; badge.textContent = "Verified Real"; }
    else if (level === "Medium" && isFake)  { badge.className = "result-badge warn"; badge.textContent = "Medium Risk"; }
    else if (level === "Medium" && !isFake) { badge.className = "result-badge real"; badge.textContent = "Likely Real"; }
    else if (level === "Low"    && isFake)  { badge.className = "result-badge warn"; badge.textContent = "Low Risk"; }
    else if (level === "Low"    && !isFake) { badge.className = "result-badge real"; badge.textContent = "Probably Real"; }
    else                                    { badge.className = "result-badge";      badge.textContent = level; }
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
    const cur  = Math.round(ease * pct);
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
  if (result.breakdown) {
    renderHybridBreakdown(result.breakdown);
  }

  show(card);
}

// ── Manual predict — uses buildPayload() from index.html ──
async function predictManual() {
  if (!validateAll()) {
    showManualError("Please fix the validation errors before predicting.");
    return;
  }

  hide(manualResultCard); hide(manualError);
  show(manualSkeleton);
  if (predictManualBtn) predictManualBtn.disabled = true;

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
  show(bulkSkeleton);
  if (predictBulkBtn) predictBulkBtn.disabled = true;

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
    if (predictBulkBtn) predictBulkBtn.disabled = false;
  }
}

function renderBulkResults(summary, predictions) {
  const el = id => document.getElementById(id);
  if (el("bssTotal")) el("bssTotal").textContent = summary.total ?? 0;
  if (el("bssReal"))  el("bssReal").textContent  = summary.real  ?? 0;
  if (el("bssFake"))  el("bssFake").textContent  = summary.fake  ?? 0;
  if (el("bssConf"))  el("bssConf").textContent  =
    summary.average_confidence ? (summary.average_confidence * 100).toFixed(1) + "%" : "—";

  const total   = summary.total || 1;
  const realPct = ((summary.real / total) * 100).toFixed(1);
  const fakePct = ((summary.fake / total) * 100).toFixed(1);
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

  tbody.innerHTML = pageItems.map((r, i) => {
    const idx    = (currentPage - 1) * PAGE_SIZE + i + 1;
    const isFake = r.prediction === 1;
    const pct    = r.confidence.percentage.toFixed(1);
    const realP  = r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(1) : "—";
    const fakeP  = r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(1) : "—";
    const lvl    = r.confidence.level.toLowerCase();
    return `
      <tr>
        <td style="color:var(--muted2)">${idx}</td>
        <td><span class="verdict-pill ${isFake ? "fake" : "real"}">${isFake ? "✕ Fake" : "✓ Real"}</span></td>
        <td>
          <span class="confidence-mini-bar">
            <span class="confidence-mini-fill ${isFake ? "fake" : "real"}" style="width:${pct}%"></span>
          </span>${pct}%
        </td>
        <td>${realP}%</td>
        <td>${fakeP}%</td>
        <td><span class="level-tag ${lvl}">${r.confidence.level}</span></td>
      </tr>`;
  }).join("");

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pg = document.getElementById("pagination");
  if (!pg) return;
  if (totalPages <= 1) { pg.innerHTML = ""; return; }
  pg.innerHTML = Array.from({ length: totalPages }, (_, i) =>
    `<button class="page-btn ${i + 1 === currentPage ? "active" : ""}" onclick="goToPage(${i + 1})">${i + 1}</button>`
  ).join("");
}

function goToPage(n) { currentPage = n; renderTable(); }

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    currentPage   = 1;
    renderTable();
  });
});

// ── Export CSV ─────────────────────────────────────────────
function exportResults() {
  if (!bulkData.length) return;
  const headers = ["#", "Label", "Confidence%", "Real%", "Fake%", "Level"];
  const rows = bulkData.map((r, i) => [
    i + 1, r.label,
    r.confidence.percentage.toFixed(2),
    r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(2) : "",
    r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(2) : "",
    r.confidence.level
  ]);
  const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "instaguard_predictions.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Session history ────────────────────────────────────────
function addToHistory(result, payload) {
  const item = {
    label:      result.label,
    confidence: result.confidence.percentage.toFixed(1),
    isFake:     result.prediction === 1,
    time:       new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    payload,
    result
  };
  sessionHistory.unshift(item);
  if (sessionHistory.length > 10) sessionHistory.pop();
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  if (!sessionHistory.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <span>No predictions yet</span>
      </div>`;
    return;
  }
  historyList.innerHTML = sessionHistory.map((item, idx) => `
    <div class="history-item" onclick="replayHistory(${idx})" title="Click to replay this prediction">
      <span class="hi-dot ${item.isFake ? "fake" : "real"}"></span>
      <span class="hi-label">${item.label}</span>
      <span class="hi-conf">${item.confidence}% · ${item.time}</span>
      <span class="hi-replay">↩</span>
    </div>`).join("");
}

// ── History replay — updated for new fields ────────────────
function replayHistory(idx) {
  const item = sessionHistory[idx];
  if (!item || !item.payload || !item.result) return;

  switchTab("manual");

  const p = item.payload;

  // Re-populate number inputs
  const numMap = {
    "followers":           "#followers",
    "following":           "#follows",
    "posts":               "#posts",
    "description_length":  "description length",
    "fullname_words":      "fullname words",
    "nums_length_username":"nums/length username",
    "nums_length_fullname":"nums/length fullname",
  };
  Object.entries(numMap).forEach(([elId, payloadKey]) => {
    const el = document.getElementById(elId);
    if (el) el.value = p[payloadKey] ?? 0;
  });

  // Re-populate toggles
  const toggleMap = {
    profile_pic:      "profile pic",
    private:          "private",
    external_url:     "external URL",
    name_eq_username: "name==username",
  };
  Object.entries(toggleMap).forEach(([elId, payloadKey]) => {
    const cb = document.getElementById(elId);
    if (cb) { cb.checked = p[payloadKey] === 1; updateToggleBadge(cb); }
  });

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

// ── AI Username Estimator — updated for new feature set ───
async function fetchUsername() {
  const username = usernameInput?.value.trim();
  if (!username) {
    if (usernameInput) {
      usernameInput.style.borderColor = "var(--fake)";
      setTimeout(() => { usernameInput.style.borderColor = ""; }, 1500);
    }
    return;
  }

  fetchUsernameBtn.disabled = true;
  const origHTML = fetchUsernameBtn.innerHTML;
  fetchUsernameBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
      style="animation:spin 0.8s linear infinite">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg> Estimating...`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You are assisting a fake Instagram account detection tool. Based ONLY on the username pattern, estimate realistic feature values. Return ONLY valid JSON — no explanation, no markdown, no backticks.

Username: "${username}"

Return exactly this JSON:
{
  "profile_pic": <0 or 1>,
  "nums_length_username": <float: count digits in "${username}" divided by length of "${username}">,
  "fullname_words": <integer 0-5>,
  "nums_length_fullname": <float 0.0-1.0>,
  "name_eq_username": <0 or 1>,
  "description_length": <integer 0-150>,
  "external_url": <0 or 1>,
  "private": <0 or 1>,
  "posts": <integer 0-5000>,
  "followers": <integer 0-100000>,
  "following": <integer 0-10000>
}

Rules:
- Compute nums_length_username precisely: count digit characters in the username, divide by total username length.
- Bot-like username (many digits, random chars, very long number strings) → profile_pic:0, followers<30, following>2000, posts:0, description_length:0, fullname_words:0, name_eq_username:1.
- Human-like username (real name, words, underscores, few digits) → profile_pic:1, followers 200-5000, following 100-600, posts 20-300, description_length 30-100, fullname_words:2.
- Edge cases get intermediate values.`
        }]
      })
    });

    const data  = await response.json();
    const raw   = data.content?.map(i => i.text || "").join("") || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Set toggles
    const toggleMap2 = { profile_pic: "profile_pic", private: "private", external_url: "external_url", name_eq_username: "name_eq_username" };
    Object.entries(toggleMap2).forEach(([key, elId]) => {
      const cb = document.getElementById(elId);
      if (cb) { cb.checked = parsed[key] === 1; updateToggleBadge(cb); }
    });

    // Set number inputs
    const numMap2 = {
      followers: "followers", following: "following", posts: "posts",
      description_length: "description_length", fullname_words: "fullname_words",
      nums_length_username: "nums_length_username", nums_length_fullname: "nums_length_fullname"
    };
    Object.entries(numMap2).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (el) el.value = parsed[key] ?? 0;
    });

    updatePreview();

    fetchUsernameBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg> Done!`;
    setTimeout(() => {
      fetchUsernameBtn.innerHTML = origHTML;
      fetchUsernameBtn.disabled = false;
    }, 1600);

  } catch (err) {
    fetchUsernameBtn.innerHTML = origHTML;
    fetchUsernameBtn.disabled = false;
    showManualError("Could not estimate features. Please fill the form manually.");
  }
}

usernameInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") fetchUsername();
});

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
function showBulkError(msg)   { if (bulkErrorText)   bulkErrorText.textContent   = msg; show(bulkError);   }
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
  const id    = checkbox.id;
  const badge = document.getElementById(id + '_badge');
  const label = document.getElementById(id + '_label');

  // OFF label → ON label for each toggle
  const labels = {
    profile_pic:      ['No profile picture', 'Has profile picture'],
    private:          ['Public account',     'Private account'],
    external_url:     ['No external URL',    'Has external URL'],
    name_eq_username: ['Name ≠ Username',    'Name = Username'],
  };

  if (badge) {
    badge.textContent = checkbox.checked ? 'ON' : 'OFF';
    badge.classList.toggle('on', checkbox.checked);   // applies purple tint when ON
  }
  if (label && labels[id]) {
    label.textContent = checkbox.checked ? labels[id][1] : labels[id][0];
  }
}


// ── BUILD PAYLOAD ────────────────────────────────────────────
// Reads every form field and returns an object whose keys exactly
// match the column names the Flask backend / model expects.
// Called inside predictManual() in script.js as:  const payload = buildPayload();
function buildPayload() {
  return {
    // Binary toggles — 1 if checked, 0 if not
    "profile pic":          document.getElementById('profile_pic').checked ? 1 : 0,
    "external URL":         document.getElementById('external_url').checked ? 1 : 0,
    "private":              document.getElementById('private').checked ? 1 : 0,
    "name==username":       document.getElementById('name_eq_username').checked ? 1 : 0,

    // Numeric ratio fields (0.0 – 1.0)
    "nums/length username": parseFloat(document.getElementById('nums_length_username').value) || 0,
    "nums/length fullname": parseFloat(document.getElementById('nums_length_fullname').value) || 0,

    // Numeric count fields
    "fullname words":       parseFloat(document.getElementById('fullname_words').value)    || 0,
    "description length":   parseFloat(document.getElementById('description_length').value) || 0,
    "#posts":               parseFloat(document.getElementById('posts').value)              || 0,
    "#followers":           parseFloat(document.getElementById('followers').value)          || 0,
    "#follows":             parseFloat(document.getElementById('following').value)          || 0,
  };
}


// ── RENDER HYBRID ENGINE BREAKDOWN ───────────────────────────
// Called inside renderManualResult() in script.js after a
// prediction response comes back from the backend.
// Populates the three animated bar rows (ML, Rules, Final)
// and the list of rules that actually fired.
function renderHybridBreakdown(breakdown) {
  const el = document.getElementById('hybridBreakdown');
  if (!breakdown || !el) return;
  el.style.display = 'block';

  // Convert 0-1 probabilities to integer percentages for display
  const mlPct    = Math.round((breakdown.ml?.fake_probability || 0) * 100);
  const rulePct  = Math.round((breakdown.rules?.score        || 0) * 100);
  const finalPct = Math.round(
    ((breakdown.ml?.fake_probability || 0) * 0.6 +   // 60% ML weight
     (breakdown.rules?.score         || 0) * 0.4)    // 40% rules weight
    * 100
  );

  // Animate the three progress bars
  document.getElementById('hybridBarML').style.width    = mlPct    + '%';
  document.getElementById('hybridValML').textContent    = mlPct    + '%';
  document.getElementById('hybridBarRules').style.width = rulePct  + '%';
  document.getElementById('hybridValRules').textContent = rulePct  + '%';
  document.getElementById('hybridBarFinal').style.width = finalPct + '%';
  document.getElementById('hybridValFinal').textContent = finalPct + '%';

  // Render fired rules list
  const list  = document.getElementById('rulesFiredList');
  list.innerHTML = '';
  const rules = breakdown.rules?.rules_fired || [];

  if (rules.length === 0) {
    list.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.3);">No rules triggered</span>';
  } else {
    rules.forEach(r => {
      const item = document.createElement('div');
      item.className = 'rule-fired-item';
      // Green dot for real signal, red dot for fake signal
      item.innerHTML = `
        <span class="rule-dot ${r.signal}"></span>
        ${r.rule}
        <span style="margin-left:auto;opacity:0.4;font-size:11px;">${r.signal}</span>`;
      list.appendChild(item);
    });
  }
}


// ── DEMO PRESET LOADER ───────────────────────────────────────
// Called by onclick="loadPreset('bot'|'real'|'edge')" on the
// three demo buttons in index.html.
// 1. Fills all form fields with preset values.
// 2. Fires predictManual() automatically after 150ms so the
//    user sees the result without having to click Analyze Account.
function loadPreset(type) {
  const presets = {
    // Classic bot: no pic, mass following, zero posts, numeric username
    bot: {
      profile_pic: false, private: false, external_url: false, name_eq_username: true,
      followers: 12, following: 3400, posts: 0,
      description_length: 0, fullname_words: 0,
      nums_length_username: 0.62, nums_length_fullname: 0.0
    },
    // Typical real account: has pic, URL, normal ratio
    real: {
      profile_pic: true, private: false, external_url: true, name_eq_username: false,
      followers: 4800, following: 320, posts: 287,
      description_length: 72, fullname_words: 2,
      nums_length_username: 0.0, nums_length_fullname: 0.0
    },
    // Ambiguous edge case: has pic but private, low followers, some numbers
    edge: {
      profile_pic: true, private: true, external_url: false, name_eq_username: false,
      followers: 180, following: 950, posts: 14,
      description_length: 18, fullname_words: 1,
      nums_length_username: 0.22, nums_length_fullname: 0.0
    }
  };

  const p = presets[type];
  if (!p) return;

  // Set the 4 toggle checkboxes and refresh their badge labels
  ['profile_pic', 'private', 'external_url', 'name_eq_username'].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) {
      cb.checked = p[id];
      updateToggleBadge(cb);   // keeps the ON/OFF pill + label text in sync
    }
  });

  // Set the 7 numeric inputs
  const numMap = {
    followers:            'followers',
    following:            'following',
    posts:                'posts',
    description_length:   'description_length',
    fullname_words:       'fullname_words',
    nums_length_username: 'nums_length_username',
    nums_length_fullname: 'nums_length_fullname',
  };
  Object.entries(numMap).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (el) el.value = p[key];
  });

  // Refresh the live profile preview card
  if (typeof updatePreview === 'function') updatePreview();

  // Auto-run prediction — short delay lets the DOM fields settle visually first
  setTimeout(() => {
    if (typeof predictManual === 'function') predictManual();
  }, 150);
}


// ── EXPOSE TO GLOBAL SCOPE ───────────────────────────────────
// These are called from inline HTML attributes (onclick, onchange)
// so they must be on window. Add these lines alongside the existing
// window.* assignments at the bottom of script.js.
window.updateToggleBadge  = updateToggleBadge;
window.buildPayload       = buildPayload;
window.renderHybridBreakdown = renderHybridBreakdown;
window.loadPreset         = loadPreset;

// ── Expose globals ─────────────────────────────────────────
window.predictManual   = predictManual;
window.predictFile     = predictFile;
window.exportResults   = exportResults;
window.goToPage        = goToPage;
window.replayHistory   = replayHistory;
window.loadPreset      = loadPreset;
window.fetchUsername   = fetchUsername;
window.validateField   = validateField;
window.validateRatio   = validateRatio;
window.updatePreview   = updatePreview;
window.updateToggleBadge = updateToggleBadge;