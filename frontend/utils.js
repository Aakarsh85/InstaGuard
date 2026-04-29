// utils.js

// ── DOM helpers ───────────────────────────────────────────
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }
function safeNum(val) { const n = Number(val); return isFinite(n) ? n : 0; }
function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function showManualError(msg) {
  const el = document.getElementById("manualErrorText");
  const card = document.getElementById("manualError");
  if (el) el.textContent = msg;
  show(card);
}

function showBulkError(msg) {
  const el = document.getElementById("bulkErrorText");
  const card = document.getElementById("bulkError");
  if (el) el.textContent = msg;
  show(card);
}

// ── Validation ────────────────────────────────────────────
const fieldRules = {
  followers: { max: 1e8 },
  following: { max: 1e8 },
  posts: { max: 1e6 },
  description_length: { max: 150 },
  fullname_words: { max: 20 },
};

function setValid(w, f, m) { w.className = "field-input-wrap valid"; f.textContent = m; f.className = "field-feedback valid-msg"; }
function setInvalid(w, f, m) { w.className = "field-input-wrap invalid"; f.textContent = m; f.className = "field-feedback invalid-msg"; }
function setWarn(w, f, m) { w.className = "field-input-wrap"; f.textContent = "⚠ " + m; f.className = "field-feedback invalid-msg"; }

function clearFieldState(input) {
  const wrap = document.getElementById(`wrap_${input.id}`);
  if (wrap) wrap.className = "field-input-wrap";
}

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

function validateAll() {
  let ok = true;
  ["followers", "following", "posts"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateField(el)) ok = false;
  });
  return ok;
}