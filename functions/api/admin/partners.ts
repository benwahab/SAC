import { requireSuperAdminSession } from "../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
interface Env { DB: D1Database; }
const H={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:H});
const str=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const statuses=["prospect","discussion","active","suspended","ended"];
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const q=str(new URL(request.url).searchParams.get("q"),120);
 try{const rows=await env.DB.prepare("SELECT p.id,p.public_reference,p.official_name,p.organization_type,p.country_code,p.intervention_area,p.relationship_status,p.cooperation_domain,p.objectives,p.entered_at,p.last_activity_at,p.updated_at,(SELECT COUNT(*) FROM partner_agreements a WHERE a.organization_id=p.id) AS agreement_count FROM partner_organizations p WHERE (?='' OR p.official_name LIKE '%'||?||'%' OR p.public_reference LIKE '%'||?||'%') ORDER BY p.updated_at DESC LIMIT 200").bind(q,q,q).all<Record<string,unknown>>();return json({partners:rows.results??[]})}catch{return json({error:"partner_service_unavailable"},503)}
};
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
 const guard=guardSameOriginJsonPost(request);if(guard)return guard;
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const parsed=await readJsonRequestBody(request,30000);if(!parsed.ok||typeof parsed.value!=="object"||parsed.value===null||Array.isArray(parsed.value))return json({error:"invalid_request"},400);
 const v=parsed.value as Record<string,unknown>,name=str(v.officialName,180),type=str(v.organizationType,60),country=str(v.countryCode,2).toUpperCase(),status=str(v.relationshipStatus,20)||"prospect";
 if(!name||!type||!/^[A-Z]{2}$/.test(country)||!statuses.includes(status))return json({error:"invalid_partner"},400);
 const now=Date.now(),id=crypto.randomUUID(),reference="SAC-PAR-"+new Date(now).toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
 try{const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO partner_organizations (id,public_reference,official_name,organization_type,country_code,intervention_area,relationship_status,cooperation_domain,objectives,source,entered_at,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?)").bind(id,reference,name,type,country,str(v.interventionArea,240),status,str(v.cooperationDomain,180),str(v.objectives,4000),str(v.source,180),now,admin.value.accountId,admin.value.accountId,now,now),
 env.DB.prepare("INSERT INTO admin_audit_events (id,actor_account_id,actor_device_id,action,scope_key,permission_used,outcome,occurred_at) VALUES (?,?,?,'partner.created','external','partners.create','success',?)").bind(crypto.randomUUID(),admin.value.accountId,admin.value.deviceId,now),
 env.DB.prepare("INSERT INTO partner_events (id,organization_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?, 'created', ?, ?, ?)").bind(crypto.randomUUID(),id,"Création de la fiche partenaire",admin.value.accountId,now)
 ]);if(results.some(x=>!x.success))return json({error:"partner_save_failed"},503);return json({created:true,id,reference},201)}catch{return json({error:"partner_save_failed"},503)}
};