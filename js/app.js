// RuZAdacha v2.3 (Local Only) — IndexedDB persistence

// Routing & drawer
const screens = {
  today: document.getElementById('screen-today'),
  ideas: document.getElementById('screen-ideas'),
  tasks: document.getElementById('screen-tasks'),
  finance: document.getElementById('screen-finance'),
  habits: document.getElementById('screen-habits'),
  analytics: document.getElementById('screen-analytics'),
};
const sideNav = document.querySelectorAll('.menu-item');
const links = document.querySelectorAll('[data-route]');
const sidebar = document.querySelector('[data-role="sidebar"]');
const scrim = document.querySelector('[data-role="scrim"]');
function isMobile(){ return matchMedia('(max-width:1023px)').matches; }
function openDrawer(){ if (isMobile()){ sidebar.classList.add('open'); scrim.classList.add('show'); } }
function closeDrawer(){ sidebar.classList.remove('open'); scrim.classList.remove('show'); }
function activate(route){
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[route].classList.add('active');
  sideNav.forEach(el => el.classList.remove('active'));
  document.querySelectorAll(`[data-route="${route}"]`).forEach(el => el.classList.add('active'));
  localStorage.setItem('ruz_last', route);
  if (isMobile()) closeDrawer();
}
links.forEach(el => el.addEventListener('click', (e) => { const r = el.getAttribute('data-route'); if (r) { e.preventDefault(); activate(r);} }));
sideNav.forEach(el => el.addEventListener('click', () => activate(el.getAttribute('data-route'))));
activate(localStorage.getItem('ruz_last') || 'today');
let sx=0,touch=false;
document.addEventListener('touchstart',e=>{ if(e.touches[0].clientX<22){ touch=true; sx=e.touches[0].clientX; } });
document.addEventListener('touchmove',e=>{ if(!touch) return; if(e.touches[0].clientX - sx > 40){ openDrawer(); touch=false; } });
document.addEventListener('touchend',()=> touch=false);
scrim.addEventListener('click', closeDrawer);

// IndexedDB helper
const idb = (function(){
  let dbp;
  function open(){
    if (dbp) return dbp;
    dbp = new Promise((res,rej)=>{
      const r = indexedDB.open('ru_focus_db', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore('state'); // key: 'data'
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function get(key){ const db = await open(); return new Promise((res,rej)=>{ const tx=db.transaction('state'); const req=tx.objectStore('state').get(key); req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error); }); }
  async function set(key,val){ const db = await open(); return new Promise((res,rej)=>{ const tx=db.transaction('state','readwrite'); tx.objectStore('state').put(val,key); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
  return {get,set};
})();

// State
async function getState(){
  const base = await idb.get('data') || { updatedAt: null, tasks: [], habits: [], finance: [] };
  if (!Array.isArray(base.ideas)) base.ideas = [];
  if (!Array.isArray(base.notes)) base.notes = [];
  return base;
}
async function setState(next){
  next.updatedAt = new Date().toISOString();
  await idb.set('data', next);
  renderAll();
}

// Tasks
const taskInput = document.getElementById('taskInput');
const taskDueInput = document.getElementById('taskDueInput');
const taskList = document.getElementById('taskList');
document.getElementById('fabAddTask').addEventListener('click', ()=>{ taskInput.scrollIntoView({behavior:'smooth',block:'center'}); taskInput.focus(); });
function isOverdue(d, done){ if(!d) return false; const today = new Date().toISOString().slice(0,10); return (!done && d < today); }
async function renderTasks(filter='all'){
  const s = await getState(); const tasks = s.tasks;
  const today = new Date().toISOString().slice(0,10);
  const filtered = tasks.filter(t => filter==='today' ? (t.dueDate||today)===today : filter==='open' ? !t.done : filter==='overdue' ? isOverdue(t.dueDate,t.done) : true);
  taskList.innerHTML = '';
  filtered.forEach(t => {
    const li = document.createElement('li');
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked=!!t.done; chk.className='chk';
    chk.addEventListener('change', async ()=>{ t.done = chk.checked; await setState(s); });
    const title = document.createElement('div'); title.className='title'; title.textContent = t.title;
    const meta = document.createElement('div'); meta.className='meta';
    const b = document.createElement('span'); b.className='badge '+(isOverdue(t.dueDate,t.done)?'overdue':'due'); b.textContent = t.dueDate ? (isOverdue(t.dueDate,t.done)?`Просрочено: ${t.dueDate}`:`Дедлайн: ${t.dueDate}`) : 'Без срока'; meta.appendChild(b);
    const actions = document.createElement('div'); actions.className='actions';
    const noteBtn = document.createElement('button'); noteBtn.className='btn ghost'; noteBtn.textContent='📝'; noteBtn.title='Заметки';
    noteBtn.addEventListener('click', ()=>openNotes(t.id));
    const del = document.createElement('button'); del.className='btn ghost'; del.textContent='Удалить';
    del.addEventListener('click', async ()=>{ s.tasks = s.tasks.filter(x=>x.id!==t.id); await setState(s); });
    actions.append(noteBtn, del);
    li.append(chk, title, meta, actions); taskList.appendChild(li);
  });
}
document.querySelectorAll('[data-filter]').forEach(chip => chip.addEventListener('click',()=>{
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('is-active'));
  chip.classList.add('is-active'); renderTasks(chip.getAttribute('data-filter'));
}));
taskInput.addEventListener('keydown', async (e)=>{
  if (e.key==='Enter' && taskInput.value.trim()){
    const s = await getState();
    const due = taskDueInput.value || new Date().toISOString().slice(0,10);
    s.tasks.unshift({ id:'t'+Date.now(), title: taskInput.value.trim(), done:false, dueDate: due });
    await setState(s); taskInput.value='';
  }
});

// Finance
const amountInput = document.getElementById('amountInput');
const typeInput = document.getElementById('typeInput');
const catInput = document.getElementById('catInput');
const addTxnBtn = document.getElementById('addTxn');
const txnList = document.getElementById('txnList');
const balanceValue = document.getElementById('balanceValue');
async function renderTxns(){
  const s = await getState(); const tx = s.finance; txnList.innerHTML=''; let bal=0;
  tx.forEach(x=>{
    bal += x.type==='income'?x.amount:-x.amount;
    const li=document.createElement('li');
    const t=document.createElement('div'); t.className='title'; t.textContent = `${x.type==='income'?'+':'-'}${x.amount} • ${x.category} • ${x.date}`;
    const del=document.createElement('button'); del.className='btn ghost'; del.textContent='Удалить';
    del.addEventListener('click', async ()=>{ s.finance = s.finance.filter(y=>y.id!==x.id); await setState(s); });
    li.append(t, del); txnList.appendChild(li);
  });
  balanceValue.textContent = `${bal} ₽`;
}
addTxnBtn.addEventListener('click', async ()=>{
  const amount = parseFloat(amountInput.value||'0'); if (!amount) return;
  const s = await getState(); const date = new Date().toISOString().slice(0,10);
  s.finance.unshift({ id:'f'+Date.now(), type: typeInput.value, amount, category: (catInput.value.trim() || 'прочее'), date });
  await setState(s); amountInput.value=''; catInput.value='';
});

// Habits
const habitInput = document.getElementById('habitInput');
const habitDueInput = document.getElementById('habitDueInput');
const habitList = document.getElementById('habitList');
async function renderHabits(){
  const s = await getState(); const habits = s.habits; habitList.innerHTML=''; const today = new Date().toISOString().slice(0,10);
  habits.forEach(h=>{
    const li=document.createElement('li');
    const title=document.createElement('div'); title.className='title'; title.textContent=h.title;
    const meta=document.createElement('div'); meta.className='meta';
    const bd=document.createElement('span'); bd.className='badge '+(h.dueDate && h.dueDate<today ? 'overdue':'due');
    bd.textContent = h.dueDate ? (h.dueDate<today?`Просрочено: ${h.dueDate}`:`Срок: ${h.dueDate}`) : 'Без срока'; meta.appendChild(bd);
    const done=document.createElement('button'); done.className='btn'; const isDone=(h.progress||[]).includes(today);
    done.textContent = isDone ? 'Готово ✓' : 'Сделано';
    done.addEventListener('click', async ()=>{ h.progress=h.progress||[]; if(!isDone) h.progress.push(today); await setState(s); });
    const del=document.createElement('button'); del.className='btn ghost'; del.textContent='Удалить';
    del.addEventListener('click', async ()=>{ s.habits = s.habits.filter(x=>x.id!==h.id); await setState(s); });
    li.append(title, meta, done, del); habitList.appendChild(li);
  });
}
document.getElementById('addHabit').addEventListener('click', async ()=>{
  if (!habitInput.value.trim()) return;
  const s = await getState();
  s.habits.unshift({ id:'h'+Date.now(), title: habitInput.value.trim(), dueDate: (habitDueInput.value || ''), progress: [] });
  await setState(s); habitInput.value=''; habitDueInput.value='';
});

// Analytics
async function updateAnalytics(){
  const s = await getState(); const tasks = s.tasks;
  const today = new Date(); const toStr = d=>d.toISOString().slice(0,10);
  const days = [...Array(7)].map((_,i)=>{ const d=new Date(today); d.setDate(d.getDate()-i); return toStr(d); }).reverse();
  let done=0,total=0,over=0;
  tasks.forEach(t=>{ if(days.includes(t.dueDate)) total++; if(t.done && days.includes(t.dueDate)) done++; if(!t.done && t.dueDate && t.dueDate < toStr(today)) over++; });
  document.getElementById('tasksStats').textContent = `За 7 дней: ${done}/${total} • Просрочено: ${over}`;
  const habits = s.habits; const todayStr = toStr(today); const hd = habits.filter(h=>(h.progress||[]).includes(todayStr)).length;
  const pct = habits.length?Math.round(hd/habits.length*100):0;
  document.getElementById('habitsStats').textContent = `Сегодня: ${hd}/${habits.length} (${pct}%)`;
  const txns = s.finance; let bal=0; txns.filter(x=>days.includes(x.date)).forEach(x=>{ bal += x.type==='income'?x.amount:-x.amount; });
  document.getElementById('financeStats').textContent = `Баланс за 7 дней: ${bal} ₽`;
}
async function renderAll(){ await renderTasks(document.querySelector('.chip.is-active')?.getAttribute('data-filter')||'all'); await renderTxns(); await renderHabits(); await updateAnalytics(); await renderIdeas(); }
renderAll();

// PWA install
const installBtn = document.getElementById('installBtn'); let defPrompt;
window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); defPrompt=e; installBtn.hidden=false; });
installBtn?.addEventListener('click', async ()=>{ if(!defPrompt) return; defPrompt.prompt(); await defPrompt.userChoice; installBtn.hidden=true; });



// ---------- v3.1: Quick Parse ----------
function parseQuick(input){
  let title = input.trim();
  const tags = [];
  let priority = null;
  title = title.replace(/#(\S+)/g, (_,t)=>{ tags.push(t); return ''; }).trim();
  const pm = title.match(/!(выс(окий)?|сред(ний)?|низ(кий)?)/i);
  if (pm){ priority = pm[1].toLowerCase().startsWith('выс') ? 'high' : pm[1].toLowerCase().startsWith('сред') ? 'mid' : 'low'; title = title.replace(pm[0],'').trim(); }
  let dueDate = null;
  const today = new Date();
  const toISO = d => d.toISOString().slice(0,10);
  const low = input.toLowerCase();
  if (/\bсегодня\b/.test(low)) dueDate = toISO(today);
  else if (/\bзавтра\b/.test(low)) { const t=new Date(); t.setDate(t.getDate()+1); dueDate = toISO(t); }
  const iso = input.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) dueDate = iso[1];
  return { title: title || input.trim(), tags, priority, dueDate };
}

// ---------- v3.1: Ideas ----------
const ideaInput = document.getElementById('ideaInput');
const addIdeaBtn = document.getElementById('addIdea');
const ideasList = document.getElementById('ideasList');
async function renderIdeas(){
  const s = await getState();
  ideasList.innerHTML = '';
  (s.ideas||[]).slice().reverse().forEach(idea => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.className='title'; title.textContent = idea.content;
    const actions = document.createElement('div'); actions.className='task-actions';
    const toTask = document.createElement('button'); toTask.className='btn small'; toTask.textContent='Сделать задачей';
    toTask.addEventListener('click', async ()=>{
      const parsed = parseQuick(idea.content);
      const task = { id:'t'+Date.now(), title: parsed.title, done:false, dueDate: (parsed.dueDate||''), tags: parsed.tags||[], priority: parsed.priority||null };
      s.tasks.unshift(task);
      idea.linkedTaskId = task.id;
      await setState(s);
    });
    const del = document.createElement('button'); del.className='btn ghost small'; del.textContent='Удалить';
    del.addEventListener('click', async ()=>{ s.ideas = s.ideas.filter(x=>x.id!==idea.id); await setState(s); });
    actions.append(toTask, del);
    li.append(title, actions);
    ideasList.appendChild(li);
  });
}
addIdeaBtn?.addEventListener('click', async ()=>{
  if (!ideaInput.value.trim()) return;
  const s = await getState();
  s.ideas = s.ideas || [];
  s.ideas.push({ id:'i'+Date.now(), content: ideaInput.value.trim(), createdAt: new Date().toISOString() });
  await setState(s);
  ideaInput.value='';
});
ideaInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addIdeaBtn.click(); } });

// ---------- v3.1: Notes ----------
const notesModal = document.getElementById('notesModal');
const notesList = document.getElementById('notesList');
const noteInput = document.getElementById('noteInput');
const addNoteBtn = document.getElementById('addNote');
const closeNotesBtn = document.getElementById('closeNotes');
let currentNotesTaskId = null;
function openNotes(taskId){ currentNotesTaskId = taskId; notesModal.classList.add('show'); renderNotes(taskId); }
function closeNotes(){ notesModal.classList.remove('show'); currentNotesTaskId = null; }
closeNotesBtn?.addEventListener('click', closeNotes);
async function renderNotes(taskId){
  const s = await getState();
  notesList.innerHTML = '';
  (s.notes||[]).filter(n=>n.taskId===taskId).forEach(n=>{
    const li=document.createElement('li'); li.textContent = n.content + ' • ' + new Date(n.createdAt).toLocaleString(); notesList.appendChild(li);
  });
}
addNoteBtn?.addEventListener('click', async ()=>{
  if (!currentNotesTaskId || !noteInput.value.trim()) return;
  const s = await getState();
  s.notes = s.notes || [];
  s.notes.push({ id:'n'+Date.now(), taskId: currentNotesTaskId, content: noteInput.value.trim(), createdAt: Date.now() });
  await setState(s); noteInput.value='';
});
noteInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addNoteBtn.click(); } });

// ---------- v3.1: Voice input (robust) ----------
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatus = document.getElementById('voiceStatus');
let rec, canVoice = false, listening = false;
let voiceBuffer = '';
let voiceTimer = null;
(function initVoice(){
  const w = window; const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return;
  canVoice = true;
  rec = new SR();
  rec.lang = 'ru-RU';
  rec.interimResults = true;
  rec.continuous = false;
  rec.onstart = () => setVoiceUI(true, 'Скажи задачу… скажи «готово» чтобы сохранить');
  rec.onerror = ()  => stopVoice(true);
  rec.onend   = ()  => stopVoice();
  rec.onresult = async (ev) => {
    let interim = '', finalText = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      const chunk = res[0].transcript.trim();
      if (res.isFinal) finalText += (finalText ? ' ' : '') + chunk;
      else interim += (interim ? ' ' : '') + chunk;
    }
    if (finalText) voiceBuffer += (voiceBuffer ? ' ' : '') + finalText;
    resetVoiceTimer();
    const fullPreview = (voiceBuffer + (interim ? (' ' + interim) : '')).trim();
    if (/(^|\b)(готово|всё|все|сохранить|стоп)(\b|$)/i.test(fullPreview)) {
      voiceBuffer = fullPreview.replace(/(^|\b)(готово|всё|все|сохранить|стоп)(\b|$)/ig, '').trim();
      stopVoice();
      await finalizeVoiceBuffer();
      return;
    }
    setVoiceUI(true, fullPreview || '…');
  };
})();
function resetVoiceTimer(){ if (voiceTimer) clearTimeout(voiceTimer); voiceTimer = setTimeout(async () => { stopVoice(); await finalizeVoiceBuffer(); }, 1500); }
function setVoiceUI(isOn, text){
  listening = isOn;
  if (voiceBtn) { voiceBtn.classList.toggle('recording', isOn); voiceBtn.textContent = isOn ? '● Запись…' : '🎤 Голос'; }
  if (voiceStatus) voiceStatus.textContent = isOn ? (text || 'Скажи задачу') : '';
}
function startVoice(){
  if (!canVoice || !rec) { const text = prompt('Голос недоступен. Введи текст задачи:'); if (text) createTaskFromText(text); return; }
  voiceBuffer = ''; if (voiceTimer) clearTimeout(voiceTimer);
  setVoiceUI(true, 'Скажи задачу… скажи «готово» чтобы сохранить'); try { rec.start(); } catch {}
}
function stopVoice(resetUI){ if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null; } try { rec && rec.stop && rec.stop(); } catch {} if (resetUI) setVoiceUI(false, ''); }
async function finalizeVoiceBuffer(){
  const text = voiceBuffer.trim(); voiceBuffer=''; setVoiceUI(false, ''); if (!text) return;
  const parsed = parseQuick(text);
  const due = parsed.dueDate || (new Date().toISOString().slice(0,10));
  const preview = `${parsed.title} ${parsed.dueDate ? '• ' + parsed.dueDate : ''}`.trim();
  const ok = confirm(`Создать задачу?\n\n${preview}`); if (!ok) return;
  const s = await getState();
  s.tasks.unshift({ id:'t'+Date.now(), title: parsed.title, done:false, dueDate: due, tags: parsed.tags||[], priority: parsed.priority||null });
  await setState(s);
}
function createTaskFromText(text){
  const parsed = parseQuick(text);
  const due = parsed.dueDate || (new Date().toISOString().slice(0,10));
  getState().then(async s => { s.tasks.unshift({ id:'t'+Date.now(), title: parsed.title, done:false, dueDate: due, tags: parsed.tags||[], priority: parsed.priority||null }); await setState(s); });
}
voiceBtn?.addEventListener('click', () => { if (!listening) startVoice(); else { stopVoice(); finalizeVoiceBuffer(); } });

