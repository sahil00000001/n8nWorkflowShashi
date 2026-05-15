import * as XLSX from "xlsx";
import { normalizeLead } from "./leads.js";

const FIELD_PATTERNS = {
  email: /^(e[\-_ ]?mail|email[\s_-]?address|mail|email\s*id|contact[\s_-]?email)$/i,
  name: /^(name|full[\s_-]?name|contact[\s_-]?name|recruiter|recruiter[\s_-]?name|hr[\s_-]?name|hiring[\s_-]?manager|first[\s_-]?last|person)$/i,
  designation: /^(designation|title|job[\s_-]?title|position|role|jobtitle|job\s*role|profile|post)$/i,
  company: /^(company|organi[sz]ation|employer|firm|business|company[\s_-]?name)$/i,
  location: /^(location|city|country|region|place|geo|address|based[\s_-]?in)$/i,
  linkedinUrl: /^(linkedin|linkedin[\s_-]?url|profile|profile[\s_-]?url|linkedin[\s_-]?profile|li[\s_-]?url)$/i,
  phone: /^(phone|mobile|contact|contact[\s_-]?number|number|tel|telephone|whatsapp)$/i,
  notes: /^(notes|comments|remarks|description|details|note)$/i,
  status: /^(status|state|stage|disposition)$/i,
  source: /^(source|origin|channel|from)$/i,
  categories: /^(category|categories|industry|domain|sector|function|tag|tags)$/i,
  role: /^(hiring[\s_-]?role|opening|opportunity|target[\s_-]?role|requirement)$/i,
};

function autoDetectColumns(headers) {
  const mapping = {};
  for (const [field, pattern] of Object.entries(FIELD_PATTERNS)) {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || "").trim();
      if (pattern.test(h)) {
        if (!mapping[field]) mapping[field] = i;
        break;
      }
    }
  }
  if (mapping.email == null) {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || "").toLowerCase();
      if (h.includes("mail")) {
        mapping.email = i;
        break;
      }
    }
  }
  return mapping;
}

function parseCategories(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw)
    .split(/[,;|/]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets = wb.SheetNames;
  const out = [];
  for (const name of sheets) {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
    if (!aoa.length) continue;
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(aoa.length, 5); i++) {
      const row = aoa[i] || [];
      const nonEmpty = row.filter((c) => String(c).trim()).length;
      if (nonEmpty >= 2) {
        headerRowIdx = i;
        break;
      }
    }
    const headers = (aoa[headerRowIdx] || []).map((h) => String(h || "").trim());
    const dataRows = aoa.slice(headerRowIdx + 1).filter((r) => r.some((c) => String(c).trim()));
    const mapping = autoDetectColumns(headers);
    out.push({ sheet: name, headers, dataRows, mapping });
  }
  return { sheets: out, fileName: file.name };
}

export function rowsToLeads(parsedSheet, sourceFile) {
  const { dataRows, mapping } = parsedSheet;
  const leads = [];
  const skipped = [];
  for (const row of dataRows) {
    const get = (key) => (mapping[key] != null ? row[mapping[key]] : "");
    const email = String(get("email") || "").trim();
    if (!email || !email.includes("@")) {
      skipped.push({ row, reason: "no valid email" });
      continue;
    }
    const lead = normalizeLead({
      email,
      name: String(get("name") || "").trim(),
      designation: String(get("designation") || "").trim(),
      company: String(get("company") || "").trim(),
      location: String(get("location") || "").trim(),
      linkedinUrl: String(get("linkedinUrl") || "").trim(),
      phone: String(get("phone") || "").trim(),
      notes: String(get("notes") || "").trim(),
      role: String(get("role") || "").trim(),
      status: String(get("status") || "new").toLowerCase().trim(),
      source: "excel",
      sourceFile,
      categories: parseCategories(get("categories")),
    });
    leads.push(lead);
  }
  return { leads, skipped };
}

export const FIELD_LABELS = {
  email: "Email",
  name: "Name / Recruiter",
  designation: "Designation",
  company: "Company",
  location: "Location",
  linkedinUrl: "LinkedIn URL",
  phone: "Phone",
  notes: "Notes",
  status: "Status",
  source: "Source",
  categories: "Categories",
  role: "Hiring role",
};
