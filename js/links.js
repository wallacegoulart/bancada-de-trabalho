function createLinkCard(link) {
  const card = document.createElement("article"); card.className = "link-card";
  const anchor = document.createElement("a"); anchor.className = "link-card-main";
  anchor.href = link.url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
  const symbol = document.createElement("span"); symbol.className = "link-symbol"; symbol.textContent = "↗";
  const title = document.createElement("h3"); title.textContent = link.name;
  const description = document.createElement("p"); description.textContent = link.description || link.url;
  anchor.append(symbol,title,description);
  const tags = document.createElement("div"); tags.className = "card-tags";
  (link.tags || []).forEach(tag => { const badge = document.createElement("span"); badge.className = "tag-badge"; badge.textContent = tag; tags.append(badge); });
  anchor.append(tags);
  const actions = document.createElement("div"); actions.className = "card-actions";
  const favorite = document.createElement("button"); favorite.className = `icon-btn favorite-toggle${link.favorite ? " is-favorite" : ""}`;
  favorite.type = "button"; favorite.textContent = link.favorite ? "★" : "☆";
  favorite.title = link.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
  favorite.setAttribute("aria-label", favorite.title + ": " + link.name);
  favorite.addEventListener("click", () => { link.favorite = !link.favorite; saveStorage(LINKS_KEY,links); renderLinks(); });
  const edit = document.createElement("button"); edit.className = "icon-btn"; edit.type = "button"; edit.textContent = "✎"; edit.title = "Editar link"; edit.setAttribute("aria-label", `Editar ${link.name}`);
  edit.addEventListener("click", () => openLinkDialog(link.id));
  actions.append(favorite,edit); card.append(anchor,actions); return card;
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
    chip.append(star,name); container.append(chip);
  });
}
function renderLinks() {
  renderFavorites();
  const tags = [...new Set(links.flatMap(link => link.tags || []))].sort((a,b) => a.localeCompare(b,"pt-BR"));
  if (activeTag !== "Todas" && !tags.includes(activeTag)) activeTag = "Todas";
  const filters = $("#tagFilters"); filters.replaceChildren();
  ["Todas",...tags].forEach(tag => {
    const button = document.createElement("button"); button.type = "button";
    button.className = `tag-filter${tag === activeTag ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => { activeTag = tag; linkPage = 1; renderLinks(); });
    filters.append(button);
  });
  const term = $("#searchLinks").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = links.filter(link => {
    const text = `${link.name} ${link.description} ${link.url} ${(link.tags || []).join(" ")}`.toLocaleLowerCase("pt-BR");
    return matchSpace(link,"linkWorkspaceFilter") && text.includes(term) && (activeTag === "Todas" || (link.tags || []).includes(activeTag));
  });
  const pageSize = Number($("#pageSize").value);
  const totalPages = Math.max(1,Math.ceil(filtered.length/pageSize));
  linkPage = Math.min(linkPage,totalPages);
  const start = (linkPage-1)*pageSize;
  fillLinks($("#allLinks"),filtered.slice(start,start+pageSize));
  $("#linksCount").textContent = `${filtered.length} link(s) encontrado(s) · ${links.length} no total`;
  const pagination = $("#linksPagination"); pagination.replaceChildren();
  if (totalPages > 1) {
    const previous = document.createElement("button"); previous.textContent = "← Anterior"; previous.disabled = linkPage === 1;
    previous.addEventListener("click",()=>{linkPage--;renderLinks();});
    const info = document.createElement("span"); info.textContent = `Página ${linkPage} de ${totalPages}`;
    const next = document.createElement("button"); next.textContent = "Próxima →"; next.disabled = linkPage === totalPages;
    next.addEventListener("click",()=>{linkPage++;renderLinks();});
    pagination.append(previous,info,next);
  }

}
$("#searchLinks").addEventListener("input",()=>{linkPage=1;renderLinks();});
$("#pageSize").addEventListener("change",()=>{linkPage=1;renderLinks();});
function openLinkDialog(id = null) {
 if(!FileStorage.ready()){ensureFolder();return;}
  editingId = id;
  $("#deleteLink").hidden=!id;
  $("#linkForm").reset(); refreshCatalog(); fillSpaces("linkSpace");
  $("#dialogTitle").textContent = id ? "Editar link" : "Adicionar link";
  if (id) { const link = links.find(item => item.id === id); if (!link) return; $("#linkName").value = link.name; $("#linkUrl").value = link.url; $("#linkDescription").value = link.description; setTags("linkTags",link.tags); $("#linkSpace").value=link.workspace_id||""; }
  $("#linkDialog").showModal();
}
$$("[data-add-link]").forEach(button => button.addEventListener("click", () => openLinkDialog()));
$("#closeDialog").addEventListener("click", () => $("#linkDialog").close());
$("#cancelDialog").addEventListener("click", () => $("#linkDialog").close());
$("#linkForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("#linkName").value.trim();
  const description = $("#linkDescription").value.trim();
  const tags = selectedTags("linkTags"); const workspace_id=$("#linkSpace").value;
  let url;
  try { url = new URL($("#linkUrl").value.trim()); }
  catch { toast("Informe uma URL válida, incluindo https://",true); return; }
  if (!["https:","http:"].includes(url.protocol)) { toast("Somente links HTTP ou HTTPS são permitidos.",true); return; }
  if (!name) return;
  if (editingId) { links = links.map(item => item.id === editingId ? {...item,name,url:url.href,description,tags,workspace_id} : item); }
  else { links.push({id:crypto.randomUUID(),name,url:url.href,description,tags,workspace_id,favorite:false}); }
  saveStorage(LINKS_KEY,links); renderLinks(); $("#linkDialog").close();
});


$('#deleteLink').onclick=async()=>{const link=links.find(x=>x.id===editingId);if(!link||!await ask('Excluir link?',`Excluir o link "${link.name}"?`))return;const old=links;links=links.filter(x=>x.id!==link.id);if(!await persist('links')){links=old;return;}$('#linkDialog').close();renderLinks();};
