/** Contrats isolant le Web et les futurs adaptateurs Capacitor. */
export interface LocationSnapshot{latitude:number;longitude:number;accuracyMeters:number;capturedAt:string}
export interface LocationAdapter{getCurrentPosition():Promise<LocationSnapshot>}
export interface NotificationPermissionAdapter{requestPermission():Promise<NotificationPermission>}
export interface ShareAdapter{share(title:string,text:string,url?:string):Promise<"shared"|"copied"|"unavailable">}
