const HISTORY_KEY = "job_mailer_history_v2";
const LEGACY_KEY = "job_mailer_sent_emails";
const PROFILE_KEY = "job_mailer_profile_v1";

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const emails = JSON.parse(legacy);
      if (Array.isArray(emails)) {
        const migrated = emails.map((e) => ({
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
        localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {}
  return [];
}

export function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error("Failed to save history:", e);
    return false;
  }
}

export function clearAllHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LEGACY_KEY);
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

export function buildEmailIndex(history) {
  const idx = new Map();
  for (const h of history) {
    if (h && h.emailLower) idx.set(h.emailLower, h);
  }
  return idx;
}
