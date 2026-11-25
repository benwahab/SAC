import { useCallback, useEffect, useState } from "react";
import type { Language } from "../i18n/translations";

type Mission={id:string;scope_key:string;assigned_account_id:string;status:string};
type Task={id:string;mission_id:string;title:string;description:string;status:string;due_at:number|null;scope_key?:string};
const copy={
 fr:{title:"Tâches et suivi",sub:"Attribuez des tâches aux missions actives et suivez les comptes rendus.",mission:"Mission active",task:"Intitulé",description:"Consignes / compte rendu attendu",due:"Échéance",create:"Créer la tâche",refresh:"Actualiser",empty:"Aucune tâche enregistrée.",todo:"À faire",in_progress:"En cours",blocked:"Bloquée",submitted:"Soumise",done:"Terminée",error:"Impossible de charger ou d’enregistrer les tâches."},
 en:{title:"Tasks & follow-up",sub:"Assign tasks to active missions and track progress reports.",mission:"Active mission",task:"Task title",description:"Instructions / expected report",due:"Due date",create:"Create task",refresh:"Refresh",empty:"No tasks recorded.",todo:"To do",in_progress:"In progress",blocked:"Blocked",submitted:"Submitted",done:"Completed",error:"Unable to load or save tasks."},
 ar:{title:"المهام والمتابعة",sub:"إسناد المهام إلى المهام الإدارية النشطة ومتابعة التقارير.",mission:"المهمة النشطة",task:"عنوان المهمة",description:"التعليمات / التقرير المطلوب",due:"الموعد النهائي",create:"إنشاء مهمة",refresh:"تحديث",empty:"لا توجد مهام مسجلة.",todo:"للإنجاز",in_progress:"قيد التنفيذ",blocked:"متوقفة",submitted:"تم الإرسال",done:"مكتملة",error:"تعذر تحميل المهام أو حفظها."}
};
export default function AdminMissionTasks({language}:{language:Language}) {
 const t=copy[language]??copy.fr;
 const [missions,setMissions]=useState<Mission[]>([]),[tasks,setTasks]=useState<Task[]>([]);
 const [missionId,setMissionId]=useState(""),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[due,setDue]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{try{const [m,r]=await Promise.all([fetch("/api/admin/missions",{credentials:"same-origin",cache:"no-store"}),fetch("/api/admin/tasks",{credentials:"same-origin",cache:"no-store"})]);if(!m.ok||!r.ok)throw 0;const mp=await m.json() as {missions:Mission[]};const tp=await r.json() as {tasks:Task[]};setMissions(mp.missions.filter(x=>x.status==="active"));setTasks(tp.tasks);if(!missionId&&mp.missions[0])setMissionId(mp.missions[0].id);}catch{setError(t.error);}},[missionId,t.error]);
 useEffect(()=>{void refresh();},[refresh]);
 async function create(){setBusy(true);setError("");try{const response=await fetch("/api/admin/tasks",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({missionId,title,description,dueAt:due?Date.parse(due):null})});if(!response.ok)throw 0;setTitle("");setDescription("");setDue("");await refresh();}catch{setError(t.error);}finally{setBusy(false);}}
 return <section className="mt-6 rounded-3xl border border-white/90 bg-white/75 p-6 shadow-glass" dir={language==="ar"?"rtl":"ltr"}>
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">{t.title}</h2><p className="mt-1 text-sm text-sac-muted">{t.sub}</p></div><button type="button" onClick={()=>void refresh()} className="rounded-xl border border-emerald-900/15 px-3 py-2 text-sm font-bold">{t.refresh}</button></div>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  <div className="mt-5 grid gap-3 md:grid-cols-2">
   <select aria-label={t.mission} value={missionId} onChange={e=>setMissionId(e.target.value)} className="rounded-xl border border-emerald-900/15 bg-white p-3 text-sm">{missions.map(m=><option key={m.id} value={m.id}>{m.scope_key} · {m.assigned_account_id}</option>)}</select>
   <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder={t.task} className="rounded-xl border border-emerald-900/15 bg-white p-3 text-sm"/>
   <textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} rows={2} placeholder={t.description} className="rounded-xl border border-emerald-900/15 bg-white p-3 text-sm"/>
   <div className="flex gap-2"><input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} aria-label={t.due} className="min-w-0 flex-1 rounded-xl border border-emerald-900/15 bg-white p-3 text-sm"/><button type="button" disabled={busy||!missionId||!title.trim()} onClick={()=>void create()} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{t.create}</button></div>
  </div>
  <div className="mt-5 grid gap-3 md:grid-cols-2">{tasks.length===0?<p className="rounded-xl bg-white/70 p-4 text-sm text-sac-muted">{t.empty}</p>:tasks.map(task=><article key={task.id} className="rounded-xl border border-emerald-900/10 bg-white/80 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{task.title}</h3><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold">{t[task.status as keyof typeof t]??task.status}</span></div><p className="mt-1 text-xs text-emerald-800">{task.scope_key??missions.find(m=>m.id===task.mission_id)?.scope_key??""}</p>{task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-sac-muted">{task.description}</p>}{task.due_at&&<p className="mt-2 text-xs text-sac-muted">{t.due}: {new Date(task.due_at).toLocaleString(language)}</p>}</article>)}</div>
 </section>;
}
