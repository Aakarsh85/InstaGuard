// ── Health check ──────────────────────────────────────────
async function checkHealth() {
  const apiStatusText = document.getElementById("apiStatus");
  const apiStatusDot = document.querySelector(".status-dot");
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
}checkHealth();

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