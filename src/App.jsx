import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "job_mailer_sent_emails";
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

const CAT_COLORS = {
  finance: "#1D9E75",
  analyst: "#378ADD",
  hr: "#D4537E",
  operations: "#BA7517",
  marketing: "#7F77DD",
  sales: "#D85A30",
  content: "#5DCAA5",
  management: "#888780",
};

function sanitize(s) {
  return (s || "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n|\r/g, " ")
    .trim();
}

function getCategories(postText) {
  const t = (postText || "").toLowerCase();
  const cats = [];
  if (/finance|accounts|accountant|gst|taxation|invoice|tally|financial|cfo/.test(t)) cats.push("finance");
  if (/business analyst|business analysis|mis\b|data analyst|analytics|market research/.test(t)) cats.push("analyst");
  if (/\boperations\b|ops |supply chain|logistics|procurement/.test(t)) cats.push("operations");
  if (/marketing|digital marketing|social media|content market|growth\b|seo\b|campaign/.test(t)) cats.push("marketing");
  if (/\bhr\b|human resource|recruiter|talent|people ops|hrbp|payroll|onboarding|recruitment/.test(t)) cats.push("hr");
  if (/content writ|content creat|copywrite|copywriting|\bblog\b|writing|editor/.test(t)) cats.push("content");
  if (/management trainee|mt program|bba|mba|trainee|fresher|graduate|campus/.test(t)) cats.push("management");
  if (/\bsales\b|business develop|\bbd\b|client|account manager|\bcrm\b/.test(t)) cats.push("sales");
  return cats.length ? cats : ["management"];
}

function extractRole(postText) {
  const lines = (postText || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    const clean = line
      .replace(/[^\w\s\-\/\(\)&,\.#+]/g, "")
      .trim()
      .replace(/^(we.re hiring|we are hiring|urgent hiring|hiring alert|hiring|join us|alert)[:\-|!\s]*/i, "")
      .trim()
      .replace(/#\w+/g, "")
      .trim()
      .replace(/\s+/g, " ");
    if (clean.length > 5 && clean.length < 80) return clean;
  }
  return "Business & Finance Opportunity";
}

function cleanName(name) {
  return (
    (name || "")
      .replace(/premium profile|\b2nd\b|\b3rd\+\b|• 2nd|• 3rd\+|, hiring|hiring manager/gi, "")
      .trim()
      .replace(/^[,.\s]+|[,.\s]+$/g, "") || "Hiring Manager"
  );
}

function generateWorkflowCode(profile, entries) {
  const jsArr =
    "[\n" +
    entries
      .map(
        (e) =>
          `  {email:'${sanitize(e.email)}',recruiter:'${sanitize(e.recruiter)}',role:'${sanitize(
            e.role
          )}',categories:${JSON.stringify(e.categories)}}`
      )
      .join(",\n") +
    "\n]";
  const isFresher = profile.jobType === "fresher";

  return `const YOUR_NAME="${sanitize(profile.name)}";
const YOUR_EMAIL="${sanitize(profile.email)}";
const YOUR_PHONE="${sanitize(profile.phone)}";
const YOUR_LINKEDIN="${sanitize(profile.linkedin)}";
const YOUR_LOCATION="${sanitize(profile.location)}";
const RESUME_LINK="${sanitize(profile.resumeLink)}";
const GRAD_YEAR="${sanitize(profile.gradYear)}";
const DEGREE="${sanitize(profile.degree)}";
const COLLEGE="${sanitize(profile.college)}";
const EXP="${sanitize(profile.experience)}";
const IS_FRESHER=${isFresher};
const jobListings=${jsArr};

function getCertBlock(c){
  const finance=["GST Filing & Taxation — Valeur Fabtex Pvt Ltd","Financial Modelling & MIS Reporting — Internship"];
  const business=["Tata GenAI-Powered Data Analytics — Forage, 2025","AWS Cloud Practitioner Essentials — AWS, 2025"];
  const awards=["Best Presenter Award (2026) — Research Presentation","1st Prize — Best Out of Waste, Razmaataz"];
  const tools=["Microsoft Excel (Advanced) — Dashboards & Reporting","Google Workspace Suite — Docs, Sheets, Slides"];
  let o;
  if(c.includes("finance")) o=[...finance,...tools,...business,...awards];
  else if(c.includes("analyst")) o=[...business,...finance,...tools,...awards];
  else if(c.includes("marketing")||c.includes("content")) o=[...awards,...tools,...business,...finance];
  else o=[...awards,...finance,...tools,...business];
  return o.map((cert,i)=>\`\${i+1}. \${cert}\`).join("\\n");
}

function getSkillBlock(c){
  const b=[];
  b.push(["Finance & Accounting","Financial Modelling, MIS Reporting, Variance Analysis, GST Filing, Invoice Processing, Accounts Reconciliation."]);
  b.push(["Business Analysis","Market Research, SWOT/SWOC Analysis, KPI Tracking, Competitive Intelligence, Data Interpretation."]);
  if(c.includes("analyst")||c.includes("operations")) b.push(["Operations & Process","SOP Development, Process Optimisation, Project Documentation, Cross-functional Collaboration."]);
  if(c.includes("marketing")||c.includes("content")) b.push(["Content & Communication","SEO-optimised writing, Report Drafting, Persuasive Copywriting, Audience Engagement."]);
  if(c.includes("hr")||c.includes("management")||c.includes("sales")) b.push(["Stakeholder Management","Client Interaction, Team Coordination, Strategic Planning, Presentation Design."]);
  if(c.includes("finance")) b.push(["Taxation & Compliance","GST Filing, Invoice Preparation, Compliance Workflows, Statutory Reporting."]);
  b.push(["Tools","Microsoft Excel (Advanced), PowerPoint, Word, Google Sheets, Docs, Slides."]);
  return b.map(([sk,desc])=>\`\${sk}\\n\${desc}\`).join("\\n\\n");
}

function genSubject(j){
  const r=j.role.replace(/[^\\w\\s\\-\\/\\(\\)\\.&\\+]/g,'').trim().replace(/\\s+/g,' ');
  const c=j.categories;
  const tag=IS_FRESHER?\`\${DEGREE} '\${GRAD_YEAR.slice(-2)}\`:\`\${EXP} YOE\`;
  if(c.includes("finance")&&c.includes("analyst")) return \`Application: \${r} | \${YOUR_NAME} — Finance & Business Analysis | \${tag} | Available Now\`;
  if(c.includes("finance")) return \`Application: \${r} | \${YOUR_NAME} — Finance & Accounts | GST · MIS · Modelling | \${tag}\`;
  if(c.includes("analyst")) return \`Application: \${r} | \${YOUR_NAME} — Business Analyst | Research · KPI · Reporting | \${tag}\`;
  if(c.includes("hr")) return \`Application: \${r} | \${YOUR_NAME} — HR & Talent Ops | Best Presenter '26 | \${tag}\`;
  if(c.includes("operations")) return \`Application: \${r} | \${YOUR_NAME} — Operations & Strategy | Process Optimisation | \${tag}\`;
  if(c.includes("marketing")) return \`Application: \${r} | \${YOUR_NAME} — Marketing & Research | Content · Brand | \${tag}\`;
  if(c.includes("sales")) return \`Application: \${r} | \${YOUR_NAME} — Sales & BD | Communication · CRM | \${tag}\`;
  if(c.includes("content")) return \`Application: \${r} | \${YOUR_NAME} — Content & Communication | Writing · Research | \${tag}\`;
  return \`Application: \${r} | \${YOUR_NAME} — Management Trainee | \${tag} | Best Presenter Award | Available Now\`;
}

function getRD(c){
  if(c.includes("finance")&&c.includes("analyst")) return "Finance & Business Analyst";
  if(c.includes("finance")) return "Finance & Accounts Executive";
  if(c.includes("analyst")) return "Business Analyst";
  if(c.includes("hr")) return "HR & Talent Operations";
  if(c.includes("operations")) return "Operations & Strategy Associate";
  if(c.includes("marketing")) return "Marketing & Research Associate";
  if(c.includes("sales")) return "Sales & Business Development";
  if(c.includes("content")) return "Content & Communication Specialist";
  return "Management Trainee / Business Graduate";
}

function genBody(j){
  const rf=j.recruiter.split(' ')[0];
  const g=(rf&&rf!=="Hiring"&&rf!=="Manager"&&rf.length>1)?\`Dear \${rf},\`:"Dear Hiring Manager,";
  const sk=getSkillBlock(j.categories);
  const ct=getCertBlock(j.categories);
  const rd=getRD(j.categories);
  const expLine=IS_FRESHER
    ?\`final-year \${DEGREE} student at \${COLLEGE} (graduating \${GRAD_YEAR}) with hands-on internship experience in finance operations, market research, and MIS reporting\`
    :\`\${EXP} years experienced professional in \${rd}\`;
  return \`<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.55">
<h2 style="margin:0 0 4px">\${YOUR_NAME}</h2>
<p style="margin:0 0 16px;color:#555;font-size:14px">\${rd} | \${DEGREE}, \${COLLEGE} (\${GRAD_YEAR}) | Best Presenter 2026 | Available Immediately</p>
<p>\${g}</p>
<p>I came across the <strong>\${j.role}</strong> opening and I am excited to apply. I am a \${expLine} — available to join immediately.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0">
  <tr><td><strong>Qualification</strong></td><td>\${DEGREE} — \${COLLEGE} | Expected \${GRAD_YEAR}</td></tr>
  <tr><td><strong>Internship Experience</strong></td><td>5 months — Finance (Valeur Fabtex) + Content (Aashman Foundation)</td></tr>
  <tr><td><strong>Key Achievement</strong></td><td>Best Presenter Award 2026</td></tr>
  <tr><td><strong>Expected CTC</strong></td><td>As per company standards</td></tr>
  <tr><td><strong>Availability</strong></td><td>Immediately Available — \${YOUR_LOCATION}</td></tr>
</table>
<h3 style="margin:18px 0 6px">Skills & Expertise</h3>
<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:0;font-size:14px">\${sk}</pre>
<h3 style="margin:18px 0 6px">Key Highlights</h3>
<ul style="margin:0;padding-left:18px">
  <li>Best Presenter Award (2026) — High-impact analytical research presentation</li>
  <li>Delivered financial models & MIS reports — Valeur Fabtex Pvt Ltd</li>
  <li>GST filing, invoice processing & compliance workflows — hands-on taxation exposure</li>
  <li>1st Prize — Best Out of Waste, Razmaataz (creative execution & teamwork)</li>
</ul>
<h3 style="margin:18px 0 6px">Credentials</h3>
<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:0;font-size:14px">\${ct}</pre>
<p style="margin-top:16px">I would love the opportunity to contribute to your team. My resume is linked below.</p>
<p>I bring strong analytical thinking, a proactive attitude, and the ability to deliver from day one.</p>
<p><a href="\${RESUME_LINK}">VIEW RESUME</a> · <a href="\${YOUR_LINKEDIN}">LINKEDIN</a></p>
<p>Thank you for your time.</p>
<p>Warm regards,<br/><strong>\${YOUR_NAME}</strong><br/>\${rd} | \${DEGREE}, \${COLLEGE} (\${GRAD_YEAR})<br/>\${YOUR_EMAIL} | +91 \${YOUR_PHONE} | \${YOUR_LOCATION}, India</p>
<p style="font-size:12px;color:#888">In response to a position posted on LinkedIn · Resume</p>
</div>\`;
}

const output=jobListings.map(j=>({json:{from:YOUR_EMAIL,to:j.email,subject:genSubject(j),html:genBody(j),recruiter:j.recruiter,role:j.role}}));
return output;`;
}

function buildWorkflow(profile, entries, batchNum, totalBatches) {
  const code = generateWorkflowCode(profile, entries);
  return {
    name: `${profile.name} – Job Mailer${
      totalBatches > 1 ? ` Batch ${batchNum}/${totalBatches}` : ""
    } (${entries.length} emails)`,
    nodes: [
      {
        id: "t1",
        name: "Start",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [200, 400],
        parameters: {},
      },
      {
        id: "c1",
        name: "Format Emails",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [460, 400],
        parameters: { jsCode: code },
      },
      {
        id: "b1",
        name: "One At A Time",
        type: "n8n-nodes-base.splitInBatches",
        typeVersion: 3,
        position: [740, 400],
        parameters: { batchSize: 1, options: {} },
      },
      {
        id: "s1",
        name: "Gmail SMTP",
        type: "n8n-nodes-base.emailSend",
        typeVersion: 2.1,
        position: [1020, 400],
        parameters: {
          fromEmail: "={{ $json.from }}",
          toEmail: "={{ $json.to }}",
          subject: "={{ $json.subject }}",
          emailType: "html",
          html: "={{ $json.html }}",
          options: { allowUnauthorizedCerts: false, appendAttribution: false },
        },
        credentials: {
          smtp: { id: "YOUR_SMTP_CREDENTIAL_ID", name: "Gmail SMTP" },
        },
      },
      {
        id: "w1",
        name: "Wait 10s",
        type: "n8n-nodes-base.wait",
        typeVersion: 1.1,
        position: [1020, 600],
        parameters: { amount: 10, unit: "seconds" },
      },
      {
        id: "n1",
        name: "Info",
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [140, 120],
        parameters: {
          content: `## ${profile.name} — Batch ${batchNum}/${totalBatches}\n\n**${entries.length} emails** pre-loaded\nDeduplicated\nRole-specific subjects\n\n1. Configure Gmail SMTP\n2. Execute`,
          width: 340,
          height: 180,
        },
      },
    ],
    connections: {
      Start: { main: [[{ node: "Format Emails", type: "main", index: 0 }]] },
      "Format Emails": {
        main: [[{ node: "One At A Time", type: "main", index: 0 }]],
      },
      "One At A Time": {
        main: [null, [{ node: "Gmail SMTP", type: "main", index: 0 }]],
      },
      "Gmail SMTP": { main: [[{ node: "Wait 10s", type: "main", index: 0 }]] },
      "Wait 10s": {
        main: [[{ node: "One At A Time", type: "main", index: 0 }]],
      },
    },
    settings: { executionOrder: "v1" },
    meta: { templateCredsSetupCompleted: true },
  };
}

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
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [showProfile, setShowProfile] = useState(false);
  const [sentEmails, setSentEmails] = useState(new Set());
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [processedEntries, setProcessedEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState([]);
  const [toast, setToast] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSentEmails(new Set(JSON.parse(raw)));
    } catch {}
    setStorageLoaded(true);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const processFiles = useCallback(
    async (files) => {
      const all = [];
      for (const file of files) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!Array.isArray(data)) continue;
          for (const item of data) {
            for (const email of item.emails || []) {
              const e = email.trim();
              if (e && e.includes("@"))
                all.push({
                  email: e,
                  rawName: item.name || "",
                  postText: item.post_text || "",
                });
            }
          }
        } catch {
          showToast(`Could not parse ${file.name}`, "error");
        }
      }
      let dupes = 0,
        newCount = 0;
      const entries = [];
      const seen = new Set(sentEmails);
      for (const item of all) {
        if (seen.has(item.email.toLowerCase())) {
          dupes++;
          continue;
        }
        seen.add(item.email.toLowerCase());
        newCount++;
        entries.push({
          email: item.email,
          recruiter: cleanName(item.rawName),
          role: extractRole(item.postText),
          categories: getCategories(item.postText),
        });
      }
      const catCounts = {};
      for (const e of entries)
        for (const c of e.categories) catCounts[c] = (catCounts[c] || 0) + 1;
      setProcessedEntries(entries);
      setStats({
        total: all.length,
        newCount,
        dupes,
        catCounts,
        batches: Math.ceil(entries.length / BATCH_SIZE),
      });
      setGenerated([]);
      if (newCount > 0) showToast(`${newCount} new · ${dupes} duplicates skipped`);
      else showToast("All emails were duplicates — nothing new!", "error");
    },
    [sentEmails]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      processFiles(
        [...e.dataTransfer.files].filter((f) => f.name.endsWith(".json"))
      );
    },
    [processFiles]
  );

  const generateWorkflows = () => {
    if (!processedEntries.length) return;
    setGenerating(true);
    const batches = [];
    for (let i = 0; i < processedEntries.length; i += BATCH_SIZE) {
      batches.push(processedEntries.slice(i, i + BATCH_SIZE));
    }
    const wfs = batches.map((batch, idx) => ({
      name:
        batches.length > 1
          ? `Batch ${idx + 1} of ${batches.length}`
          : "Workflow",
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
    const newSent = new Set(sentEmails);
    for (const e of processedEntries) newSent.add(e.email.toLowerCase());
    setSentEmails(newSent);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...newSent]));
    } catch {}
    setGenerating(false);
    showToast(`${wfs.length} workflow${wfs.length > 1 ? "s" : ""} ready!`);
  };

  const downloadWorkflow = (wf) => {
    const url = URL.createObjectURL(wf.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = wf.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    setSentEmails(new Set());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    showToast("History cleared");
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
          {storageLoaded && sentEmails.size > 0 && (
            <span className="tracked-badge">{sentEmails.size} tracked</span>
          )}
          <button onClick={() => setShowProfile((p) => !p)}>
            {showProfile ? "Hide" : "Profile"}
          </button>
        </div>
      </header>

      {showProfile && (
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
        </section>
      )}

      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current.click()}
      >
        <div className="dropzone-title">Drop LinkedIn email JSON files here</div>
        <div className="dropzone-hint">
          Multiple files supported · duplicates skipped automatically
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
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
              ["Total found", stats.total, null],
              ["New emails", stats.newCount, "success"],
              ["Duplicates skipped", stats.dupes, "warning"],
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
              <h3 className="card-title" style={{ fontSize: 13 }}>
                Category breakdown
              </h3>
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

          {stats.newCount > 0 && (
            <button
              className="primary"
              disabled={generating}
              onClick={generateWorkflows}
            >
              {generating
                ? "Generating..."
                : stats.batches > 1
                ? `Generate ${stats.batches} workflow files (${stats.newCount} emails)`
                : `Generate workflow (${stats.newCount} emails)`}
            </button>
          )}
        </section>
      )}

      {generated.length > 0 && (
        <section className="card">
          <h2 className="card-title">
            Ready — import into n8n, connect Gmail SMTP, execute
          </h2>
          <div className="generated-list">
            {generated.map((wf, i) => (
              <div key={i} className="generated-item">
                <div>
                  <div className="generated-name">{wf.name}</div>
                  <div className="generated-meta">
                    {wf.count} emails · {wf.filename}
                  </div>
                </div>
                <button
                  className="primary"
                  onClick={() => downloadWorkflow(wf)}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
          <p className="footer-note">
            {sentEmails.size} emails saved to memory — future uploads skip them
            automatically
          </p>
        </section>
      )}

      {storageLoaded && sentEmails.size > 0 && (
        <div className="history-bar">
          <span>
            {sentEmails.size} emails in dedup history · persists across sessions
          </span>
          <button className="danger" onClick={clearHistory}>
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}
