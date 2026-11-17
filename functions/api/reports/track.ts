interface Env{DB:D1Database;}interface Context{request:Request;env:Env;}
export async function onRequestGet({request,env}:Context){
 const code=(new URL(request.url).searchParams.get("code")??"").trim().toUpperCase();
 const fail=(message:string,status:number)=>Response.json({success:false,data:null,error:{code:"TRACKING_ERROR",message}},{status,headers:{"Cache-Control":"no-store"}});
 if(!/^SAC-[A-F0-9]{36}$/.test(code))return fail("Code de suivi invalide.",400);
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
 const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
 const row=await env.DB.prepare("SELECT id,category,status,created_at AS createdAt,updated_at AS updatedAt FROM reports WHERE tracking_code_hash=? LIMIT 1").bind(hash).first<{id:string;category:string;status:string;createdAt:string;updatedAt:string}>();
 if(!row)return fail("Aucun signalement ne correspond à ce code.",404);
 return Response.json({success:true,data:{reference:row.id.slice(0,8).toUpperCase(),category:row.category,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt},error:null},{headers:{"Cache-Control":"no-store"}});
}