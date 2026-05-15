import * as XLSX from "xlsx";

function autoWidths(rows) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => {
    let w = k.length;
    for (const r of rows) {
      const v = r[k] == null ? "" : String(r[k]);
      if (v.length > w) w = v.length;
    }
    return { wch: Math.min(Math.max(w + 2, 10), 60) };
  });
}

function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

export function exportHistoryToExcel(history, filename) {
  const wb = XLSX.utils.book_new();

  const rows = history.map((h, i) => ({
    "#": i + 1,
    Email: h.email || "",
    Recruiter: h.recruiter || "",
    Role: h.role || "",
    Categories: (h.categories || []).join(", "),
    "Added At": formatDate(h.addedAt),
    "Generated At": formatDate(h.generatedAt),
    "Source File": h.sourceFile || "",
    Legacy: h.legacy ? "yes" : "",
  }));
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = autoWidths(rows);
  XLSX.utils.book_append_sheet(wb, ws1, "History");

  const byCat = {};
  for (const h of history) {
    for (const c of h.categories && h.categories.length ? h.categories : ["uncategorized"]) {
      byCat[c] = (byCat[c] || 0) + 1;
    }
  }
  const catRows = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ Category: cat, Count: count }));
  if (catRows.length) {
    const ws2 = XLSX.utils.json_to_sheet(catRows);
    ws2["!cols"] = autoWidths(catRows);
    XLSX.utils.book_append_sheet(wb, ws2, "By Category");
  }

  const summary = [
    { Metric: "Total emails in history", Value: history.length },
    { Metric: "Generated (queued)", Value: history.filter((h) => h.generatedAt).length },
    { Metric: "Migrated from legacy", Value: history.filter((h) => h.legacy).length },
    { Metric: "Export date", Value: formatDate(new Date().toISOString()) },
  ];
  const ws3 = XLSX.utils.json_to_sheet(summary);
  ws3["!cols"] = autoWidths(summary);
  XLSX.utils.book_append_sheet(wb, ws3, "Summary");

  const name =
    filename || `job_mailer_history_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}

export function exportEntriesToExcel(entries, filename) {
  const wb = XLSX.utils.book_new();
  const rows = entries.map((e, i) => ({
    "#": i + 1,
    Email: e.email,
    Recruiter: e.recruiter,
    Role: e.role,
    Categories: (e.categories || []).join(", "),
    Status: e.status || "new",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = autoWidths(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Entries");
  XLSX.writeFile(wb, filename || `job_mailer_batch_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
