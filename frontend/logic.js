// logic.js
// ── Toggle badge ──────────────────────────────────────────
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

// ── Numeric ratio ─────────────────────────────────────────
function computeNumericRatio(str) {
  if (!str || str.length === 0) return 0;
  const digits = (str.match(/[0-9]/g) || []).length;
  return parseFloat((digits / str.length).toFixed(4));
}

// ── Build payload ─────────────────────────────────────────
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

  const numRatioUsername = computeNumericRatio(username);
  const numRatioFullname = computeNumericRatio(fullname);
  const fullnameWords = fullname ? fullname.trim().split(/\s+/).filter(Boolean).length : 0;
  const descriptionLen = bio.length;
  const nameEqUsername = (username && fullname &&
    username.toLowerCase() === fullname.replace(/\s+/g, '').toLowerCase()) ? 1 : 0;

  const followerFollowRatio = followers / (following + 1);
  const postsPerFollower = posts / (followers + 1);
  const followAggressiveness = following / (followers + posts + 1);
  const profileCompleteness = hasPic + (descriptionLen > 0 ? 1 : 0) + hasUrl + (fullnameWords > 0 ? 1 : 0);
  const usernameSuspicion = numRatioUsername * (1 - hasPic);
  const nameAuthenticity = fullnameWords * (1 - nameEqUsername);
  const activityScore = Math.log1p(posts) + Math.log1p(followers);

  return {
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
    "follower_follow_ratio": followerFollowRatio,
    "posts_per_follower": postsPerFollower,
    "follow_aggressiveness": followAggressiveness,
    "profile_completeness": profileCompleteness,
    "username_suspicion": usernameSuspicion,
    "name_authenticity": nameAuthenticity,
    "activity_score": activityScore,
    "_username_text": username,
    "_fullname_text": fullname,
    "_bio_text": bio,
  };
}

// ── Feature labels ────────────────────────────────────────
const FEATURE_LABELS = {
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
  "username_suspicion": "Username Suspicion",
  "activity_score": "Activity Score",
  "follower_follow_ratio": "Follower/Follow Ratio",
  "follow_aggressiveness": "Follow Aggressiveness",
  "profile_completeness": "Profile Completeness",
  "name_authenticity": "Name Authenticity",
  "posts_per_follower": "Posts per Follower",
};

// ── Compute feature influence ─────────────────────────────
function computeFeatureInfluence(payload, result) {
  const isFake = result.prediction === 1;
  const confidence = result.confidence.percentage / 100;

  const followers = payload["#followers"] || 0;
  const following = payload["#follows"] || 0;
  const posts = payload["#posts"] || 0;
  const hasPic = payload["profile pic"] === 1 ? 1 : 0;
  const bioLen = payload["description length"] || 0;
  const numRatioUser = payload["nums/length username"] || 0;
  const numRatioFull = payload["nums/length fullname"] || 0;
  const fnWords = payload["fullname words"] || 0;

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

  const features = [
    { key: "profile pic", weight: 0.4614, directionScore: hasPic ? 0.95 : -0.90 },
    { key: "username_suspicion", weight: 0.3104, directionScore: (() => {
      if (userSuspicion === 0) return 0.90; if (userSuspicion <= 0.05) return 0.60;
      if (userSuspicion <= 0.15) return 0.10; if (userSuspicion <= 0.30) return -0.40;
      if (userSuspicion <= 0.50) return -0.70; return -0.90;
    })() },
    { key: "activity_score", weight: 0.0414, directionScore: (() => {
      if (activityScore >= 14) return 0.90; if (activityScore >= 10) return 0.76;
      if (activityScore >= 7) return 0.50; if (activityScore >= 4) return 0.10;
      if (activityScore >= 2) return -0.40; return -0.84;
    })() },
    { key: "#posts", weight: 0.0289, directionScore: (() => {
      if (posts >= 100) return 0.90; if (posts >= 50) return 0.76;
      if (posts >= 20) return 0.56; if (posts >= 10) return 0.30;
      if (posts >= 5) return -0.10; if (posts >= 1) return -0.50; return -0.90;
    })() },
    { key: "nums/length fullname", weight: 0.0270, directionScore: (() => {
      if (numRatioFull === 0) return 0.76; if (numRatioFull <= 0.10) return 0.36;
      if (numRatioFull <= 0.25) return -0.20; if (numRatioFull <= 0.40) return -0.56; return -0.84;
    })() },
    { key: "nums/length username", weight: 0.0255, directionScore: (() => {
      if (numRatioUser === 0) return 0.84; if (numRatioUser <= 0.10) return 0.56;
      if (numRatioUser <= 0.20) return 0.10; if (numRatioUser <= 0.35) return -0.30;
      if (numRatioUser <= 0.50) return -0.64; return -0.88;
    })() },
    { key: "profile_completeness", weight: 0.0228, directionScore: (() => {
      if (profileComplete >= 4) return 0.90; if (profileComplete >= 3) return 0.64;
      if (profileComplete >= 2) return 0.20; if (profileComplete >= 1) return -0.30; return -0.84;
    })() },
    { key: "follow_aggressiveness", weight: 0.0221, directionScore: (() => {
      if (followAggressive > 50) return -0.90; if (followAggressive > 20) return -0.70;
      if (followAggressive > 10) return -0.50; if (followAggressive > 5) return -0.20;
      if (followAggressive > 2) return 0.10; if (followAggressive > 1) return 0.40; return 0.70;
    })() },
    { key: "#followers", weight: 0.0159, directionScore: (() => {
      if (followers >= 5000) return 0.94; if (followers >= 1000) return 0.84;
      if (followers >= 500) return 0.64; if (followers >= 100) return 0.30;
      if (followers >= 50) return -0.10; if (followers >= 20) return -0.50; return -0.84;
    })() },
    { key: "follower_follow_ratio", weight: 0.0137, directionScore: (() => {
      if (followerFollowRatio >= 10) return 0.90; if (followerFollowRatio >= 3) return 0.70;
      if (followerFollowRatio >= 1) return 0.40; if (followerFollowRatio >= 0.5) return -0.10;
      if (followerFollowRatio >= 0.2) return -0.50; return -0.80;
    })() },
    { key: "description length", weight: 0.0066, directionScore: (() => {
      if (bioLen >= 80) return 0.84; if (bioLen >= 50) return 0.70;
      if (bioLen >= 30) return 0.44; if (bioLen >= 15) return 0.10;
      if (bioLen >= 5) return -0.30; return -0.84;
    })() },
    { key: "private", weight: 0.0062, directionScore: 0.00 },
    { key: "fullname words", weight: 0.0055, directionScore: (() => {
      if (fnWords >= 3) return 0.76; if (fnWords >= 2) return 0.64;
      if (fnWords === 1) return 0.00; return -0.84;
    })() },
    { key: "#follows", weight: 0.0046, directionScore: (() => {
      if (following > 7500) return -0.90; if (following > 5000) return -0.70;
      if (following > 2000) return -0.40; if (following > 1000) return 0.10;
      if (following >= 50 && following <= 1000) return 0.70;
      if (following >= 10) return 0.20; return -0.30;
    })() },
    { key: "name_authenticity", weight: 0.0045, directionScore: (() => {
      if (nameAuth >= 3) return 0.70; if (nameAuth >= 2) return 0.50;
      if (nameAuth >= 1) return 0.20; return -0.40;
    })() },
    { key: "posts_per_follower", weight: 0.0035, directionScore: (() => {
      if (postsPerFollower > 5) return -0.60; if (postsPerFollower > 1) return 0.10;
      if (postsPerFollower > 0.1) return 0.70; if (postsPerFollower > 0.01) return 0.40; return -0.50;
    })() },
    { key: "name==username", weight: 0.000, directionScore: 0.00 },
    { key: "external URL", weight: 0.000, directionScore: 0.00 },
  ];

  const scored = features.map(f => {
    const supporting = isFake ? f.directionScore < 0 : f.directionScore > 0;
    const magnitude = Math.abs(f.directionScore) * f.weight;
    return { ...f, supporting, magnitude };
  });

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

// ── Render feature importance ─────────────────────────────
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

  requestAnimationFrame(() => {
    container.querySelectorAll(".fb-fill").forEach((el, i) => {
      if (i >= VISIBLE_COUNT) return;
      const pct = Math.round(scaled[i]?.influence * 100 || 0);
      setTimeout(() => { el.style.width = pct + "%"; }, 80 + i * 65);
    });
  });
}

// ── Generate explanation ──────────────────────────────────
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

  if (!hasPic) { flags.push({ text: "No profile picture", type: "warning" }); reasons.push("no profile picture"); }
  else { flags.push({ text: "Has profile picture", type: "normal" }); }

  if (followers < 20) { flags.push({ text: `Only ${followers} followers`, type: "suspicious" }); reasons.push("very few followers"); }
  else if (followers > 50000) { flags.push({ text: `${fmt(followers)} followers`, type: "normal" }); }

  if (following > 2000) { flags.push({ text: `Following ${fmt(following)} accounts`, type: "suspicious" }); reasons.push(`mass-following ${fmt(following)} accounts`); }
  else if (following < 600 && following > 0) { flags.push({ text: `Normal following (${fmt(following)})`, type: "normal" }); }

  if (posts === 0) { flags.push({ text: "0 posts", type: "suspicious" }); reasons.push("no posts at all"); }
  else if (posts < 5) { flags.push({ text: `Only ${posts} post${posts !== 1 ? "s" : ""}`, type: "warning" }); reasons.push("very few posts"); }
  else { flags.push({ text: `${fmt(posts)} posts`, type: "normal" }); }

  if (ratio > 0.5) { flags.push({ text: `High username digit ratio (${(ratio * 100).toFixed(0)}%)`, type: "suspicious" }); reasons.push(`username is ${(ratio * 100).toFixed(0)}% digits`); }
  else if (ratio > 0.25) { flags.push({ text: `Some username digits (${(ratio * 100).toFixed(0)}%)`, type: "warning" }); }
  else { flags.push({ text: "Clean username", type: "normal" }); }

  if (bioLen < 5) { flags.push({ text: "No bio", type: "suspicious" }); reasons.push("no profile bio"); }
  else if (bioLen > 40) { flags.push({ text: "Detailed bio", type: "normal" }); }
  else { flags.push({ text: "Questionable bio", type: "warning" }); }

  if (hasUrl) { flags.push({ text: "Has website link", type: "normal" }); }

  if (fnWords === 0) { flags.push({ text: "No display name", type: "suspicious" }); reasons.push("missing display name"); }
  else if (fnWords >= 2) { flags.push({ text: `${fnWords}-word display name`, type: "normal" }); }

  if (following > 0 && followers > 0) {
    const ratio2 = following / followers;
    if (ratio2 > 5 && followers >= 150) { flags.push({ text: `Following ${ratio2.toFixed(1)}× more than followers`, type: "suspicious" }); reasons.push(`follows ${ratio2.toFixed(1)}× more than follows back`); }
    else if (ratio2 > 2 && followers >= 100) { flags.push({ text: `Following ${ratio2.toFixed(1)}× more than followers`, type: "warning" }); reasons.push(`follows ${ratio2.toFixed(1)}× more than follows back`); }
    else { flags.push({ text: `Following ${ratio2.toFixed(1)}× more than followers`, type: "normal" }); reasons.push(`follows ${ratio2.toFixed(1)}× more than follows back`); }
  }

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
        p1.textContent = "The model predicted this as a "; p2.textContent = "fake account";
        p3.textContent = " with "; p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
        p5.textContent = ". The overall combination of feature values matched patterns commonly observed in inauthentic accounts.";
        explanationEl.append(p1, p2, p3, p4, p5);
      } else {
        p1.textContent = "This account was classified as "; p2.textContent = "fake";
        p3.textContent = " with "; p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
        const em = document.createElement("em"); em.textContent = reasons.join(", ");
        p5.textContent = ". These patterns are strongly associated with bot or inauthentic accounts.";
        explanationEl.append(p1, p2, p3, p4, document.createTextNode(". The key signals driving this verdict were: "), em, p5);
      }
    } else {
      if (reasons.length === 0) {
        p1.textContent = "The model predicted this as a "; p2.textContent = "real account";
        p3.textContent = " with "; p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
        p5.textContent = ". The profile's feature values closely match patterns observed in authentic Instagram accounts.";
        explanationEl.append(p1, p2, p3, p4, p5);
      } else {
        p1.textContent = "This account appears to be "; p2.textContent = "real";
        p3.textContent = " with "; p4.textContent = `${level.toLowerCase()} confidence (${pct}%)`;
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

// ── Live hint helpers ─────────────────────────────────────
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
  chips.push({ text: `${username.length} chars`, level: 'neutral' });
  if (ratio === 0) chips.push({ text: 'No numbers · clean', level: 'safe' });
  else if (ratio <= 0.2) chips.push({ text: `${digitCnt} numbers (${pct}%)`, level: 'safe' });
  else if (ratio <= 0.4) chips.push({ text: `${digitCnt} numbers (${pct}%) · suspicious`, level: 'warn' });
  else chips.push({ text: `${digitCnt} numbers (${pct}%) · high risk`, level: 'danger' });
  const fullname = (document.getElementById('fullname_text')?.value || '').trim();
  if (fullname) {
    const match = username.toLowerCase() === fullname.replace(/\s+/g, '').toLowerCase();
    chips.push(match ? { text: 'Name = username · flag', level: 'warn' } : { text: 'Name ≠ username · ok', level: 'safe' });
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
  if (words >= 2) chips.push({ text: `${words} words · looks real`, level: 'safe' });
  else if (words === 1) chips.push({ text: '1 word · borderline', level: 'warn' });
  else chips.push({ text: 'No name · suspicious', level: 'danger' });
  if (ratio === 0) chips.push({ text: 'No digits · clean', level: 'safe' });
  else if (ratio <= 0.1) chips.push({ text: `${pct}% digits`, level: 'safe' });
  else chips.push({ text: `${pct}% digits · suspicious`, level: 'warn' });
  const username = (document.getElementById('username_text')?.value || '').trim();
  if (username) {
    const match = username.toLowerCase() === fullname.replace(/\s+/g, '').toLowerCase();
    chips.push(match ? { text: 'Matches username · flag', level: 'warn' } : { text: 'Differs from username', level: 'safe' });
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

function computeLiveHints() {
  onUsernameInput();
  onFullnameInput();
  onBioInput();
}

// ── Demo preset loader ────────────────────────────────────
function loadPreset(type) {
  const presets = {
    bot: { profile_pic: false, private: false, external_url: false, followers: 12, following: 3400, posts: 0, username_text: 'sailesh738291', fullname_text: '', bio_text: '' },
    real: { profile_pic: true, private: false, external_url: true, followers: 4800, following: 320, posts: 287, username_text: 'ajay.kumar', fullname_text: 'Ajay Kumar', bio_text: 'Travel photographer based in Goa 📸' },
    edge: { profile_pic: true, private: true, external_url: false, followers: 180, following: 950, posts: 14, username_text: 'akash.22x', fullname_text: 'Akash', bio_text: 'Just me.' },
  };
  const p = presets[type];
  if (!p) return;
  ['profile_pic', 'private', 'external_url'].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) { cb.checked = p[id]; updateToggleBadge(cb); }
  });
  ['followers', 'following', 'posts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = p[id];
  });
  const uEl = document.getElementById('username_text');
  const fEl = document.getElementById('fullname_text');
  const bEl = document.getElementById('bio_text');
  if (uEl) { uEl.value = p.username_text; onUsernameInput(); }
  if (fEl) { fEl.value = p.fullname_text; onFullnameInput(); }
  if (bEl) { bEl.value = p.bio_text; onBioInput(); }
  updatePreview();
  setTimeout(() => { if (typeof predictManual === 'function') predictManual(); }, 150);
}

// ── Session history ───────────────────────────────────────
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
  if (!sessionHistory.length) { emptyState.classList.remove("hidden"); return; }
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

function replayHistory(idx) {
  const item = sessionHistory[idx];
  if (!item || !item.payload || !item.result) return;
  switchTab("manual");
  const p = item.payload;
  const numMap = { followers: "#followers", following: "#follows", posts: "#posts" };
  Object.entries(numMap).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.value = p[key] ?? 0;
  });
  const toggleMap = { profile_pic: "profile pic", private: "private", external_url: "external URL" };
  Object.entries(toggleMap).forEach(([elId, key]) => {
    const cb = document.getElementById(elId);
    if (cb) { cb.checked = p[key] === 1; updateToggleBadge(cb); }
  });
  const uEl = document.getElementById('username_text');
  const fEl = document.getElementById('fullname_text');
  const bEl = document.getElementById('bio_text');
  if (uEl) { uEl.value = p._username_text || ''; onUsernameInput(); }
  if (fEl) { fEl.value = p._fullname_text || ''; onFullnameInput(); }
  if (bEl) { bEl.value = p._bio_text || ''; onBioInput(); }
  updatePreview();
  hide(document.getElementById("manualError"));
  hide(document.getElementById("manualSkeleton"));
  renderManualResult(item.result, p);
  updatePreviewBadge(item.result.label);
  setTimeout(() => {
    document.getElementById("manualResultCard")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 150);
}