interface Env{DB:D1Database}
export const onRequestGet:PagesFunction<Env>=async({env})=>{
 try{await env.DB.prepare("SELECT 1 AS ok").first<{ok:number}>();return Response.json({ok:true,service:"sac-api",database:"connected"})}
 catch{return Response.json({ok:false,service:"sac-api",database:"unavailable"},{status:503})}
};
