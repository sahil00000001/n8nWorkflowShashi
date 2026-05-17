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
  const [tab, setTab] = useState("import");
  const [profiles, setProfiles] = useState(null);
  const [allLeads, setAllLeads] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
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
    setTab("import");
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
    const { leads: merged, added, addedLeads, merged: updated, duplicates } = mergeLeads(
      ownLeads,
      tagged,
      currentOwner
    );
    setAllLeads([...otherLeads, ...merged]);
    showToast(
      `${sourceLabel}: ${added} new · ${updated} updated · ${duplicates.length} merged`
    );
    return { added, addedLeads, updated, duplicatesCount: duplicates.length };
  };

  const markLeadsSent = (emailLowers) => {
    if (!emailLowers.length) return;
    const targetSet = new Set(emailLowers);
    const now = new Date().toISOString();
    setAllLeads((prev) =>
      prev.map((l) =>
        l.owner === currentOwner && targetSet.has(l.emailLower)
          ? { ...l, status: "sent", generatedAt: l.generatedAt || now, updatedAt: now }
          : l
      )
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
          ["import", "Import"],
          ["leads", `Leads · ${leads.length}`],
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
        {tab === "import" && (
          <ImportTab
            leads={leads}
            pack={pack}
            currentOwner={currentOwner}
            profile={profile}
            ingestLeads={ingestLeads}
            markLeadsSent={markLeadsSent}
            importPreview={importPreview}
            setImportPreview={setImportPreview}
            showToast={showToast}
          />
        )}
        {tab === "leads" && (
          <LeadsTab
            leads={leads}
            pack={pack}
            allLeads={allLeads}
            setAllLeads={setAllLeads}
            currentOwner={currentOwner}
            profile={profile}
            onEdit={setEditingLead}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            markLeadsSent={markLeadsSent}
            showToast={showToast}
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


function LeadsTab({ leads, pack, allLeads, setAllLeads, currentOwner, profile, onEdit, selectedIds, setSelectedIds, markLeadsSent, showToast, onClearAll }) {
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

  const generateWorkflowFor = (sourceLeads) => {
    if (!sourceLeads.length) return;
    if (!profile.resumeLink || !profile.email) {
      showToast("Set resume link + email in Profile tab first", "error");
      return;
    }
    const batches = [];
    for (let i = 0; i < sourceLeads.length; i += BATCH_SIZE) {
      batches.push(sourceLeads.slice(i, i + BATCH_SIZE));
    }
    batches.forEach((batch, idx) => {
      const wf = buildWorkflow(profile, batch, idx + 1, batches.length, currentOwner);
      const blob = new Blob([JSON.stringify(wf, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = batches.length > 1
        ? `${currentOwner}_batch${idx + 1}_${new Date().toISOString().slice(0, 10)}.json`
        : `${currentOwner}_mailer_${new Date().toISOString().slice(0, 10)}.json`;
      setTimeout(() => {
        a.click();
        URL.revokeObjectURL(url);
      }, idx * 200);
    });
    markLeadsSent(sourceLeads.map((l) => l.emailLower));
    showToast(
      `${batches.length > 1 ? `${batches.length} workflows` : "Workflow"} downloaded · ${sourceLeads.length} leads marked sent`
    );
  };

  const generateForSelected = () => generateWorkflowFor(filtered.filter((l) => selectedIds.has(l.emailLower)));
  const generateForAll = () => generateWorkflowFor(filtered);

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
            {selectedIds.size > 0 ? (
              <>
                <button className="primary big" onClick={generateForSelected}>
                  📥 Generate workflow ({selectedIds.size})
                </button>
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
            ) : (
              filtered.length > 0 && filtered.length <= 2000 && (
                <button className="primary" onClick={generateForAll}>
                  📥 Workflow for {filtered.length === leads.length ? "all" : "filtered"} ({filtered.length})
                </button>
              )
            )}
            <button onClick={downloadFiltered} disabled={filtered.length === 0}>
              Excel ({filtered.length === leads.length ? "all" : "filtered"})
            </button>
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

function ImportTab({ leads, pack, currentOwner, profile, ingestLeads, markLeadsSent, importPreview, setImportPreview, showToast }) {
  const [dragging, setDragging] = useState(false);
  const [lastImport, setLastImport] = useState(null);
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
        const sourceNames = [];
        const seenInBatch = new Set();
        for (const f of jsonFiles) {
          sourceNames.push(f.name);
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
                if (!lead) continue;
                if (seenInBatch.has(lead.emailLower)) continue;
                seenInBatch.add(lead.emailLower);
                incoming.push(lead);
              }
            }
          } catch {
            showToast(`Failed to parse ${f.name}`, "error");
          }
        }
        if (incoming.length) {
          const result = ingestLeads(incoming, "LinkedIn JSON");
          setLastImport({
            workflowLeads: incoming,
            addedCount: result?.added || 0,
            updatedCount: result?.updated || 0,
            sourceLabel: sourceNames.join(", "),
            sourceKind: "linkedin",
          });
        } else {
          showToast("No valid emails found in JSON", "error");
        }
      }
    },
    [ingestLeads, setImportPreview, showToast, pack, currentOwner]
  );

  const confirmExcelImport = () => {
    if (!importPreview || importPreview.kind !== "excel") return;
    const allNewLeads = [];
    const seenInBatch = new Set();
    for (const sheet of importPreview.parsed.sheets) {
      const { leads: parsed } = rowsToLeads(sheet, importPreview.parsed.fileName);
      for (const l of parsed) {
        const tagged = { ...l, owner: currentOwner };
        if (seenInBatch.has(tagged.emailLower)) continue;
        seenInBatch.add(tagged.emailLower);
        allNewLeads.push(tagged);
      }
    }
    const result = ingestLeads(allNewLeads, "Excel import");
    setLastImport({
      workflowLeads: allNewLeads,
      addedCount: result?.added || 0,
      updatedCount: result?.updated || 0,
      sourceLabel: importPreview.parsed.fileName,
      sourceKind: "excel",
    });
    setImportPreview(null);
  };

  const downloadLastImportWorkflow = () => {
    if (!lastImport || !lastImport.workflowLeads.length) return;
    if (!profile.resumeLink || !profile.email) {
      showToast("Set resume link + email in Profile tab first", "error");
      return;
    }
    const batches = [];
    for (let i = 0; i < lastImport.workflowLeads.length; i += BATCH_SIZE) {
      batches.push(lastImport.workflowLeads.slice(i, i + BATCH_SIZE));
    }
    batches.forEach((batch, idx) => {
      const wf = buildWorkflow(profile, batch, idx + 1, batches.length, currentOwner);
      const blob = new Blob([JSON.stringify(wf, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = batches.length > 1
        ? `${currentOwner}_batch${idx + 1}_${new Date().toISOString().slice(0, 10)}.json`
        : `${currentOwner}_mailer_${new Date().toISOString().slice(0, 10)}.json`;
      setTimeout(() => {
        a.click();
        URL.revokeObjectURL(url);
      }, idx * 200);
    });
    markLeadsSent(lastImport.workflowLeads.map((l) => l.emailLower));
    showToast(
      `${batches.length > 1 ? `${batches.length} workflows` : "Workflow"} downloaded · ${lastImport.workflowLeads.length} leads marked sent`
    );
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

      {lastImport && lastImport.workflowLeads.length > 0 && (
        <section className="card slide-up ready-card">
          <div className="ready-glow" />
          <div className="ready-content">
            <div className="ready-header">
              <span className="ready-emoji">✨</span>
              <div>
                <h3 className="ready-title">Workflow ready</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  <strong>{lastImport.workflowLeads.length}</strong> email
                  {lastImport.workflowLeads.length > 1 ? "s" : ""} from{" "}
                  <strong>{lastImport.sourceLabel}</strong>
                  {lastImport.addedCount > 0 && ` · ${lastImport.addedCount} new added to ${pack.shortName}'s database`}
                  {lastImport.updatedCount > 0 && ` · ${lastImport.updatedCount} already in database (still included)`}
                </p>
              </div>
            </div>
            <div className="ready-actions">
              <button className="primary big" onClick={downloadLastImportWorkflow}>
                📥 Download n8n workflow ({lastImport.workflowLeads.length} email{lastImport.workflowLeads.length > 1 ? "s" : ""})
              </button>
              <button onClick={() => setLastImport(null)}>Dismiss</button>
            </div>
            <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
              Workflow includes every email from this file (existing leads too — your call to send or not). Import into n8n → connect Gmail SMTP → execute.
            </p>
          </div>
        </section>
      )}

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
