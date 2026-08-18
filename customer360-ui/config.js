// ============================================================================
// Industry branding + sample customers. Edit freely for demos.
// When the real backend is ready, set BACKEND_URL and USE_MOCK = false.
// ============================================================================
const USE_MOCK = true;                 // <-- flip to false to call the real master
const BACKEND_URL = "";                // <-- e.g. https://your-app.cloudhub.io/api/master

const INDUSTRIES = {
  finserv: {
    label: "Financial Services / Insurance",
    company: "Meridian Financial",
    logo: "🏦",
    accent: "#2563eb",       // blue
    accent2: "#1e3a8a",
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
    metric: "churnRisk",
    customers: [
      { id: "C-1001", name: "Priya Sharma · Family plan" },
      { id: "C-1002", name: "James Morrison · Prepaid" },
      { id: "C-1003", name: "Aisha Khan · Contract ending" }
    ]
  }
};
