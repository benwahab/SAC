import { requireSuperAdminSession } from "../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
interface Env { DB:D1Database; }
const H={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:H});
const definitions:Record<string,{max:number;kind:string}>={
 "organization.name":{max:180,kind:"text"},"organization.public_email":{max:180,kind:"email"},
 "organization.public_phone":{max:60,kind:"phone"},"organization.website":{max:240,kind:"url"},
 "localization.default_language":{max:2,kind:"language"},"localization.time_zone":{max:80,kind:"timezone"},
 "localization.date_format":{max:20,kind:"date_format"}
};
const valid=(key:string,value:string)=>{const d=definitions[key];if(!d||value.length>d.max)return false;
 if(d.kind==="email")return value===""||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
 if(d.kind==="phone")return /^[+0-9 ()-]*$/.test(value);
 if(d.kind==="url"){if(!value)return true;try{return new URL(value).protocol==="https:"}catch{return false}}
 if(d.kind==="language")return ["fr","en","ar"].includes(value);
 if(d.kind==="date_format")return ["DD/MM/YYYY","YYYY-MM-DD","MM/DD/YYYY"].includes(value);
 if(d.kind==="timezone"){try{new Intl.DateTimeFormat("en",{timeZone:value});return true}catch{return false}}
 return true;
};
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 try{const [settings,events]=await Promise.all([
 env.DB.prepare("SELECT setting_key,value_json,version,updated_at FROM system_settings ORDER BY setting_key").all<Record<string,unknown>>(),
 env.DB.prepare("SELECT id,setting_key,previous_value_json,new_value_json,version,justification,occurred_at FROM setting_change_events ORDER BY occurred_at DESC LIMIT 100").all<Record<string,unknown>>()
 ]);return json({settings:settings.results??[],events:events.results??[]})}catch{return json({error:"settings_service_unavailable"},503)}
};
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
 const guard=guardSameOriginJsonPost(request);if(guard)return guard;
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const parsed=await readJsonRequestBody(request,12000);if(!parsed.ok||typeof parsed.value!=="object"||parsed.value===null||Array.isArray(parsed.value))return json({error:"invalid_request"},400);
 const v=parsed.value as Record<string,unknown>,key=typeof v.key==="string"?v.key:"",value=typeof v.value==="string"?v.value.trim():"",expected=Number.isSafeInteger(v.expectedVersion)?Number(v.expectedVersion):0,justification=typeof v.justification==="string"?v.justification.trim().slice(0,500):"";
 if(!valid(key,value))return json({error:"invalid_setting"},400);
 const now=Date.now(),actor=admin.value.accountId;
 try{const current=await env.DB.prepare("SELECT value_json,version FROM system_settings WHERE setting_key=?").bind(key).first<{value_json:string;version:number}>();
 if((current?.version??0)!==expected)return json({error:"setting_conflict",currentVersion:current?.version??0},409);
 const version=expected+1,id=crypto.randomUUID(),serialized=JSON.stringify(value);
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO system_settings (setting_key,value_json,version,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(key,serialized,version,actor,now),
 env.DB.prepare("INSERT INTO setting_change_events (id,setting_key,previous_value_json,new_value_json,version,justification,actor_account_id,occurred_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,key,current?.value_json??null,serialized,version,justification,actor,now),
 env.DB.prepare("INSERT INTO admin_audit_events (id,actor_account_id,actor_device_id,action,scope_key,permission_used,outcome,occurred_at) VALUES (?,?,?,'settings.updated','settings','settings.update','success',?)").bind(crypto.randomUUID(),actor,admin.value.deviceId,now)
 ]);
 return results.every(x=>x.success)?json({updated:true,key,version,updatedAt:now}):json({error:"settings_save_failed"},503)
 }catch{return json({error:"settings_save_failed"},503)}
};