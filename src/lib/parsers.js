export function sanitize(s) {
  return (s || "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n|\r/g, " ")
    .trim();
}

export function getCategories(postText) {
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

export function extractRole(postText) {
  const lines = (postText || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    const clean = line
      .replace(/[^\w\s\-\/\(\)&,\.#+]/g, "")
      .trim()
      .replace(/^(we.re hiring|we are hiring|urgent hiring|hiring alert|hiring|join us|alert)[:\-|!\s]*/i, "")
      .trim()
      .replace(/#\w+/g, "")
      .trim()
      .replace(/\s+/g, " ");
    if (clean.length > 5 && clean.length < 80) return clean;
  }
  return "Business & Finance Opportunity";
}

export function cleanName(name) {
  return (
    (name || "")
      .replace(/premium profile|\b2nd\b|\b3rd\+\b|• 2nd|• 3rd\+|, hiring|hiring manager/gi, "")
      .trim()
      .replace(/^[,.\s]+|[,.\s]+$/g, "") || "Hiring Manager"
  );
}

export const CATEGORY_LIST = [
  "finance",
  "analyst",
  "operations",
  "marketing",
  "hr",
  "content",
  "management",
  "sales",
];

export const CAT_COLORS = {
  finance: "#1D9E75",
  analyst: "#378ADD",
  hr: "#D4537E",
  operations: "#BA7517",
  marketing: "#7F77DD",
  sales: "#D85A30",
  content: "#5DCAA5",
  management: "#888780",
};
