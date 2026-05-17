import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import { buildWorkflow } from "./lib/workflow.js";
import {
  loadLeads,
  saveLeads,
  clearAllLeads,
  loadProfiles,
  saveProfiles,
  loadCurrentOwner,
  saveCurrentOwner,
} from "./lib/storage.js";
import { exportLeadsToExcel } from "./lib/excel.js";
import {
  normalizeLead,
  leadFromLinkedInItem,
  mergeLeads,
  uniqueValues,
  filterLeads,
  STATUS_LIST,
  STATUS_COLORS,
} from "./lib/leads.js";
import { parseExcelFile, rowsToLeads, FIELD_LABELS } from "./lib/excelImport.js";
import {
  isCloudConfigured,
  fetchAllLeads,
  upsertLeads,
  deleteLeadsByEmail,
  deleteAllLeadsForOwner,
  indexLeads,
  diffLeads,
} from "./lib/cloudSync.js";
import { getPack, listPacks, OWNER_IDS } from "./lib/contentPacks/index.js";

const BATCH_SIZE = 400;

const PROFILE_FIELDS = [
  ["name", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["degree", "Degree"],
  ["college", "College"],
  ["gradYear", "Grad year"],
];

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      year: "2-digit",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function App() {
  const [currentOwner, setCurrentOwner] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [profiles, setProfiles] = useState(null);
  const [allLeads, setAllLeads] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [generated, setGenerated] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [syncStatus, setSyncStatus] = useState(
    isCloudConfigured() ? "idle" : "local-only"
  );
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const lastSyncedMapRef = useRef(new Map());

  useEffect(() => {
    const local = loadLeads();
    const profs = loadProfiles();
    const saved = loadCurrentOwner();
    setAllLeads(local);
    setProfiles(profs);
    setCurrentOwner(saved);
    lastSyncedMapRef.current = indexLeads(local);
    setStorageLoaded(true);

    if (isCloudConfigured()) {
      setSyncStatus("syncing");
      fetchAllLeads()
        .then(async (cloud) => {
          if (cloud == null) return;
          if (cloud.length === 0 && local.length > 0) {
            await upsertLeads(local);
            lastSyncedMapRef.current = indexLeads(local);
          } else {
            setAllLeads(cloud);
            saveLeads(cloud);
            lastSyncedMapRef.current = indexLeads(cloud);
          }
          setSyncStatus("synced");
          setLastSyncedAt(Date.now());
        })
        .catch((e) => {
          console.error("Initial cloud fetch failed:", e);
          setSyncStatus("error");
        });
    }
  }, []);

  useEffect(() => {
    if (storageLoaded && profiles) saveProfiles(profiles);
  }, [profiles, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    saveLeads(allLeads);
    if (!isCloudConfigured()) return;

    const handle = setTimeout(async () => {
      const nextMap = indexLeads(allLeads);
      const { toUpsert, toDelete } = diffLeads(lastSyncedMapRef.current, nextMap);
      if (toUpsert.length === 0 && toDelete.length === 0) return;

      setSyncStatus("syncing");
      try {
        if (toUpsert.length) await upsertLeads(toUpsert);
        if (toDelete.length) {
          const byOwner = new Map();
          for (const k of toDelete) {
            const prev = lastSyncedMapRef.current.get(k);
            const owner = prev?.owner || currentOwner;
            if (!byOwner.has(owner)) byOwner.set(owner, []);
            byOwner.get(owner).push(k);
          }
          for (const [owner, keys] of byOwner) {
            await deleteLeadsByEmail(owner, keys);
          }
        }
        lastSyncedMapRef.current = nextMap;
        setSyncStatus("synced");
        setLastSyncedAt(Date.now());
      } catch (e) {
        console.error("Cloud sync failed:", e);
        setSyncStatus("error");
      }
    }, 800);

    return () => clearTimeout(handle);
  }, [allLeads, storageLoaded, currentOwner]);

  const manualResync = async () => {
    if (!isCloudConfigured()) return;
    setSyncStatus("syncing");
    try {
      const cloud = await fetchAllLeads();
      if (cloud) {
        setAllLeads(cloud);
        saveLeads(cloud);
        lastSyncedMapRef.current = indexLeads(cloud);
      }
      setSyncStatus("synced");
      setLastSyncedAt(Date.now());
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  };

  const handlePickUser = (ownerId) => {
    setCurrentOwner(ownerId);
    saveCurrentOwner(ownerId);
    setSelectedIds(new Set());
    setEditingLead(null);
    setImportPreview(null);
    setGenerated([]);
    setTab("dashboard");
  };

  const leads = useMemo(
    () => allLeads.filter((l) => l.owner === currentOwner),
    [allLeads, currentOwner]
  );

  const pack = currentOwner ? getPack(currentOwner) : null;
  const profile = currentOwner && profiles ? profiles[currentOwner] : null;

  const setProfile = (updater) => {
    setProfiles((prev) => ({
      ...prev,
      [currentOwner]: typeof updater === "function" ? updater(prev[currentOwner]) : updater,
    }));
  };

  const ingestLeads = (incoming, sourceLabel) => {
    const ownLeads = allLeads.filter((l) => l.owner === currentOwner);
    const otherLeads = allLeads.filter((l) => l.owner !== currentOwner);
    const tagged = incoming.map((l) => ({ ...l, owner: currentOwner }));
    const { leads: merged, added, merged: updated, duplicates } = mergeLeads(
      ownLeads,
      tagged,
      currentOwner
    );
    setAllLeads([...otherLeads, ...merged]);
    showToast(
      `${sourceLabel}: ${added} new · ${updated} updated · ${duplicates.length} merged`
    );
  };

  const updateOneLead = (updated) => {
    const norm = normalizeLead({ ...updated, owner: currentOwner }, currentOwner);
    norm.updatedAt = new Date().toISOString();
    setAllLeads((prev) =>
      prev.map((l) =>
        l.owner === currentOwner && l.emailLower === editingLead.emailLower
          ? norm
          : l
      )
    );
  };

  const deleteOneLead = (emailLower) => {
    setAllLeads((prev) =>
      prev.filter((l) => !(l.owner === currentOwner && l.emailLower === emailLower))
    );
  };

  const clearAllForCurrent = () => {
    const otherLeads = allLeads.filter((l) => l.owner !== currentOwner);
    setAllLeads(otherLeads);
    if (isCloudConfigured()) {
      deleteAllLeadsForOwner(currentOwner).catch((e) => console.error(e));
    }
  };

  if (!storageLoaded || !profiles) {
    return <div className="app"><div className="loading-screen">Loading…</div></div>;
  }

  if (!currentOwner) {
    return <SplashScreen onPick={handlePickUser} />;
  }

  return (
    <div className="app" data-owner={currentOwner}>
      {toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} />}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            confirm.onConfirm();
            setConfirm(null);
          }}
        />
      )}
      {editingLead && (
        <LeadDrawer
          lead={editingLead}
          pack={pack}
          onClose={() => setEditingLead(null)}
          onSave={(updated) => {
            updateOneLead(updated);
            setEditingLead(null);
            showToast("Lead updated");
          }}
          onDelete={() => {
            deleteOneLead(editingLead.emailLower);
            setEditingLead(null);
            showToast("Lead deleted");
          }}
        />
      )}

      <Header
        leads={leads}
        pack={pack}
        currentOwner={currentOwner}
        onSwitch={handlePickUser}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onResync={manualResync}
      />

      <nav className="tabs">
        {[
          ["dashboard", "Dashboard"],
          ["leads", `Leads · ${leads.length}`],
          ["import", "Import"],
          ["generate", "Generate"],
          ["profile", "Profile"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "tab active" : "tab"}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === "dashboard" && (
          <DashboardTab leads={leads} pack={pack} onJump={(t) => setTab(t)} />
        )}
        {tab === "leads" && (
          <LeadsTab
            leads={leads}
            pack={pack}
            allLeads={allLeads}
            setAllLeads={setAllLeads}
            currentOwner={currentOwner}
            onEdit={setEditingLead}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onClearAll={() =>
              setConfirm({
                title: `Delete all of ${pack.shortName}'s leads?`,
                message: `This permanently removes all ${leads.length} leads for ${pack.displayName}. Cannot be undone.`,
                onConfirm: () => {
                  clearAllForCurrent();
                  setSelectedIds(new Set());
                  showToast(`Cleared all leads for ${pack.shortName}`);
                },
              })
            }
          />
        )}
        {tab === "import" && (
          <ImportTab
            leads={leads}
            pack={pack}
            currentOwner={currentOwner}
            ingestLeads={ingestLeads}
            importPreview={importPreview}
            setImportPreview={setImportPreview}
            showToast={showToast}
          />
        )}
        {tab === "generate" && (
          <GenerateTab
            leads={leads}
            allLeads={allLeads}
            setAllLeads={setAllLeads}
            pack={pack}
            currentOwner={currentOwner}
            profile={profile}
            generated={generated}
            setGenerated={setGenerated}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            showToast={showToast}
          />
        )}
        {tab === "profile" && (
          <ProfileTab profile={profile} pack={pack} setProfile={setProfile} />
        )}
      </div>
    </div>
  );
}

function SplashScreen({ onPick }) {
  const packs = listPacks();
  return (
    <div className="splash">
      <div className="splash-content">
        <h1 className="splash-title">Who's applying today?</h1>
        <p className="splash-subtitle">Each user has separate leads, profile, and email templates.</p>
        <div className="splash-cards">
          {packs.map((p) => (
            <button
              key={p.id}
              className="splash-card"
              style={{ "--accent": p.color }}
              onClick={() => onPick(p.id)}
            >
              <div className="splash-emoji">{p.emoji}</div>
              <div className="splash-card-name">{p.displayName}</div>
              <div className="splash-card-tagline">{p.tagline}</div>
              <div className="splash-card-cta">Enter →</div>
            </button>
          ))}
        </div>
        <p className="splash-footer muted small">
          You can switch users anytime from the header.
        </p>
      </div>
    </div>
  );
}

function Header({ leads, pack, currentOwner, onSwitch, syncStatus, lastSyncedAt, onResync }) {
  return (
    <header className="hero" style={{ "--hero-accent": pack.color }}>
      <div className="hero-bg" />
      <div className="hero-content">
        <div>
          <div className="hero-eyebrow">
            <span className="hero-emoji">{pack.emoji}</span>
            <span>{pack.displayName}</span>
          </div>
          <h1 className="title">Lead Manager</h1>
          <p className="subtitle">{pack.tagline}</p>
          <SyncBadge status={syncStatus} lastSyncedAt={lastSyncedAt} onResync={onResync} />
        </div>
        <div className="hero-right">
          <div className="user-switch">
            {OWNER_IDS.map((id) => {
              const p = getPack(id);
              return (
                <button
                  key={id}
                  className={`user-pill ${id === currentOwner ? "active" : ""}`}
                  onClick={() => id !== currentOwner && onSwitch(id)}
                  title={`Switch to ${p.displayName}`}
                >
                  <span className="user-pill-emoji">{p.emoji}</span>
                  <span>{p.shortName}</span>
                </button>
              );
            })}
          </div>
          <div className="hero-stats">
            <HeroStat label="Total" value={leads.length} />
            <HeroStat label="Queued" value={leads.filter((l) => l.generatedAt).length} accent />
          </div>
        </div>
      </div>
    </header>
  );
}

function SyncBadge({ status, lastSyncedAt, onResync }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!lastSyncedAt) return;
    const t = setInterval(() => force((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [lastSyncedAt]);

  const ago = lastSyncedAt ? timeAgo(lastSyncedAt) : null;
  const labels = {
    "local-only": "Local only — set up cloud sync",
    idle: "Connecting…",
    syncing: "Syncing…",
    synced: ago ? `Synced ${ago}` : "Synced",
    error: "Sync error — click to retry",
  };
  const classes = {
    "local-only": "warning",
    syncing: "syncing",
    synced: "ok",
    error: "error",
  };
  return (
    <button
      className={`sync-badge ${classes[status] || ""}`}
      onClick={status === "error" ? onResync : undefined}
      disabled={status !== "error"}
    >
      <span className={`sync-dot ${status}`} />
      {labels[status] || status}
    </button>
  );
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function HeroStat({ label, value, accent }) {
  return (
    <div className={`hero-stat ${accent ? "accent" : ""}`}>
      <div className="hero-stat-value">{value}</div>
      <div className="hero-stat-label">{label}</div>
    </div>
  );
}

function DashboardTab({ leads, pack, onJump }) {
  const byDesignation = useMemo(() => buildBreakdown(leads, "designation"), [leads]);
  const byCompany = useMemo(() => buildBreakdown(leads, "company"), [leads]);
  const byLocation = useMemo(() => buildBreakdown(leads, "location"), [leads]);
  const byCategory = useMemo(() => buildArrayBreakdown(leads, "categories"), [leads]);
  const byStatus = useMemo(() => buildBreakdown(leads, "status"), [leads]);

  if (leads.length === 0) {
    return (
      <section className="card empty fade-in">
        <h2>Welcome, {pack.shortName}!</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          No leads yet. Import from Excel or LinkedIn JSON to get started.
        </p>
        <button className="primary big" onClick={() => onJump("import")}>
          Go to Import →
        </button>
      </section>
    );
  }

  return (
    <div className="dashboard fade-in">
      <div className="grid-2">
        <BreakdownCard title="By Designation" data={byDesignation} accent={pack.color} />
        <BreakdownCard title="By Company" data={byCompany} accent={pack.color} />
      </div>
      <div className="grid-2">
        <BreakdownCard title="By Location" data={byLocation} accent={pack.color} />
        <BreakdownCard title="By Status" data={byStatus} accent={pack.color} colors={STATUS_COLORS} />
      </div>
      <BreakdownCard title="By Category" data={byCategory} accent={pack.color} colors={pack.categoryColors} />

      <section className="card slide-up">
        <h3 className="card-title">Recent leads</h3>
        <div className="recent-grid">
          {leads
            .slice()
            .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
            .slice(0, 6)
            .map((l) => (
              <div key={l.emailLower} className="recent-card">
                <div className="recent-name">{l.name || l.email.split("@")[0]}</div>
                <div className="recent-meta">
                  {l.designation || "—"} {l.company && `· ${l.company}`}
                </div>
                <div className="recent-email mono small muted">{l.email}</div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function buildBreakdown(leads, key) {
  const counts = {};
  for (const l of leads) {
    const v = (l[key] || "").trim() || "—";
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function buildArrayBreakdown(leads, key) {
  const counts = {};
  for (const l of leads) {
    const arr = l[key] || [];
    if (!arr.length) counts["—"] = (counts["—"] || 0) + 1;
    for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function BreakdownCard({ title, data, accent, colors }) {
  const max = Math.max(1, ...data.map(([, c]) => c));
  return (
    <section className="card slide-up">
      <h3 className="card-title">{title}</h3>
      {data.length === 0 ? (
        <p className="muted small">No data</p>
      ) : (
        <div className="bar-list">
          {data.map(([label, count]) => (
            <div className="bar-row" key={label}>
              <div className="bar-label" title={label}>{label}</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${(count / max) * 100}%`, background: colors?.[label] || accent }}
                />
              </div>
              <div className="bar-count">{count}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LeadsTab({ leads, pack, allLeads, setAllLeads, currentOwner, onEdit, selectedIds, setSelectedIds, onClearAll }) {
  const [filters, setFilters] = useState({
    search: "",
    designation: "all",
    company: "all",
    location: "all",
    category: "all",
    status: "all",
    source: "all",
  });
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const designations = useMemo(() => uniqueValues(leads, "designation"), [leads]);
  const companies = useMemo(() => uniqueValues(leads, "company"), [leads]);
  const locations = useMemo(() => uniqueValues(leads, "location"), [leads]);

  const filtered = useMemo(() => filterLeads(leads, filters), [leads, filters]);
  useEffect(() => setPage(0), [filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((l) => selectedIds.has(l.emailLower));

  const toggleAllOnPage = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) for (const l of pageRows) next.delete(l.emailLower);
    else for (const l of pageRows) next.add(l.emailLower);
    setSelectedIds(next);
  };

  const toggleOne = useCallback(
    (emailLower) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(emailLower)) next.delete(emailLower);
        else next.add(emailLower);
        return next;
      });
    },
    [setSelectedIds]
  );

  const updateStatusForSelected = (status) => {
    if (selectedIds.size === 0) return;
    const now = new Date().toISOString();
    setAllLeads((prev) =>
      prev.map((l) =>
        l.owner === currentOwner && selectedIds.has(l.emailLower)
          ? { ...l, status, updatedAt: now }
          : l
      )
    );
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    setAllLeads((prev) =>
      prev.filter((l) => !(l.owner === currentOwner && selectedIds.has(l.emailLower)))
    );
    setSelectedIds(new Set());
  };

  const downloadFiltered = () => exportLeadsToExcel(filtered, `${currentOwner}_leads_filtered_${new Date().toISOString().slice(0, 10)}.xlsx`);
  const downloadAll = () => exportLeadsToExcel(leads, `${currentOwner}_leads_${new Date().toISOString().slice(0, 10)}.xlsx`);

  const resetFilters = () =>
    setFilters({
      search: "", designation: "all", company: "all", location: "all",
      category: "all", status: "all", source: "all",
    });

  return (
    <div className="fade-in">
      <section className="card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="🔍  Search email, name, role, company, notes…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="search-input"
          />
          <div className="filter-row">
            <FilterSelect label="Designation" value={filters.designation} options={designations}
              onChange={(v) => setFilters({ ...filters, designation: v })} />
            <FilterSelect label="Company" value={filters.company} options={companies}
              onChange={(v) => setFilters({ ...filters, company: v })} />
            <FilterSelect label="Location" value={filters.location} options={locations}
              onChange={(v) => setFilters({ ...filters, location: v })} />
            <FilterSelect label="Category" value={filters.category} options={pack.categories}
              onChange={(v) => setFilters({ ...filters, category: v })} />
            <FilterSelect label="Status" value={filters.status} options={STATUS_LIST}
              onChange={(v) => setFilters({ ...filters, status: v })} />
            <FilterSelect label="Source" value={filters.source} options={["excel", "linkedin", "manual", "legacy"]}
              onChange={(v) => setFilters({ ...filters, source: v })} />
            {Object.values(filters).some((v) => v && v !== "all") && (
              <button className="link" onClick={resetFilters}>Reset</button>
            )}
          </div>
        </div>

        <div className="row-between" style={{ marginTop: 14 }}>
          <div className="muted small">
            Showing <strong>{filtered.length}</strong> of {leads.length}
            {selectedIds.size > 0 && (
              <span className="selection-badge"> · {selectedIds.size} selected</span>
            )}
          </div>
          <div className="action-cluster">
            {selectedIds.size > 0 && (
              <>
                <select className="select" defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      updateStatusForSelected(e.target.value);
                      e.target.value = "";
                    }
                  }}>
                  <option value="" disabled>Set status…</option>
                  {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="danger" onClick={deleteSelected}>Delete {selectedIds.size}</button>
              </>
            )}
            <button className="primary" onClick={downloadFiltered} disabled={filtered.length === 0}>
              Download {filtered.length === leads.length ? "all" : "filtered"} (.xlsx)
            </button>
            {filtered.length !== leads.length && leads.length > 0 && (
              <button onClick={downloadAll}>Download all</button>
            )}
            {leads.length > 0 && (
              <button className="danger" onClick={onClearAll}>Clear all</button>
            )}
          </div>
        </div>
      </section>

      {leads.length === 0 ? (
        <section className="card empty">
          <p className="muted">No leads yet. Import on the Import tab.</p>
        </section>
      ) : (
        <section className="card">
          <div className="leads-table-wrap">
            <table className="leads-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
                  </th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Categories</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l) => (
                  <LeadRow
                    key={l.emailLower}
                    lead={l}
                    pack={pack}
                    selected={selectedIds.has(l.emailLower)}
                    onToggle={toggleOne}
                    onEdit={onEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pager">
              <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Prev</button>
              <span className="muted small">Page {safePage + 1} of {totalPages}</span>
              <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>Next →</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} title={label}>
      <option value="all">{label}: all</option>
      {options.map((o) => <option key={o} value={o}>{label}: {o}</option>)}
    </select>
  );
}

const LeadRow = memo(function LeadRow({ lead, pack, selected, onToggle, onEdit }) {
  const l = lead;
  return (
    <tr className="lead-row">
      <td>
        <input type="checkbox" checked={selected} onChange={() => onToggle(l.emailLower)} />
      </td>
      <td className="mono small">{l.email}</td>
      <td className="small">{l.name || "—"}</td>
      <td className="small">{l.designation || "—"}</td>
      <td className="small">{l.company || "—"}</td>
      <td className="small">{l.location || "—"}</td>
      <td>
        <span className="status-chip" style={{ background: STATUS_COLORS[l.status] || "#888" }}>
          {l.status}
        </span>
      </td>
      <td>
        <div className="cat-row tight">
          {(l.categories || []).slice(0, 3).map((c) => (
            <span key={c} className="cat-chip tight"
              style={{ background: pack.categoryColors[c] || "#888" }}>
              {c}
            </span>
          ))}
          {(l.categories || []).length > 3 && (
            <span className="muted small">+{l.categories.length - 3}</span>
          )}
        </div>
      </td>
      <td className="muted small">{fmtDate(l.addedAt)}</td>
      <td>
        <button className="link" onClick={() => onEdit(l)}>Edit</button>
      </td>
    </tr>
  );
});

function ImportTab({ leads, pack, currentOwner, ingestLeads, importPreview, setImportPreview, showToast }) {
  const [dragging, setDragging] = useState(false);
  const jsonRef = useRef();
  const excelRef = useRef();

  const handleFiles = useCallback(
    async (files) => {
      const excelFiles = files.filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
      const jsonFiles = files.filter((f) => /\.json$/i.test(f.name));

      if (excelFiles.length) {
        try {
          const parsed = await parseExcelFile(excelFiles[0]);
          setImportPreview({ kind: "excel", parsed, file: excelFiles[0] });
          showToast(`Parsed ${excelFiles[0].name} — confirm to import for ${pack.shortName}`);
        } catch (e) {
          console.error(e);
          showToast(`Failed to parse ${excelFiles[0].name}`, "error");
        }
      }

      if (jsonFiles.length) {
        const incoming = [];
        for (const f of jsonFiles) {
          try {
            const text = await f.text();
            const data = JSON.parse(text);
            if (!Array.isArray(data)) {
              showToast(`${f.name}: not a JSON array — skipped`, "error");
              continue;
            }
            for (const item of data) {
              for (const email of item.emails || []) {
                const lead = leadFromLinkedInItem(
                  { email, rawName: item.name, postText: item.post_text },
                  f.name,
                  currentOwner
                );
                if (lead) incoming.push(lead);
              }
            }
          } catch {
            showToast(`Failed to parse ${f.name}`, "error");
          }
        }
        if (incoming.length) {
          ingestLeads(incoming, "LinkedIn JSON");
        }
      }
    },
    [ingestLeads, setImportPreview, showToast, pack, currentOwner]
  );

  const confirmExcelImport = () => {
    if (!importPreview || importPreview.kind !== "excel") return;
    const allLeads = [];
    for (const sheet of importPreview.parsed.sheets) {
      const { leads: parsed } = rowsToLeads(sheet, importPreview.parsed.fileName);
      allLeads.push(...parsed.map((l) => ({ ...l, owner: currentOwner })));
    }
    ingestLeads(allLeads, "Excel import");
    setImportPreview(null);
  };

  return (
    <div className="fade-in">
      <section className="card import-banner">
        <div>
          <strong>Importing for {pack.displayName}</strong>{" "}
          <span className="muted small">— all leads will be tagged owner=<code>{currentOwner}</code></span>
        </div>
      </section>
      <div className="grid-2">
        <section
          className={`dropzone-card ${dragging ? "dragging" : ""}`}
          onClick={() => excelRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles([...e.dataTransfer.files]); }}
        >
          <div className="dropzone-icon">📊</div>
          <h3>Import Excel</h3>
          <p className="muted small">
            Drop your spreadsheet — columns auto-detected (email, name, designation, company, location, etc.)
          </p>
          <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" multiple style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) handleFiles([...e.target.files]);
              e.target.value = "";
            }} />
        </section>

        <section className="dropzone-card"
          onClick={() => jsonRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles([...e.dataTransfer.files]); }}
        >
          <div className="dropzone-icon">🔗</div>
          <h3>Import LinkedIn JSON</h3>
          <p className="muted small">
            Drop LinkedIn email JSON exports — recruiter, role, and categories auto-extracted
          </p>
          <input ref={jsonRef} type="file" accept=".json" multiple style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) handleFiles([...e.target.files]);
              e.target.value = "";
            }} />
        </section>
      </div>

      {importPreview && importPreview.kind === "excel" && (
        <section className="card slide-up">
          <div className="row-between">
            <h3 className="card-title">Excel preview: {importPreview.parsed.fileName}</h3>
            <div className="action-cluster">
              <button onClick={() => setImportPreview(null)}>Cancel</button>
              <button className="primary" onClick={confirmExcelImport}>
                Import all sheets for {pack.shortName}
              </button>
            </div>
          </div>

          {importPreview.parsed.sheets.map((sheet, idx) => (
            <SheetPreview
              key={idx}
              sheet={sheet}
              onMappingChange={(newMapping) => {
                const updated = { ...importPreview };
                updated.parsed.sheets[idx].mapping = newMapping;
                setImportPreview(updated);
              }}
            />
          ))}
        </section>
      )}

      <section className="card slide-up">
        <h3 className="card-title">Summary for {pack.shortName}</h3>
        <div className="summary-grid">
          <div className="summary-tile">
            <div className="summary-tile-value">{leads.length}</div>
            <div className="summary-tile-label">Total leads in {pack.shortName}'s database</div>
          </div>
          <div className="summary-tile">
            <div className="summary-tile-value">{leads.filter((l) => l.source === "excel").length}</div>
            <div className="summary-tile-label">From Excel imports</div>
          </div>
          <div className="summary-tile">
            <div className="summary-tile-value">{leads.filter((l) => l.source === "linkedin").length}</div>
            <div className="summary-tile-label">From LinkedIn imports</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SheetPreview({ sheet, onMappingChange }) {
  const { sheet: sheetName, headers, dataRows, mapping } = sheet;
  return (
    <div className="sheet-preview">
      <div className="sheet-head">
        <strong>{sheetName}</strong>{" "}
        <span className="muted small">· {dataRows.length} rows · {headers.length} columns</span>
      </div>
      <div className="mapping-grid">
        {Object.entries(FIELD_LABELS).map(([field, label]) => (
          <div key={field} className="mapping-row">
            <label className="field-label">{label}</label>
            <select className="select" value={mapping[field] == null ? "" : mapping[field]}
              onChange={(e) => {
                const next = { ...mapping };
                if (e.target.value === "") delete next[field];
                else next[field] = Number(e.target.value);
                onMappingChange(next);
              }}>
              <option value="">— not mapped —</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>{h || `(Column ${i + 1})`}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        Sample (first 3 rows):{" "}
        {dataRows.slice(0, 3).map((r, i) => (
          <span key={i} className="sample-row">
            {(r || []).slice(0, 5).join(" | ")}{i < 2 && " ·· "}
          </span>
        ))}
      </div>
    </div>
  );
}

function GenerateTab({ leads, allLeads, setAllLeads, pack, currentOwner, profile, generated, setGenerated, selectedIds, showToast }) {
  const [mode, setMode] = useState("selected");
  const [statusFilter, setStatusFilter] = useState("new");
  const [generating, setGenerating] = useState(false);

  const sourceLeads = useMemo(() => {
    if (mode === "all") return leads;
    if (mode === "selected") return leads.filter((l) => selectedIds.has(l.emailLower));
    if (mode === "status") return leads.filter((l) => l.status === statusFilter);
    return [];
  }, [leads, mode, statusFilter, selectedIds]);

  const generate = () => {
    if (!sourceLeads.length) {
      showToast("No leads to generate from", "error");
      return;
    }
    if (!profile.resumeLink || !profile.email) {
      showToast("Set resume link + email in Profile tab first", "error");
      return;
    }
    setGenerating(true);
    const batches = [];
    for (let i = 0; i < sourceLeads.length; i += BATCH_SIZE) {
      batches.push(sourceLeads.slice(i, i + BATCH_SIZE));
    }
    const wfs = batches.map((batch, idx) => ({
      name: batches.length > 1 ? `Batch ${idx + 1} of ${batches.length}` : "Workflow",
      count: batch.length,
      blob: new Blob(
        [JSON.stringify(buildWorkflow(profile, batch, idx + 1, batches.length, currentOwner), null, 2)],
        { type: "application/json" }
      ),
      filename: batches.length > 1
        ? `${currentOwner}_batch${idx + 1}_${new Date().toISOString().slice(0, 10)}.json`
        : `${currentOwner}_mailer_${new Date().toISOString().slice(0, 10)}.json`,
    }));
    setGenerated(wfs);

    const now = new Date().toISOString();
    const targetSet = new Set(sourceLeads.map((l) => l.emailLower));
    setAllLeads((prev) =>
      prev.map((l) =>
        l.owner === currentOwner && targetSet.has(l.emailLower)
          ? { ...l, status: "queued", generatedAt: now, updatedAt: now }
          : l
      )
    );
    setGenerating(false);
    showToast(
      `${wfs.length} workflow${wfs.length > 1 ? "s" : ""} ready · ${sourceLeads.length} leads marked queued`
    );
  };

  const downloadOne = (wf) => {
    const url = URL.createObjectURL(wf.blob);
    const a = document.createElement("a");
    a.href = url; a.download = wf.filename; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadAll = () => generated.forEach((wf, i) => setTimeout(() => downloadOne(wf), i * 150));

  return (
    <div className="fade-in">
      <section className="card">
        <h3 className="card-title">Generate workflow for {pack.shortName}</h3>
        <p className="muted small">Subject lines and email bodies use {pack.shortName}'s content pack.</p>
        <div className="radio-row">
          <label>
            <input type="radio" checked={mode === "selected"} onChange={() => setMode("selected")} />
            Selected ({selectedIds.size})
          </label>
          <label>
            <input type="radio" checked={mode === "status"} onChange={() => setMode("status")} />
            By status
          </label>
          <label>
            <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
            All ({leads.length})
          </label>
        </div>

        {mode === "status" && (
          <div style={{ marginBottom: 12 }}>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_LIST.map((s) => (
                <option key={s} value={s}>
                  {s} ({leads.filter((l) => l.status === s).length})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="row-between">
          <div className="muted small">
            <strong>{sourceLeads.length}</strong> leads selected for generation
            {sourceLeads.length > BATCH_SIZE && ` · ${Math.ceil(sourceLeads.length / BATCH_SIZE)} batches`}
          </div>
          <button className="primary big" disabled={generating || sourceLeads.length === 0} onClick={generate}>
            {generating ? "Generating…" : `Generate workflow (${sourceLeads.length})`}
          </button>
        </div>
      </section>

      {generated.length > 0 && (
        <section className="card slide-up">
          <div className="row-between">
            <h3 className="card-title">Ready to import into n8n</h3>
            {generated.length > 1 && <button onClick={downloadAll}>Download all</button>}
          </div>
          <div className="generated-list">
            {generated.map((wf, i) => (
              <div key={i} className="generated-item">
                <div>
                  <div className="generated-name">{wf.name}</div>
                  <div className="generated-meta">{wf.count} emails · {wf.filename}</div>
                </div>
                <button className="primary" onClick={() => downloadOne(wf)}>Download</button>
              </div>
            ))}
          </div>
          <p className="footer-note">
            Targeted leads marked <strong>queued</strong>. Update to <strong>sent</strong> after n8n fires.
          </p>
        </section>
      )}
    </div>
  );
}

function ProfileTab({ profile, pack, setProfile }) {
  const pf = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  return (
    <section className="card fade-in">
      <h2 className="card-title">{pack.displayName}'s profile</h2>
      <p className="muted small">
        Used to build the email body. Auto-saved to this browser. Each user has their own profile.
      </p>
      <div className="radio-row">
        {["fresher", "experienced"].map((t) => (
          <label key={t}>
            <input type="radio" name="jobType" checked={profile.jobType === t} onChange={() => pf("jobType", t)} />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </label>
        ))}
      </div>
      <div className="profile-grid">
        {PROFILE_FIELDS.map(([k, label]) => (
          <div key={k}>
            <label className="field-label">{label}</label>
            <input type="text" value={profile[k] || ""} onChange={(e) => pf(k, e.target.value)} style={{ width: "100%" }} />
          </div>
        ))}
        {profile.jobType === "experienced" && (
          <div>
            <label className="field-label">Experience (years, e.g. 2)</label>
            <input type="text" value={profile.experience || ""} onChange={(e) => pf("experience", e.target.value)} style={{ width: "100%" }} />
          </div>
        )}
      </div>
      <div className="field-full">
        <label className="field-label">LinkedIn URL</label>
        <input type="url" value={profile.linkedin || ""} onChange={(e) => pf("linkedin", e.target.value)} style={{ width: "100%" }} />
      </div>
      <div className="field-full">
        <label className="field-label">Resume link (Google Drive)</label>
        <input type="url" value={profile.resumeLink || ""} onChange={(e) => pf("resumeLink", e.target.value)} style={{ width: "100%" }}
          placeholder="https://drive.google.com/file/d/.../view" />
        {!profile.resumeLink && (
          <p className="muted small" style={{ marginTop: 4 }}>
            ⚠ Required before generating workflows
          </p>
        )}
      </div>
    </section>
  );
}

function LeadDrawer({ lead, pack, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({ ...lead });
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Edit lead</h3>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          <Field label="Email" value={draft.email} onChange={(v) => setField("email", v)} />
          <Field label="Name" value={draft.name} onChange={(v) => setField("name", v)} />
          <Field label="Designation" value={draft.designation} onChange={(v) => setField("designation", v)} />
          <Field label="Company" value={draft.company} onChange={(v) => setField("company", v)} />
          <Field label="Location" value={draft.location} onChange={(v) => setField("location", v)} />
          <Field label="LinkedIn URL" value={draft.linkedinUrl} onChange={(v) => setField("linkedinUrl", v)} />
          <Field label="Phone" value={draft.phone} onChange={(v) => setField("phone", v)} />
          <Field label="Hiring role" value={draft.role} onChange={(v) => setField("role", v)} />
          <div>
            <label className="field-label">Status</label>
            <select className="select" value={draft.status} onChange={(e) => setField("status", e.target.value)} style={{ width: "100%" }}>
              {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Categories</label>
            <div className="cat-row">
              {pack.categories.map((c) => {
                const on = (draft.categories || []).includes(c);
                return (
                  <button key={c} type="button" className={`cat-toggle ${on ? "active" : ""}`}
                    style={on ? { background: pack.categoryColors[c], borderColor: pack.categoryColors[c] } : undefined}
                    onClick={() => setField("categories",
                      on ? draft.categories.filter((x) => x !== c) : [...(draft.categories || []), c]
                    )}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="field-full">
            <label className="field-label">Notes</label>
            <textarea value={draft.notes || ""} onChange={(e) => setField("notes", e.target.value)} rows={3} style={{ width: "100%", resize: "vertical" }} />
          </div>
        </div>
        <div className="drawer-foot">
          <button className="danger" onClick={onDelete}>Delete lead</button>
          <div className="action-cluster">
            <button onClick={onClose}>Cancel</button>
            <button className="primary" onClick={() => onSave(draft)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }} />
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="danger filled" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, type }) {
  return <div className={`toast ${type}`}>{msg}</div>;
}
