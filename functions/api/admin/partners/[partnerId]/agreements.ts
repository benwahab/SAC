import { requireSuperAdminSession } from "../../../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../../lib/security/json-request-body.ts";
interface Env { DB:D1Database; }
const H={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:H});
const str=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export const onRequestGet:PagesFunction<Env>=async({request,env,params})=>{
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const partnerId=typeof params.partnerId==="string"?params.partnerId:"";
 try{const rows=await env.DB.prepare("SELECT id,public_reference,title,purpose,legal_status,operational_status,starts_on,ends_on,current_version,created_at,updated_at FROM partner_agreements WHERE organization_id=? ORDER BY updated_at DESC").bind(partnerId).all<Record<string,unknown>>();return json({agreements:rows.results??[]})}catch{return json({error:"agreement_service_unavailable"},503)}
};
export const onRequestPost:PagesFunction<Env>=async({request,env,params})=>{
 const guard=guardSameOriginJsonPost(request);if(guard)return guard;
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const partnerId=typeof params.partnerId==="string"?params.partnerId:"";
 const parsed=await readJsonRequestBody(request,30000);if(!parsed.ok||typeof parsed.value!=="object"||parsed.value===null||Array.isArray(parsed.value))return json({error:"invalid_request"},400);
 const v=parsed.value as Record<string,unknown>,title=str(v.title,180),purpose=str(v.purpose,4000),obligations=str(v.obligations,6000),deliverables=str(v.deliverables,6000),startsOn=str(v.startsOn,10)||null,endsOn=str(v.endsOn,10)||null;
 if(!title)return json({error:"agreement_title_required"},400);
 if(startsOn&&!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)||endsOn&&!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)||startsOn&&endsOn&&endsOn<startsOn)return json({error:"invalid_agreement_dates"},400);
 const now=Date.now(),id=crypto.randomUUID(),reference="SAC-CONV-"+new Date(now).toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
 try{const partner=await env.DB.prepare("SELECT id FROM partner_organizations WHERE id=?").bind(partnerId).first();if(!partner)return json({error:"partner_not_found"},404);
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO partner_agreements (id,public_reference,organization_id,title,purpose,legal_status,operational_status,starts_on,ends_on,current_version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,'draft','planned',?,?,1,?,?,?,?)").bind(id,reference,partnerId,title,purpose,startsOn,endsOn,admin.value.accountId,admin.value.accountId,now,now),
 env.DB.prepare("INSERT INTO partner_agreement_versions (id,agreement_id,version_number,title,purpose,obligations,deliverables,starts_on,ends_on,created_by,created_at) VALUES (?,?,1,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,title,purpose,obligations,deliverables,startsOn,endsOn,admin.value.accountId,now),
 env.DB.prepare("INSERT INTO partner_events (id,organization_id,agreement_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?,?,'agreement_created',?,?,?)").bind(crypto.randomUUID(),partnerId,id,"Création d'une convention en brouillon",admin.value.accountId,now),
 env.DB.prepare("INSERT INTO admin_audit_events (id,actor_account_id,actor_device_id,action,scope_key,permission_used,outcome,occurred_at) VALUES (?,?,?,'partner.agreement.created','external','agreements.create','success',?)").bind(crypto.randomUUID(),admin.value.accountId,admin.value.deviceId,now)
 ]);return results.every(x=>x.success)?json({created:true,id,reference},201):json({error:"agreement_save_failed"},503)
 }catch{return json({error:"agreement_save_failed"},503)}
};