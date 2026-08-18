// ============================================================================
// Chat UI: industry reskin (incl. background) + chat thread + agent responses.
// ============================================================================
const industrySel = document.getElementById("industry");
Object.keys(INDUSTRIES).forEach(key => {
  const o = document.createElement("option");
  o.value = key; o.textContent = INDUSTRIES[key].label;
  industrySel.appendChild(o);
});

function onIndustryChange() {
  const ind = INDUSTRIES[industrySel.value];
  document.documentElement.style.setProperty("--accent", ind.accent);
  document.documentElement.style.setProperty("--accent2", ind.accent2);
  document.documentElement.style.setProperty("--bg", ind.bg);
  document.documentElement.style.setProperty("--pattern", ind.pattern || "none");
  document.getElementById("logo").textContent = ind.logo;
  document.getElementById("companyName").textContent = ind.company;
  document.getElementById("tagline").textContent = ind.label + " · Customer 360 Agent";
  const custSel = document.getElementById("customer");
  custSel.innerHTML = "";
  ind.customers.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id; o.textContent = c.name;
    custSel.appendChild(o);
  });
  // reset chat with a greeting from this industry's agent
  const chat = document.getElementById("chat");
  chat.innerHTML = "";
  addAgentText(ind.company + " agent ready. Pick a customer and ask me to assess risk and act.");
}

// --- chat helpers ---
function addUser(text) {
  const chat = document.getElementById("chat");
  const d = document.createElement("div");
  d.className = "msg user";
  d.innerHTML = '<div class="who">You</div>' + escapeHtml(text);
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
}
function addAgentText(text) {
  const chat = document.getElementById("chat");
  const ind = INDUSTRIES[industrySel.value];
  const d = document.createElement("div");
  d.className = "msg agent";
  d.innerHTML = '<div class="who">' + ind.company + ' agent</div>' + escapeHtml(text);
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
  return d;
}
function addTyping() {
  const chat = document.getElementById("chat");
  const d = document.createElement("div");
  d.className = "msg agent typing"; d.textContent = "routing to master → industry agent…";
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
  return d;
}

// --- send ---
async function sendChat() {
  const btn = document.getElementById("go");
  const inp = document.getElementById("message");
  const text = inp.value.trim();
  if (!text) return;
  const industry = industrySel.value;
  const customerId = document.getElementById("customer").value;

  addUser(text);
  inp.value = ""; btn.disabled = true;
  const typing = addTyping();

  let payload;
  try {
    payload = USE_MOCK ? mockMasterResponse(industry, customerId, text)
                       : await callBackend(industry, customerId, text);
  } catch (e) { payload = { error: String(e) }; }

  typing.remove();
  renderAgent(payload, industry);
  btn.disabled = false; inp.focus();
}

async function callBackend(industry, customerId, message) {
  if (!BACKEND_URL) {
    return { error: "BACKEND_URL is not set yet. Set it in config.js to the master endpoint (e.g. https://your-app.cloudhub.io/api/master)." };
  }
  const r = await fetch(BACKEND_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ industry, customerId, message })
  });
  if (!r.ok) return { error: "Backend returned HTTP " + r.status };
  return await r.json();
}

// --- render agent result as a rich card bubble ---
function renderAgent(payload, industry) {
  const chat = document.getElementById("chat");
  const ind = INDUSTRIES[industry];
  const d = document.createElement("div");
  d.className = "msg agent";
  if (payload.error) { d.innerHTML = '<div class="who">' + ind.company + ' agent</div>Error: ' + escapeHtml(payload.error); chat.appendChild(d); return; }
  // Agent Fabric path returns a natural-language reply (LLM). Render it as text.
  if (payload.mode === "agent-fabric" && payload.reply) {
    d.innerHTML = '<div class="who">' + ind.company + ' agent</div>' + escapeHtml(payload.reply).replace(/\n/g,"<br>");
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return;
  }
  const r = payload.result || payload;
  const ins = r.insight || {};
  const band = ins.band || "—";
  const actions = (r.actionsTaken || []).map(a => JSON.stringify(a)).join("\n");
  d.innerHTML =
    '<div class="who">' + ind.company + ' agent</div>' +
    '<div class="rc">' +
      '<div class="route">Master → ' + (payload.routedIndustry || industry) + '-agent · ' + (payload.mode || "mock") + '</div>' +
      '<div class="rc-head">' +
        '<div class="rc-score"><b>' + (ins.score ?? "–") + '</b><span>' + (ins.metric || "score") + '</span></div>' +
        '<div><div><b>' + escapeHtml(r.customer || "") + '</b> · ' + escapeHtml(r.customerId || "") + '</div>' +
        '<div class="rc-band band-' + band + '">' + band + ' risk</div></div>' +
      '</div>' +
      '<div class="rc-title">Why</div><ul>' +
        ((ins.drivers && ins.drivers.length) ? ins.drivers.map(x => "<li>" + escapeHtml(x) + "</li>").join("") : "<li>No risk drivers</li>") +
      '</ul>' +
      '<div class="rc-title">Decision</div><div>' + escapeHtml(r.decision ? r.decision.action : "") + '</div>' +
      '<div class="rc-title">Actions taken</div><div class="mono">' + escapeHtml(actions || "none") + '</div>' +
    '</div>';
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// --- MOCK master (mirrors MuleSoft Data Cloud scoring + industry decision) ---
function mockMasterResponse(industry, customerId, message) {
  const ind = INDUSTRIES[industry];
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
  else if (band === "HIGH") { action = "OFFER"; actions = [ {system:"CoreSystem", applied:true, offer:"Targeted offer", ref:"OFR-"+customerId} ]; }
  else if (band === "MEDIUM") { action = "OUTREACH"; actions = [ {system:"MarketingCloud", sent:true, channel:"email", ref:"MSG-"+customerId} ]; }
  else { action = "MONITOR"; actions = [ {system:"none", note:"MONITOR — no action"} ]; }
  return { mode:"mock", routedIndustry: industry, result: {
    agent: industry+"-agent", company: ind.company, customerId, customer: g.name,
    insight: { metric: ind.metric, score, band, drivers },
    decision: { band, action }, actionsTaken: actions } };
}

onIndustryChange();
