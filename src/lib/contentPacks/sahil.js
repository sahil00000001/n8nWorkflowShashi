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
  if (/\b(software engineer|software developer|programmer|swe\b|sde\b|engineer i+|engineer\b)\b/.test(t) && !cats.length)
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

function isAIFlavor(c) {
  return c.includes("ai") || c.includes("ml");
}
function isDataFlavor(c) {
  return c.includes("data");
}

function getRD(c) {
  if (c.includes("ai") && c.includes("ml")) return "AI / ML Engineer";
  if (c.includes("ai")) return "AI Engineer · GenAI";
  if (c.includes("ml")) return "Machine Learning Engineer";
  if (c.includes("fullstack")) return "Full Stack Developer";
  if (c.includes("backend")) return "Backend Developer";
  if (c.includes("frontend")) return "Frontend Developer";
  if (c.includes("data")) return "Data Engineer · AI";
  if (c.includes("devops")) return "Full Stack + DevOps";
  return "Software Engineer";
}

function getCertBlock(c) {
  const ai = [
    "Tata GenAI-Powered Data Analytics Simulation — Forage, 2025",
    "AWS Cloud Practitioner Essentials — AWS, 2025",
    "Camunda BPMN & DMN — Credly, 2025",
  ];
  const cloud = [
    "AWS Cloud Practitioner Essentials — AWS, 2025",
    "Tata GenAI-Powered Data Analytics Simulation — Forage, 2025",
    "Camunda BPMN & DMN — Credly, 2025",
  ];
  const list = isAIFlavor(c) || isDataFlavor(c) ? ai : cloud;
  return list.map((cert, i) => `${i + 1}. ${cert}`).join("\n");
}

function getSkillBlock(c) {
  const b = [];
  if (isAIFlavor(c) || isDataFlavor(c)) {
    b.push(["AI / GenAI", "LangChain, LangGraph, LlamaIndex, CrewAI, RAG Pipelines, Hybrid Search, Prompt Engineering (CoT, ReAct, ToT), LLM Fine-tuning (LoRA, QLoRA), Multi-Agent Systems, MCP, Agent Memory, Guardrails, LLMOps."]);
    b.push(["ML Frameworks", "PyTorch, TensorFlow, Scikit-learn, Hugging Face Transformers, Pandas, NumPy, BERT, Whisper."]);
    b.push(["Vector DBs", "Pinecone, FAISS, Weaviate, ChromaDB, pgvector, Qdrant."]);
    b.push(["Backend & API", "FastAPI, Flask, Spring Boot, ASP.NET Core, RESTful APIs, WebSockets, Microservices, Pydantic, asyncio."]);
    b.push(["Cloud", "AWS (EC2, S3, RDS, IAM, Lambda, Bedrock, SageMaker), Azure (Functions, Azure OpenAI, Azure AI Search), GCP (Vertex AI)."]);
    b.push(["LLMOps & DevOps", "Docker, Kubernetes, CI/CD, Git, MLflow, LangSmith, RAGAS, DeepEval, Promptfoo, Observability."]);
  } else {
    b.push(["Backend", "ASP.NET Core 8, ASP.NET MVC, Spring Boot, Spring MVC, Microservices Architecture, RESTful API Development, FastAPI."]);
    b.push(["Frontend", "ReactJS, Redux, TypeScript, JavaScript (ES6+), HTML5, CSS3, Responsive UI, Component Libraries."]);
    if (c.includes("fullstack") || c.includes("frontend")) {
      b.push(["UI Engineering", "Reusable component libraries, API-driven data visualization, dynamic tables, performance optimization."]);
    }
    b.push(["Databases", "PostgreSQL, MySQL, MongoDB, SQL Server, Redis (SQL & NoSQL design, indexing, query optimization)."]);
    b.push(["Cloud & DevOps", "AWS (EC2, S3, RDS, IAM), Azure (Functions, Infrastructure), Docker, Git, CI/CD pipelines, Postman."]);
    if (c.includes("devops")) {
      b.push(["DevOps Practices", "Docker, Kubernetes (basics), CI/CD, Terraform (basics), Linux, MLflow, Observability."]);
    }
    b.push(["Languages", "Java, JavaScript, TypeScript, Python, C++, SQL."]);
  }
  return b.map(([sk, desc]) => `${sk}\n${desc}`).join("\n\n");
}

function getTagline(c) {
  if (isAIFlavor(c)) return "AI · LangChain · RAG · LangGraph";
  if (isDataFlavor(c)) return "Data · NL-to-SQL · Snowflake · AI";
  if (c.includes("backend")) return "Backend · ASP.NET · Spring Boot · 35+ APIs";
  if (c.includes("frontend")) return "Frontend · React · TypeScript · Redux";
  if (c.includes("fullstack")) return "Full Stack · ASP.NET + React · 35+ APIs";
  if (c.includes("devops")) return "Docker · CI/CD · AWS · 35+ APIs";
  return "Software Engineer · 35+ Production APIs";
}

function genSubject(lead, profile) {
  const r = String(lead.role || "this opening").replace(/[^\w\s\-/\\(\\)\.&+]/g, "").trim().replace(/\s+/g, " ");
  const c = lead.categories || [];
  const tag = `${profile.experience || "2"} YoE`;
  const name = profile.name || "Sahil Vashisht";
  return `Application: ${r} | ${name} — ${getRD(c)} | ${getTagline(c)} | ${tag}`;
}

function genBody(lead, profile) {
  const c = lead.categories || [];
  const rf = (lead.name || "").split(" ")[0];
  const greeting = (rf && rf !== "Hiring" && rf !== "Manager" && rf.length > 1) ? `Dear ${escape(rf)},` : "Dear Hiring Manager,";
  const rd = getRD(c);
  const sk = getSkillBlock(c);
  const ct = getCertBlock(c);
  const name = escape(profile.name);
  const role = escape(lead.role || "this opening");

  const introLine = isAIFlavor(c)
    ? `AI Engineer with ${escape(profile.experience || "2")} years of production experience building LLM-powered applications, agentic AI systems, and RAG pipelines using LangChain, LangGraph, AWS Bedrock, and Azure OpenAI`
    : isDataFlavor(c)
    ? `Data + AI Engineer with ${escape(profile.experience || "2")} years building NL-to-SQL engines, real-time analytics pipelines, and schema-aware GenAI integrations over Snowflake and Azure OpenAI`
    : `Full Stack Developer with ${escape(profile.experience || "2")} years of production experience architecting REST APIs in ASP.NET Core and Spring Boot, building scalable React/TypeScript frontends, and delivering enterprise integrations end-to-end`;

  const aiHighlights = `
  <li><strong>Autonomous AI Code Review Agent</strong> — Built self-correcting agentic system (GPT-4o + LangGraph + ReAct loops); 87% precision on 200 real-world PRs.</li>
  <li><strong>Multi-Modal Customer Support Agent</strong> — Voice-to-text agent (Whisper + Claude 3 + hybrid RAG on Pinecone) with multi-agent handoff &amp; guardrails, serverless on AWS Lambda.</li>
  <li><strong>Real-Time Financial Intelligence Platform</strong> — NL-to-SQL engine (Azure OpenAI + Snowflake Cortex); reduced analyst query time by 60%.</li>
  <li><strong>10+ production APIs</strong> at PodTech using LLM function-calling — reduced manual processing time by 35%.</li>
  <li><strong>Led WLS enterprise integration</strong> — 5-developer team, 100% on-time delivery.</li>
  `.trim();

  const fsHighlights = `
  <li><strong>Led WLS enterprise integration end-to-end</strong> at PodTech — managed 5 developers, owned system architecture, delivered 100% on-time under strict client deadlines.</li>
  <li><strong>Architected 35+ production REST APIs</strong> across ASP.NET Core 8 and Spring Boot — serving thousands of daily requests.</li>
  <li><strong>Reduced API response time by 20% &amp; data processing efficiency by 30%</strong> at LTIMindtree via systematic refactoring and indexing.</li>
  <li><strong>Engineered complex .NET file handling &amp; command processors</strong> — streamlined data operations, 35% processing time reduction.</li>
  <li><strong>Built reusable React + Redux component libraries</strong> with TypeScript and dynamic API-driven data visualization.</li>
  `.trim();

  const highlights = isAIFlavor(c) || isDataFlavor(c) ? aiHighlights : fsHighlights;

  const headlineBadge = isAIFlavor(c)
    ? "2 YoE · LangChain · LangGraph · AWS Bedrock · Azure OpenAI"
    : isDataFlavor(c)
    ? "2 YoE · Snowflake · Azure OpenAI · NL-to-SQL"
    : "2 YoE · ASP.NET Core · Spring Boot · React · 35+ APIs";

  return `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.55">
<h2 style="margin:0 0 4px">${name}</h2>
<p style="margin:0 0 16px;color:#555;font-size:14px">${escape(rd)} | ${escape(profile.degree)}, ${escape(profile.college)} (${escape(profile.gradYear)}) | ${headlineBadge}</p>
<p>${greeting}</p>
<p>I came across the <strong>${role}</strong> opening and I am excited to apply. I am an ${introLine} — available to join immediately.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0">
  <tr><td><strong>Experience</strong></td><td>${escape(profile.experience || "2")} years — PodTech (Full Stack · AI-Integrated Systems) + LTIMindtree (Software Developer)</td></tr>
  <tr><td><strong>Qualification</strong></td><td>${escape(profile.degree)} — ${escape(profile.college)} (${escape(profile.gradYear)}) | CGPA 8.47</td></tr>
  <tr><td><strong>Key Achievement</strong></td><td>Led WLS enterprise integration — 5-dev team, 100% on-time, 35+ production APIs</td></tr>
  <tr><td><strong>Expected CTC</strong></td><td>As per industry standards / negotiable</td></tr>
  <tr><td><strong>Availability</strong></td><td>30-day notice — ${escape(profile.location)}</td></tr>
</table>
<h3 style="margin:18px 0 6px">Skills &amp; Expertise</h3>
<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:0;font-size:14px">${escape(sk)}</pre>
<h3 style="margin:18px 0 6px">Key Highlights</h3>
<ul style="margin:0;padding-left:18px">
${highlights}
</ul>
<h3 style="margin:18px 0 6px">Credentials</h3>
<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:0;font-size:14px">${escape(ct)}</pre>
<p style="margin-top:16px">I would love the opportunity to contribute to your team. My resume is linked below.</p>
<p>I bring strong production engineering, ownership across the full stack, and a track record of measurable KPI improvements.</p>
<p><a href="${escape(profile.resumeLink)}">VIEW RESUME</a> · <a href="${escape(profile.linkedin)}">LINKEDIN</a> · <a href="https://github.com/sahil00000001">GITHUB</a></p>
<p>Thank you for your time.</p>
<p>Warm regards,<br/><strong>${name}</strong><br/>${escape(rd)} | ${escape(profile.degree)}, ${escape(profile.college)} (${escape(profile.gradYear)})<br/>${escape(profile.email)} | +91 ${escape(profile.phone)} | ${escape(profile.location)}, India</p>
<p style="font-size:12px;color:#888">In response to a position posted on LinkedIn · Resume</p>
</div>`;
}

export const sahilPack = {
  id: "sahil",
  displayName: "Sahil Vashisht",
  shortName: "Sahil",
  tagline: "AI Engineer · 2 YoE · LangChain · RAG · Full Stack",
  emoji: "🚀",
  color: "#4A3AFF",
  defaultProfile: {
    name: "Sahil Vashisht",
    email: "vashishtsahil99@gmail.com",
    phone: "9625107920",
    linkedin: "https://www.linkedin.com/in/sahilvashisht00/",
    location: "New Delhi",
    resumeLink: "",
    gradYear: "2024",
    degree: "BTech IT",
    college: "GTBIT",
    experience: "2",
    jobType: "experienced",
  },
  categories: CATEGORIES,
  categoryColors: CATEGORY_COLORS,
  detectCategories,
  genSubject,
  genBody,
};
