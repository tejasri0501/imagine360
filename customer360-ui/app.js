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
  try { payload = await callAgentFabric(industry, customerId, text); }
  catch (e) { payload = { error: String(e) }; }

  typing.remove();
  renderAgent(payload, industry);
  btn.disabled = false; inp.focus();
}

// Call the Agent Fabric master broker directly over A2A (JSON-RPC message/send).
async function callAgentFabric(industry, customerId, message) {
  if (!AF_BROKER_URL) {
    return { error: "AF_BROKER_URL is not set. In config.js set it to the Agent Fabric broker A2A endpoint." };
  }
  const text = "industry=" + industry + "; customerId=" + customerId + "; request: " + message;
  const body = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [ { kind: "text", text: text } ]
      }
    }
  };
  const r = await fetch(AF_BROKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) return { error: "Agent Fabric returned HTTP " + r.status };
  const j = await r.json();
  // A2A reply: pull the text out of result.message.parts (or result.parts)
  const parts = (j.result && (j.result.message && j.result.message.parts || j.result.parts)) || [];
  const replyText = parts.filter(p => p.kind === "text" || p.text).map(p => p.text).join("\n");
  return { mode: "agent-fabric", reply: replyText || JSON.stringify(j), raw: j };
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

onIndustryChange();
