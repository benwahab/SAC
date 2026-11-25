import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
interface Env { DB:D1Database; }
const H={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const object=(v:unknown):v is Record<string,unknown>=>typeof v==="object"&&v!==null&&!Array.isArray(v);
export const onRequestGet: PagesFunction<Env> = async ({request,env}) => {
 const session=await requireAuthenticatedDeviceSession(request,env.DB);
 if(!session.ok) return json({error:"authentication_required"},session.status);
 try {
  const result=await env.DB.prepare("SELECT id,mission_id,title,description,status,due_at,created_at,updated_at,version FROM admin_mission_tasks WHERE assigned_account_id=? AND status!='done' ORDER BY CASE status WHEN 'blocked' THEN 0 WHEN 'submitted' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,due_at,created_at DESC LIMIT 200").bind(session.value.accountId).all();
  if(!result.success) return json({error:"service_unavailable"},503);
  return json({tasks:result.results??[]});
 } catch { return json({error:"service_unavailable"},503); }
};
export const onRequestPatch: PagesFunction<Env> = async ({request,env}) => {
 const origin=guardSameOriginJsonPost(request); if(origin) return origin;
 const session=await requireAuthenticatedDeviceSession(request,env.DB);
 if(!session.ok) return json({error:"authentication_required"},session.status);
 const parsed=await readJsonRequestBody(request,8192);
 if(!parsed.ok||!object(parsed.value)) return json({error:"invalid_request"},400);
 const {taskId,status,note=""}=parsed.value;
 if(typeof taskId!=="string"||taskId.length>128||!["in_progress","blocked","submitted"].includes(String(status))||typeof note!=="string"||note.length>4000) return json({error:"invalid_task_update"},400);
 try {
  const task=await env.DB.prepare("SELECT id,status FROM admin_mission_tasks WHERE id=? AND assigned_account_id=?").bind(taskId,session.value.accountId).first<{id:string;status:string}>();
  if(!task) return json({error:"task_not_found"},404);
  if(task.status==="done") return json({error:"task_closed"},409);
  const now=Date.now();
  const result=await env.DB.batch([
   env.DB.prepare("UPDATE admin_mission_tasks SET status=?,updated_at=?,version=version+1 WHERE id=? AND assigned_account_id=? AND version=(SELECT version FROM admin_mission_tasks WHERE id=?)").bind(status,now,taskId,session.value.accountId,taskId),
   env.DB.prepare("INSERT INTO admin_mission_task_events(id,task_id,actor_account_id,from_status,to_status,note,occurred_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),taskId,session.value.accountId,task.status,status,note,now)
  ]);
  if(result.some(x=>!x.success)) return json({error:"service_unavailable"},503);
  return json({updated:true,status});
 } catch { return json({error:"service_unavailable"},503); }
};
