'use strict';
const STORE='my-daily-v1';
const $=id=>document.getElementById(id);
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today=()=>localDate();
const friendlyDate=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'});};
const uid=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;
function load(){try{const data=JSON.parse(localStorage.getItem(STORE));return Array.isArray(data)?data:[];}catch{return [];}}
let tasks=load(),tab='today',editing=null;
function save(){localStorage.setItem(STORE,JSON.stringify(tasks));render(); queueReminderSync();}
// Weekly habits run only on the weekdays selected by the user (0=Sunday).
const recurring=t=>t.repeat==='daily'||t.repeat==='weekly2'||t.repeat==='weekly3';
const weekday=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).getDay();};
const weekdays=t=>Array.isArray(t.weekdays)?t.weekdays:[];
function scheduled(t,date){return t.due<=date && (t.repeat==='daily'||(recurring(t)&&weekdays(t).includes(weekday(date)))||(!recurring(t)&&t.due===date));}
function isDone(t){return recurring(t)?(t.completedDates||[]).includes(today()):Boolean(t.completed);}
function repeatLabel(t){return t.repeat==='daily'?'Every day':recurring(t)?`${t.repeat==='weekly2'?'2':'3'} times/week (${weekdays(t).map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')})`:'One time';}

function relevant(t){if(tab==='all')return true;if(tab==='upcoming')return !scheduled(t,today()) && (recurring(t)||t.due>today());return scheduled(t,today())||(!recurring(t)&&t.due<today()&&!t.completed);}
function toggle(id){const t=tasks.find(t=>t.id===id);if(!t)return;if(recurring(t)){t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];t.completedDates=t.completedDates.includes(today())?t.completedDates.filter(d=>d!==today()):[...t.completedDates,today()];}else t.completed=!t.completed;save();}
function render(){
 $('date-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 const daily=tasks.filter(t=>scheduled(t,today()));const done=daily.filter(isDone).length;
 $('progress-label').textContent=`${done} of ${daily.length} completed`;$('progress-bar').style.width=`${daily.length?100*done/daily.length:0}%`;
 if(tab==='calendar'){renderCalendar();return;}
 const visible=tasks.filter(relevant).sort((a,b)=>a.due.localeCompare(b.due)||a.time.localeCompare(b.time));
 $('list-title').textContent=tab==='today'?"Today's tasks":tab==='upcoming'?'Upcoming tasks':'All tasks';$('task-count').textContent=`${visible.length} tasks`;
 const list=$('task-list');list.replaceChildren();
 if(!visible.length){const el=document.createElement('div');el.className='empty';el.textContent='Nothing here yet. Add your first task.';list.append(el);return;}
 for(const t of visible){const row=document.createElement('div');row.className='task';const main=document.createElement('div');main.className='task-main';const check=document.createElement('button');check.className=`check ${isDone(t)?'done':''}`;check.textContent=isDone(t)?'✓':'';check.setAttribute('aria-label',`Mark ${t.title} ${isDone(t)?'incomplete':'complete'}`);check.onclick=()=>toggle(t.id);const body=document.createElement('div');body.className='task-text';const name=document.createElement('div');name.className=`task-name ${isDone(t)?'done':''}`;name.textContent=t.title;const meta=document.createElement('div');meta.className='task-meta';meta.textContent=`${recurring(t)?repeatLabel(t)+' from '+friendlyDate(t.due):friendlyDate(t.due)} · ${t.time}`;body.append(name,meta);main.append(check,body);const edit=document.createElement('button');edit.className='edit';edit.textContent='Edit';edit.setAttribute('aria-label',`Edit ${t.title}`);edit.onclick=()=>openForm(t.id);row.append(main,edit);list.append(row);}
}

function renderCalendar(){
 const now=new Date(),year=now.getFullYear(),month=now.getMonth();
 $('list-title').textContent=now.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 $('task-count').textContent='This month';
 const list=$('task-list');list.replaceChildren();
 const grid=document.createElement('div');grid.className='calendar-grid';
 for(const wd of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']){const h=document.createElement('div');h.className='cal-weekday';h.textContent=wd;grid.append(h);}
 const start=(new Date(year,month,1).getDay()+6)%7;
 for(let i=0;i<start;i++){const blank=document.createElement('div');grid.append(blank);}
 for(let day=1;day<=new Date(year,month+1,0).getDate();day++){
  const date=localDate(new Date(year,month,day));
  const active=tasks.filter(t=>scheduled(t,date));
  const cell=document.createElement('button');cell.type='button';cell.className='cal-day'+(date===today()?' current':'');
  cell.textContent=String(day);
  if(active.length){const dot=document.createElement('span');dot.className='cal-dot';dot.textContent=String(active.length);cell.append(dot);}
  cell.title=`${date}: ${active.length} task(s)`;
  cell.onclick=()=>{const heading=$('calendar-selection');if(heading)heading.remove();const existing=$('calendar-details');if(existing)existing.remove();const details=document.createElement('div');details.id='calendar-details';details.className='calendar-details';const title=document.createElement('h3');title.textContent=new Date(year,month,day).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});details.append(title);if(!active.length){const p=document.createElement('p');p.textContent='No tasks scheduled.';details.append(p);}for(const t of active){const p=document.createElement('p');p.textContent=`${t.time} — ${t.title}`;details.append(p);}list.append(details);};
  grid.append(cell);
 }
 list.append(grid);
}

function openForm(id=null){editing=id;const t=tasks.find(t=>t.id===id);$('dialog-title').textContent=t?'Edit task':'New task';$('title').value=t?.title??'';$('due').value=t?.due??today();$('time').value=t?.time??'09:00';$('repeat').value=t?.repeat??'none';setWeekdayControls(t?.weekdays);$('delete-btn').hidden=!t;$('task-dialog').showModal();}
const SUGGESTIONS=[['Study for 30 minutes','daily'],['Drink water','daily'],['Exercise','daily'],['Read 20 minutes','daily'],['Clean my room','none'],['Buy groceries','none'],['Go for a walk','daily'],['Take vitamins','daily'],['Do laundry','none'],['Plan tomorrow','daily'],['Meditate','daily'],['Finish homework','none']];
for(const [name,repeat] of SUGGESTIONS){const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>{$('title').value=name;$('repeat').value=repeat;setWeekdayControls();$('due').value=today();};$('suggested-tasks').append(b);}
$('open-form').onclick=()=>openForm();$('close-form').onclick=()=>$('task-dialog').close();
const dayLabels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dayButtons=[];
for(let d=0;d<7;d++){const btn=document.createElement('button');btn.type='button';btn.textContent=dayLabels[d];btn.className='weekday-pill';btn.setAttribute('aria-pressed','false');btn.onclick=()=>{btn.setAttribute('aria-pressed',btn.getAttribute('aria-pressed')==='true'?'false':'true');updateWeekdayHint();};$('weekday-options').append(btn);dayButtons.push(btn);}
function selectedWeekdays(){return dayButtons.flatMap((b,d)=>b.getAttribute('aria-pressed')==='true'?[d]:[]);}
function updateWeekdayHint(){const repeat=$('repeat').value,need=repeat==='weekly2'?2:repeat==='weekly3'?3:0;$('weekday-picker').hidden=!need;if(need){const count=selectedWeekdays().length;$('weekday-hint').textContent=`Choose exactly ${need} days (${count} selected)`;$('weekday-hint').style.color=count===need?'var(--accent)':'#dbbad0';}}
function setWeekdayControls(days){const selected=Array.isArray(days)?days:[1,3,5];dayButtons.forEach((b,d)=>b.setAttribute('aria-pressed',String(selected.includes(d))));updateWeekdayHint();}
$('repeat').addEventListener('change',updateWeekdayHint);
$('task-form').onsubmit=e=>{e.preventDefault();const title=$('title').value.trim(),due=$('due').value,time=$('time').value,repeat=$('repeat').value;const weekdays=selectedWeekdays(),need=repeat==='weekly2'?2:repeat==='weekly3'?3:0;if(need&&weekdays.length!==need){updateWeekdayHint();return;}if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!/^\d{2}:\d{2}$/.test(time))return;const old=tasks.find(t=>t.id===editing);if(old){Object.assign(old,{title,due,time,repeat,weekdays:need?weekdays:[]});if(!recurring(old))old.completedDates=[];if(recurring(old))old.completed=false;}else tasks.push({id:uid(),title,due,time,repeat,weekdays:need?weekdays:[],completed:false,completedDates:[]});$('task-dialog').close();save();};
$('delete-btn').onclick=()=>{if(editing&&confirm('Delete this task?')){tasks=tasks.filter(t=>t.id!==editing);$('task-dialog').close();save();}};
document.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{tab=btn.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));render();});
// The website cannot schedule background alerts by itself. Cloudflare Web Push does that.
setInterval(()=>{if(document.visibilityState==='visible'&&$('date-label').dataset.today!==today()){$('date-label').dataset.today=today();render();}},15000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
render();

// Push notifications are optional and require deploying the included Worker.
// All task data stays in localStorage; only schedules needed for notifications
// are submitted to the configured Worker when enabled.
const apiBase=()=>String(window.MY_DAILY_PUSH?.apiBase||'').replace(/\/$/,'');
const statusMessage=msg=>{$('push-status').textContent=msg;};
const auth=()=>{let id=localStorage.getItem('my-daily-device-id');if(!id){id=crypto.randomUUID();localStorage.setItem('my-daily-device-id',id);}let secret=localStorage.getItem('my-daily-device-secret');if(!secret){secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');localStorage.setItem('my-daily-device-secret',secret);}return {id,secret};};
const jsonApi=async(path,body)=>{const res=await fetch(`${apiBase()}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...auth(),...body})});if(!res.ok)throw new Error(`Server error ${res.status}`);return res.json();};
const encodeKey=key=>{const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
const digestStore='my-daily-digest-times';
const DEFAULT_DIGEST=['09:00','14:00','20:00'];
const SUGGESTED_DIGEST=['09:00','14:00','20:00','11:00','17:00'];
const validTime=t=>typeof t==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
function digestTimes(){try{const value=JSON.parse(localStorage.getItem(digestStore));if(Array.isArray(value)&&value.length<=5&&value.every(validTime)&&new Set(value).size===value.length)return value;}catch{}return [...DEFAULT_DIGEST];}
function renderDigestTimes(){const times=digestTimes();$('digest-count').value=String(times.length);showDigestInputs(times);}
function showDigestInputs(times){const count=Number($('digest-count').value);const box=$('digest-times');box.replaceChildren();for(let i=0;i<count;i++){const label=document.createElement('label');label.textContent=`Reminder ${i+1}`;const input=document.createElement('input');input.type='time';input.id=`digest-${i}`;input.required=true;input.value=times[i]||SUGGESTED_DIGEST.find(v=>!times.includes(v)&&!Array.from(box.querySelectorAll('input')).some(el=>el.value===v))||String(8+i*2).padStart(2,'0')+':00';label.appendChild(input);box.appendChild(label);}}
$('digest-count').onchange=()=>{const existing=Array.from($('digest-times').querySelectorAll('input')).map(input=>input.value);showDigestInputs(existing);};
$('digest-save').onclick=()=>{
 const times=Array.from($('digest-times').querySelectorAll('input')).map(input=>input.value);
 if(times.some(v=>!validTime(v))||new Set(times).size!==times.length){$('digest-message').textContent='Choose different valid times for each reminder.';return;}
 localStorage.setItem(digestStore,JSON.stringify(times));
 $('digest-message').textContent='Schedule saved. Syncing with notification server…';
 if(localStorage.getItem('my-daily-push-enabled')==='yes')syncReminders().then(()=>$('digest-message').textContent=times.length?`${times.length} daily summaries scheduled.`:'Daily summaries turned off.').catch(e=>$('digest-message').textContent=`Not synced: ${e.message}`);
 else $('digest-message').textContent='Schedule saved. Enable notifications to receive Lock Screen alerts.';
};
renderDigestTimes();
let syncTimer;function queueReminderSync(){if(localStorage.getItem('my-daily-push-enabled')!=='yes'||!apiBase())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncReminders().catch(err=>statusMessage(`Sync failed: ${err.message}`)),650);}
async function syncReminders(){const subs=await navigator.serviceWorker.ready;const subscription=await subs.pushManager.getSubscription();if(!subscription)return;const payload=tasks.map(t=>({id:t.id,title:t.title,due:t.due,time:t.time,repeat:t.repeat,weekdays:weekdays(t),completed:!!t.completed,completedDates:t.completedDates||[]}));await jsonApi('/sync',{subscription:subscription.toJSON(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,digestTimes:digestTimes(),tasks:payload});statusMessage('Notifications enabled. Reminder schedule synced.');}
$('push-enable').onclick=async()=>{try{if(!apiBase()||!window.MY_DAILY_PUSH?.publicKey){statusMessage('Not connected yet. Set up Cloudflare and add the server URL and public key to push-config.js first.');return;}if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){statusMessage('Install My Daily from Safari to your iPhone Home Screen to enable notifications. Requires iOS 16.4+.');return;}const perm=await Notification.requestPermission();if(perm!=='granted'){statusMessage('Notifications were not permitted. Change this in iPhone Settings if needed.');return;}const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub){const key=String(window.MY_DAILY_PUSH.publicKey||'').trim();const keyBytes=encodeKey(key);if(keyBytes.length!==65||keyBytes[0]!==4)throw new Error('Invalid public key in push-config.js. Paste the entire publicKey from your latest matching VAPID pair, without quotes or the publicKey: label.');sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes});}localStorage.setItem('my-daily-push-enabled','yes');await syncReminders();refreshPushControls();}catch(err){statusMessage(`Could not enable notifications: ${err.message}`);}};
$('push-disable').onclick=async()=>{try{if(apiBase())await jsonApi('/disable',{});const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();localStorage.removeItem('my-daily-push-enabled');refreshPushControls();statusMessage('Notifications disabled. Tasks are still saved on this phone.');}catch(err){statusMessage(`Could not disable notifications: ${err.message}`);}};
function refreshPushControls(){const permitted=('Notification'in window)&&Notification.permission==='granted';const enabled=localStorage.getItem('my-daily-push-enabled')==='yes';const active=enabled&&permitted&&!!apiBase();$('push-enable').hidden=active;$('push-disable').hidden=!active;if(active){statusMessage('Notifications are on. You can turn them off here.');}else if(('Notification'in window)&&Notification.permission==='denied'){statusMessage('Notifications are blocked. Change permission in iPhone Settings.');}else if(!apiBase()){statusMessage('Reminders need a connected server. Configure push-config.js first.');}else{statusMessage('Turn on reminders to get Lock Screen alerts.');}}
refreshPushControls();if(localStorage.getItem('my-daily-push-enabled')==='yes'&&('Notification'in window)&&Notification.permission==='granted')queueReminderSync();

// Settings: saved theme affects colors only; task storage is unchanged.
const themeKey='my-daily-theme';
const allowedThemes=new Set(['purple','blue','green','pink','orange']);
function chooseTheme(color){const theme=allowedThemes.has(color)?color:'purple';document.documentElement.dataset.theme=theme;localStorage.setItem(themeKey,theme);document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));}
chooseTheme(localStorage.getItem(themeKey)||'purple');
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>chooseTheme(button.dataset.themeChoice)));
$('open-settings').addEventListener('click',()=>{refreshPushControls();$('settings-dialog').showModal();});
$('close-settings').addEventListener('click',()=>$('settings-dialog').close());
