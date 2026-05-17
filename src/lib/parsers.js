export function sanitize(s) {
  return (s || "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n|\r/g, " ")
    .trim();
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
  return "Open Role Opportunity";
}

export function cleanName(name) {
  return (
    (name || "")
      .replace(/premium profile|\b2nd\b|\b3rd\+\b|• 2nd|• 3rd\+|, hiring|hiring manager/gi, "")
      .trim()
      .replace(/^[,.\s]+|[,.\s]+$/g, "") || "Hiring Manager"
  );
}
