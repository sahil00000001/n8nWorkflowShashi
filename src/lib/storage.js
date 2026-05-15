import { migrateV2HistoryToLeads, normalizeLead } from "./leads.js";

const LEADS_KEY = "job_mailer_leads_v3";
const HISTORY_KEY_V2 = "job_mailer_history_v2";
const LEGACY_KEY_V1 = "job_mailer_sent_emails";
const PROFILE_KEY = "job_mailer_profile_v1";

export function loadLeads() {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeLead);
    }
    const v2 = localStorage.getItem(HISTORY_KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2);
      if (Array.isArray(parsed)) {
        const migrated = migrateV2HistoryToLeads(parsed);
        localStorage.setItem(LEADS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    const v1 = localStorage.getItem(LEGACY_KEY_V1);
    if (v1) {
      const emails = JSON.parse(v1);
      if (Array.isArray(emails)) {
        const v2Shape = emails.map((e) => ({
          email: e,
          emailLower: String(e).toLowerCase(),
          recruiter: "",
          role: "",
          categories: [],
          addedAt: null,
          generatedAt: null,
          sourceFile: null,
          legacy: true,
        }));
        const migrated = migrateV2HistoryToLeads(v2Shape);
        localStorage.setItem(LEADS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.error("loadLeads failed:", e);
  }
  return [];
}

export function saveLeads(leads) {
  try {
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
    return true;
  } catch (e) {
    console.error("saveLeads failed:", e);
    return false;
  }
}

export function clearAllLeads() {
  try {
    localStorage.removeItem(LEADS_KEY);
    localStorage.removeItem(HISTORY_KEY_V2);
    localStorage.removeItem(LEGACY_KEY_V1);
  } catch {}
}

export function loadProfile(defaults) {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch {}
  return defaults;
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

export function buildEmailIndex(leads) {
  const idx = new Map();
  for (const l of leads) {
    if (l && l.emailLower) idx.set(l.emailLower, l);
  }
  return idx;
}

export const loadHistory = loadLeads;
export const saveHistory = saveLeads;
export const clearAllHistory = clearAllLeads;
