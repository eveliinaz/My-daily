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
   await env.DB.batch([env.DB.prepare('DELETE FROM tasks WHERE device_id=?').bind(body.id),env.DB.prepare('DELETE FROM devices WHERE id=?').bind(body.id),env.DB.prepare('DELETE FROM delivered WHERE device_id=?').bind(body.id),env.DB.prepare('DELETE FROM digest_settings WHERE device_id=?').bind(body.id)]);
   return response({ok:true});
  }
  if(!validSub(body.subscription)||!validTz(body.timezone)||!Array.isArray(body.digestTimes)||body.digestTimes.length>5||new Set(body.digestTimes).size!==body.digestTimes.length||!body.digestTimes.every(v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v))||!Array.isArray(body.tasks)||body.tasks.length>150)return response({error:'Invalid reminder data'},400);
  const list=[];
  for(const t of body.tasks){if(typeof t.id!=='string'||t.id.length>100||typeof t.title!=='string'||t.title.length>120||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(t.due)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time)||!['none','daily','weekly2','weekly3'].includes(t.repeat)||!Array.isArray(t.completedDates)||!Array.isArray(t.weekdays)||t.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||(t.repeat==='weekly2'&&new Set(t.weekdays).size!==2)||(t.repeat==='weekly3'&&new Set(t.weekdays).size!==3))return response({error:'Invalid task'},400);
   list.push(env.DB.prepare('INSERT INTO tasks(device_id,id,title,due,time,repeat,completed,completed_dates,weekdays) VALUES(?,?,?,?,?,?,?,?,?)').bind(body.id,t.id,t.title,t.due,t.time,t.repeat,Number(!!t.completed),JSON.stringify(t.completedDates.filter(x=>typeof x==='string').slice(-400)),JSON.stringify(t.weekdays)));
  }
  // Single Worker invocation serializes this device's replacement. For a serious public launch,
  // add stronger auth, server-side rate limiting, and multi-device sync policies.
  await env.DB.batch([env.DB.prepare('INSERT INTO devices(id,secret,subscription,timezone,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,timezone=excluded.timezone,updated_at=excluded.updated_at').bind(body.id,body.secret,JSON.stringify(body.subscription),body.timezone,Date.now()),env.DB.prepare('DELETE FROM tasks WHERE device_id=?').bind(body.id),env.DB.prepare('INSERT INTO digest_settings(device_id,morning,afternoon,evening,times_json) VALUES(?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET morning=excluded.morning,afternoon=excluded.afternoon,evening=excluded.evening,times_json=excluded.times_json').bind(body.id,body.digestTimes[0]||null,body.digestTimes[1]||null,body.digestTimes[2]||null,JSON.stringify(body.digestTimes)),...list]);
  return response({ok:true,count:list.length});
 },
 async scheduled(event,env,ctx){ctx.waitUntil(runReminders(env));}
};
function activeOn(t,day){if(t.due>day)return false;if(t.repeat==='daily')return true;if(t.repeat==='none')return t.due===day;const weekday=new Date(day+'T12:00:00Z').getUTCDay();let days=[];try{days=JSON.parse(t.weekdays||'[]');}catch{}return days.includes(weekday);}
function unfinishedOn(t,day){if(!activeOn(t,day))return false;if(t.repeat==='none')return !t.completed;try{return !JSON.parse(t.completed_dates||'[]').includes(day);}catch{return true;}}
function localNow(timezone,date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const f=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {day:`${f.year}-${f.month}-${f.day}`,minutes:Number(f.hour)*60+Number(f.minute)};}
async function runReminders(env){
 const now=new Date();
 // Prototype cap: cron runs once a minute; process up to 500 subscribed devices.
 const {results:devices}=await env.DB.prepare('SELECT d.id,d.subscription,d.timezone,s.morning,s.afternoon,s.evening,s.times_json FROM devices d LEFT JOIN digest_settings s ON d.id=s.device_id LIMIT 500').all();
 const vapid={publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY,subject:'mailto:'+env.VAPID_CONTACT_EMAIL};
 for(const d of devices){
  let local;try{local=localNow(d.timezone,now);}catch{continue;}
  const hh=String(Math.floor(local.minutes/60)).padStart(2,'0');const mm=String(local.minutes%60).padStart(2,'0');
  // 0–5 daily summaries in the device time zone. Older 3-slot settings still work.
  let slots;try{slots=d.times_json===null||d.times_json===undefined?[d.morning,d.afternoon,d.evening]:JSON.parse(d.times_json);}catch{slots=[];}
  if(Array.isArray(slots)&&slots.includes(`${hh}:${mm}`)){
   const {results:pending}=await env.DB.prepare('SELECT * FROM tasks WHERE device_id=? AND due<=? ORDER BY time LIMIT 151').bind(d.id,local.day).all();
   const unfinished=pending.filter(t=>unfinishedOn(t,local.day));
   if(unfinished.length){
    const slot=`${hh}:${mm}`;const claimId=`__daily_digest_${slot}`;
    const claimed=await env.DB.prepare('INSERT OR IGNORE INTO delivered(device_id,task_id,local_day,sent_at) VALUES(?,?,?,?)').bind(d.id,claimId,local.day,Date.now()).run();
    if(claimed.meta?.changes){
     const names=unfinished.slice(0,3).map(t=>t.title).join(', ');
     const extra=unfinished.length>3?` and ${unfinished.length-3} more`:'';
     try{await sendPushNotification(JSON.parse(d.subscription),{title:`My Daily · ${unfinished.length} unfinished task${unfinished.length===1?'':'s'}`,body:`${names}${extra}`,tag:`digest-${local.day}-${slot}`,url:'/My-daily/'},vapid);}
     catch(err){await env.DB.prepare('DELETE FROM delivered WHERE device_id=? AND task_id=? AND local_day=?').bind(d.id,claimId,local.day).run();console.error('Digest push failed',err?.statusCode||'unknown');}
    }
   }
  }
  const {results:due}=await env.DB.prepare('SELECT * FROM tasks WHERE device_id=? AND time=? AND due<=?').bind(d.id,`${hh}:${mm}`,local.day).all();
  for(const t of due){if(!unfinishedOn(t,local.day))continue;
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
