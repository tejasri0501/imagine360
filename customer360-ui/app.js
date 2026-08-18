// ============================================================================
// UI logic: industry-based reskin + run agent (mock or real backend).
// ============================================================================

// --- populate industry dropdown ---
const industrySel = document.getElementById("industry");
Object.keys(INDUSTRIES).forEach(key => {
  const o = document.createElement("option");
  o.value = key; o.textContent = INDUSTRIES[key].label;
  industrySel.appendChild(o);
});

function onIndustryChange() {
  const ind = INDUSTRIES[industrySel.value];
  // reskin
  document.documentElement.style.setProperty("--accent", ind.accent);
  document.documentElement.style.setProperty("--accent2", ind.accent2);
  document.getElementById("logo").textContent = ind.logo;
  document.getElementById("companyName").textContent = ind.company;
  document.getElementById("tagline").textContent = ind.label + " · Customer 360 Agent";
  document.getElementById("modeBadge").textContent = USE_MOCK ? "MOCK" : "LIVE";
  // customers
  const custSel = document.getElementById("customer");
  custSel.innerHTML = "";
  ind.customers.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id; o.textContent = c.name;
    custSel.appendChild(o);
  });
  document.getElementById("resultCard").style.display = "none";
}

// --- run ---
async function runAgent() {
  const btn = document.getElementById("go");
  btn.disabled = true; btn.textContent = "Routing…";
  const industry = industrySel.value;
  const customerId = document.getElementById("customer").value;
  const message = document.getElementById("message").value;

  let result;
  try {
    result = USE_MOCK
      ? mockMasterResponse(industry, customerId, message)
      : await callBackend(industry, customerId, message);
  } catch (e) {
    result = { error: String(e) };
  }
  render(result, industry);
  btn.disabled = false; btn.textContent = "Send to Master Agent →";
}

async function callBackend(industry, customerId, message) {
  const r = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ industry, customerId, message })
  });
  return await r.json();
}

// --- MOCK: mirrors the MuleSoft Data Cloud scoring + industry agent decision ---
function mockMasterResponse(industry, customerId, message) {
  const ind = INDUSTRIES[industry];
  // mock golden records (same shape as the Data Cloud System API)
  const db = {
    "C-1001": { name: "Priya Sharma", value: 420, s: { complaints:3, engagement:1, negative:0, priceShock:true, sat:3 } },
    "C-1002": { name: "James Morrison", value: 85, s: { complaints:0, engagement:22, negative:0, priceShock:false, sat:9 } },
    "C-1003": { name: "Aisha Khan", value: 310, s: { complaints:1, engagement:3, negative:2, priceShock:false, sat:5 } }
  };
  const g = db[customerId] || db["C-1001"];
  const s = g.s;
  let score = s.complaints*12 + (s.engagement<4?25:0) + s.negative*15 + (s.priceShock?18:0) + (s.sat<=4?20:0);
  if (score > 100) score = 100;
  const band = score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  const drivers = [];
  if (s.complaints>0) drivers.push("Recent complaints: " + s.complaints);
  if (s.engagement<4) drivers.push("Low engagement (" + s.engagement + "/30d)");
  if (s.negative>0) drivers.push("Negative events: " + s.negative);
  if (s.priceShock) drivers.push("Recent price/rate increase");
  if (s.sat<=4) drivers.push("Low satisfaction (" + s.sat + ")");

  let action, actions;
  if (band === "HIGH" && g.value >= 300) { action = "OFFER_PLUS_CASE";
    actions = [ {system:"CoreSystem", applied:true, offer:"Loyalty offer", ref:"OFR-"+customerId},
                {system:"ServiceNow", opened:true, subject:"High-value at-risk follow-up", ref:"CASE-"+customerId} ]; }
  else if (band === "HIGH") { action = "OFFER";
    actions = [ {system:"CoreSystem", applied:true, offer:"Targeted offer", ref:"OFR-"+customerId} ]; }
  else if (band === "MEDIUM") { action = "OUTREACH";
    actions = [ {system:"MarketingCloud", sent:true, channel:"email", ref:"MSG-"+customerId} ]; }
  else { action = "MONITOR"; actions = [ {system:"none", note:"MONITOR — no action"} ]; }

  return {
    mode: "mock",
    routedIndustry: industry,
    result: {
      agent: industry + "-agent",
      company: ind.company,
      customerId, customer: g.name,
      insight: { metric: ind.metric, score, band, drivers },
      decision: { band, action, rationale: industry + ": " + ind.metric + " band " + band + " (score " + score + ")" },
      actionsTaken: actions,
      summary: ind.company + " " + industry + "-agent evaluated " + g.name + " (" + band + " " + ind.metric + ") and executed: " + action
    }
  };
}

// --- render ---
function render(payload, industry) {
  const card = document.getElementById("resultCard");
  card.style.display = "block";
  if (payload.error) { document.getElementById("routeLine").textContent = "Error: " + payload.error; return; }
  const r = payload.result || payload;
  const ins = r.insight || {};
  document.getElementById("routeLine").textContent =
    "Master → " + (payload.routedIndustry || industry) + "-agent   (" + (payload.mode || "mock") + ")";
  document.getElementById("scoreNum").textContent = ins.score ?? "–";
  document.getElementById("scoreLabel").textContent = ins.metric || "score";
  document.getElementById("custLine").textContent = (r.customer || "") + "  ·  " + (r.customerId || "");
  const band = ins.band || "—";
  const bandEl = document.getElementById("bandLine");
  bandEl.textContent = band + " risk";
  bandEl.className = "band band-" + band;
  const ul = document.getElementById("drivers"); ul.innerHTML = "";
  (ins.drivers || []).forEach(d => { const li = document.createElement("li"); li.textContent = d; ul.appendChild(li); });
  if ((ins.drivers||[]).length === 0) ul.innerHTML = "<li>No risk drivers</li>";
  document.getElementById("decision").textContent = (r.decision ? (r.decision.action + " — " + r.decision.rationale) : "");
  document.getElementById("actions").textContent = JSON.stringify(r.actionsTaken || [], null, 2);
}

// init
onIndustryChange();
