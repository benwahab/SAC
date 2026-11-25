import { requireSuperAdminSession } from "../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const H = { "Cache-Control":"no-store", "Content-Type":"application/json; charset=utf-8", "X-Content-Type-Options":"nosniff" };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const object=(v:unknown):v is Record<string,unknown>=>typeof v==="object"&&v!==null&&!Array.isArray(v);

export const onRequestGet: PagesFunction<Env> = async ({request,env}) => {
 const admin=await requireSuperAdminSession(request,env.DB);
 if(!admin.ok) return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 try {
  const result=await env.DB.prepare(`SELECT t.id,t.mission_id,t.assigned_account_id,t.title,t.description,t.status,t.due_at,t.created_at,t.updated_at,t.version,m.scope_key
   FROM admin_mission_tasks t JOIN admin_missions m ON m.id=t.mission_id
   ORDER BY CASE t.status WHEN 'blocked' THEN 0 WHEN 'submitted' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,t.due_at,t.created_at DESC LIMIT 500`).all();
  if(!result.success) return json({error:"service_unavailable"},503);
  return json({tasks:result.results??[]});
 } catch { return json({error:"service_unavailable"},503); }
};

export const onRequestPost: PagesFunction<Env> = async ({request,env}) => {
 const origin=guardSameOriginJsonPost(request); if(origin) return origin;
 const admin=await requireSuperAdminSession(request,env.DB);
 if(!admin.ok) return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const parsed=await readJsonRequestBody(request,8192);
 if(!parsed.ok) return json({error:"invalid_request"},400);
 if(!object(parsed.value)) return json({error:"invalid_task"},400);
 const b=parsed.value;
 const missionId=b.missionId, title=b.title, description=b.description??"", dueAt=b.dueAt??null;
 if(typeof missionId!=="string"||missionId.length>128||typeof title!=="string"||!title.trim()||title.trim().length>180||
 typeof description!=="string"||description.length>4000||
 (dueAt!==null&&(typeof dueAt!=="number"||!Number.isSafeInteger(dueAt)||dueAt<=Date.now())))
 return json({error:"invalid_task"},400);
 try {
  const mission=await env.DB.prepare("SELECT id,assigned_account_id,status FROM admin_missions WHERE id=?").bind(missionId).first<{id:string;assigned_account_id:string;status:string}>();
  if(!mission||mission.status!=="active") return json({error:"mission_not_active"},404);
  const id=crypto.randomUUID(), now=Date.now();
  const result=await env.DB.batch([
   env.DB.prepare("INSERT INTO admin_mission_tasks(id,mission_id,assigned_account_id,title,description,status,due_at,created_by_account_id,created_at,updated_at,version) VALUES(?,?,?,?,?,'todo',?,?,?, ?,1)").bind(id,missionId,mission.assigned_account_id,title.trim(),description,dueAt,admin.value.accountId,now,now),
   env.DB.prepare("INSERT INTO admin_mission_task_events(id,task_id,actor_account_id,from_status,to_status,note,occurred_at) VALUES(?,?,?,NULL,'todo','Task created',?)").bind(crypto.randomUUID(),id,admin.value.accountId,now)
  ]);
  if(result.some(x=>!x.success)) return json({error:"service_unavailable"},503);
  return json({created:true,id,status:"todo"},201);
 } catch { return json({error:"service_unavailable"},503); }
};
