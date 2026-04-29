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

function handleFileSelect(file) {
  const name = file.name;
  if (!name.endsWith(".csv") && !name.endsWith(".json")) {
    showBulkError("Only CSV or JSON files are supported."); return;
  }
  if (selectedFileName) selectedFileName.textContent = name;
  show(fileSelectedInfo);
  if (uploadZoneInner) uploadZoneInner.classList.add("hidden");
}
