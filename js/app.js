"use strict";
const CONFIG = { FOCUS_BLOCKS: 8, FOCUS_MINUTES: 30, FOCUS_MAX: 16, AUTOSAVE_MS: 1100 };
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LEGACY = { links: 'devworkbench_v04_links', spaces: 'devworkbench_v05_spaces', reminders: 'devworkbench_v04_tasks', focus: 'devworkbench_v06_focus' };
const LINKS_KEY = LEGACY.links, SPACES_KEY = LEGACY.spaces;
const PATHS = { links: 'dados/links.json', spaces: 'dados/espacos.json', reminders: 'dados/lembretes.json', focus: 'dados/foco.json', notes: 'dados/anotacoes.json' };
let links = [], spaces = [], reminders = [], focusData = {}, notes = [];
let activeTag = 'Todas', linkPage = 1, editingId = null, editingReminder = null, activeNote = null, noteTimer = null, notesVersion = 0, storageSession = 0;
const uid = () => crypto.randomUUID();
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateShift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return day(d); };
const tags = s => [...new Set(String(s || '').split(',').map(t => t.trim()).filter(Boolean))];
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = error ? 'show error' : 'show'; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.className = '', 4300); }
function ask(title, message) { return new Promise(resolve => { const d = $('#confirmDialog'); $('#confirmTitle').textContent = title; $('#confirmMessage').textContent = message; const finish = v => { d.close(); resolve(v); }; $('#confirmCancel').onclick = () => finish(false); $('#confirmYes').onclick = () => finish(true); d.oncancel = e => { e.preventDefault(); finish(false); }; d.showModal(); }); }
function updateFolder() { const ok = FileStorage.ready(); $('#folderStatus').textContent = ok ? '📁 ' + FileStorage.name() : '⚠ Pasta não conectada'; $('#folderStatus').title = ok ? 'Pasta física conectada. O Chrome não fornece o caminho absoluto.' : 'Conecte a pasta para salvar seus dados'; $('#chooseFolder').textContent = ok ? 'Alterar pasta' : 'Selecionar pasta'; }
async function ensureFolder() { if (FileStorage.ready()) return true; $('#folderDialog').showModal(); return false; }
function snapshot(name) { return JSON.stringify(name === 'links' ? links : name === 'spaces' ? spaces : name === 'reminders' ? reminders : name === 'focus' ? focusData : notes, null, 2); }
function persist(name) { if (!FileStorage.ready()) { toast('Conecte a pasta para salvar.', true); return Promise.resolve(false); } const session = storageSession; const content = snapshot(name); return FileStorage.enqueue(async () => { if (session !== storageSession) return false; try { await FileStorage.write(PATHS[name], content); return true; } catch (e) { console.error(e); toast('Falha ao gravar ' + name + ': ' + e.message, true); return false; } }); }
function saveStorage(key) { const entry = Object.entries(LEGACY).find(([, v]) => v === key); if (entry) return persist(entry[0]); }
function legacyArray(key) { try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : []; } catch { return []; } }
function legacyObject(key) { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } }
async function loadAll() {
  if (!FileStorage.ready()) return; storageSession++; try {
    const fresh = {}; for (const [key, path] of Object.entries(PATHS)) { const text = await FileStorage.read(path); fresh[key] = text === null ? null : JSON.parse(text); }
    links = Array.isArray(fresh.links) ? fresh.links : legacyArray(LEGACY.links);
    spaces = Array.isArray(fresh.spaces) ? fresh.spaces : legacyArray(LEGACY.spaces);
    reminders = Array.isArray(fresh.reminders) ? fresh.reminders : legacyArray(LEGACY.reminders).map(r => ({ ...r, date: day(), priority: false, tags: [] }));
    focusData = fresh.focus && typeof fresh.focus === 'object' && !Array.isArray(fresh.focus) ? fresh.focus : legacyObject(LEGACY.focus);
    notes = Array.isArray(fresh.notes) ? fresh.notes : [];
    for (const key of Object.keys(PATHS)) if (fresh[key] === null) await persist(key);
    updateFolder(); renderAll(); toast('Pasta conectada · dados carregados');
  } catch (e) { console.error(e); toast('Erro ao carregar pasta: ' + e.message + ' · dados não substituídos', true); }
}
async function connectFolder(change = false) { try { if (change && FileStorage.ready() && !await ask('Alterar pasta?', 'A nova pasta será carregada. Os dados da pasta atual permanecerão nela. Faça backup antes de trocar.')) return; await FileStorage.select(); $('#folderDialog').close(); await loadAll(); } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível selecionar a pasta: ' + e.message, true); } }
$('#chooseFolder').onclick = async () => { if (!FileStorage.ready()) { try { if (await FileStorage.reconnect()) { await loadAll(); return; } } catch { } } await connectFolder(FileStorage.ready()); };
$('#folderConnect').onclick = () => connectFolder(false);
$('#folderCancel').onclick = () => $('#folderDialog').close();
function updateClock() { const now = new Date(); $('#dateNow').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); $('#timeNow').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); if (day() !== focusDay) { focusDay = day(); renderAll(); } }
let focusDay = day(); updateClock(); setInterval(updateClock, 1000);
const sectionLabels = { inicio: 'Home', links: 'Meus links', anotacoes: 'Anotações', lembretes: 'Lembretes', ferramentas: 'Ferramentas', daily: 'Daily', kanban: 'Kanban', wiki: 'Wiki', skills: 'Skills', assistente: 'Assistente IA' };
function navigate(section) { $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === section)); $$('.page').forEach(p => p.classList.remove('active')); const id = ['inicio', 'links', 'anotacoes', 'lembretes', 'ferramentas'].includes(section) ? `#section-${section}` : '#section-placeholder'; $(id).classList.add('active'); $('#breadcrumbSection').textContent = sectionLabels[section] || 'Home'; if (id === '#section-placeholder') $('#placeholderTitle').textContent = sectionLabels[section]; if (section === 'links') renderLinks(); if (section === 'anotacoes') renderNotes(); if (section === 'lembretes') renderReminders(); }
$$('.nav-item').forEach(b => b.onclick = () => navigate(b.dataset.section)); $$('[data-goto]').forEach(b => b.onclick = () => navigate(b.dataset.goto)); $('#backHome').onclick = () => navigate('inicio');

function createLinkCard(link) {
  const card = document.createElement("article"); card.className = "link-card";
  const anchor = document.createElement("a"); anchor.className = "link-card-main";
  anchor.href = link.url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
  const symbol = document.createElement("span"); symbol.className = "link-symbol"; symbol.textContent = "↗";
  const title = document.createElement("h3"); title.textContent = link.name;
  const description = document.createElement("p"); description.textContent = link.description || link.url;
  anchor.append(symbol, title, description);
  const tags = document.createElement("div"); tags.className = "card-tags";
  (link.tags || []).forEach(tag => { const badge = document.createElement("span"); badge.className = "tag-badge"; badge.textContent = tag; tags.append(badge); });
  anchor.append(tags);
  const actions = document.createElement("div"); actions.className = "card-actions";
  const favorite = document.createElement("button"); favorite.className = `icon-btn favorite-toggle${link.favorite ? " is-favorite" : ""}`;
  favorite.type = "button"; favorite.textContent = link.favorite ? "★" : "☆";
  favorite.title = link.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
  favorite.setAttribute("aria-label", favorite.title + ": " + link.name);
  favorite.addEventListener("click", () => { link.favorite = !link.favorite; saveStorage(LINKS_KEY, links); renderLinks(); });
  const edit = document.createElement("button"); edit.className = "icon-btn"; edit.type = "button"; edit.textContent = "✎"; edit.title = "Editar link"; edit.setAttribute("aria-label", `Editar ${link.name}`);
  edit.addEventListener("click", () => openLinkDialog(link.id));
  const remove = document.createElement("button"); remove.className = "icon-btn"; remove.type = "button"; remove.textContent = "×"; remove.title = "Excluir link"; remove.setAttribute("aria-label", `Excluir ${link.name}`);
  remove.addEventListener("click", async () => { if (!await ask("Excluir link?", `Excluir o link "${link.name}"?`)) return; links = links.filter(item => item.id !== link.id); saveStorage(LINKS_KEY, links); renderLinks(); });
  actions.append(favorite, edit, remove); card.append(anchor, actions); return card;
}
function fillLinks(container, items) {
  container.replaceChildren();
  if (!items.length) { const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = "Nenhum link encontrado. Clique em Adicionar link para começar."; container.append(empty); return; }
  items.forEach(item => container.append(createLinkCard(item)));
}
function renderFavorites() {
  const container = $("#favoriteLinks");
  container.replaceChildren();
  const favorites = links.filter(link => link.favorite);
  $("#favoritesSection").hidden = favorites.length === 0;
  favorites.forEach(link => {
    const chip = document.createElement("a"); chip.className = "favorite-chip";
    chip.href = link.url; chip.target = "_blank"; chip.rel = "noopener noreferrer";
    const star = document.createElement("span"); star.textContent = "★"; star.className = "favorite-star";
    const name = document.createElement("span"); name.textContent = link.name;
    chip.append(star, name); container.append(chip);
  });
}
function renderLinks() {
  renderFavorites();
  const tags = [...new Set(links.flatMap(link => link.tags || []))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (activeTag !== "Todas" && !tags.includes(activeTag)) activeTag = "Todas";
  const filters = $("#tagFilters"); filters.replaceChildren();
  ["Todas", ...tags].forEach(tag => {
    const button = document.createElement("button"); button.type = "button";
    button.className = `tag-filter${tag === activeTag ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => { activeTag = tag; linkPage = 1; renderLinks(); });
    filters.append(button);
  });
  const term = $("#searchLinks").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = links.filter(link => {
    const text = `${link.name} ${link.description} ${link.url} ${(link.tags || []).join(" ")}`.toLocaleLowerCase("pt-BR");
    return text.includes(term) && (activeTag === "Todas" || (link.tags || []).includes(activeTag));
  });
  const pageSize = Number($("#pageSize").value);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  linkPage = Math.min(linkPage, totalPages);
  const start = (linkPage - 1) * pageSize;
  fillLinks($("#allLinks"), filtered.slice(start, start + pageSize));
  $("#linksCount").textContent = `${filtered.length} link(s) encontrado(s) · ${links.length} no total`;
  const pagination = $("#linksPagination"); pagination.replaceChildren();
  if (totalPages > 1) {
    const previous = document.createElement("button"); previous.textContent = "← Anterior"; previous.disabled = linkPage === 1;
    previous.addEventListener("click", () => { linkPage--; renderLinks(); });
    const info = document.createElement("span"); info.textContent = `Página ${linkPage} de ${totalPages}`;
    const next = document.createElement("button"); next.textContent = "Próxima →"; next.disabled = linkPage === totalPages;
    next.addEventListener("click", () => { linkPage++; renderLinks(); });
    pagination.append(previous, info, next);
  }

}
$("#searchLinks").addEventListener("input", () => { linkPage = 1; renderLinks(); });
$("#pageSize").addEventListener("change", () => { linkPage = 1; renderLinks(); });
function openLinkDialog(id = null) {
  editingId = id;
  $("#linkForm").reset();
  $("#dialogTitle").textContent = id ? "Editar link" : "Adicionar link";
  if (id) { const link = links.find(item => item.id === id); if (!link) return; $("#linkName").value = link.name; $("#linkUrl").value = link.url; $("#linkDescription").value = link.description; $("#linkTags").value = (link.tags || []).join(", "); }
  $("#linkDialog").showModal();
}
$$("[data-add-link]").forEach(button => button.addEventListener("click", () => openLinkDialog()));
$("#closeDialog").addEventListener("click", () => $("#linkDialog").close());
$("#cancelDialog").addEventListener("click", () => $("#linkDialog").close());
$("#linkForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("#linkName").value.trim();
  const description = $("#linkDescription").value.trim();
  const tags = [...new Set($("#linkTags").value.split(",").map(t => t.trim()).filter(Boolean))].slice(0, 12);
  let url;
  try { url = new URL($("#linkUrl").value.trim()); }
  catch { toast("Informe uma URL válida, incluindo https://", true); return; }
  if (!["https:", "http:"].includes(url.protocol)) { toast("Somente links HTTP ou HTTPS são permitidos.", true); return; }
  if (!name) return;
  if (editingId) { links = links.map(item => item.id === editingId ? { ...item, name, url: url.href, description, tags } : item); }
  else { links.push({ id: crypto.randomUUID(), name, url: url.href, description, tags, favorite: false }); }
  saveStorage(LINKS_KEY, links); renderLinks(); $("#linkDialog").close();
});

function renderSpaces() {
  const container = $("#spaceCards"); container.replaceChildren();
  if (!spaces.length) {
    const empty = document.createElement("div"); empty.className = "empty";
    empty.textContent = "Nenhum espaço cadastrado. Clique em Novo espaço para criar o primeiro.";
    container.append(empty); return;
  }
  spaces.forEach(space => {
    const card = document.createElement("article"); card.className = "space-card";
    const icon = document.createElement("span"); icon.className = "space-icon"; icon.textContent = "▦";
    const title = document.createElement("h3"); title.textContent = space.name;
    const description = document.createElement("p"); description.textContent = space.description || "Espaço de trabalho";
    const status = document.createElement("span"); status.className = "space-status"; status.textContent = "Módulos em construção";
    const actions = document.createElement("div"); actions.className = "card-actions";
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "icon-btn"; remove.textContent = "×"; remove.title = "Excluir espaço";
    remove.setAttribute("aria-label", `Excluir espaço ${space.name}`);
    remove.addEventListener("click", async () => { if (!await ask("Excluir espaço?", `Excluir o espaço "${space.name}"?`)) return; spaces = spaces.filter(s => s.id !== space.id); saveStorage(SPACES_KEY, spaces); renderSpaces(); });
    actions.append(remove); card.append(icon, title, description, status, actions); container.append(card);
  });
}
$("#addSpace").addEventListener("click", () => $("#spaceDialog").showModal());
$("#closeSpace").addEventListener("click", () => $("#spaceDialog").close());
$("#cancelSpace").addEventListener("click", () => $("#spaceDialog").close());
$("#spaceForm").addEventListener("submit", event => {
  event.preventDefault(); const name = $("#spaceName").value.trim();
  const description = $("#spaceDescription").value.trim(); if (!name) return;
  spaces.push({ id: crypto.randomUUID(), name, description }); saveStorage(SPACES_KEY, spaces);
  renderSpaces(); $("#spaceForm").reset(); $("#spaceDialog").close();
});

// Módulo Home: blocos de foco e indicadores.
function todayFocus() { if (!focusData[focusDay]) focusData[focusDay] = { goal: CONFIG.FOCUS_BLOCKS, done: [] }; const f = focusData[focusDay]; f.goal = Math.min(CONFIG.FOCUS_MAX, Math.max(1, Number(f.goal) || CONFIG.FOCUS_BLOCKS)); if (!Array.isArray(f.done)) f.done = []; return f; }
function renderFocus() { const f = todayFocus(), completed = f.done.filter(i => i < f.goal).length; $('#focusDate').textContent = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); $('#focusProgress').textContent = `${completed} / ${f.goal}`; $('#focusGoal').textContent = f.goal; $('#decreaseGoal').disabled = f.goal <= 1; $('#increaseGoal').disabled = f.goal >= CONFIG.FOCUS_MAX; $('#focusBar').style.width = `${completed / f.goal * 100}%`; $('#focusTime').textContent = `${completed * CONFIG.FOCUS_MINUTES} minutos concluídos · ${CONFIG.FOCUS_MINUTES} min por bloco`; const root = $('#focusChecks'); root.replaceChildren(); for (let i = 0; i < f.goal; i++) { const b = document.createElement('button'); b.className = 'focus-check' + (f.done.includes(i) ? ' completed' : ''); b.textContent = f.done.includes(i) ? '✓' : String(i + 1); b.title = `Bloco ${i + 1}`; b.onclick = () => { f.done = f.done.includes(i) ? f.done.filter(x => x !== i) : [...f.done, i]; persist('focus'); renderFocus(); }; root.append(b); } }
$('#decreaseGoal').onclick = () => { todayFocus().goal--; persist('focus'); renderFocus(); }; $('#increaseGoal').onclick = () => { todayFocus().goal++; persist('focus'); renderFocus(); };
function renderHome() { const today = day(), yesterday = dateShift(-1); $('#reviewYesterday').textContent = notes.filter(n => day(new Date(n.createdAt)) === yesterday && !n.archived).length; $('#reviewPending').textContent = notes.filter(n => !n.reviewed && !n.archived && day(new Date(n.createdAt)) < today).length; $('#remToday').textContent = reminders.filter(r => !r.done && r.date === today).length; $('#remOverdue').textContent = reminders.filter(r => !r.done && r.date < today).length; const preview = $('#reviewPreview'); preview.replaceChildren(); notes.filter(n => !n.reviewed && !n.archived && day(new Date(n.createdAt)) < today).slice(0, 3).forEach(n => { const b = document.createElement('button'); b.className = 'mini-item'; b.textContent = n.title || 'Sem título · título pendente'; b.onclick = () => { navigate('anotacoes'); openNote(n.id); }; preview.append(b); }); const rem = $('#remPreview'); rem.replaceChildren(); reminders.filter(r => !r.done && r.date <= today).sort((a, b) => Number(b.priority) - Number(a.priority) || a.date.localeCompare(b.date)).slice(0, 3).forEach(r => { const b = document.createElement('button'); b.className = 'mini-item' + (r.priority ? ' is-priority' : ''); b.textContent = r.text; b.onclick = () => navigate('lembretes'); rem.append(b); }); }

// Módulo Lembretes.
function reminderGroup(r) { if (r.date === day()) return 'today'; if (r.date === dateShift(-1)) return 'yesterday'; return r.date < day() ? 'older' : 'future'; }
function reminderRow(r) { const row = document.createElement('div'); row.className = 'reminder-item' + (r.priority ? ' priority' : ''); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !!r.done; check.onchange = () => { r.done = check.checked; persist('reminders'); renderReminders(); renderHome(); }; const content = document.createElement('div'); content.className = 'reminder-content'; const name = document.createElement('strong'); name.textContent = r.text; const info = document.createElement('small'); info.textContent = [r.date, r.time, (r.tags || []).map(t => '#' + t).join(' ')].filter(Boolean).join(' · '); content.append(name, info); const edit = document.createElement('button'); edit.className = 'icon-btn'; edit.textContent = '✎'; edit.title = 'Editar'; edit.onclick = () => { editingReminder = r.id; $('#remText').value = r.text; $('#remDate').value = r.date; $('#remTime').value = r.time || ''; $('#remTags').value = (r.tags || []).join(', '); $('#remPriority').checked = !!r.priority; $('#remSubmit').textContent = 'Salvar alterações'; $('#cancelRemEdit').hidden = false; $('#remText').focus(); }; const remove = document.createElement('button'); remove.className = 'icon-btn'; remove.textContent = '×'; remove.title = 'Excluir'; remove.onclick = async () => { if (!await ask('Excluir lembrete?', `Excluir "${r.text}"?`)) return; reminders = reminders.filter(x => x.id !== r.id); await persist('reminders'); renderReminders(); renderHome(); }; row.append(check, content, edit, remove); return row; }
function renderReminders() { const root = $('#reminderGroups'); root.replaceChildren(); for (const [id, label] of [['today', 'Lembretes de hoje'], ['yesterday', 'Lembretes de ontem'], ['older', 'Vencidos há 2 dias ou mais'], ['future', 'Próximos']]) { const group = document.createElement('section'); group.className = 'panel reminder-group'; const list = reminders.filter(r => !r.done && reminderGroup(r) === id).sort((a, b) => Number(b.priority) - Number(a.priority) || a.date.localeCompare(b.date)); const heading = document.createElement('h2'); heading.textContent = `${label} (${list.length})`; group.append(heading); if (!list.length) { const empty = document.createElement('p'); empty.className = 'muted-note'; empty.textContent = 'Nenhum lembrete nesta categoria.'; group.append(empty); } else list.forEach(r => group.append(reminderRow(r))); if (id === 'future') { const details = document.createElement('details'); details.open = false; const summary = document.createElement('summary'); summary.textContent = `${label} (${list.length})`; details.append(summary, ...[...group.children].slice(1)); group.replaceChildren(details); } root.append(group); } const completed = reminders.filter(r => r.done).sort((a, b) => b.date.localeCompare(a.date)); $('#completedCount').textContent = `(${completed.length})`; $('#completedReminders').replaceChildren(...completed.map(reminderRow)); }
function resetReminderForm() { editingReminder = null; $('#reminderForm').reset(); $('#remDate').value = day(); $('#remSubmit').textContent = '+ Adicionar lembrete'; $('#cancelRemEdit').hidden = true; }
$('#cancelRemEdit').onclick = resetReminderForm;
$('#reminderForm').onsubmit = async e => { e.preventDefault(); if (!FileStorage.ready()) { await ensureFolder(); return; } const text = $('#remText').value.trim(), date = $('#remDate').value; if (!text || !date) return; const data = { text, date, time: $('#remTime').value, tags: tags($('#remTags').value), priority: $('#remPriority').checked }; if (editingReminder) { const r = reminders.find(x => x.id === editingReminder); if (r) Object.assign(r, data); } else reminders.push({ id: uid(), done: false, ...data }); await persist('reminders'); resetReminderForm(); renderReminders(); renderHome(); };

// Módulo Anotações: índice JSON + Markdown individual; o índice mantém busca e estados.
const noteFile = id => `anotacoes/${id}.md`;
function noteMarkdown(n) { return `# ${n.title || 'Sem título'}\n\n${n.body || ''}\n`; }
function noteSaveLabel(label, failed = false) { $('#noteSaveStatus').textContent = label; $('#noteSaveStatus').className = failed ? 'save-error' : ''; }
function noteFromFields() { if (!activeNote) return; activeNote.title = $('#noteTitle').value.trim(); activeNote.body = $('#noteBody').value; activeNote.tags = tags($('#noteTags').value); activeNote.space = $('#noteSpace').value; activeNote.reviewed = $('#noteReviewed').checked; activeNote.archived = $('#noteArchived').checked; activeNote.updatedAt = new Date().toISOString(); }
async function flushNote() { if (!activeNote) return true; if (!FileStorage.ready()) { noteSaveLabel('Erro: pasta não conectada', true); return false; } clearTimeout(noteTimer); noteFromFields(); const n = structuredClone(activeNote), session = storageSession; noteSaveLabel('Salvando...'); const index = snapshot('notes'); const result = await FileStorage.enqueue(async () => { if (session !== storageSession) return false; try { await FileStorage.write(noteFile(n.id), noteMarkdown(n)); await FileStorage.write(PATHS.notes, index); return true; } catch (e) { console.error(e); toast('Erro ao salvar anotação: ' + e.message, true); return false; } }); if (activeNote?.id === n.id) noteSaveLabel(result ? '✓ Salvo na pasta' : 'Erro ao salvar', !result); renderNotes(); renderHome(); return result; }
function scheduleNote() { noteSaveLabel('Alterações pendentes...'); clearTimeout(noteTimer); noteTimer = setTimeout(() => { flushNote(); }, CONFIG.AUTOSAVE_MS); }
function openNote(id = null) { if (!FileStorage.ready()) { ensureFolder(); return; } const existing = notes.find(n => n.id === id); activeNote = existing || { id: uid(), title: '', body: '', tags: [], space: '', reviewed: false, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; if (!existing) notes.unshift(activeNote); $('#noteTitle').value = activeNote.title || ''; $('#noteBody').value = activeNote.body || ''; $('#noteTags').value = (activeNote.tags || []).join(', '); $('#noteReviewed').checked = !!activeNote.reviewed; $('#noteArchived').checked = !!activeNote.archived; $('#noteSpace').replaceChildren(new Option('Sem espaço', ''), ...spaces.map(s => new Option(s.name, s.id))); $('#noteSpace').value = activeNote.space || ''; $('#noteMeta').textContent = 'Criada em ' + new Date(activeNote.createdAt).toLocaleString('pt-BR'); $('#noteOverlay').hidden = false; noteSaveLabel(existing ? '✓ Salvo na pasta' : 'Nova anotação · ainda não salva'); $('#noteBody').focus(); if (!existing) scheduleNote(); }
async function closeNote() { if (activeNote) { const ok = await flushNote(); if (!ok) return; } $('#noteOverlay').hidden = true; $('#noteOverlay').classList.remove('expanded'); activeNote = null; renderNotes(); renderHome(); }
$('#newNote').onclick = () => openNote(); $('#closeNote').onclick = closeNote; $('#noteBackdrop').onclick = closeNote; $('#expandNote').onclick = () => $('#noteOverlay').classList.toggle('expanded'); $('#saveNote').onclick = flushNote;
for (const id of ['noteTitle', 'noteBody', 'noteTags', 'noteSpace', 'noteReviewed', 'noteArchived']) $('#' + id).addEventListener(['noteReviewed', 'noteArchived', 'noteSpace'].includes(id) ? 'change' : 'input', scheduleNote);
$('#deleteNote').onclick = async () => { if (!activeNote || !await ask('Excluir anotação?', 'A anotação e seu arquivo Markdown serão removidos da pasta.')) return; const id = activeNote.id; clearTimeout(noteTimer); const prior = notes; notes = notes.filter(n => n.id !== id); try { await FileStorage.enqueue(async () => { await FileStorage.remove(noteFile(id)).catch(e => { if (e.name !== 'NotFoundError') throw e; }); await FileStorage.write(PATHS.notes, snapshot('notes')); }); activeNote = null; $('#noteOverlay').hidden = true; renderNotes(); renderHome(); toast('Anotação excluída'); } catch (e) { notes = prior; toast('Falha ao excluir: ' + e.message, true); } };
function renderNotes() { const root = $('#noteList'); root.replaceChildren(); const term = $('#searchNotes').value.toLocaleLowerCase('pt-BR'), filter = $('#noteFilter').value; const filtered = notes.filter(n => { const matches = (`${n.title} ${n.body} ${(n.tags || []).join(' ')}`).toLocaleLowerCase('pt-BR').includes(term); const status = filter === 'all' ? !n.archived : filter === 'untitled' ? !n.title && !n.archived : filter === 'pending' ? !n.reviewed && !n.archived : filter === 'reviewed' ? n.reviewed && !n.archived : n.archived; return matches && status; }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Nenhuma anotação encontrada.'; root.append(empty); } filtered.forEach(n => { const card = document.createElement('button'); card.className = 'note-card'; const title = document.createElement('strong'); title.textContent = n.title || 'Sem título'; const excerpt = document.createElement('p'); excerpt.textContent = (n.body || 'Anotação vazia').slice(0, 160); const meta = document.createElement('small'); meta.textContent = [!n.title ? '⚠ Título pendente' : '', !n.reviewed ? 'Revisão pendente' : 'Revisada', ...(n.tags || []).map(t => '#' + t), new Date(n.updatedAt).toLocaleDateString('pt-BR')].filter(Boolean).join(' · '); card.append(title, excerpt, meta); card.onclick = () => openNote(n.id); root.append(card); }); }
$('#searchNotes').oninput = renderNotes; $('#noteFilter').onchange = renderNotes;
function renderAll() { renderLinks(); renderSpaces(); renderFocus(); renderHome(); renderNotes(); renderReminders(); }
resetReminderForm(); updateFolder(); renderAll();
(async () => { if (await FileStorage.restore()) { await loadAll(); } else { $('#folderDialog').showModal(); } })();
