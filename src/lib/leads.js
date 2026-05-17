import { extractRole, cleanName } from "./parsers.js";
import { getPack, DEFAULT_OWNER } from "./contentPacks/index.js";

export const STATUS_LIST = ["new", "queued", "sent", "responded", "rejected"];

export const STATUS_COLORS = {
  new: "#888780",
  queued: "#378ADD",
  sent: "#1D9E75",
  responded: "#7F77DD",
  rejected: "#D85A30",
};

export function emptyLead(ownerId = DEFAULT_OWNER) {
  const now = new Date().toISOString();
  return {
    owner: ownerId,
    email: "",
    emailLower: "",
    name: "",
    designation: "",
    company: "",
    location: "",
    linkedinUrl: "",
    phone: "",
    notes: "",
    role: "",
    categories: [],
    status: "new",
    source: "manual",
    sourceFile: "",
    addedAt: now,
    updatedAt: now,
    generatedAt: null,
  };
}

export function normalizeLead(input, ownerId) {
  const base = emptyLead(ownerId || input.owner || DEFAULT_OWNER);
  const merged = { ...base, ...input };
  merged.owner = merged.owner || ownerId || DEFAULT_OWNER;
  merged.email = String(merged.email || "").trim();
  merged.emailLower = merged.email.toLowerCase();
  merged.name = String(merged.name || "").trim();
  merged.designation = String(merged.designation || "").trim();
  merged.company = String(merged.company || "").trim();
  merged.location = String(merged.location || "").trim();
  merged.linkedinUrl = String(merged.linkedinUrl || "").trim();
  merged.phone = String(merged.phone || "").trim();
  merged.notes = String(merged.notes || "").trim();
  merged.role = String(merged.role || "").trim();
  merged.categories = Array.isArray(merged.categories) ? merged.categories : [];
  if (!STATUS_LIST.includes(merged.status)) merged.status = "new";
  if (!merged.addedAt) merged.addedAt = new Date().toISOString();
  if (!merged.updatedAt) merged.updatedAt = merged.addedAt;
  return merged;
}

export function leadFromLinkedInItem(item, sourceFile, ownerId) {
  const email = String(item.email || "").trim();
  if (!email || !email.includes("@")) return null;
  const pack = getPack(ownerId);
  const lead = emptyLead(ownerId);
  lead.email = email;
  lead.emailLower = email.toLowerCase();
  lead.name = cleanName(item.rawName || item.name || "");
  lead.role = extractRole(item.postText || item.post_text || "");
  lead.categories = pack.detectCategories(item.postText || item.post_text || "");
  lead.source = "linkedin";
  lead.sourceFile = sourceFile || "";
  lead.status = "new";
  return lead;
}

export function mergeLeads(existing, incoming, ownerId) {
  const byEmail = new Map();
  for (const l of existing) {
    const norm = normalizeLead(l, ownerId);
    if (norm.emailLower) byEmail.set(norm.emailLower, norm);
  }
  let added = 0;
  let merged = 0;
  const duplicates = [];
  const now = new Date().toISOString();
  for (const raw of incoming) {
    const lead = normalizeLead(raw, ownerId);
    if (!lead.emailLower) continue;
    const prev = byEmail.get(lead.emailLower);
    if (!prev) {
      byEmail.set(lead.emailLower, lead);
      added++;
    } else {
      const next = { ...prev };
      for (const k of [
        "name",
        "designation",
        "company",
        "location",
        "linkedinUrl",
        "phone",
        "notes",
        "role",
      ]) {
        if (!next[k] && lead[k]) next[k] = lead[k];
      }
      const catSet = new Set([...(next.categories || []), ...(lead.categories || [])]);
      next.categories = [...catSet];
      next.updatedAt = now;
      if (lead.sourceFile && !next.sourceFile) next.sourceFile = lead.sourceFile;
      byEmail.set(lead.emailLower, next);
      merged++;
      duplicates.push(lead);
    }
  }
  return { leads: [...byEmail.values()], added, merged, duplicates };
}

export function uniqueValues(leads, key) {
  const set = new Set();
  for (const l of leads) {
    const v = (l[key] || "").trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterLeads(leads, filters) {
  const q = (filters.search || "").trim().toLowerCase();
  return leads.filter((l) => {
    if (filters.designation && filters.designation !== "all" && l.designation !== filters.designation) return false;
    if (filters.location && filters.location !== "all" && l.location !== filters.location) return false;
    if (filters.company && filters.company !== "all" && l.company !== filters.company) return false;
    if (filters.status && filters.status !== "all" && l.status !== filters.status) return false;
    if (filters.category && filters.category !== "all" && !(l.categories || []).includes(filters.category)) return false;
    if (filters.source && filters.source !== "all" && l.source !== filters.source) return false;
    if (!q) return true;
    return (
      l.email.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.designation.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) ||
      l.location.toLowerCase().includes(q) ||
      l.role.toLowerCase().includes(q) ||
      (l.notes || "").toLowerCase().includes(q)
    );
  });
}

export function migrateV2HistoryToLeads(v2History) {
  return v2History.map((h) => {
    const lead = emptyLead("shashi");
    lead.email = h.email || "";
    lead.emailLower = (h.emailLower || h.email || "").toLowerCase();
    lead.name = h.recruiter || "";
    lead.role = h.role || "";
    lead.categories = h.categories || [];
    lead.status = h.generatedAt ? "queued" : "new";
    lead.source = h.legacy ? "legacy" : "linkedin";
    lead.sourceFile = h.sourceFile || "";
    lead.addedAt = h.addedAt || new Date().toISOString();
    lead.updatedAt = h.addedAt || new Date().toISOString();
    lead.generatedAt = h.generatedAt || null;
    return lead;
  });
}
