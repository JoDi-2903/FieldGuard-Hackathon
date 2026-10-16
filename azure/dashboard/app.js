"use strict";

// FieldGuard dashboard — plain JS, no build step, no external chart library.
// Primary view: the ranked visit list (status colour + icon + label, never colour
// alone). Detail view: three single-series line charts (never a dual-axis combo).

const CFG = window.FIELDGUARD_CONFIG || {};
const API = (CFG.apiBaseUrl || "").replace(/\/$/, "");

const RISK_STYLES = {
  red: { cls: "red", icon: "‼", label: "High risk" },
  yellow: { cls: "yellow", icon: "!", label: "Medium risk" },
  green: { cls: "green", icon: "✓", label: "Low risk" },
};

const CHART_COLORS = { temp: "#d9822b", hum: "#2f6fb0", soil: "#4a7c59" };

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

async function getJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

function renderRiskList(items) {
  const list = document.getElementById("risk-list");
  list.innerHTML = "";
  if (!items.length) {
    list.appendChild(el("p", { class: "muted", text: "No risk scores yet. Trigger a scoring run." }));
    return;
  }
  for (const item of items) {
    const style = RISK_STYLES[item.color] || RISK_STYLES.yellow;
    const card = el("div", { class: "card" });

    const topRow = el("div", { class: "row" });
    topRow.appendChild(el("span", { class: "field-name", text: item.fieldName || item.fieldId }));
    const badge = el("span", { class: `badge ${style.cls}` });
    badge.appendChild(el("span", { text: style.icon }));
    badge.appendChild(el("span", { text: style.label }));
    topRow.appendChild(badge);
    topRow.appendChild(el("span", { class: "score", text: item.score != null ? item.score : "–" }));
    card.appendChild(topRow);

    if (item.reasoning) card.appendChild(el("div", { class: "muted", text: item.reasoning }));
    if (item.recommended_action)
      card.appendChild(el("div", { text: `→ ${item.recommended_action}` }));
    if (item.data_caveats) card.appendChild(el("div", { class: "caveat", text: `⚠ ${item.data_caveats}` }));
    list.appendChild(card);
  }
}

// Minimal single-series line chart on a canvas (DPI-aware, baseline-anchored).
function drawLine(canvasId, points, color) {
  const canvas = document.getElementById(canvasId);
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const vals = points.map((p) => p.value).filter((v) => v != null);
  if (vals.length < 2) {
    ctx.fillStyle = "#9fb0c0";
    ctx.font = "13px system-ui";
    ctx.fillText("not enough data", 8, h / 2);
    return;
  }
  const pad = 6;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (w - 2 * pad);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  let started = false;
  points.forEach((p, i) => {
    if (p.value == null) return;
    const px = x(i);
    const py = y(p.value);
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.fillStyle = "#9fb0c0";
  ctx.font = "11px system-ui";
  ctx.fillText(max.toFixed(1), 8, 12);
  ctx.fillText(min.toFixed(1), 8, h - 2);
}

function renderCharts(readings) {
  // readings are newest-first; chart chronologically.
  const chrono = [...readings].reverse();
  const series = (key) => chrono.map((r) => ({ t: r.deviceTimestamp, value: r[key] }));
  drawLine("chart-temp", series("temperature_c"), CHART_COLORS.temp);
  drawLine("chart-hum", series("humidity_pct"), CHART_COLORS.hum);
  drawLine("chart-soil", series("soil_pct"), CHART_COLORS.soil);
}

async function refresh() {
  const riskStatus = document.getElementById("risk-status");
  const chartStatus = document.getElementById("chart-status");
  document.getElementById("device-label").textContent = CFG.chartDeviceId || "(unset)";

  if (!API || API.includes("<function-app-hostname>")) {
    riskStatus.className = "error";
    riskStatus.textContent = "Set apiBaseUrl in config.js (copy from config.js.template).";
    return;
  }

  try {
    renderRiskList(await getJSON("/risk"));
    riskStatus.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    riskStatus.className = "error";
    riskStatus.textContent = `Could not load risk list: ${e.message}`;
  }

  try {
    const limit = CFG.chartLimit || 200;
    const readings = await getJSON(`/readings?deviceId=${encodeURIComponent(CFG.chartDeviceId)}&limit=${limit}`);
    renderCharts(readings);
    chartStatus.textContent = `${readings.length} readings`;
  } catch (e) {
    chartStatus.className = "error";
    chartStatus.textContent = `Could not load readings: ${e.message}`;
  }
}

document.getElementById("refresh").addEventListener("click", refresh);
refresh();
