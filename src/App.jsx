import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  getCategories,
  extractRole,
  cleanName,
  CATEGORY_LIST,
  CAT_COLORS,
} from "./lib/parsers.js";
import { buildWorkflow } from "./lib/workflow.js";
import {
  loadHistory,
  saveHistory,
  clearAllHistory,
  loadProfile,
  saveProfile,
  buildEmailIndex,
} from "./lib/storage.js";
import { exportHistoryToExcel, exportEntriesToExcel } from "./lib/excel.js";

const BATCH_SIZE = 400;

const DEFAULT_PROFILE = {
  name: "Shashi Vashisht",
  email: "shashivash.bba2023ea@rdias.ac.in",
  phone: "9818710014",
  linkedin: "https://www.linkedin.com/in/shashi-vashisht-0a13a5348/",
  location: "New Delhi",
  resumeLink:
    "https://drive.google.com/file/d/1EgfW4MOmNTUT7H9mYQSrTAXUP4lBvaRA/view?usp=sharing",
  gradYear: "2026",
  degree: "BBA",
  college: "RDIAS",
  experience: "",
  jobType: "fresher",
};

const FIELDS = [
  ["name", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["degree", "Degree"],
  ["college", "College"],
  ["gradYear", "Grad year"],
];

export default function App() {
  const [tab, setTab] = useState("process");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [history, setHistory] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState([]);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    setHistory(loadHistory());
    setProfile(loadProfile(DEFAULT_PROFILE));
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (storageLoaded) saveProfile(profile);
  }, [profile, storageLoaded]);

  const emailIndex = useMemo(() => buildEmailIndex(history), [history]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const processFiles = useCallback(
    async (files) => {
      if (!files.length) return;
      const allRaw = [];
      const filesUsed = [];
      for (const file of files) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!Array.isArray(data)) {
            showToast(`${file.name}: expected JSON array — skipped`, "error");
            continue;
          }
          filesUsed.push(file.name);
          for (const item of data) {
            for (const email of item.emails || []) {
              const e = (email || "").trim();
              if (e && e.includes("@")) {
                allRaw.push({
                  email: e,
                  emailLower: e.toLowerCase(),
                  rawName: item.name || "",
                  postText: item.post_text || "",
                  sourceFile: file.name,
                });
              }
            }
          }
        } catch {
          showToast(`Could not parse ${file.name}`, "error");
        }
      }

      const dedupedByThisBatch = new Map();
      for (const r of allRaw) {
        if (!dedupedByThisBatch.has(r.emailLower)) dedupedByThisBatch.set(r.emailLower, r);
      }

      const newEntries = [];
      const duplicates = [];
      for (const r of dedupedByThisBatch.values()) {
        const prev = emailIndex.get(r.emailLower);
        const entry = {
          email: r.email,
          emailLower: r.emailLower,
          recruiter: cleanName(r.rawName),
          role: extractRole(r.postText),
          categories: getCategories(r.postText),
          sourceFile: r.sourceFile,
          excluded: false,
          status: prev ? "duplicate" : "new",
          firstSeenAt: prev?.addedAt || null,
        };
        if (prev) duplicates.push(entry);
        else newEntries.push(entry);
      }

      const catCounts = {};
      for (const e of newEntries)
        for (const c of e.categories) catCounts[c] = (catCounts[c] || 0) + 1;

      setEntries(newEntries);
      setStats({
        totalFound: allRaw.length,
        uniqueInBatch: dedupedByThisBatch.size,
        newCount: newEntries.length,
        dupes: duplicates.length,
        catCounts,
        batches: Math.max(1, Math.ceil(newEntries.length / BATCH_SIZE)),
        files: filesUsed,
        duplicates,
      });
      setGenerated([]);

      if (newEntries.length > 0)
        showToast(
          `${newEntries.length} new · ${duplicates.length} already in history`
        );
      else if (duplicates.length > 0)
        showToast("All emails were duplicates — nothing new!", "error");
      else showToast("No valid emails found in those files", "error");
    },
    [emailIndex]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      processFiles(
        [...e.dataTransfer.files].filter((f) => f.name.toLowerCase().endsWith(".json"))
      );
    },
    [processFiles]
  );

  const updateEntry = (idx, patch) =>
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const toggleEntryCategory = (idx, cat) =>
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== idx) return e;
        const has = e.categories.includes(cat);
        const next = has ? e.categories.filter((c) => c !== cat) : [...e.categories, cat];
        return { ...e, categories: next.length ? next : ["management"] };
      })
    );

  const generateWorkflows = () => {
    const active = entries.filter((e) => !e.excluded);
    if (!active.length) {
      showToast("No entries selected — uncheck 'exclude' to include", "error");
      return;
    }
    setGenerating(true);
    const batches = [];
    for (let i = 0; i < active.length; i += BATCH_SIZE) {
      batches.push(active.slice(i, i + BATCH_SIZE));
    }
    const wfs = batches.map((batch, idx) => ({
      name:
        batches.length > 1 ? `Batch ${idx + 1} of ${batches.length}` : "Workflow",
      count: batch.length,
      blob: new Blob(
        [JSON.stringify(buildWorkflow(profile, batch, idx + 1, batches.length), null, 2)],
        { type: "application/json" }
      ),
      filename:
        batches.length > 1
          ? `${profile.name.replace(/\s+/g, "_")}_batch${idx + 1}.json`
          : `${profile.name.replace(/\s+/g, "_")}_mailer.json`,
    }));
    setGenerated(wfs);

    const now = new Date().toISOString();
    const additions = active.map((e) => ({
      email: e.email,
      emailLower: e.emailLower,
      recruiter: e.recruiter,
      role: e.role,
      categories: e.categories,
      addedAt: now,
      generatedAt: now,
      sourceFile: e.sourceFile || null,
    }));
    const merged = [...history, ...additions];
    setHistory(merged);
    saveHistory(merged);

    setGenerating(false);
    showToast(`${wfs.length} workflow${wfs.length > 1 ? "s" : ""} ready · history updated`);
  };

  const downloadWorkflow = (wf) => {
    const url = URL.createObjectURL(wf.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = wf.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    generated.forEach((wf, i) => setTimeout(() => downloadWorkflow(wf), i * 150));
  };

  const exportCurrentBatchExcel = () => {
    if (!entries.length) return;
    exportEntriesToExcel(entries, `current_batch_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Current batch exported to Excel");
  };

  const exportHistoryExcel = () => {
    if (!history.length) {
      showToast("History is empty", "error");
      return;
    }
    exportHistoryToExcel(history);
    showToast(`Exported ${history.length} rows to Excel`);
  };

  const clearHistory = () => {
    setConfirm({
      title: "Clear all history?",
      message: `This permanently removes all ${history.length} tracked emails. Future uploads will no longer recognize them as duplicates. This cannot be undone.`,
      onConfirm: () => {
        clearAllHistory();
        setHistory([]);
        showToast("History cleared");
        setConfirm(null);
      },
    });
  };

  const deleteHistoryRow = (emailLower) => {
    const next = history.filter((h) => h.emailLower !== emailLower);
    setHistory(next);
    saveHistory(next);
    showToast("Removed 1 entry from history");
  };

  const pf = (key, val) => setProfile((p) => ({ ...p, [key]: val }));

  return (
    <div className="app">
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <header className="header">
        <div>
          <h1 className="title">Job mailer builder</h1>
          <p className="subtitle">
            Upload LinkedIn files → auto-dedup → generate n8n workflows
          </p>
        </div>
        <div className="header-actions">
          {storageLoaded && history.length > 0 && (
            <span className="tracked-badge">{history.length} in history</span>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tab === "process" ? "tab active" : "tab"}
          onClick={() => setTab("process")}
        >
          Process
        </button>
        <button
          className={tab === "history" ? "tab active" : "tab"}
          onClick={() => setTab("history")}
        >
          History {history.length > 0 && <span className="pill">{history.length}</span>}
        </button>
        <button
          className={tab === "profile" ? "tab active" : "tab"}
          onClick={() => setTab("profile")}
        >
          Profile
        </button>
      </nav>

      {tab === "process" && (
        <ProcessTab
          dragging={dragging}
          setDragging={setDragging}
          handleDrop={handleDrop}
          fileRef={fileRef}
          processFiles={processFiles}
          stats={stats}
          entries={entries}
          updateEntry={updateEntry}
          toggleEntryCategory={toggleEntryCategory}
          generating={generating}
          generated={generated}
          generateWorkflows={generateWorkflows}
          downloadWorkflow={downloadWorkflow}
          downloadAll={downloadAll}
          exportCurrentBatchExcel={exportCurrentBatchExcel}
        />
      )}

      {tab === "history" && (
        <HistoryTab
          history={history}
          exportHistoryExcel={exportHistoryExcel}
          clearHistory={clearHistory}
          deleteHistoryRow={deleteHistoryRow}
        />
      )}

      {tab === "profile" && <ProfileTab profile={profile} pf={pf} />}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function ProcessTab({
  dragging,
  setDragging,
  handleDrop,
  fileRef,
  processFiles,
  stats,
  entries,
  updateEntry,
  toggleEntryCategory,
  generating,
  generated,
  generateWorkflows,
  downloadWorkflow,
  downloadAll,
  exportCurrentBatchExcel,
}) {
  const [showDupes, setShowDupes] = useState(false);
  const activeCount = entries.filter((e) => !e.excluded).length;

  return (
    <>
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current.click()}
      >
        <div className="dropzone-title">Drop LinkedIn email JSON files here</div>
        <div className="dropzone-hint">
          Multiple files supported · duplicates checked against full history
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) processFiles([...e.target.files]);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </div>

      {stats && (
        <section className="card">
          <div className="stats-grid">
            {[
              ["Total found", stats.totalFound, null],
              ["Unique in batch", stats.uniqueInBatch, null],
              ["New emails", stats.newCount, "success"],
              ["Already in history", stats.dupes, "warning"],
              ["Batches needed", stats.batches, null],
            ].map(([label, val, sem]) => (
              <div key={label} className={`stat ${sem || ""}`}>
                <div className="stat-value">{val}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>

          {Object.keys(stats.catCounts).length > 0 && (
            <>
              <h3 className="section-label">Category breakdown</h3>
              <div className="cat-row">
                {Object.entries(stats.catCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <span
                      key={cat}
                      className="cat-chip"
                      style={{ background: CAT_COLORS[cat] || "#888" }}
                    >
                      {cat} · {count}
                    </span>
                  ))}
              </div>
            </>
          )}

          {stats.files.length > 0 && (
            <div className="muted small" style={{ marginTop: 8 }}>
              From: {stats.files.join(", ")}
            </div>
          )}

          {stats.dupes > 0 && (
            <button
              className="link"
              onClick={() => setShowDupes((v) => !v)}
              style={{ marginTop: 10 }}
            >
              {showDupes ? "Hide" : "Show"} {stats.dupes} duplicate
              {stats.dupes > 1 ? "s" : ""}
            </button>
          )}

          {showDupes && stats.duplicates.length > 0 && (
            <div className="dupe-list">
              {stats.duplicates.slice(0, 200).map((d) => (
                <div key={d.emailLower} className="dupe-row">
                  <span className="mono">{d.email}</span>
                  <span className="muted small">{d.recruiter}</span>
                </div>
              ))}
              {stats.duplicates.length > 200 && (
                <div className="muted small">
                  …and {stats.duplicates.length - 200} more
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {entries.length > 0 && (
        <section className="card">
          <div className="row-between">
            <h3 className="section-label" style={{ margin: 0 }}>
              Preview · edit before generating ({activeCount} active /{" "}
              {entries.length} total)
            </h3>
            <button onClick={exportCurrentBatchExcel}>Export batch (Excel)</button>
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>Use</th>
                  <th>Email</th>
                  <th>Recruiter</th>
                  <th>Role</th>
                  <th>Categories</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.emailLower} className={e.excluded ? "excluded" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!e.excluded}
                        onChange={(ev) => updateEntry(i, { excluded: !ev.target.checked })}
                      />
                    </td>
                    <td className="mono small">{e.email}</td>
                    <td>
                      <input
                        type="text"
                        value={e.recruiter}
                        onChange={(ev) => updateEntry(i, { recruiter: ev.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={e.role}
                        onChange={(ev) => updateEntry(i, { role: ev.target.value })}
                      />
                    </td>
                    <td>
                      <div className="cat-row">
                        {CATEGORY_LIST.map((c) => {
                          const active = e.categories.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              className={`cat-toggle ${active ? "active" : ""}`}
                              style={
                                active
                                  ? { background: CAT_COLORS[c], borderColor: CAT_COLORS[c] }
                                  : undefined
                              }
                              onClick={() => toggleEntryCategory(i, c)}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions-row">
            <button
              className="primary"
              disabled={generating || activeCount === 0}
              onClick={generateWorkflows}
            >
              {generating
                ? "Generating..."
                : activeCount > BATCH_SIZE
                ? `Generate ${Math.ceil(activeCount / BATCH_SIZE)} workflow files (${activeCount} emails)`
                : `Generate workflow (${activeCount} emails)`}
            </button>
          </div>
        </section>
      )}

      {generated.length > 0 && (
        <section className="card">
          <div className="row-between">
            <h2 className="card-title">Ready — import into n8n, connect Gmail SMTP, execute</h2>
            {generated.length > 1 && (
              <button onClick={downloadAll}>Download all</button>
            )}
          </div>
          <div className="generated-list">
            {generated.map((wf, i) => (
              <div key={i} className="generated-item">
                <div>
                  <div className="generated-name">{wf.name}</div>
                  <div className="generated-meta">
                    {wf.count} emails · {wf.filename}
                  </div>
                </div>
                <button className="primary" onClick={() => downloadWorkflow(wf)}>
                  Download
                </button>
              </div>
            ))}
          </div>
          <p className="footer-note">
            Emails were added to history. Future uploads will skip them automatically.
          </p>
        </section>
      )}
    </>
  );
}

function HistoryTab({ history, exportHistoryExcel, clearHistory, deleteHistoryRow }) {
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((h) => {
      if (catFilter !== "all" && !(h.categories || []).includes(catFilter)) return false;
      if (!q) return true;
      return (
        h.email?.toLowerCase().includes(q) ||
        h.recruiter?.toLowerCase().includes(q) ||
        h.role?.toLowerCase().includes(q) ||
        h.sourceFile?.toLowerCase().includes(q)
      );
    });
  }, [history, query, catFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (history.length === 0) {
    return (
      <section className="card empty">
        <p>No history yet. Generate a workflow on the Process tab to start tracking.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="history-controls">
        <input
          type="text"
          placeholder="Search email, recruiter, role, file…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select
          value={catFilter}
          onChange={(e) => {
            setCatFilter(e.target.value);
            setPage(0);
          }}
          className="select"
        >
          <option value="all">All categories</option>
          {CATEGORY_LIST.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="primary" onClick={exportHistoryExcel}>
          Download Excel
        </button>
        <button className="danger" onClick={clearHistory}>
          Clear history
        </button>
      </div>

      <div className="muted small" style={{ marginBottom: 8 }}>
        Showing {filtered.length === 0 ? 0 : safePage * pageSize + 1}–
        {Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}
        {filtered.length !== history.length && ` (${history.length} total)`}
      </div>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Email</th>
              <th>Recruiter</th>
              <th>Role</th>
              <th>Categories</th>
              <th>Generated</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((h, i) => (
              <tr key={h.emailLower || i}>
                <td className="muted small">{safePage * pageSize + i + 1}</td>
                <td className="mono small">{h.email}</td>
                <td className="small">{h.recruiter || "—"}</td>
                <td className="small">{h.role || "—"}</td>
                <td>
                  <div className="cat-row tight">
                    {(h.categories || []).map((c) => (
                      <span
                        key={c}
                        className="cat-chip tight"
                        style={{ background: CAT_COLORS[c] || "#888" }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="muted small">
                  {h.generatedAt
                    ? new Date(h.generatedAt).toLocaleDateString("en-IN", {
                        year: "2-digit",
                        month: "short",
                        day: "2-digit",
                      })
                    : h.legacy
                    ? "legacy"
                    : "—"}
                </td>
                <td className="muted small">{h.sourceFile || "—"}</td>
                <td>
                  <button
                    className="link danger"
                    title="Remove from history"
                    onClick={() => deleteHistoryRow(h.emailLower)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pager">
          <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            ← Prev
          </button>
          <span className="muted small">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}

function ProfileTab({ profile, pf }) {
  return (
    <section className="card">
      <h2 className="card-title">Profile</h2>
      <div className="radio-row">
        {["fresher", "experienced"].map((t) => (
          <label key={t}>
            <input
              type="radio"
              name="jobType"
              checked={profile.jobType === t}
              onChange={() => pf("jobType", t)}
            />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </label>
        ))}
      </div>
      <div className="profile-grid">
        {FIELDS.map(([k, label]) => (
          <div key={k}>
            <label className="field-label">{label}</label>
            <input
              type="text"
              value={profile[k]}
              onChange={(e) => pf(k, e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        ))}
        {profile.jobType === "experienced" && (
          <div>
            <label className="field-label">Experience (e.g. 1.6)</label>
            <input
              type="text"
              value={profile.experience}
              onChange={(e) => pf("experience", e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>
      <div className="field-full">
        <label className="field-label">LinkedIn URL</label>
        <input
          type="url"
          value={profile.linkedin}
          onChange={(e) => pf("linkedin", e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <div className="field-full">
        <label className="field-label">Resume link (Google Drive)</label>
        <input
          type="url"
          value={profile.resumeLink}
          onChange={(e) => pf("resumeLink", e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <p className="footer-note">Profile auto-saves to this browser.</p>
    </section>
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
          <button className="danger filled" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
