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
    const status = document.createElement("span"); status.className = "space-status"; status.textContent = `${notes.filter(n=>(n.workspace_id||n.space)===space.id).length} notas · ${links.filter(n=>n.workspace_id===space.id).length} links`;
    const actions = document.createElement("div"); actions.className = "card-actions";
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "icon-btn"; remove.textContent = "×"; remove.title = "Excluir espaço";
    remove.setAttribute("aria-label",`Excluir espaço ${space.name}`);
    remove.addEventListener("click",async()=>{ if (!await ask("Excluir espaço?",`Excluir o espaço "${space.name}"?`)) return; spaces = spaces.filter(s=>s.id!==space.id); saveStorage(SPACES_KEY,spaces); renderSpaces(); });
    const view=document.createElement("button");view.className="btn btn-outline";view.textContent="Abrir espaço";view.onclick=()=>showWorkspace(space.id); actions.append(view,remove); card.append(icon,title,description,status,actions); container.append(card);
  });
}
$("#addSpace").addEventListener("click",()=>$("#spaceDialog").showModal());
$("#closeSpace").addEventListener("click",()=>$("#spaceDialog").close());
$("#cancelSpace").addEventListener("click",()=>$("#spaceDialog").close());
$("#spaceForm").addEventListener("submit",event=>{
  event.preventDefault(); const name = $("#spaceName").value.trim();
  const description = $("#spaceDescription").value.trim(); if (!name) return;
  spaces.push({id:crypto.randomUUID(),name,description}); saveStorage(SPACES_KEY,spaces);
  refreshSpaces(); renderSpaces(); $("#spaceForm").reset(); $("#spaceDialog").close();
});

