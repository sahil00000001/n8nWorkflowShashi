import { getPack } from "./contentPacks/index.js";

export function buildWorkflow(profile, leads, batchNum, totalBatches, ownerId) {
  const pack = getPack(ownerId);
  const items = leads.map((lead) => ({
    json: {
      from: profile.email,
      to: lead.email,
      subject: pack.genSubject(lead, profile),
      html: pack.genBody(lead, profile),
      recruiter: lead.name || "",
      role: lead.role || "",
    },
  }));

  const jsCode = `// Pre-computed by Lead Manager for ${pack.displayName}\nreturn ${JSON.stringify(items, null, 2)};`;

  const safeName = profile.name || pack.displayName;
  return {
    name: `${safeName} – Job Mailer${
      totalBatches > 1 ? ` Batch ${batchNum}/${totalBatches}` : ""
    } (${leads.length} emails)`,
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
        parameters: { jsCode },
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
        continueOnFail: true,
        parameters: {
          fromEmail: "={{ $json.from }}",
          toEmail: "={{ $json.to }}",
          subject: "={{ $json.subject }}",
          emailType: "html",
          html: "={{ $json.html }}",
          options: { allowUnauthorizedCerts: false, appendAttribution: false },
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
          content: `## ${safeName} — ${pack.shortName} — Batch ${batchNum}/${totalBatches}\n\n**${leads.length} emails** pre-formatted (subject + HTML body).\n\nReady to send via Gmail SMTP.\n\n1. Connect Gmail SMTP credential\n2. Click Execute`,
          width: 340,
          height: 200,
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
