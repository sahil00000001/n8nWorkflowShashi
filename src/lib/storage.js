import { migrateV2HistoryToLeads, normalizeLead } from "./leads.js";
import { getPack, DEFAULT_OWNER, OWNER_IDS } from "./contentPacks/index.js";

const LEADS_KEY = "lead_manager_leads_v4";
const LEADS_KEY_V3 = "job_mailer_leads_v3";
const HISTORY_KEY_V2 = "job_mailer_history_v2";
const LEGACY_KEY_V1 = "job_mailer_sent_emails";
const PROFILES_KEY = "lead_manager_profiles_v2";
const PROFILE_KEY_V1 = "job_mailer_profile_v1";
const CURRENT_OWNER_KEY = "lead_manager_current_owner";

export function loadLeads() {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((l) => normalizeLead(l));
    }
    const v3 = localStorage.getItem(LEADS_KEY_V3);
    if (v3) {
      const parsed = JSON.parse(v3);
      if (Array.isArray(parsed)) {
        const migrated = parsed.map((l) => normalizeLead({ ...l, owner: l.owner || "shashi" }));
        localStorage.setItem(LEADS_KEY, JSON.stringify(migrated));
        return migrated;
      }
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
    localStorage.removeItem(LEADS_KEY_V3);
    localStorage.removeItem(HISTORY_KEY_V2);
    localStorage.removeItem(LEGACY_KEY_V1);
  } catch {}
}

export function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const out = {};
        for (const id of OWNER_IDS) {
          out[id] = { ...getPack(id).defaultProfile, ...(parsed[id] || {}) };
        }
        return out;
      }
    }
    const v1 = localStorage.getItem(PROFILE_KEY_V1);
    if (v1) {
      const oldProfile = JSON.parse(v1);
      const migrated = {};
      for (const id of OWNER_IDS) {
        migrated[id] = { ...getPack(id).defaultProfile };
      }
      migrated.shashi = { ...migrated.shashi, ...oldProfile };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (e) {
    console.error("loadProfiles failed:", e);
  }
  const fresh = {};
  for (const id of OWNER_IDS) fresh[id] = { ...getPack(id).defaultProfile };
  return fresh;
}

export function saveProfiles(profiles) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {}
}

export function loadCurrentOwner() {
  try {
    const v = localStorage.getItem(CURRENT_OWNER_KEY);
    if (v && OWNER_IDS.includes(v)) return v;
  } catch {}
  return null;
}

export function saveCurrentOwner(ownerId) {
  try {
    localStorage.setItem(CURRENT_OWNER_KEY, ownerId);
  } catch {}
}

export function buildEmailIndex(leads) {
  const idx = new Map();
  for (const l of leads) {
    if (l && l.emailLower) idx.set(l.emailLower, l);
  }
  return idx;
}
