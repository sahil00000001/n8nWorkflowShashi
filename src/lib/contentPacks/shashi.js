const CATEGORIES = [
  "finance",
  "analyst",
  "operations",
  "marketing",
  "hr",
  "content",
  "management",
  "sales",
];

const CATEGORY_COLORS = {
  finance: "#1D9E75",
  analyst: "#378ADD",
  hr: "#D4537E",
  operations: "#BA7517",
  marketing: "#7F77DD",
  sales: "#D85A30",
  content: "#5DCAA5",
  management: "#888780",
};

function detectCategories(postText) {
  const t = (postText || "").toLowerCase();
  const cats = [];
  if (/finance|accounts|accountant|gst|taxation|invoice|tally|financial|cfo/.test(t)) cats.push("finance");
  if (/business analyst|business analysis|mis\b|data analyst|analytics|market research/.test(t)) cats.push("analyst");
  if (/\boperations\b|ops |supply chain|logistics|procurement/.test(t)) cats.push("operations");
  if (/marketing|digital marketing|social media|content market|growth\b|seo\b|campaign/.test(t)) cats.push("marketing");
  if (/\bhr\b|human resource|recruiter|talent|people ops|hrbp|payroll|onboarding|recruitment/.test(t)) cats.push("hr");
  if (/content writ|content creat|copywrite|copywriting|\bblog\b|writing|editor/.test(t)) cats.push("content");
  if (/management trainee|mt program|bba|mba|trainee|fresher|graduate|campus/.test(t)) cats.push("management");
  if (/\bsales\b|business develop|\bbd\b|client|account manager|\bcrm\b/.test(t)) cats.push("sales");
  return cats.length ? cats : ["management"];
}

function escape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getRD(c) {
  if (c.includes("finance") && c.includes("analyst")) return "Finance & Business Analyst";
  if (c.includes("finance")) return "Finance & Accounts Executive";
  if (c.includes("analyst")) return "Business Analyst";
  if (c.includes("hr")) return "HR & Talent Operations";
  if (c.includes("operations")) return "Operations & Strategy Associate";
  if (c.includes("marketing")) return "Marketing & Research Associate";
  if (c.includes("sales")) return "Sales & Business Development";
  if (c.includes("content")) return "Content & Communication Specialist";
  return "Management Trainee / Business Graduate";
}

function getCertBlock(c) {
  const finance = [
    "GST Filing & Taxation — Valeur Fabtex Pvt Ltd",
    "Financial Modelling & MIS Reporting — Internship",
  ];
  const business = [
    "Tata GenAI-Powered Data Analytics — Forage, 2025",
    "AWS Cloud Practitioner Essentials — AWS, 2025",
  ];
  const awards = [
    "Best Presenter Award (2026) — Research Presentation",
    "1st Prize — Best Out of Waste, Razmaataz",
  ];
  const tools = [
    "Microsoft Excel (Advanced) — Dashboards & Reporting",
    "Google Workspace Suite — Docs, Sheets, Slides",
  ];
  let o;
  if (c.includes("finance")) o = [...finance, ...tools, ...business, ...awards];
  else if (c.includes("analyst")) o = [...business, ...finance, ...tools, ...awards];
  else if (c.includes("marketing") || c.includes("content")) o = [...awards, ...tools, ...business, ...finance];
  else o = [...awards, ...finance, ...tools, ...business];
  return o.map((cert, i) => `${i + 1}. ${cert}`).join("\n");
}

function getSkillBlock(c) {
  const b = [];
  b.push(["Finance & Accounting", "Financial Modelling, MIS Reporting, Variance Analysis, GST Filing, Invoice Processing, Accounts Reconciliation."]);
  b.push(["Business Analysis", "Market Research, SWOT/SWOC Analysis, KPI Tracking, Competitive Intelligence, Data Interpretation."]);
  if (c.includes("analyst") || c.includes("operations")) b.push(["Operations & Process", "SOP Development, Process Optimisation, Project Documentation, Cross-functional Collaboration."]);
  if (c.includes("marketing") || c.includes("content")) b.push(["Content & Communication", "SEO-optimised writing, Report Drafting, Persuasive Copywriting, Audience Engagement."]);
  if (c.includes("hr") || c.includes("management") || c.includes("sales")) b.push(["Stakeholder Management", "Client Interaction, Team Coordination, Strategic Planning, Presentation Design."]);
  if (c.includes("finance")) b.push(["Taxation & Compliance", "GST Filing, Invoice Preparation, Compliance Workflows, Statutory Reporting."]);
  b.push(["Tools", "Microsoft Excel (Advanced), PowerPoint, Word, Google Sheets, Docs, Slides."]);
  return b.map(([sk, desc]) => `${sk}\n${desc}`).join("\n\n");
}

function genSubject(lead, profile) {
  const r = String(lead.role || "").replace(/[^\w\s\-/\\(\\)\.&+]/g, "").trim().replace(/\s+/g, " ");
  const c = lead.categories || [];
  const isFresher = profile.jobType === "fresher";
  const tag = isFresher ? `${profile.degree} '${(profile.gradYear || "").slice(-2)}` : `${profile.experience} YoE`;
  const name = profile.name || "Shashi Vashisht";
  if (c.includes("finance") && c.includes("analyst")) return `Application: ${r} | ${name} — Finance & Business Analysis | ${tag} | Available Now`;
  if (c.includes("finance")) return `Application: ${r} | ${name} — Finance & Accounts | GST · MIS · Modelling | ${tag}`;
  if (c.includes("analyst")) return `Application: ${r} | ${name} — Business Analyst | Research · KPI · Reporting | ${tag}`;
  if (c.includes("hr")) return `Application: ${r} | ${name} — HR & Talent Ops | Best Presenter '26 | ${tag}`;
  if (c.includes("operations")) return `Application: ${r} | ${name} — Operations & Strategy | Process Optimisation | ${tag}`;
  if (c.includes("marketing")) return `Application: ${r} | ${name} — Marketing & Research | Content · Brand | ${tag}`;
  if (c.includes("sales")) return `Application: ${r} | ${name} — Sales & BD | Communication · CRM | ${tag}`;
  if (c.includes("content")) return `Application: ${r} | ${name} — Content & Communication | Writing · Research | ${tag}`;
  return `Application: ${r} | ${name} — Management Trainee | ${tag} | Best Presenter Award | Available Now`;
}

function genBody(lead, profile) {
  const c = lead.categories || [];
  const rf = (lead.name || "").split(" ")[0];
  const greeting = (rf && rf !== "Hiring" && rf !== "Manager" && rf.length > 1) ? `Dear ${escape(rf)},` : "Dear Hiring Manager,";
  const rd = getRD(c);
  const sk = getSkillBlock(c);
  const ct = getCertBlock(c);
  const isFresher = profile.jobType === "fresher";
  const expLine = isFresher
    ? `final-year ${escape(profile.degree)} student at ${escape(profile.college)} (graduating ${escape(profile.gradYear)}) with hands-on internship experience in finance operations, market research, and MIS reporting`
    : `${escape(profile.experience)} years experienced professional in ${escape(rd)}`;
  const name = escape(profile.name);
  const role = escape(lead.role || "this opening");

  return `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.55">
<h2 style="margin:0 0 4px">${name}</h2>
<p style="margin:0 0 16px;color:#555;font-size:14px">${escape(rd)} | ${escape(profile.degree)}, ${escape(profile.college)} (${escape(profile.gradYear)}) | Best Presenter 2026 | Available Immediately</p>
<p>${greeting}</p>
<p>I came across the <strong>${role}</strong> opening and I am excited to apply. I am a ${expLine} — available to join immediately.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0">
  <tr><td><strong>Qualification</strong></td><td>${escape(profile.degree)} — ${escape(profile.college)} | Expected ${escape(profile.gradYear)}</td></tr>
  <tr><td><strong>Internship Experience</strong></td><td>5 months — Finance (Valeur Fabtex) + Content (Aashman Foundation)</td></tr>
  <tr><td><strong>Key Achievement</strong></td><td>Best Presenter Award 2026</td></tr>
  <tr><td><strong>Expected CTC</strong></td><td>As per company standards</td></tr>
  <tr><td><strong>Availability</strong></td><td>Immediately Available — ${escape(profile.location)}</td></tr>
</table>
<h3 style="margin:18px 0 6px">Skills &amp; Expertise</h3>
<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:0;font-size:14px">${escape(sk)}</pre>
<h3 style="margin:18px 0 6px">Key Highlights</h3>
<ul style="margin:0;padding-left:18px">
  <li>Best Presenter Award (2026) — High-impact analytical research presentation</li>
  <li>Delivered financial models &amp; MIS reports — Valeur Fabtex Pvt Ltd</li>
  <li>GST filing, invoice processing &amp; compliance workflows — hands-on taxation exposure</li>
  <li>1st Prize — Best Out of Waste, Razmaataz (creative execution &amp; teamwork)</li>
</ul>
<h3 style="margin:18px 0 6px">Credentials</h3>
<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:0;font-size:14px">${escape(ct)}</pre>
<p style="margin-top:16px">I would love the opportunity to contribute to your team. My resume is linked below.</p>
<p>I bring strong analytical thinking, a proactive attitude, and the ability to deliver from day one.</p>
<p><a href="${escape(profile.resumeLink)}">VIEW RESUME</a> · <a href="${escape(profile.linkedin)}">LINKEDIN</a></p>
<p>Thank you for your time.</p>
<p>Warm regards,<br/><strong>${name}</strong><br/>${escape(rd)} | ${escape(profile.degree)}, ${escape(profile.college)} (${escape(profile.gradYear)})<br/>${escape(profile.email)} | +91 ${escape(profile.phone)} | ${escape(profile.location)}, India</p>
<p style="font-size:12px;color:#888">In response to a position posted on LinkedIn · Resume</p>
</div>`;
}

export const shashiPack = {
  id: "shashi",
  displayName: "Shashi Vashisht",
  shortName: "Shashi",
  tagline: "BBA '26 · Marketing · HR · Finance · Analytics",
  emoji: "✨",
  color: "#D4537E",
  defaultProfile: {
    name: "Shashi Vashisht",
    email: "shashivash.bba2023ea@rdias.ac.in",
    phone: "9818710014",
    linkedin: "https://www.linkedin.com/in/shashi-vashisht-0a13a5348/",
    location: "New Delhi",
    resumeLink: "https://drive.google.com/file/d/1EgfW4MOmNTUT7H9mYQSrTAXUP4lBvaRA/view?usp=sharing",
    gradYear: "2026",
    degree: "BBA",
    college: "RDIAS",
    experience: "",
    jobType: "fresher",
  },
  categories: CATEGORIES,
  categoryColors: CATEGORY_COLORS,
  detectCategories,
  genSubject,
  genBody,
};
