// ============================================================================
// Industry branding + sample customers. Edit freely for demos.
// Set AF_BROKER_URL below to the Agent Fabric master broker (A2A) endpoint.
// ============================================================================
// The master IS Agent Fabric — the UI calls the AF broker directly (A2A).
// Set AF_BROKER_URL to the broker's A2A endpoint (from the AF ingress gateway).
const AF_BROKER_URL = "";              // <-- SET THIS: https://<af-ingress>/customer360Master

// Inline SVG tiled patterns (data-URIs). Zero external requests, always load,
// no CORS. Faint white icons themed per industry, layered over the gradient.
function pat(svg){ return "url(\"data:image/svg+xml,"+encodeURIComponent(svg)+"\")"; }
const P_FINSERV   = pat('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><g fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="3"><circle cx="30" cy="30" r="16"/><text x="24" y="37" font-size="20" fill="#ffffff" fill-opacity="0.10" stroke="none">$</text><circle cx="90" cy="90" r="16"/><text x="84" y="97" font-size="20" fill="#ffffff" fill-opacity="0.10" stroke="none">$</text></g></svg>');
const P_RETAIL    = pat('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><g fill="#ffffff" fill-opacity="0.09"><path d="M30 34 h24 l4 30 h-32 z"/><path d="M36 34 a6 6 0 0 1 12 0" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="3"/><path d="M84 84 h24 l4 26 h-32 z"/></g></svg>');
const P_HEALTH    = pat('<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110"><g fill="#ffffff" fill-opacity="0.10"><path d="M26 18h10v10h10v10h-10v10h-10v-10h-10v-10h10z"/><path d="M74 62h8v8h8v8h-8v8h-8v-8h-8v-8h8z"/></g></svg>');
const P_TELCO     = pat('<svg xmlns="http://www.w3.org/2000/svg" width="130" height="130"><g fill="none" stroke="#ffffff" stroke-opacity="0.11" stroke-width="3"><path d="M30 70 a20 20 0 0 1 34 0"/><path d="M22 78 a32 32 0 0 1 50 0"/><circle cx="47" cy="80" r="3" fill="#ffffff" fill-opacity="0.14" stroke="none"/><path d="M96 118 a20 20 0 0 1 34 0"/></g></svg>');
const P_BANKING   = pat('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><g fill="none" stroke="#ffffff" stroke-opacity="0.11" stroke-width="3"><path d="M20 42 l20 -14 l20 14 z"/><path d="M24 46 v20 M34 46 v20 M44 46 v20 M18 70 h44"/><path d="M80 102 l20 -14 l20 14 z"/></g></svg>');

const INDUSTRIES = {
  finserv: {
    label: "Financial Services / Insurance",
    company: "Meridian Financial",
    logo: "🏦",
    accent: "#2563eb",       // blue
    accent2: "#1e3a8a",
    bg: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#2563eb 100%)",
    pattern: P_FINSERV,
    metric: "churnRisk",
    customers: [
      { id: "C-1001", name: "Priya Sharma  · Premier · $420/mo" },
      { id: "C-1002", name: "James Morrison · Standard · $85/mo" },
      { id: "C-1003", name: "Aisha Khan · Premier · $310/mo" }
    ]
  },
  retail: {
    label: "Retail / CPG",
    company: "NorthPeak Retail",
    logo: "🛍️",
    accent: "#db2777",       // pink
    accent2: "#9d174d",
    bg: "linear-gradient(135deg,#4a044e 0%,#9d174d 55%,#db2777 100%)",
    pattern: P_RETAIL,
    metric: "churnRisk",
    customers: [
      { id: "C-1001", name: "Priya Sharma · Loyalty Gold" },
      { id: "C-1002", name: "James Morrison · New shopper" },
      { id: "C-1003", name: "Aisha Khan · Lapsing" }
    ]
  },
  healthcare: {
    label: "Healthcare",
    company: "Caldera Health",
    logo: "🏥",
    accent: "#059669",       // green
    accent2: "#065f46",
    bg: "linear-gradient(135deg,#052e2b 0%,#065f46 55%,#059669 100%)",
    pattern: P_HEALTH,
    metric: "readmissionRisk",
    customers: [
      { id: "C-1001", name: "Priya Sharma · High utilization" },
      { id: "C-1002", name: "James Morrison · Routine" },
      { id: "C-1003", name: "Aisha Khan · 2 missed follow-ups" }
    ]
  },
  telco: {
    label: "Telco",
    company: "Vantage Mobile",
    logo: "📡",
    accent: "#7c3aed",       // purple
    accent2: "#5b21b6",
    bg: "linear-gradient(135deg,#1e1b4b 0%,#5b21b6 55%,#7c3aed 100%)",
    pattern: P_TELCO,
    metric: "churnRisk",
    customers: [
      { id: "C-1001", name: "Priya Sharma · Family plan" },
      { id: "C-1002", name: "James Morrison · Prepaid" },
      { id: "C-1003", name: "Aisha Khan · Contract ending" }
    ]
  },
  banking: {
    label: "Banking",
    company: "Sterling Trust Bank",
    logo: "🏛️",
    accent: "#0d9488",       // teal
    accent2: "#134e4a",
    bg: "linear-gradient(135deg,#042f2e 0%,#134e4a 55%,#0d9488 100%)",
    pattern: P_BANKING,
    metric: "attritionRisk",
    customers: [
      { id: "C-1001", name: "Priya Sharma · Wealth · $420/mo" },
      { id: "C-1002", name: "James Morrison · Checking · $85/mo" },
      { id: "C-1003", name: "Aisha Khan · Lending · $310/mo" }
    ]
  }
};
