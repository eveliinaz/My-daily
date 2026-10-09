'use strict';
const STORE='my-daily-v1';
const $=id=>document.getElementById(id);
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today=()=>localDate();
const friendlyDate=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'});};
const uid=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;
function load(){try{const data=JSON.parse(localStorage.getItem(STORE));return Array.isArray(data)?data:[];}catch{return [];}}
let tasks=load(),tab='today',editing=null;
function save(){localStorage.setItem(STORE,JSON.stringify(tasks));render();}
// Daily habits are completed once per calendar day; a one-time task stays completed.
function isDone(t){return t.repeat==='daily'?t.completedDates?.includes(today()):Boolean(t.completed);}
function relevant(t){if(tab==='all')return true;if(tab==='upcoming')return t.repeat!=='daily'&&t.due>today();return t.repeat==='daily'?t.due<=today():t.due<=today();}
function toggle(id){const t=tasks.find(t=>t.id===id);if(!t)return;if(t.repeat==='daily'){t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];t.completedDates=t.completedDates.includes(today())?t.completedDates.filter(d=>d!==today()):[...t.completedDates,today()];}else t.completed=!t.completed;save();}
function render(){
 $('date-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 const daily=tasks.filter(t=>t.repeat==='daily'?t.due<=today():t.due<=today());const done=daily.filter(isDone).length;
 $('progress-label').textContent=`${done} of ${daily.length} done`;$('progress-bar').style.width=`${daily.length?100*done/daily.length:0}%`;
 if(tab==='calendar'){renderCalendar();return;}
 const visible=tasks.filter(relevant).sort((a,b)=>a.due.localeCompare(b.due)||a.time.localeCompare(b.time));
 $('list-title').textContent=tab==='today'?"Today's tasks":tab==='upcoming'?'Upcoming tasks':'All tasks';$('task-count').textContent=`${visible.length} tasks`;
 const list=$('task-list');list.replaceChildren();
 if(!visible.length){const el=document.createElement('div');el.className='empty';el.textContent='Nothing here yet. Add your first task.';list.append(el);return;}
 for(const t of visible){const row=document.createElement('div');row.className='task';const main=document.createElement('div');main.className='task-main';const check=document.createElement('button');check.className=`check ${isDone(t)?'done':''}`;check.textContent=isDone(t)?'Done':'';check.setAttribute('aria-label',`Mark ${t.title} ${isDone(t)?'incomplete':'complete'}`);check.onclick=()=>toggle(t.id);const body=document.createElement('div');body.className='task-text';const name=document.createElement('div');name.className=`task-name ${isDone(t)?'done':''}`;name.textContent=t.title;const meta=document.createElement('div');meta.className='task-meta';meta.textContent=`${t.repeat==='daily'?'Every day from '+friendlyDate(t.due):friendlyDate(t.due)} · ${t.time}`;body.append(name,meta);main.append(check,body);const edit=document.createElement('button');edit.className='edit';edit.textContent='Edit';edit.setAttribute('aria-label',`Edit ${t.title}`);edit.onclick=()=>openForm(t.id);row.append(main,edit);list.append(row);}
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
  const active=tasks.filter(t=>t.repeat==='daily'?t.due<=date:t.due===date);
  const cell=document.createElement('button');cell.type='button';cell.className='cal-day'+(date===today()?' current':'');
  cell.textContent=String(day);
  if(active.length){const dot=document.createElement('span');dot.className='cal-dot';dot.textContent=String(active.length);cell.append(dot);}
  cell.title=`${date}: ${active.length} task(s)`;
  cell.onclick=()=>{const heading=$('calendar-selection');if(heading)heading.remove();const existing=$('calendar-details');if(existing)existing.remove();const details=document.createElement('div');details.id='calendar-details';details.className='calendar-details';const title=document.createElement('h3');title.textContent=new Date(year,month,day).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});details.append(title);if(!active.length){const p=document.createElement('p');p.textContent='No tasks scheduled.';details.append(p);}for(const t of active){const p=document.createElement('p');p.textContent=`${t.time} — ${t.title}`;details.append(p);}list.append(details);};
  grid.append(cell);
 }
 list.append(grid);
}

function openForm(id=null){editing=id;const t=tasks.find(t=>t.id===id);$('dialog-title').textContent=t?'Edit task':'New task';$('title').value=t?.title??'';$('due').value=t?.due??today();$('time').value=t?.time??'09:00';$('repeat').value=t?.repeat??'none';$('delete-btn').hidden=!t;$('task-dialog').showModal();}
$('open-form').onclick=()=>openForm();$('close-form').onclick=()=>$('task-dialog').close();
$('task-form').onsubmit=e=>{e.preventDefault();const title=$('title').value.trim(),due=$('due').value,time=$('time').value,repeat=$('repeat').value;if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!/^\d{2}:\d{2}$/.test(time))return;const old=tasks.find(t=>t.id===editing);if(old){Object.assign(old,{title,due,time,repeat});if(repeat!== 'daily')old.completedDates=[];if(repeat==='daily')old.completed=false;}else tasks.push({id:uid(),title,due,time,repeat,completed:false,completedDates:[]});$('task-dialog').close();save();};
$('delete-btn').onclick=()=>{if(editing&&confirm('Delete this task?')){tasks=tasks.filter(t=>t.id!==editing);$('task-dialog').close();save();}};
document.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{tab=btn.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));render();});
// In-page reminder only. Browsers do not reliably run this when closed or suspended.
const shown=new Set();function checkDueWhileOpen(){const now=new Date();const minute=now.toTimeString().slice(0,5);for(const t of tasks){if((t.repeat==='daily'?t.due<=today():t.due===today())&&t.time===minute&&!isDone(t)){const key=`${today()}|${minute}|${t.id}`;if(!shown.has(key)){shown.add(key);alert(`My Daily reminder: ${t.title}`);}}}}
setInterval(()=>{if(document.visibilityState==='visible'){if($('date-label').dataset.today!==today()){$('date-label').dataset.today=today();render();}checkDueWhileOpen();}},15000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
render();
