let _XLSX = null;
async function loadXLSX() {
  if (_XLSX) return _XLSX;
  _XLSX = await import("xlsx");
  return _XLSX;
}

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

function leadRow(l, i) {
  return {
    "#": i + 1,
    Email: l.email || "",
    Name: l.name || "",
    Designation: l.designation || "",
    Company: l.company || "",
    Location: l.location || "",
    "LinkedIn URL": l.linkedinUrl || "",
    Phone: l.phone || "",
    "Hiring Role": l.role || "",
    Categories: (l.categories || []).join(", "),
    Status: l.status || "",
    Source: l.source || "",
    "Source File": l.sourceFile || "",
    Notes: l.notes || "",
    "Added At": formatDate(l.addedAt),
    "Updated At": formatDate(l.updatedAt),
    "Generated At": formatDate(l.generatedAt),
  };
}

function buildLeadsSheet(XLSX, leads) {
  const rows = leads.map((l, i) => leadRow(l, i));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = autoWidths(rows);
  if (rows.length) ws["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

function buildBreakdown(XLSX, leads, key, label) {
  const counts = {};
  for (const l of leads) {
    const raw = l[key];
    if (Array.isArray(raw)) {
      for (const v of raw.length ? raw : ["—"]) counts[v] = (counts[v] || 0) + 1;
    } else {
      const v = (raw || "—").toString().trim() || "—";
      counts[v] = (counts[v] || 0) + 1;
    }
  }
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => ({ [label]: k, Count: c }));
  if (!rows.length) return null;
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = autoWidths(rows);
  return ws;
}

export async function exportLeadsToExcel(leads, filename) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildLeadsSheet(XLSX, leads), "Leads");

  const byDesignation = buildBreakdown(XLSX, leads, "designation", "Designation");
  if (byDesignation) XLSX.utils.book_append_sheet(wb, byDesignation, "By Designation");
  const byCompany = buildBreakdown(XLSX, leads, "company", "Company");
  if (byCompany) XLSX.utils.book_append_sheet(wb, byCompany, "By Company");
  const byLocation = buildBreakdown(XLSX, leads, "location", "Location");
  if (byLocation) XLSX.utils.book_append_sheet(wb, byLocation, "By Location");
  const byCategory = buildBreakdown(XLSX, leads, "categories", "Category");
  if (byCategory) XLSX.utils.book_append_sheet(wb, byCategory, "By Category");
  const byStatus = buildBreakdown(XLSX, leads, "status", "Status");
  if (byStatus) XLSX.utils.book_append_sheet(wb, byStatus, "By Status");

  const summary = [
    { Metric: "Total leads", Value: leads.length },
    { Metric: "Queued / Generated", Value: leads.filter((l) => l.generatedAt).length },
    { Metric: "From Excel import", Value: leads.filter((l) => l.source === "excel").length },
    { Metric: "From LinkedIn", Value: leads.filter((l) => l.source === "linkedin").length },
    { Metric: "Manual / migrated", Value: leads.filter((l) => l.source !== "excel" && l.source !== "linkedin").length },
    { Metric: "Export date", Value: formatDate(new Date().toISOString()) },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary["!cols"] = autoWidths(summary);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  const name = filename || `leads_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}

export async function exportEntriesToExcel(entries, filename) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildLeadsSheet(XLSX, entries), "Leads");
  XLSX.writeFile(wb, filename || `leads_batch_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export const exportHistoryToExcel = exportLeadsToExcel;
