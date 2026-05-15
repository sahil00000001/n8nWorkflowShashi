import { supabase, isCloudConfigured } from "./supabase.js";

const TABLE = "leads";
const CHUNK = 500;

function leadToRow(l) {
  return {
    email_lower: l.emailLower,
    email: l.email,
    name: l.name || "",
    designation: l.designation || "",
    company: l.company || "",
    location: l.location || "",
    linkedin_url: l.linkedinUrl || "",
    phone: l.phone || "",
    notes: l.notes || "",
    role: l.role || "",
    categories: l.categories || [],
    status: l.status || "new",
    source: l.source || "manual",
    source_file: l.sourceFile || "",
    added_at: l.addedAt || new Date().toISOString(),
    updated_at: l.updatedAt || new Date().toISOString(),
    generated_at: l.generatedAt || null,
  };
}

function rowToLead(r) {
  return {
    email: r.email,
    emailLower: r.email_lower,
    name: r.name || "",
    designation: r.designation || "",
    company: r.company || "",
    location: r.location || "",
    linkedinUrl: r.linkedin_url || "",
    phone: r.phone || "",
    notes: r.notes || "",
    role: r.role || "",
    categories: Array.isArray(r.categories) ? r.categories : [],
    status: r.status || "new",
    source: r.source || "manual",
    sourceFile: r.source_file || "",
    addedAt: r.added_at,
    updatedAt: r.updated_at,
    generatedAt: r.generated_at,
  };
}

export async function fetchAllLeads() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToLead);
}

export async function upsertLeads(leads) {
  if (!supabase || !leads.length) return;
  const rows = leads.map(leadToRow);
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(TABLE)
      .upsert(chunk, { onConflict: "email_lower" });
    if (error) throw error;
  }
}

export async function deleteLeadsByEmail(emailLowers) {
  if (!supabase || !emailLowers.length) return;
  for (let i = 0; i < emailLowers.length; i += CHUNK) {
    const chunk = emailLowers.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .in("email_lower", chunk);
    if (error) throw error;
  }
}

export async function deleteAllLeads() {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .neq("email_lower", "___never_match___");
  if (error) throw error;
}

export function indexLeads(leads) {
  const m = new Map();
  for (const l of leads || []) {
    if (l && l.emailLower) m.set(l.emailLower, l);
  }
  return m;
}

export function diffLeads(prevMap, nextMap) {
  const toUpsert = [];
  const toDelete = [];
  for (const [key, lead] of nextMap) {
    const prev = prevMap.get(key);
    if (!prev) {
      toUpsert.push(lead);
    } else if (!leadsEqual(prev, lead)) {
      toUpsert.push(lead);
    }
  }
  for (const [key] of prevMap) {
    if (!nextMap.has(key)) toDelete.push(key);
  }
  return { toUpsert, toDelete };
}

function leadsEqual(a, b) {
  const keys = [
    "email",
    "name",
    "designation",
    "company",
    "location",
    "linkedinUrl",
    "phone",
    "notes",
    "role",
    "status",
    "source",
    "sourceFile",
    "updatedAt",
    "generatedAt",
  ];
  for (const k of keys) {
    if ((a[k] || "") !== (b[k] || "")) return false;
  }
  const ca = (a.categories || []).slice().sort().join(",");
  const cb = (b.categories || []).slice().sort().join(",");
  return ca === cb;
}

export { isCloudConfigured };
