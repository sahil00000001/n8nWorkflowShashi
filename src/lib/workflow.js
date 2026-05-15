import { sanitize } from "./parsers.js";

export function generateWorkflowCode(profile, entries) {
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

export function buildWorkflow(profile, entries, batchNum, totalBatches) {
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
