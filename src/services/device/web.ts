import type {LocationAdapter,NotificationPermissionAdapter,ShareAdapter} from "./contracts";
export const webLocationAdapter:LocationAdapter={getCurrentPosition:()=>new Promise((resolve,reject)=>{
 if(!("geolocation" in navigator)){reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));return}
 navigator.geolocation.getCurrentPosition(position=>resolve({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracyMeters:position.coords.accuracy,capturedAt:new Date(position.timestamp).toISOString()}),reject,{enableHighAccuracy:true,maximumAge:0,timeout:15000})
})};
export const webNotificationAdapter:NotificationPermissionAdapter={requestPermission:async()=>!("Notification" in window)?"unsupported":Notification.requestPermission()};
export const webShareAdapter:ShareAdapter={share:async(title,text,url)=>{
 if(navigator.share){await navigator.share({title,text,url});return "shared"}
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText([text,url].filter(Boolean).join("\n"));return "copied"}
 return "unavailable"
}};
