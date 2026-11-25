import { requireSuperAdminSession } from "../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
interface Env{DB:D1Database}
const H={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:H});
const str=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const statuses=["proposed","planned","active","on_hold","completed","cancelled"],priorities=["low","normal","high","critical"],milestoneStatuses=["pending","in_progress","completed","delayed","cancelled"];
const validDate=(v:string)=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z")));
const ref=()=> "SAC-PRJ-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const q=str(new URL(request.url).searchParams.get("q"),120);
 try{const [projects,milestones,risks,events,summary]=await Promise.all([
 env.DB.prepare("SELECT id,public_reference,title,description,project_status,priority,progress_percent,starts_on,ends_on,created_at,updated_at FROM initiatives WHERE (?='' OR title LIKE '%'||?||'%' OR public_reference LIKE '%'||?||'%') ORDER BY updated_at DESC LIMIT 200").bind(q,q,q).all<Record<string,unknown>>(),
 env.DB.prepare("SELECT m.id,m.project_id,m.title,m.description,m.due_on,m.milestone_status,m.created_at,m.updated_at FROM project_milestones m INNER JOIN initiatives p ON p.id=m.project_id WHERE (?='' OR p.title LIKE '%'||?||'%' OR m.title LIKE '%'||?||'%') ORDER BY CASE WHEN m.due_on IS NULL THEN 1 ELSE 0 END,m.due_on LIMIT 500").bind(q,q,q).all<Record<string,unknown>>(),
 env.DB.prepare("SELECT id,project_id,title,description,probability,impact,mitigation_plan,risk_status,review_on,created_at,updated_at FROM project_risks WHERE (?='' OR title LIKE '%'||?||'%') ORDER BY updated_at DESC LIMIT 300").bind(q,q).all<Record<string,unknown>>(),
 env.DB.prepare("SELECT id,project_id,milestone_id,event_type,summary,occurred_at FROM project_events ORDER BY occurred_at DESC LIMIT 100").all<Record<string,unknown>>(),
 env.DB.prepare("SELECT COUNT(*) AS total_projects,SUM(CASE WHEN project_status='active' THEN 1 ELSE 0 END) AS active_projects,SUM(CASE WHEN project_status='completed' THEN 1 ELSE 0 END) AS completed_projects,(SELECT COUNT(*) FROM project_milestones WHERE milestone_status IN ('pending','in_progress','delayed')) AS open_milestones FROM initiatives").first<Record<string,number>>()
 ]);return json({projects:projects.results??[],milestones:milestones.results??[],risks:risks.results??[],events:events.results??[],summary})}catch{return json({error:"project_service_unavailable"},503)}
};
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
 const guard=guardSameOriginJsonPost(request);if(guard)return guard;
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const parsed=await readJsonRequestBody(request,30000);if(!parsed.ok||typeof parsed.value!=="object"||parsed.value===null||Array.isArray(parsed.value))return json({error:"invalid_request"},400);
 const v=parsed.value as Record<string,unknown>,action=str(v.action,30),now=Date.now(),actor=admin.value.accountId;
 const audit=(name:string,permission:string)=>env.DB.prepare("INSERT INTO admin_audit_events (id,actor_account_id,actor_device_id,action,scope_key,permission_used,outcome,occurred_at) VALUES (?,?,?,?,?,?, 'success',?)").bind(crypto.randomUUID(),actor,admin.value.deviceId,name,"steering",permission,now);
 try{
 if(action==="create_project"){
 const title=str(v.title,180),description=str(v.description,5000),status=str(v.status,20)||"proposed",priority=str(v.priority,20)||"normal",start=str(v.startsOn,10),end=str(v.endsOn,10);
 if(!title||!statuses.includes(status)||!priorities.includes(priority)||!validDate(start)||!validDate(end)||start&&end&&end<start)return json({error:"invalid_project"},400);
 const id=crypto.randomUUID(),reference=ref();
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO initiatives (id,public_reference,title,description,project_status,priority,progress_percent,starts_on,ends_on,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,0,?,?,?,?,?,?)").bind(id,reference,title,description,status,priority,start||null,end||null,actor,actor,now,now),
 env.DB.prepare("INSERT INTO project_events (id,project_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?, 'created', ?, ?, ?)").bind(crypto.randomUUID(),id,"Création du projet",actor,now),
 audit("project.created","steering.manage_projects")
 ]);return results.every(x=>x.success)?json({created:true,id,reference},201):json({error:"project_save_failed"},503)
 }
 if(action==="create_milestone"){
 const projectId=str(v.projectId,80),title=str(v.title,180),description=str(v.description,3000),due=str(v.dueOn,10),status=str(v.status,20)||"pending";
 if(!projectId||!title||!milestoneStatuses.includes(status)||!validDate(due))return json({error:"invalid_milestone"},400);
 const project=await env.DB.prepare("SELECT id FROM initiatives WHERE id=?").bind(projectId).first();if(!project)return json({error:"project_not_found"},404);
 const id=crypto.randomUUID();
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO project_milestones (id,project_id,title,description,due_on,milestone_status,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,projectId,title,description,due||null,status,actor,actor,now,now),
 env.DB.prepare("INSERT INTO project_events (id,project_id,milestone_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?,?,'milestone_created',?,?,?)").bind(crypto.randomUUID(),projectId,id,"Création d'un jalon",actor,now),
 audit("project.milestone.created","steering.manage_projects")
 ]);return results.every(x=>x.success)?json({created:true,id},201):json({error:"milestone_save_failed"},503)
 }
 if(action==="update_project"){
 const id=str(v.projectId,80),status=str(v.status,20),progress=Number(v.progressPercent);if(!id||!statuses.includes(status)||!Number.isInteger(progress)||progress<0||progress>100)return json({error:"invalid_project_update"},400);
 const exists=await env.DB.prepare("SELECT id FROM initiatives WHERE id=?").bind(id).first();if(!exists)return json({error:"project_not_found"},404);
 const results=await env.DB.batch([
 env.DB.prepare("UPDATE initiatives SET project_status=?,progress_percent=?,updated_by=?,updated_at=? WHERE id=?").bind(status,progress,actor,now,id),
 env.DB.prepare("INSERT INTO project_events (id,project_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?, 'updated', ?, ?, ?)").bind(crypto.randomUUID(),id,"Mise à jour de l'état et de l'avancement du projet",actor,now),
 audit("project.updated","steering.manage_projects")
 ]);return results.every(x=>x.success)?json({updated:true}):json({error:"project_update_failed"},503)
 }
 if(action==="create_risk"){
 const projectId=str(v.projectId,80),title=str(v.title,180),description=str(v.description,3000),mitigation=str(v.mitigationPlan,4000),probability=Number(v.probability),impact=Number(v.impact),review=str(v.reviewOn,10),status=str(v.status,20)||"open";
 if(!projectId||!title||!Number.isInteger(probability)||probability<1||probability>5||!Number.isInteger(impact)||impact<1||impact>5||!["open","mitigating","accepted","closed"].includes(status)||!validDate(review))return json({error:"invalid_risk"},400);
 const project=await env.DB.prepare("SELECT id FROM initiatives WHERE id=?").bind(projectId).first();if(!project)return json({error:"project_not_found"},404);
 const id=crypto.randomUUID();
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO project_risks (id,project_id,title,description,probability,impact,mitigation_plan,risk_status,review_on,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,projectId,title,description,probability,impact,mitigation,status,review||null,actor,actor,now,now),
 env.DB.prepare("INSERT INTO project_risk_events (id,risk_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?, 'created', ?, ?, ?)").bind(crypto.randomUUID(),id,"Création du risque projet",actor,now),
 audit("project.risk.created","steering.manage_risks")
 ]);return results.every(x=>x.success)?json({created:true,id},201):json({error:"risk_save_failed"},503)
 }
 if(action==="update_risk"){
 const id=str(v.riskId,80),status=str(v.status,20);if(!id||!["open","mitigating","accepted","closed"].includes(status))return json({error:"invalid_risk_update"},400);
 const risk=await env.DB.prepare("SELECT id FROM project_risks WHERE id=?").bind(id).first();if(!risk)return json({error:"risk_not_found"},404);
 const results=await env.DB.batch([
 env.DB.prepare("UPDATE project_risks SET risk_status=?,updated_by=?,updated_at=? WHERE id=?").bind(status,actor,now,id),
 env.DB.prepare("INSERT INTO project_risk_events (id,risk_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?, 'status_changed', ?, ?, ?)").bind(crypto.randomUUID(),id,"Mise à jour du statut du risque",actor,now),
 audit("project.risk.updated","steering.manage_risks")
 ]);return results.every(x=>x.success)?json({updated:true}):json({error:"risk_update_failed"},503)
 }
 if(action==="update_milestone"){
 const id=str(v.milestoneId,80),status=str(v.status,20);if(!id||!milestoneStatuses.includes(status))return json({error:"invalid_milestone_update"},400);
 const milestone=await env.DB.prepare("SELECT id,project_id FROM project_milestones WHERE id=?").bind(id).first<{id:string;project_id:string}>();if(!milestone)return json({error:"milestone_not_found"},404);
 const results=await env.DB.batch([
 env.DB.prepare("UPDATE project_milestones SET milestone_status=?,updated_by=?,updated_at=? WHERE id=?").bind(status,actor,now,id),
 env.DB.prepare("UPDATE initiatives SET updated_at=?,updated_by=? WHERE id=?").bind(now,actor,milestone.project_id),
 env.DB.prepare("INSERT INTO project_events (id,project_id,milestone_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?,?,'milestone_updated',?,?,?)").bind(crypto.randomUUID(),milestone.project_id,id,"Mise à jour du statut d'un jalon",actor,now),
 audit("project.milestone.updated","steering.manage_projects")
 ]);return results.every(x=>x.success)?json({updated:true}):json({error:"milestone_update_failed"},503)
 }
 return json({error:"invalid_action"},400)
 }catch{return json({error:"project_operation_failed"},503)}
};