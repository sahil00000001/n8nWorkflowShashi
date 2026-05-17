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
    let clean = line
      .replace(/[''`]/g, "")
      .replace(/[^\w\s\-\/\(\)&,\.#+]/g, " ")
      .replace(/#\w+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    clean = clean
      .replace(/^(were hiring|we are hiring|we re hiring|urgent hiring|hiring alert|alert|hiring for|now hiring|looking for|join us as|hiring)[:\-|!\s]*/i, "")
      .trim();

    const lower = clean.toLowerCase();
    const hiringIdx = lower.indexOf(" hiring ");
    if (hiringIdx > 0 && hiringIdx < 60) {
      clean = clean.slice(hiringIdx + " hiring ".length).trim();
    } else if (lower.startsWith("hiring ")) {
      clean = clean.slice("hiring ".length).trim();
    }

    clean = clean
      .replace(/\s+(in|at|for|near)\s+[A-Za-z][A-Za-z .\-]+$/i, "")
      .replace(/\s+\(.*?\)\s*$/g, "")
      .replace(/[\s|\-]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (clean.length > 4 && clean.length < 80) return clean;
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
