import { requireSuperAdminSession } from "../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
interface Env { DB:D1Database; }
const H={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:H});
const str=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const validDate=(v:string)=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z")));
const staffStatuses=["active","leave","suspended","departed"];
const assetConditions=["new","good","fair","needs_repair","out_of_service"];
const assetStatuses=["available","assigned","maintenance","retired"];
const reference=(prefix:string)=>prefix+"-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const q=str(new URL(request.url).searchParams.get("q"),120);
 try{
 const [staff,assets,summary,events]=await Promise.all([
 env.DB.prepare("SELECT s.id,s.staff_reference,s.account_id,s.full_name,s.job_title,s.department,s.work_email,s.work_phone,s.work_location,s.employment_status,s.start_date,s.end_date,s.created_at,s.updated_at FROM hr_staff s WHERE (?='' OR s.full_name LIKE '%'||?||'%' OR s.staff_reference LIKE '%'||?||'%' OR s.department LIKE '%'||?||'%') ORDER BY s.full_name LIMIT 300").bind(q,q,q,q).all<Record<string,unknown>>(),
 env.DB.prepare("SELECT a.id,a.inventory_reference,a.asset_name,a.asset_category,a.serial_number,a.asset_condition,a.asset_status,a.current_location,a.acquired_on,a.updated_at,st.id AS assigned_staff_id,st.full_name AS assigned_staff_name,x.id AS active_assignment_id FROM logistics_assets a LEFT JOIN logistics_asset_assignments x ON x.asset_id=a.id AND x.returned_at IS NULL LEFT JOIN hr_staff st ON st.id=x.staff_id WHERE (?='' OR a.asset_name LIKE '%'||?||'%' OR a.inventory_reference LIKE '%'||?||'%' OR a.serial_number LIKE '%'||?||'%') ORDER BY a.updated_at DESC LIMIT 400").bind(q,q,q,q).all<Record<string,unknown>>(),
 env.DB.prepare("SELECT (SELECT COUNT(*) FROM hr_staff WHERE employment_status='active') AS active_staff,(SELECT COUNT(*) FROM logistics_assets WHERE asset_status='available') AS available_assets,(SELECT COUNT(*) FROM logistics_assets WHERE asset_status='assigned') AS assigned_assets,(SELECT COUNT(*) FROM logistics_assets WHERE asset_status='maintenance') AS maintenance_assets").first<Record<string,number>>(),
 env.DB.prepare("SELECT id,entity_type,entity_id,event_type,summary,occurred_at FROM hr_logistics_events ORDER BY occurred_at DESC LIMIT 50").all<Record<string,unknown>>()
 ]);
 return json({staff:staff.results??[],assets:assets.results??[],summary,events:events.results??[]})
 }catch{return json({error:"resources_service_unavailable"},503)}
};
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
 const guard=guardSameOriginJsonPost(request);if(guard)return guard;
 const admin=await requireSuperAdminSession(request,env.DB);if(!admin.ok)return json({error:admin.status===401?"authentication_required":"super_admin_required"},admin.status);
 const parsed=await readJsonRequestBody(request,30000);if(!parsed.ok||typeof parsed.value!=="object"||parsed.value===null||Array.isArray(parsed.value))return json({error:"invalid_request"},400);
 const v=parsed.value as Record<string,unknown>,action=str(v.action,30),now=Date.now(),actor=admin.value.accountId;
 const audit=(key:string,permission:string)=>env.DB.prepare("INSERT INTO admin_audit_events (id,actor_account_id,actor_device_id,action,scope_key,permission_used,outcome,occurred_at) VALUES (?,?,?,?,?,?, 'success',?)").bind(crypto.randomUUID(),actor,admin.value.deviceId,key,"resources",permission,now);
 const event=(type:string,id:string,kind:string,summary:string)=>env.DB.prepare("INSERT INTO hr_logistics_events (id,entity_type,entity_id,event_type,summary,actor_account_id,occurred_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),type,id,kind,summary,actor,now);
 try{
 if(action==="create_staff"){
 const name=str(v.fullName,160),status=str(v.employmentStatus,20)||"active",startDate=str(v.startDate,10);if(!name||!staffStatuses.includes(status)||!validDate(startDate))return json({error:"invalid_staff"},400);
 const id=crypto.randomUUID(),ref=reference("SAC-PER");
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO hr_staff (id,staff_reference,account_id,full_name,job_title,department,work_email,work_phone,work_location,employment_status,start_date,notes,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,ref,str(v.accountId,80)||null,name,str(v.jobTitle,120),str(v.department,120),str(v.workEmail,180),str(v.workPhone,60),str(v.workLocation,160),status,startDate||null,str(v.notes,3000),actor,actor,now,now),
 event("staff",id,"created","Création de la fiche du personnel"),audit("hr.staff.created","resources.staff.create")
 ]);return results.every(x=>x.success)?json({created:true,id,reference:ref},201):json({error:"staff_save_failed"},503)
 }
 if(action==="create_asset"){
 const name=str(v.assetName,160),category=str(v.assetCategory,60),condition=str(v.assetCondition,30)||"good",location=str(v.currentLocation,160),acquiredOn=str(v.acquiredOn,10);if(!name||!category||!assetConditions.includes(condition)||!validDate(acquiredOn))return json({error:"invalid_asset"},400);
 const id=crypto.randomUUID(),ref=reference("SAC-INV");
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO logistics_assets (id,inventory_reference,asset_name,asset_category,serial_number,asset_condition,asset_status,current_location,acquired_on,notes,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'available',?,?,?,?,?,?,?)").bind(id,ref,name,category,str(v.serialNumber,120),condition,location,acquiredOn||null,str(v.notes,3000),actor,actor,now,now),
 event("asset",id,"created","Enregistrement d'un équipement dans l'inventaire"),audit("logistics.asset.created","resources.assets.create")
 ]);return results.every(x=>x.success)?json({created:true,id,reference:ref},201):json({error:"asset_save_failed"},503)
 }
 if(action==="assign_asset"){
 const assetId=str(v.assetId,80),staffId=str(v.staffId,80);if(!assetId||!staffId)return json({error:"assignment_fields_required"},400);
 const [asset,staff,current]=await Promise.all([
 env.DB.prepare("SELECT id,asset_status FROM logistics_assets WHERE id=?").bind(assetId).first<{id:string;asset_status:string}>(),
 env.DB.prepare("SELECT id,employment_status FROM hr_staff WHERE id=?").bind(staffId).first<{id:string;employment_status:string}>(),
 env.DB.prepare("SELECT id FROM logistics_asset_assignments WHERE asset_id=? AND returned_at IS NULL").bind(assetId).first()
 ]);
 if(!asset||!staff)return json({error:"asset_or_staff_not_found"},404);
 if(asset.asset_status!=="available"||current)return json({error:"asset_not_available"},409);
 if(staff.employment_status!=="active")return json({error:"staff_not_active"},409);
 const id=crypto.randomUUID();
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO logistics_asset_assignments (id,asset_id,staff_id,assigned_by,assigned_at,notes) VALUES (?,?,?,?,?,?)").bind(id,assetId,staffId,actor,now,str(v.notes,1000)),
 env.DB.prepare("UPDATE logistics_assets SET asset_status='assigned',updated_by=?,updated_at=? WHERE id=? AND asset_status='available'").bind(actor,now,assetId),
 event("assignment",id,"assigned","Affectation d'un équipement à un membre du personnel"),event("asset",assetId,"assigned","Équipement affecté"),audit("logistics.asset.assigned","resources.assets.assign")
 ]);return results.every(x=>x.success)?json({assigned:true,id},201):json({error:"assignment_failed"},503)
 }
 if(action==="return_asset"){
 const assignmentId=str(v.assignmentId,80),condition=str(v.returnCondition,40)||"good";if(!assignmentId||!["new","good","fair","needs_repair","out_of_service"].includes(condition))return json({error:"invalid_return"},400);
 const assignment=await env.DB.prepare("SELECT id,asset_id FROM logistics_asset_assignments WHERE id=? AND returned_at IS NULL").bind(assignmentId).first<{id:string;asset_id:string}>();if(!assignment)return json({error:"active_assignment_not_found"},404);
 const assetStatus=condition==="needs_repair"||condition==="out_of_service"?"maintenance":"available";
 const results=await env.DB.batch([
 env.DB.prepare("UPDATE logistics_asset_assignments SET returned_at=?,return_condition=?,notes=CASE WHEN ?='' THEN notes ELSE notes||char(10)||? END WHERE id=? AND returned_at IS NULL").bind(now,condition,str(v.notes,1000),str(v.notes,1000),assignmentId),
 env.DB.prepare("UPDATE logistics_assets SET asset_status=?,asset_condition=?,updated_by=?,updated_at=? WHERE id=?").bind(assetStatus,condition,actor,now,assignment.asset_id),
 event("assignment",assignmentId,"returned","Retour d'un équipement et contrôle de son état"),event("asset",assignment.asset_id,"returned","Équipement retourné à l'inventaire"),audit("logistics.asset.returned","resources.assets.return")
 ]);return results.every(x=>x.success)?json({returned:true,assetStatus},200):json({error:"return_failed"},503)
 }
 if(action==="update_staff_status"){
 const id=str(v.staffId,80),status=str(v.employmentStatus,20);if(!id||!staffStatuses.includes(status))return json({error:"invalid_staff_status"},400);
 const exists=await env.DB.prepare("SELECT id FROM hr_staff WHERE id=?").bind(id).first();if(!exists)return json({error:"staff_not_found"},404);
 if(status==="departed"){const assigned=await env.DB.prepare("SELECT id FROM logistics_asset_assignments WHERE staff_id=? AND returned_at IS NULL LIMIT 1").bind(id).first();if(assigned)return json({error:"staff_has_assigned_assets"},409)}
 const results=await env.DB.batch([env.DB.prepare("UPDATE hr_staff SET employment_status=?,updated_by=?,updated_at=?,end_date=CASE WHEN ?='departed' THEN date('now') ELSE end_date END WHERE id=?").bind(status,actor,now,status,id),event("staff",id,"status_changed","Changement du statut du personnel"),audit("hr.staff.status.updated","resources.staff.update")]);
 return results.every(x=>x.success)?json({updated:true}):json({error:"staff_update_failed"},503)
 }
 if(action==="update_asset_status"){
 const id=str(v.assetId,80),status=str(v.assetStatus,20);if(!id||!assetStatuses.includes(status)||status==="assigned")return json({error:"invalid_asset_status"},400);
 const exists=await env.DB.prepare("SELECT id FROM logistics_assets WHERE id=?").bind(id).first();if(!exists)return json({error:"asset_not_found"},404);
 if(status==="available"){const current=await env.DB.prepare("SELECT id FROM logistics_asset_assignments WHERE asset_id=? AND returned_at IS NULL").bind(id).first();if(current)return json({error:"asset_has_active_assignment"},409)}
 const results=await env.DB.batch([env.DB.prepare("UPDATE logistics_assets SET asset_status=?,updated_by=?,updated_at=? WHERE id=?").bind(status,actor,now,id),event("asset",id,"status_changed","Changement du statut de l'équipement"),audit("logistics.asset.status.updated","resources.assets.update")]);
 return results.every(x=>x.success)?json({updated:true}):json({error:"asset_update_failed"},503)
 }
 return json({error:"invalid_action"},400)
 }catch{return json({error:"resources_operation_failed"},503)}
};