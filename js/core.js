"use strict";
const CONFIG={FOCUS_BLOCKS:8,FOCUS_MINUTES:30,FOCUS_MAX:16,AUTOSAVE_MS:1100};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const LEGACY={links:'devworkbench_v04_links',spaces:'devworkbench_v05_spaces',reminders:'devworkbench_v04_tasks',focus:'devworkbench_v06_focus'};
const LINKS_KEY=LEGACY.links,SPACES_KEY=LEGACY.spaces;
const PATHS={links:'dados/links.json',spaces:'dados/espacos.json',reminders:'dados/lembretes.json',focus:'dados/foco.json',notes:'dados/anotacoes.json',catalog:'dados/tags.json',settings:'dados/config.json'};
let settings={blocks:8,minutes:30};
let catalog=[], links=[],spaces=[],reminders=[],focusData={},notes=[];
let activeTag='Todas',linkPage=1,editingId=null,editingReminder=null,activeNote=null,noteTimer=null,notesVersion=0,storageSession=0;
const uid=()=>crypto.randomUUID();
const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateShift=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return day(d);};
const tags=s=>[...new Set(String(s||'').split(',').map(t=>t.trim()).filter(Boolean))];
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className=error?'show error':'show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className='',4300);}
function ask(title,message){return new Promise(resolve=>{const d=$('#confirmDialog');$('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;const finish=v=>{d.close();resolve(v);};$('#confirmCancel').onclick=()=>finish(false);$('#confirmYes').onclick=()=>finish(true);d.oncancel=e=>{e.preventDefault();finish(false);};d.showModal();});}
function updateFolder(){const ok=FileStorage.ready();$('#folderStatus').textContent=ok?'📁 '+FileStorage.name():'⚠ Pasta não conectada';$('#folderStatus').title=ok?'Pasta física conectada. O Chrome não fornece o caminho absoluto.':'Conecte a pasta para salvar seus dados';$('#configFolder').textContent=FileStorage.name();$('#chooseFolder').textContent=ok?'Alterar pasta':'Selecionar pasta';}
async function ensureFolder(){if(FileStorage.ready())return true;$('#folderDialog').showModal();return false;}
function snapshot(name){return JSON.stringify(name==='links'?links:name==='spaces'?spaces:name==='reminders'?reminders:name==='focus'?focusData:name==='catalog'?catalog:name==='settings'?settings:notes,null,2);}
function persist(name){if(!FileStorage.ready()){toast('Conecte a pasta para salvar.',true);return Promise.resolve(false);}const session=storageSession;const content=snapshot(name);return FileStorage.enqueue(async()=>{if(session!==storageSession)return false;try{await FileStorage.write(PATHS[name],content);return true;}catch(e){console.error(e);toast('Falha ao gravar '+name+': '+e.message,true);return false;}});}
function saveStorage(key){const entry=Object.entries(LEGACY).find(([,v])=>v===key);if(entry)return persist(entry[0]);}
function legacyArray(key){try{const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:[];}catch{return [];}}
function legacyObject(key){try{const v=JSON.parse(localStorage.getItem(key));return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
async function loadAll(){if(!FileStorage.ready())return;storageSession++;try{
 const fresh={};for(const [key,path] of Object.entries(PATHS)){const text=await FileStorage.read(path);fresh[key]=text===null?null:JSON.parse(text);}
 for(const k of ["links","spaces","reminders","notes","catalog"])if(fresh[k]!==null&&!Array.isArray(fresh[k]))throw new Error("Formato inválido: "+k);
 links=Array.isArray(fresh.links)?fresh.links:legacyArray(LEGACY.links);
 spaces=Array.isArray(fresh.spaces)?fresh.spaces:legacyArray(LEGACY.spaces);
 reminders=Array.isArray(fresh.reminders)?fresh.reminders:legacyArray(LEGACY.reminders).map(r=>({...r,date:day(),priority:false,tags:[]}));
 focusData=fresh.focus&&typeof fresh.focus==='object'&&!Array.isArray(fresh.focus)?fresh.focus:legacyObject(LEGACY.focus);
 settings={blocks:Math.min(16,Math.max(1,Number(fresh.settings?.blocks)||8)),minutes:Math.min(240,Math.max(1,Number(fresh.settings?.minutes)||30))};
 notes=Array.isArray(fresh.notes)?fresh.notes:[]; catalog=Array.isArray(fresh.catalog)?fresh.catalog:[]; for(const t of [...links,...notes,...reminders].flatMap(x=>x.tags||[])) if(!catalog.includes(t))catalog.push(t); refreshCatalog();
 for(const key of Object.keys(PATHS))if(fresh[key]===null)await persist(key);
 updateFolder();renderAll();toast('Pasta conectada · dados carregados');
 }catch(e){console.error(e);toast('Erro ao carregar pasta: '+e.message+' · dados não substituídos',true);}}
let connectingFolder=false;
async function connectFolder(){
 if(connectingFolder)return;
 if(activeNote){toast('Feche a anotação antes de trocar a pasta.',true);return;}
 connectingFolder=true;
 try{await FileStorage.select();await loadAll();if($('#folderDialog').open)$('#folderDialog').close();}
 catch(e){if(e.name!=='AbortError')toast('Não foi possível selecionar a pasta: '+e.message,true);}
 finally{connectingFolder=false;}
}
$('#chooseFolder').onclick=()=>{if(FileStorage.ready()){ask('Alterar pasta?','Os dados atuais permanecerão na pasta anterior. Faça backup antes de trocar.').then(ok=>{if(ok)connectFolder();});}else connectFolder();};
$('#folderConnect').onclick=()=>connectFolder();
$('#folderCancel').onclick=()=>$('#folderDialog').close();
function updateClock(){const now=new Date();$('#dateNow').textContent=now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});$('#timeNow').textContent=now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});if(day()!==focusDay){focusDay=day();renderAll();}}
let focusDay=day();setInterval(updateClock,1000);
const sectionLabels={inicio:'Home',links:'Meus links',anotacoes:'Anotações',lembretes:'Lembretes',ferramentas:'Ferramentas',daily:'Daily',kanban:'Kanban',wiki:'Wiki',skills:'Skills',assistente:'Assistente IA',config:'Configurações'};
function navigate(section){if($('#section-config').classList.contains('active')&&section!=='config')renderAll();$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.section===section));$$('.page').forEach(p=>p.classList.remove('active'));const id=['inicio','links','anotacoes','lembretes','ferramentas','config'].includes(section)?`#section-${section}`:'#section-placeholder';$(id).classList.add('active');$('#breadcrumbSection').textContent=sectionLabels[section]||'Home';if(id==='#section-placeholder')$('#placeholderTitle').textContent=sectionLabels[section];if(section==='config')renderConfig();if(section==='links')renderLinks();if(section==='anotacoes')renderNotes();if(section==='lembretes')renderReminders();}
$$('.nav-item').forEach(b=>b.onclick=()=>navigate(b.dataset.section));$$('[data-goto]').forEach(b=>b.onclick=()=>navigate(b.dataset.goto));$('#backHome').onclick=()=>navigate('inicio');

