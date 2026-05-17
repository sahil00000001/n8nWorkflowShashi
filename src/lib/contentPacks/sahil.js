const CATEGORIES = [
  "ai",
  "ml",
  "backend",
  "frontend",
  "fullstack",
  "data",
  "devops",
  "software",
];

const CATEGORY_COLORS = {
  ai: "#7F77DD",
  ml: "#4A3AFF",
  backend: "#1D9E75",
  frontend: "#378ADD",
  fullstack: "#D85A30",
  data: "#5DCAA5",
  devops: "#BA7517",
  software: "#888780",
};

function detectCategories(postText) {
  const t = (postText || "").toLowerCase();
  const cats = [];
  if (/\b(gen ?ai|genai|llm|ai engineer|prompt engineer|agentic|langchain|langgraph|llama ?index|rag\b|retrieval[- ]augmented|openai|claude|bedrock|azure openai|vector ?db|pinecone|chatbot|conversational ai)\b/.test(t))
    cats.push("ai");
  if (/\b(machine learning|deep learning|ml engineer|mlops|pytorch|tensorflow|computer vision|nlp|natural language|hugging ?face|model training|fine[- ]?tun)/.test(t))
    cats.push("ml");
  if (/\b(backend|back[- ]end|server[- ]?side|api developer|node\.?js|spring boot|asp\.net|django|fastapi|flask|microservice|graphql|rest api|java developer|\.net developer)\b/.test(t))
    cats.push("backend");
  if (/\b(frontend|front[- ]end|react|next\.?js|vue|angular|ui engineer|ux developer|web developer|html|css|tailwind|typescript developer)\b/.test(t))
    cats.push("frontend");
  if (/\b(full ?stack|fullstack|mern|mean|end[- ]to[- ]end developer|software engineer.*(react|node))\b/.test(t))
    cats.push("fullstack");
  if (/\b(data engineer|data scientist|data analyst|etl|elt|snowflake|bigquery|spark|airflow|databricks|pipeline|warehous|analytics engineer)\b/.test(t))
    cats.push("data");
  if (/\b(devops|sre|site reliability|infrastructure|docker|kubernetes|k8s|terraform|ansible|ci\/cd|cicd|aws certified|cloud engineer)\b/.test(t))
    cats.push("devops");
  if (/\b(software engineer|software developer|programmer|swe\b|sde\b)\b/.test(t) && !cats.length)
    cats.push("software");
  return cats.length ? cats : ["software"];
}

function escape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CERTIFICATIONS = [
  "Tata GenAI-Powered Data Analytics — Forage, 2025",
  "Introduction to Large Language Models — Google",
  "Introduction to Generative AI — Google",
  "AWS Cloud Practitioner Essentials — AWS, 2025",
  "Microsoft Azure Fundamentals AZ-900 — Microsoft",
  "Camunda Knowledge Badge (BPMN & DMN) — Credly, 2025",
  "Six Sigma White Belt Certification",
  "Introduction to SQL — Google Developer Program",
];

const REASON_FOR_EXPLORING =
  "Looking to contribute to advanced AI systems and scalable automation solutions in a growth-oriented environment.";

const GITHUB_URL = "https://github.com/sahil00000001";

function noticeShort(noticePeriod) {
  // Turn "15 Days — not currently serving" into "Available in 15 Days"
  const m = String(noticePeriod || "").match(/(\d+\s*Days?)/i);
  return m ? `Available in ${m[1]}` : "Available Immediately";
}

function genSubject(lead, profile) {
  const r = String(lead.role || "this opening")
    .replace(/[^\w\s\-/\\(\\)\.&+]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  const name = profile.name || "Sahil Vashisht";
  const title = profile.title || "Agentic AI Developer";
  const tag = `${profile.experience || "1.6"} YoE`;
  return `Application: ${r} | ${name} — ${title} | ${tag} | ${noticeShort(profile.noticePeriod)}`;
}

function genBody(lead, profile) {
  const name = escape(profile.name);
  const title = escape(profile.title || "Agentic AI Developer");
  const role = escape(lead.role || "this opening");
  const experience = escape(profile.experience || "1.6");
  const currentCtc = escape(profile.currentCtc || "—");
  const expectedCtc = escape(profile.expectedCtc || "Negotiable");
  const noticePeriod = escape(profile.noticePeriod || "Immediate");
  const location = escape(profile.location || "");
  const email = escape(profile.email || "");
  const phone = escape(profile.phone || "");
  const linkedin = escape(profile.linkedin || "");
  const resume = escape(profile.resumeLink || "");
  const certCount = CERTIFICATIONS.length;
  const availability = noticeShort(profile.noticePeriod);

  const certListHtml = CERTIFICATIONS.map((c) => `  <li>${escape(c)}</li>`).join("\n");

  return `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.55">
<h2 style="margin:0 0 4px">${name}</h2>
<p style="margin:0 0 16px;color:#555;font-size:14px">${title} &nbsp;|&nbsp; ${experience} Years Experience &nbsp;|&nbsp; ${certCount} Certifications &nbsp;|&nbsp; ${escape(availability)}</p>

<p>Dear Hiring Manager,</p>

<p>I am writing to express my interest in the <strong>${role}</strong> position. With ${experience} years of professional experience as a ${title} and ${certCount} industry certifications, I believe I can contribute meaningfully to your team from day one.</p>

<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0">
  <tr><td><strong>Total Experience</strong></td><td>${experience} Years</td></tr>
  <tr><td><strong>Current CTC</strong></td><td>${currentCtc}</td></tr>
  <tr><td><strong>Expected CTC</strong></td><td>${expectedCtc}</td></tr>
  <tr><td><strong>Notice Period</strong></td><td>${noticePeriod}</td></tr>
  <tr><td><strong>Current Location</strong></td><td>${location}${location ? ", India" : ""}</td></tr>
</table>

<h3 style="margin:18px 0 6px">Relevant Skills &amp; Expertise</h3>
<div style="font-size:14px">
  <p style="margin:8px 0"><strong>Full Stack Development (${experience} Years)</strong><br/>
  ASP.NET Core, Spring Boot, React + TypeScript, Node.js — 35+ production RESTful APIs</p>

  <p style="margin:8px 0"><strong>AI &amp; Agentic AI (9/10)</strong><br/>
  LLM integration, autonomous agent workflows, RAG pipelines, prompt engineering. Google-certified in LLMs &amp; Generative AI.</p>

  <p style="margin:8px 0"><strong>Problem Solving &amp; DSA (8.5/10)</strong><br/>
  End-to-end feature ownership, system design, code reviews, Agile/Scrum.</p>

  <p style="margin:8px 0"><strong>Databases — SQL / NoSQL (7/10)</strong><br/>
  MySQL, PostgreSQL, MongoDB, SQL Server — schema design &amp; query optimization.</p>
</div>

<h3 style="margin:18px 0 6px">Key Achievements</h3>
<ul style="margin:0;padding-left:18px">
  <li>Led WLS enterprise integration at PodTech — managed team of 5, delivered 100% on-time</li>
  <li>Architected 35+ production-ready RESTful APIs across ASP.NET Core &amp; Spring Boot</li>
  <li>Reduced API response times by 20% and data processing time by 35%</li>
  <li>B.Tech Information Technology — CGPA: 8.47 — GTBIT, New Delhi (2024)</li>
</ul>

<h3 style="margin:18px 0 6px">Professional Certifications</h3>
<ol style="margin:0;padding-left:20px">
${certListHtml}
</ol>

<p style="margin-top:16px">I would welcome the opportunity to discuss how my experience aligns with your team's requirements. My resume is attached below for your reference.</p>

<p><strong>Reason for exploring:</strong> ${escape(REASON_FOR_EXPLORING)}</p>

<p><a href="${resume}">VIEW RESUME</a> &nbsp;·&nbsp; <a href="${linkedin}">LINKEDIN</a> &nbsp;·&nbsp; <a href="${GITHUB_URL}">GITHUB</a></p>

<p>Thank you for your time and consideration.</p>

<p>Warm regards,<br/>
<strong>${name}</strong><br/>
${title}<br/>
${email} &nbsp;|&nbsp; +91 ${phone} &nbsp;|&nbsp; ${location}${location ? ", India" : ""}</p>
</div>`;
}

export const sahilPack = {
  id: "sahil",
  displayName: "Sahil Vashisht",
  shortName: "Sahil",
  tagline: "Agentic AI Developer · 1.6 YoE · 8 Certs · 15-Day Notice",
  emoji: "🚀",
  color: "#4A3AFF",
  defaultProfile: {
    name: "Sahil Vashisht",
    email: "vashishtsahil99@gmail.com",
    phone: "9625107920",
    linkedin: "https://www.linkedin.com/in/sahilvashisht00/",
    location: "Bangalore",
    resumeLink: "https://drive.google.com/file/d/1biWU5Odp_Wjja0NUykLytKINWUYj01mo/view",
    gradYear: "2024",
    degree: "BTech IT",
    college: "GTBIT",
    experience: "1.6",
    jobType: "experienced",
    title: "Agentic AI Developer",
    currentCtc: "6 LPA",
    expectedCtc: "8-10 LPA (negotiable)",
    noticePeriod: "15 Days — not currently serving",
  },
  categories: CATEGORIES,
  categoryColors: CATEGORY_COLORS,
  detectCategories,
  genSubject,
  genBody,
};
