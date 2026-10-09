import {sendPushNotification} from '@mmmike/web-push/send';
const ORIGIN='https://eveliinaz.github.io';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
function validSub(sub){try{const url=new URL(sub.endpoint);return url.protocol==='https:' && (url.hostname==='fcm.googleapis.com'||url.hostname.endsWith('.push.apple.com')||url.hostname.endsWith('.push.services.mozilla.com')) && typeof sub.keys?.p256dh==='string'&&typeof sub.keys?.auth==='string';}catch{return false;}}
function validDevice(body){return typeof body.id==='string'&&/^[a-f0-9-]{30,50}$/i.test(body.id)&&typeof body.secret==='string'&&/^[a-f0-9]{64}$/.test(body.secret);}
const validTz=tz=>{try{new Intl.DateTimeFormat('en-US',{timeZone:tz});return true;}catch{return false;}};
async function authenticate(db,body){const row=await db.prepare('SELECT secret FROM devices WHERE id=?').bind(body.id).first();return !row||row.secret===body.secret;}
export default {
 async fetch(req,env){
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.headers.get('Origin')!==ORIGIN)return response({error:'Invalid origin'},403);
  const route=new URL(req.url).pathname;
  if(req.method!=='POST'||!['/sync','/disable'].includes(route))return response({error:'Not found'},404);
  let body;try{body=await req.json();}catch{return response({error:'Invalid JSON'},400);}
  if(!validDevice(body))return response({error:'Invalid device'},400);
  if(!await authenticate(env.DB,body))return response({error:'Authentication failed'},403);
  if(route==='/disable'){
   await env.DB.batch([env.DB.prepare('DELETE FROM tasks WHERE device_id=?').bind(body.id),env.DB.prepare('DELETE FROM devices WHERE id=?').bind(body.id),env.DB.prepare('DELETE FROM delivered WHERE device_id=?').bind(body.id)]);
   return response({ok:true});
  }
  if(!validSub(body.subscription)||!validTz(body.timezone)||!Array.isArray(body.tasks)||body.tasks.length>150)return response({error:'Invalid reminder data'},400);
  const list=[];
  for(const t of body.tasks){if(typeof t.id!=='string'||t.id.length>100||typeof t.title!=='string'||t.title.length>120||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(t.due)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time)||!['none','daily'].includes(t.repeat)||!Array.isArray(t.completedDates))return response({error:'Invalid task'},400);
   list.push(env.DB.prepare('INSERT INTO tasks(device_id,id,title,due,time,repeat,completed,completed_dates) VALUES(?,?,?,?,?,?,?,?)').bind(body.id,t.id,t.title,t.due,t.time,t.repeat,Number(!!t.completed),JSON.stringify(t.completedDates.filter(x=>typeof x==='string').slice(-400))));
  }
  // Single Worker invocation serializes this device's replacement. For a serious public launch,
  // add stronger auth, server-side rate limiting, and multi-device sync policies.
  await env.DB.batch([env.DB.prepare('INSERT INTO devices(id,secret,subscription,timezone,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,timezone=excluded.timezone,updated_at=excluded.updated_at').bind(body.id,body.secret,JSON.stringify(body.subscription),body.timezone,Date.now()),env.DB.prepare('DELETE FROM tasks WHERE device_id=?').bind(body.id),...list]);
  return response({ok:true,count:list.length});
 },
 async scheduled(event,env,ctx){ctx.waitUntil(runReminders(env));}
};
function localNow(timezone,date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const f=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {day:`${f.year}-${f.month}-${f.day}`,minutes:Number(f.hour)*60+Number(f.minute)};}
async function runReminders(env){
 const now=new Date();
 // Prototype cap: cron runs once a minute; process up to 500 subscribed devices.
 const {results:devices}=await env.DB.prepare('SELECT id,subscription,timezone FROM devices LIMIT 500').all();
 const vapid={publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY,subject:'mailto:'+env.VAPID_CONTACT_EMAIL};
 for(const d of devices){
  let local;try{local=localNow(d.timezone,now);}catch{continue;}
  const hh=String(Math.floor(local.minutes/60)).padStart(2,'0');const mm=String(local.minutes%60).padStart(2,'0');
  const {results:due}=await env.DB.prepare('SELECT * FROM tasks WHERE device_id=? AND time=? AND due<=?').bind(d.id,`${hh}:${mm}`,local.day).all();
  for(const t of due){if(t.repeat==='none'&&t.due!==local.day)continue;if(t.repeat==='none'&&t.completed)continue;
   if(t.repeat==='daily'&&JSON.parse(t.completed_dates||'[]').includes(local.day))continue;
   // Insert a claim before sending to prevent two cron invocations from sending duplicates.
   const claimed=await env.DB.prepare('INSERT OR IGNORE INTO delivered(device_id,task_id,local_day,sent_at) VALUES(?,?,?,?)').bind(d.id,t.id,local.day,Date.now()).run();
   if(!claimed.meta?.changes)continue;
   try{const ok=await sendPushNotification(JSON.parse(d.subscription),{title:'My Daily reminder',body:t.title,url:'/My-daily/',tag:`${t.id}-${local.day}`},vapid);
    if(!ok)await env.DB.prepare('DELETE FROM devices WHERE id=?').bind(d.id).run();
   }catch(err){await env.DB.prepare('DELETE FROM delivered WHERE device_id=? AND task_id=? AND local_day=?').bind(d.id,t.id,local.day).run();console.error('Push failed',err?.statusCode||'unknown');}
  }
 }
 // Keep claims from growing forever.
 await env.DB.prepare('DELETE FROM delivered WHERE sent_at<?').bind(Date.now()-45*86400000).run();
}
