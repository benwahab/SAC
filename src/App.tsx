import {useEffect,useState} from "react";
import {ArrowUpRight,HeartHandshake,LockKeyhole,MapPin,ShieldCheck,UsersRound,Wifi} from "lucide-react";
type HealthState="checking"|"connected"|"unavailable";
const pillars=[
 {icon:UsersRound,title:"Vos proches, votre choix",description:"Vous choisissez les personnes de confiance qui peuvent recevoir vos alertes. Aucun fil public, aucun partage automatique avec une institution."},
 {icon:MapPin,title:"Une position sous contrôle",description:"La localisation ne sera partagée qu'avec votre autorisation. Une position ancienne sera toujours signalée comme telle."},
 {icon:HeartHandshake,title:"Une aide qui s'organise",description:"Vos proches pourront accuser réception ou proposer leur aide. Vous gardez le contrôle de la clôture de votre alerte."}
];
export default function App(){
 const [health,setHealth]=useState<HealthState>("checking");
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/health",{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error("API unavailable");
   const payload:{ok?:boolean;database?:string}=await response.json();
   setHealth(payload.ok&&payload.database==="connected"?"connected":"unavailable");
  }).catch((error:unknown)=>{
   if(error instanceof DOMException&&error.name==="AbortError")return;
   setHealth("unavailable");
  });
  return()=>controller.abort();
 },[]);
 const statusDot=health==="connected"?"bg-sac-green":health==="unavailable"?"bg-amber-500":"animate-pulse bg-slate-300";
 return <div className="min-h-screen overflow-hidden bg-[#F5F7FA] text-slate-900">
  <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
   <a href="/" aria-label="SAC, accueil" className="flex flex-col"><span className="text-xl font-black tracking-[0.2em] text-sac-navy">SAC</span><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sécurité · Alerte · Citoyenne</span></a>
   <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 sm:flex"><LockKeyhole size={14} className="text-sac-green"/>Application privée</div>
  </header>
  <main>
   <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-14 lg:grid-cols-[1.08fr_0.92fr]">
    <div className="pointer-events-none absolute -right-40 -top-24 h-[28rem] w-[28rem] rounded-full bg-sky-100/70 blur-3xl"/>
    <div className="relative">
     <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm"><span className="h-2 w-2 rounded-full bg-sac-green"/>Votre cercle de confiance, toujours au centre</div>
     <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-sac-navy sm:text-5xl lg:text-[3.7rem]">Votre sécurité.<span className="block text-slate-500">Vos proches.</span><span className="block">Votre décision.</span></h1>
     <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">SAC vous aidera à prévenir les personnes qui comptent pour vous en cas de danger et à sécuriser vos déplacements, tout en gardant le contrôle de vos informations.</p>
     <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" disabled aria-describedby="sos-status" className="inline-flex min-h-14 cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-slate-300 px-7 text-base font-extrabold text-slate-600 shadow-sm"><ShieldCheck size={20}/>SOS<span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">En préparation</span></button><span className="text-sm leading-6 text-slate-500" id="sos-status">Le déclenchement sera activé après validation des envois réels et des protections.</span></div>
     <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-600"><span className="inline-flex items-center gap-2"><LockKeyhole size={16} className="text-sac-green"/>Données protégées</span><span className="inline-flex items-center gap-2"><UsersRound size={16} className="text-sac-green"/>Contacts choisis</span></div>
    </div>
    <div className="relative mx-auto w-full max-w-md"><div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-sky-100 via-white to-rose-100 blur-xl"/><div className="relative rounded-[2rem] border border-white bg-white p-6 shadow-soft sm:p-8">
     <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Espace personnel</p><h2 className="mt-1 text-xl font-extrabold text-sac-navy">SAC vous accompagne</h2></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-sac-navy"><ShieldCheck size={25}/></span></div>
     <div className="mt-7 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><Wifi size={19}/></span><div className="min-w-0"><p className="text-sm font-bold text-slate-800">État du serveur</p><p className="mt-0.5 text-xs text-slate-500" aria-live="polite">{health==="checking"&&"Vérification de la connexion…"}{health==="connected"&&"API et base de données accessibles"}{health==="unavailable"&&"Connexion serveur à vérifier"}</p></div><span className={"ml-auto h-2.5 w-2.5 shrink-0 rounded-full "+statusDot}/></div></div>
     <div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-sm font-semibold text-slate-600">Formule gratuite</span><span className="text-sm font-extrabold text-sac-navy">2 contacts</span></div><div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-sm font-semibold text-slate-600">Formule Premium</span><span className="text-sm font-extrabold text-sac-navy">5 000 F / mois</span></div></div>
     <p className="mt-5 text-xs leading-5 text-slate-400">Les fonctions de sécurité essentielles, dont le SOS, resteront accessibles gratuitement.</p>
    </div></div>
   </section>
   <section className="border-y border-slate-200/80 bg-white"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-8"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sac-green">Les principes SAC</p><h2 className="mt-3 text-3xl font-black tracking-tight text-sac-navy sm:text-4xl">La confiance commence par le contrôle.</h2></div><div className="mt-10 grid gap-5 md:grid-cols-3">{pillars.map(({icon:Icon,title,description})=><article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-soft"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-sac-navy"><Icon size={23}/></span><h3 className="mt-5 text-lg font-extrabold text-sac-navy">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{description}</p></article>)}</div></div></section>
   <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8"><div className="flex flex-col gap-5 rounded-3xl bg-sac-navy px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-9"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">Une application responsable</p><h2 className="mt-2 text-2xl font-extrabold">SAC ne remplace pas les services d'urgence.</h2><p className="mt-2 text-sm leading-6 text-slate-300">SAC est conçu pour prévenir vos proches de confiance. Il ne garantit pas une intervention des secours.</p></div><a href="https://github.com/benwahab/SAC" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-white px-4 py-3 text-sm font-bold text-sac-navy transition hover:bg-slate-100">Suivre le projet <ArrowUpRight size={16}/></a></div></section>
  </main>
  <footer className="border-t border-slate-200 bg-white px-5 py-7 text-center text-xs text-slate-500">SAC — Sécurité, Alerte, Citoyenne · Votre sécurité, votre décision.</footer>
 </div>;
}