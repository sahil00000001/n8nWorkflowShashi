Here's what the app does, all in one place:

**How to use it:**
1. Click the **Profile** button — verify Shashi's details (name, email, LinkedIn, resume link etc. are pre-filled correctly)
2. **Drop any LinkedIn email JSON files** — it processes them all at once
3. See the stats: total found, new vs duplicates, category breakdown
4. Click **Generate workflow** — downloads ready-to-import n8n JSON file(s)

**What it handles automatically:**
- **Deduplication** — tracks every email address ever processed in persistent storage, skips repeats across all sessions (even if you close and reopen the app)
- **Auto-batching** — splits into 400-email files if the count exceeds the limit
- **Category detection** — reads post text and assigns `finance`, `hr`, `analyst`, `operations`, `marketing`, `sales`, `content`, `management`
- **Role-specific subjects** — professional `Application: [Role] | Shashi Vashisht — [Category] | BBA '26` format
- **Clear history** button — resets the dedup memory if needed (e.g. re-sending to everyone)

The `.jsx` file is also saved if you ever want to self-host or modify it.
























import { useState, useRef, useCallback, useEffect } from "react"; const STORAGE_KEY = "job_mailer_sent_emails"; const BATCH_SIZE = 400; const DEFAULT_PROFILE = { name: "Shashi Vashisht", email: "shashivash.bba2023ea@rdias.ac.in", phone: "9818710014", linkedin: "https://www.linkedin.com/in/shashi-vashisht-0a13a5348/", location: "New Delhi", resumeLink: "https://drive.google.com/file/d/1EgfW4MOmNTUT7H9mYQSrTAXUP4lBvaRA/view?usp=sharing", gradYear: "2026", degree: "BBA", college: "RDIAS", experience: "", jobType: "fresher", }; function sanitize(s) { return (s||"").replace(/[\uD800-\uDFFF]/g,"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\n|\r/g," ").trim(); } function getCategories(postText) { const t=(postText||"").toLowerCase(); const cats=[]; if(/finance|accounts|accountant|gst|taxation|invoice|tally|financial|cfo/.test(t)) cats.push("finance"); if(/business analyst|business analysis|mis\b|data analyst|analytics|market research/.test(t)) cats.push("analyst"); if(/\boperations\b|ops |supply chain|logistics|procurement/.test(t)) cats.push("operations"); if(/marketing|digital marketing|social media|content market|growth\b|seo\b|campaign/.test(t)) cats.push("marketing"); if(/\bhr\b|human resource|recruiter|talent|people ops|hrbp|payroll|onboarding|recruitment/.test(t)) cats.push("hr"); if(/content writ|content creat|copywrite|copywriting|\bblog\b|writing|editor/.test(t)) cats.push("content"); if(/management trainee|mt program|bba|mba|trainee|fresher|graduate|campus/.test(t)) cats.push("management"); if(/\bsales\b|business develop|\bbd\b|client|account manager|\bcrm\b/.test(t)) cats.push("sales"); return cats.length?cats:["management"]; } function extractRole(postText) { const lines=(postText||"").split("\n").map(l=>l.trim()).filter(Boolean); for(const line of lines.slice(0,6)){ const clean=line.replace(/[^\w\s\-\/\(\)&,\.#+]/g,"").trim() .replace(/^(we.re hiring|we are hiring|urgent hiring|hiring alert|hiring|join us|alert)[:\-|!\s]*/i,"").trim() .replace(/#\w+/g,"").trim().replace(/\s+/g," "); if(clean.length>5&&clean.length<80) return clean; } return "Business & Finance Opportunity"; } function cleanName(name) { return (name||"").replace(/premium profile|\b2nd\b|\b3rd\+\b|• 2nd|• 3rd\+|, hiring|hiring manager/gi,"").trim().replace(/^[,.\s]+|[,.\s]+$/g,"")||"Hiring Manager"; } function generateWorkflowCode(profile, entries) { const jsArr="[\n"+entries.map(e=>` {email:'${sanitize(e.email)}',recruiter:'${sanitize(e.recruiter)}',role:'${sanitize(e.role)}',categories:${JSON.stringify(e.categories)}}`).join(",\n")+"\n]"; const isFresher=profile.jobType==="fresher"; return `const YOUR_NAME="${sanitize(profile.name)}"; const YOUR_EMAIL="${sanitize(profile.email)}"; const YOUR_PHONE="${sanitize(profile.phone)}"; const YOUR_LINKEDIN="${sanitize(profile.linkedin)}"; const YOUR_LOCATION="${sanitize(profile.location)}"; const RESUME_LINK="${sanitize(profile.resumeLink)}"; const GRAD_YEAR="${sanitize(profile.gradYear)}"; const DEGREE="${sanitize(profile.degree)}"; const COLLEGE="${sanitize(profile.college)}"; const EXP="${sanitize(profile.experience)}"; const IS_FRESHER=${isFresher}; const jobListings=${jsArr}; function getCertBlock(c){ const finance=["GST Filing & Taxation — Valeur Fabtex Pvt Ltd","Financial Modelling & MIS Reporting — Internship"]; const business=["Tata GenAI-Powered Data Analytics — Forage, 2025","AWS Cloud Practitioner Essentials — AWS, 2025"]; const awards=["Best Presenter Award (2026) — Research Presentation","1st Prize — Best Out of Waste, Razmaataz"]; const tools=["Microsoft Excel (Advanced) — Dashboards & Reporting","Google Workspace Suite — Docs, Sheets, Slides"]; let o; if(c.includes("finance")) o=[...finance,...tools,...business,...awards]; else if(c.includes("analyst")) o=[...business,...finance,...tools,...awards]; else if(c.includes("marketing")||c.includes("content")) o=[...awards,...tools,...business,...finance]; else o=[...awards,...finance,...tools,...business]; return o.map((cert,i)=>\`\${i+1}. \${cert}\`).join(""); } function getSkillBlock(c){ const b=[]; b.push(["Finance & Accounting","Financial Modelling, MIS Reporting, Variance Analysis, GST Filing, Invoice Processing, Accounts Reconciliation."]); b.push(["Business Analysis","Market Research, SWOT/SWOC Analysis, KPI Tracking, Competitive Intelligence, Data Interpretation."]); if(c.includes("analyst")||c.includes("operations")) b.push(["Operations & Process","SOP Development, Process Optimisation, Project Documentation, Cross-functional Collaboration."]); if(c.includes("marketing")||c.includes("content")) b.push(["Content & Communication","SEO-optimised writing, Report Drafting, Persuasive Copywriting, Audience Engagement."]); if(c.includes("hr")||c.includes("management")||c.includes("sales")) b.push(["Stakeholder Management","Client Interaction, Team Coordination, Strategic Planning, Presentation Design."]); if(c.includes("finance")) b.push(["Taxation & Compliance","GST Filing, Invoice Preparation, Compliance Workflows, Statutory Reporting."]); b.push(["Tools","Microsoft Excel (Advanced), PowerPoint, Word, Google Sheets, Docs, Slides."]); return b.map(([sk,desc])=>\`\${sk}
\${desc}\`).join(""); } function genSubject(j){ const r=j.role.replace(/[^\\w\\s\\-\\/\\(\\)\\.&\\+]/g,'').trim().replace(/\\s+/g,' '); const c=j.categories; const tag=IS_FRESHER?\`\${DEGREE} '\${GRAD_YEAR.slice(-2)}\`:\`\${EXP} YOE\`; if(c.includes("finance")&&c.includes("analyst")) return\`Application: \${r} | \${YOUR_NAME} — Finance & Business Analysis | \${tag} | Available Now\`; if(c.includes("finance")) return\`Application: \${r} | \${YOUR_NAME} — Finance & Accounts | GST · MIS · Modelling | \${tag}\`; if(c.includes("analyst")) return\`Application: \${r} | \${YOUR_NAME} — Business Analyst | Research · KPI · Reporting | \${tag}\`; if(c.includes("hr")) return\`Application: \${r} | \${YOUR_NAME} — HR & Talent Ops | Best Presenter '26 | \${tag}\`; if(c.includes("operations")) return\`Application: \${r} | \${YOUR_NAME} — Operations & Strategy | Process Optimisation | \${tag}\`; if(c.includes("marketing")) return\`Application: \${r} | \${YOUR_NAME} — Marketing & Research | Content · Brand | \${tag}\`; if(c.includes("sales")) return\`Application: \${r} | \${YOUR_NAME} — Sales & BD | Communication · CRM | \${tag}\`; if(c.includes("content")) return\`Application: \${r} | \${YOUR_NAME} — Content & Communication | Writing · Research | \${tag}\`; return\`Application: \${r} | \${YOUR_NAME} — Management Trainee | \${tag} | Best Presenter Award | Available Now\`; } function getRD(c){ if(c.includes("finance")&&c.includes("analyst")) return"Finance & Business Analyst"; if(c.includes("finance")) return"Finance & Accounts Executive"; if(c.includes("analyst")) return"Business Analyst"; if(c.includes("hr")) return"HR & Talent Operations"; if(c.includes("operations")) return"Operations & Strategy Associate"; if(c.includes("marketing")) return"Marketing & Research Associate"; if(c.includes("sales")) return"Sales & Business Development"; if(c.includes("content")) return"Content & Communication Specialist"; return"Management Trainee / Business Graduate"; } function genBody(j){ const rf=j.recruiter.split(' ')[0]; const g=(rf&&rf!=="Hiring"&&rf!=="Manager"&&rf.length>1)?\`Dear \${rf},\`:"Dear Hiring Manager,"; const sk=getSkillBlock(j.categories); const ct=getCertBlock(j.categories); const rd=getRD(j.categories); const expLine=IS_FRESHER ?\`final-year \${DEGREE} student at \${COLLEGE} (graduating \${GRAD_YEAR}) with hands-on internship experience in finance operations, market research, and MIS reporting\` :\`\${EXP} years experienced professional in \${rd}\`; return \`
\${YOUR_NAME}
\${rd} | \${DEGREE}, \${COLLEGE} (\${GRAD_YEAR}) | Best Presenter 2026 | Available Immediately

\${g}

I came across the \${j.role} opening and I am excited to apply. I am a \${expLine} — available to join immediately.

Qualification	\${DEGREE} — \${COLLEGE} | Expected \${GRAD_YEAR}
Internship Experience	5 months — Finance (Valeur Fabtex) + Content (Aashman Foundation)
Key Achievement	Best Presenter Award 2026
Expected CTC	As per company standards
Availability	Immediately Available — \${YOUR_LOCATION}
Skills & Expertise
\${sk}
Key Highlights
► Best Presenter Award (2026) — High-impact analytical research presentation
► Delivered financial models & MIS reports — Valeur Fabtex Pvt Ltd
► GST filing, invoice processing & compliance workflows — hands-on taxation exposure
► 1st Prize — Best Out of Waste, Razmaataz (creative execution & teamwork)
Credentials
\${ct}
I would love the opportunity to contribute to your team. My resume is linked below.

I bring strong analytical thinking, a proactive attitude, and the ability to deliver from day one.

VIEW RESUMELINKEDIN
Thank you for your time.

Warm regards,

\${YOUR_NAME}
\${rd} | \${DEGREE}, \${COLLEGE} (\${GRAD_YEAR})
\${YOUR_EMAIL} | +91 \${YOUR_PHONE} | \${YOUR_LOCATION}, India
In response to a position posted on LinkedIn · Resume

\`; } const output=jobListings.map(j=>({json:{from:YOUR_EMAIL,to:j.email,subject:genSubject(j),html:genBody(j),recruiter:j.recruiter,role:j.role}})); return output;`; } function buildWorkflow(profile,entries,batchNum,totalBatches){ const code=generateWorkflowCode(profile,entries); return { name:`${profile.name} – Job Mailer${totalBatches>1?` Batch ${batchNum}/${totalBatches}`:""} (${entries.length} emails)`, nodes:[ {id:"t1",name:"▶️ Start",type:"n8n-nodes-base.manualTrigger",typeVersion:1,position:[200,400],parameters:{}}, {id:"c1",name:"📧 Format Emails",type:"n8n-nodes-base.code",typeVersion:2,position:[460,400],parameters:{jsCode:code}}, {id:"b1",name:"🔄 One At A Time",type:"n8n-nodes-base.splitInBatches",typeVersion:3,position:[740,400],parameters:{batchSize:1,options:{}}}, {id:"s1",name:"📬 Gmail SMTP",type:"n8n-nodes-base.emailSend",typeVersion:2.1,position:[1020,400], parameters:{fromEmail:"={{ $json.from }}",toEmail:"={{ $json.to }}",subject:"={{ $json.subject }}",emailType:"html",html:"={{ $json.html }}",options:{allowUnauthorizedCerts:false,appendAttribution:false}}, credentials:{smtp:{id:"YOUR_SMTP_CREDENTIAL_ID",name:"Gmail SMTP"}}}, {id:"w1",name:"⏱️ Wait 10s",type:"n8n-nodes-base.wait",typeVersion:1.1,position:[1020,600],parameters:{amount:10,unit:"seconds"}}, {id:"n1",name:"📋 Info",type:"n8n-nodes-base.stickyNote",typeVersion:1,position:[140,120], parameters:{content:`## ${profile.name} — Batch ${batchNum}/${totalBatches}\n\n📨 **${entries.length} emails** pre-loaded\n✅ Deduplicated\n✅ Role-specific subjects\n\n1. Configure Gmail SMTP\n2. Execute`,width:340,height:180}} ], connections:{ "▶️ Start":{main:[[{node:"📧 Format Emails",type:"main",index:0}]]}, "📧 Format Emails":{main:[[{node:"🔄 One At A Time",type:"main",index:0}]]}, "🔄 One At A Time":{main:[null,[{node:"📬 Gmail SMTP",type:"main",index:0}]]}, "📬 Gmail SMTP":{main:[[{node:"⏱️ Wait 10s",type:"main",index:0}]]}, "⏱️ Wait 10s":{main:[[{node:"🔄 One At A Time",type:"main",index:0}]]} }, settings:{executionOrder:"v1"},meta:{templateCredsSetupCompleted:true} }; } const CAT_COLORS={finance:"#1D9E75",analyst:"#378ADD",hr:"#D4537E",operations:"#BA7517",marketing:"#7F77DD",sales:"#D85A30",content:"#5DCAA5",management:"#888780"}; export default function App(){ const [profile,setProfile]=useState(DEFAULT_PROFILE); const [showProfile,setShowProfile]=useState(false); const [sentEmails,setSentEmails]=useState(new Set()); const [storageLoaded,setStorageLoaded]=useState(false); const [processedEntries,setProcessedEntries]=useState([]); const [stats,setStats]=useState(null); const [dragging,setDragging]=useState(false); const [generating,setGenerating]=useState(false); const [generated,setGenerated]=useState([]); const [toast,setToast]=useState(null); const fileRef=useRef(); useEffect(()=>{ (async()=>{ try{ const res=await window.storage.get(STORAGE_KEY); if(res?.value){ const arr=JSON.parse(res.value); setSentEmails(new Set(arr)); } }catch{} setStorageLoaded(true); })(); },[]); const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); }; const processFiles=useCallback(async(files)=>{ const all=[]; for(const file of files){ try{ const text=await file.text(); const data=JSON.parse(text); if(!Array.isArray(data)) continue; for(const item of data){ for(const email of (item.emails||[])){ const e=email.trim(); if(e&&e.includes("@")) all.push({email:e,rawName:item.name||"",postText:item.post_text||""}); } } }catch{ showToast(`Could not parse ${file.name}`,"error"); } } let dupes=0,newCount=0; const entries=[]; const seen=new Set(sentEmails); for(const item of all){ if(seen.has(item.email.toLowerCase())){dupes++;continue;} seen.add(item.email.toLowerCase()); newCount++; entries.push({email:item.email,recruiter:cleanName(item.rawName),role:extractRole(item.postText),categories:getCategories(item.postText)}); } const catCounts={}; for(const e of entries) for(const c of e.categories) catCounts[c]=(catCounts[c]||0)+1; setProcessedEntries(entries); setStats({total:all.length,newCount,dupes,catCounts,batches:Math.ceil(entries.length/BATCH_SIZE)}); setGenerated([]); if(newCount>0) showToast(`${newCount} new · ${dupes} duplicates skipped`); else showToast("All emails were duplicates — nothing new!","error"); },[sentEmails]); const handleDrop=useCallback((e)=>{ e.preventDefault(); setDragging(false); processFiles([...e.dataTransfer.files].filter(f=>f.name.endsWith(".json"))); },[processFiles]); const generateWorkflows=async()=>{ if(!processedEntries.length) return; setGenerating(true); const batches=[]; for(let i=0;i({ name:batches.length>1?`Batch ${idx+1} of ${batches.length}`:"Workflow", count:batch.length, blob:new Blob([JSON.stringify(buildWorkflow(profile,batch,idx+1,batches.length),null,2)],{type:"application/json"}), filename:batches.length>1?`${profile.name.replace(/\s+/g,"_")}_batch${idx+1}.json`:`${profile.name.replace(/\s+/g,"_")}_mailer.json` })); setGenerated(wfs); const newSent=new Set(sentEmails); for(const e of processedEntries) newSent.add(e.email.toLowerCase()); setSentEmails(newSent); try{ await window.storage.set(STORAGE_KEY,JSON.stringify([...newSent])); }catch{} setGenerating(false); showToast(`${wfs.length} workflow${wfs.length>1?"s":""} ready!`); }; const downloadWorkflow=(wf)=>{ const url=URL.createObjectURL(wf.blob); const a=document.createElement("a"); a.href=url; a.download=wf.filename; a.click(); URL.revokeObjectURL(url); }; const clearHistory=async()=>{ setSentEmails(new Set()); try{await window.storage.delete(STORAGE_KEY);}catch{} showToast("History cleared"); }; const pf=(key,val)=>setProfile(p=>({...p,[key]:val})); const FIELDS=[ ["name","Full name"],["email","Email"],["phone","Phone"], ["location","Location"],["degree","Degree"],["college","College"],["gradYear","Grad year"], ]; return(
n8n job mailer builder
{toast&&(
{toast.msg}
)}
Job mailer builder
Upload LinkedIn files → auto-dedup → generate n8n workflows

{storageLoaded&&sentEmails.size>0&&( {sentEmails.size} tracked )} setShowProfile(p=>!p)} style={{fontSize:13,display:"flex",alignItems:"center",gap:6}}> {showProfile?"Hide":"Profile"}
{showProfile&&(
Profile

{["fresher","experienced"].map(t=>( pf("jobType",t)}/> {t.charAt(0).toUpperCase()+t.slice(1)} ))}
{FIELDS.map(([k,label])=>(
{label} 
{profile[k]}
pf(k,e.target.value)} style={{width:"100%",fontSize:13,boxSizing:"border-box"}}/>
))} {profile.jobType==="experienced"&&(
Experience (e.g. 1.6) 
{profile.experience}
pf("experience",e.target.value)} style={{width:"100%",fontSize:13,boxSizing:"border-box"}}/>
)}
LinkedIn URL 
{profile.linkedin}
pf("linkedin",e.target.value)} style={{width:"100%",fontSize:13,boxSizing:"border-box"}}/>
Resume link (Google Drive) 
{profile.resumeLink}
pf("resumeLink",e.target.value)} style={{width:"100%",fontSize:13,boxSizing:"border-box"}}/>
)}
{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onClick={()=>fileRef.current.click()} style={{border:`1.5px dashed ${dragging?"var(--color-border-primary)":"var(--color-border-secondary)"}`,borderRadius:"var(--border-radius-lg)",padding:"2.5rem",textAlign:"center",cursor:"pointer",background:dragging?"var(--color-background-secondary)":"transparent",transition:"background 0.15s",marginBottom:"1.25rem"}} >
Drop LinkedIn email JSON files here

Multiple files supported · duplicates skipped automatically

No file chosen{if(e.target.files?.length)processFiles([...e.target.files]);e.target.value="";}} style={{display:"none"}}/>
{stats&&(
{[["Total found",stats.total,"ti-database",null],["New emails",stats.newCount,"ti-mail","success"],["Duplicates skipped",stats.dupes,"ti-copy","warning"],["Batches needed",stats.batches,"ti-layers",null]].map(([label,val,icon,sem])=>(
{val}

{label}

))}
{Object.keys(stats.catCounts).length>0&&(
Category breakdown

{Object.entries(stats.catCounts).sort((a,b)=>b[1]-a[1]).map(([cat,count])=>( {cat} · {count} ))}
)} {stats.newCount>0&&( {generating?"Generating...":stats.batches>1?`Generate ${stats.batches} workflow files (${stats.newCount} emails)`:`Generate workflow (${stats.newCount} emails)`} )}
)} {generated.length>0&&(
Ready — import into n8n, connect Gmail SMTP, execute

{generated.map((wf,i)=>(
{wf.name}

{wf.count} emails · {wf.filename}

downloadWorkflow(wf)} style={{fontSize:13,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}> Download
))}
{sentEmails.size} emails saved to memory — future uploads skip them automatically

)} {storageLoaded&&sentEmails.size>0&&(
{sentEmails.size} emails in dedup history · persists across sessions

Clear history
)}
); }