import { requireSuperAdminSession } from "../../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";
interface Env { DB: D1Database; }
const H={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:H});
const str=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const statuses=["prospect","discussion","active","suspended","ended"];
export const onRequestGet:PagesFunction<Env>=async({request,env,params})=>{
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const id=typeof params.partnerId==="string"?params.partnerId:"";
 try{const partner=await env.DB.prepare("SELECT id,public_reference,official_name,organization_type,country_code,intervention_area,relationship_status,cooperation_domain,objectives,source,entered_at,last_activity_at,created_at,updated_at FROM partner_organizations WHERE id=?").bind(id).first<Record<string,unknown>>();if(!partner)return json({error:"partner_not_found"},404);
 const [contacts,agreements,events]=await Promise.all([
 env.DB.prepare("SELECT id,full_name,professional_title,professional_email,professional_phone,visibility,contact_status,created_at,updated_at FROM partner_contacts WHERE organization_id=? ORDER BY created_at DESC").bind(id).all<Record<string,unknown>>(),
 env.DB.prepare("SELECT id,public_reference,title,purpose,legal_status,operational_status,starts_on,ends_on,current_version,created_at,updated_at FROM partner_agreements WHERE organization_id=? ORDER BY updated_at DESC").bind(id).all<Record<string,unknown>>(),
 env.DB.prepare("SELECT event_type,summary,occurred_at FROM partner_events WHERE organization_id=? ORDER BY occurred_at DESC LIMIT 100").bind(id).all<Record<string,unknown>>()
 ]);
 return json({partner,contacts:contacts.results??[],agreements:agreements.results??[],events:events.results??[]})
 }catch{return json({error:"partner_service_unavailable"},503)}
};
export const onRequestPost:PagesFunction<Env>=async({request,env,params})=>{
 const guard=guardSameOriginJsonPost(request);if(guard)return guard;
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const id=typeof params.partnerId==="string"?params.partnerId:"";
 const parsed=await readJsonRequestBody(request,30000);if(!parsed.ok||typeof parsed.value!=="object"||parsed.value===null||Array.isArray(parsed.value))return json({error:"invalid_request"},400);
 const v=parsed.value as Record<string,unknown>,action=str(v.action,30),now=Date.now();
 try{
 const current=await env.DB.prepare("SELECT id,relationship_status FROM partner_organizations WHERE id=?").bind(id).first<{id:string;relationship_status:string}>();if(!current)return json({error:"partner_not_found"},404);
 if(action==="add_contact"){
 const name=str(v.fullName,160);if(!name)return json({error:"contact_name_required"},400);
 const contactId=crypto.randomUUID();
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO partner_contacts (id,organization_id,full_name,professional_title,professional_email,professional_phone,visibility,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'restricted',?,?,?)").bind(contactId,id,name,str(v.professionalTitle,120),str(v.professionalEmail,180),str(v.professionalPhone,60),admin.value.accountId,now,now),
 env.DB.prepare("INSERT INTO partner_events (id,organization_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?, 'contact_added', ?, ?, ?)").bind(crypto.randomUUID(),id,"Ajout d'un contact professionnel",admin.value.accountId,now),
 env.DB.prepare("INSERT INTO admin_audit_events (id,actor_account_id,actor_device_id,action,scope_key,permission_used,outcome,occurred_at) VALUES (?,?,?,'partner.contact.created','external','partner_contacts.create','success',?)").bind(crypto.randomUUID(),admin.value.accountId,admin.value.deviceId,now)
 ]);return results.every(x=>x.success)?json({created:true,contactId},201):json({error:"contact_save_failed"},503)
 }
 if(action!=="update")return json({error:"invalid_action"},400);
 const status=str(v.relationshipStatus,20);if(!statuses.includes(status))return json({error:"invalid_status"},400);
 const name=str(v.officialName,180);if(!name)return json({error:"invalid_partner"},400);
 const results=await env.DB.batch([
 env.DB.prepare("UPDATE partner_organizations SET official_name=?,organization_type=?,country_code=?,intervention_area=?,relationship_status=?,cooperation_domain=?,objectives=?,source=?,updated_by=?,updated_at=?,last_activity_at=? WHERE id=?").bind(name,str(v.organizationType,60),str(v.countryCode,2).toUpperCase(),str(v.interventionArea,240),status,str(v.cooperationDomain,180),str(v.objectives,4000),str(v.source,180),admin.value.accountId,now,now,id),
 env.DB.prepare("INSERT INTO partner_events (id,organization_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?, 'updated', ?, ?, ?)").bind(crypto.randomUUID(),id,"Mise à jour de la fiche partenaire",admin.value.accountId,now),
 env.DB.prepare("INSERT INTO admin_audit_events (id,actor_account_id,actor_device_id,action,scope_key,permission_used,outcome,occurred_at) VALUES (?,?,?,'partner.updated','external','partners.update','success',?)").bind(crypto.randomUUID(),admin.value.accountId,admin.value.deviceId,now)
 ]);return results.every(x=>x.success)?json({updated:true}):json({error:"partner_update_failed"},503)
 }catch{return json({error:"partner_update_failed"},503)}
};