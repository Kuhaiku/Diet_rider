// --- CONFIGURAÇÃO ---
const IS_DEV =
  window.location.port === "8080" || window.location.port === "5500";
const API_BASE = IS_DEV
  ? `http://${window.location.hostname}:3000/api`
  : "/api";

const token = localStorage.getItem("token");
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};
const user = JSON.parse(localStorage.getItem("user")) || {};

// Globais
// CORREÇÃO: Usar window.allPosts para compartilhar dados com perfil.js
window.allPosts = []; 
let myLibrary = [];
let myPresets = [];
let selectedAttachments = new Set();
let currentAttachType = 'recipe';
let latestPostId = 0;
let searchTimeout = null;
let isSearching = false;
let reportType = 'post'; // 'post' ou 'comment'

// --- INICIALIZAÇÃO ---
if (
  window.location.pathname.includes("community.html") ||
  document.getElementById("community-feed")
) {
  window.onload = async function () {
    if (!token) window.location.href = "login.html";

    injectPreviewModal();
    injectConfirmModal(); // Injeta o modal de confirmação
    setupSidebarLinks();

    await Promise.all([loadPosts(), fetchUserLibrary()]);

    checkDeepLink();

    setInterval(checkForNewPosts, 15000);
  };
}

// --- SIDEBAR & AUTH ---
function setupSidebarLinks() {
  const profileLink = document.getElementById("link-my-profile");
  if (user && user.id && profileLink) {
    profileLink.href = `perfil.html?id=${user.id}`;
  }
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("mobile-overlay");
  if (sb && sb.classList.contains("-translate-x-full")) {
    sb.classList.remove("-translate-x-full");
    ov.classList.remove("hidden");
  } else if (sb) {
    sb.classList.add("-translate-x-full");
    ov.classList.add("hidden");
  }
}

function logout() {
  if (confirm("Deseja realmente sair?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
  }
}

// --- FEED & BUSCA ---

async function loadPosts(query = "") {
  if (!document.getElementById("community-feed")) return;

  document.getElementById("new-posts-btn")?.classList.add("hidden");

  if (query) {
    document.getElementById(
      "community-feed"
    ).innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-indigo-500 text-2xl"></i></div>`;
  }

  try {
    const url = query
      ? `${API_BASE}/community/posts?q=${encodeURIComponent(query)}`
      : `${API_BASE}/community/posts`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Erro API");
    const posts = await res.json();

    // CORREÇÃO: Atualizar a variável global window
    window.allPosts = posts;
    
    if (!query && Array.isArray(posts) && posts.length > 0)
      latestPostId = posts[0].id;

    renderFeed(posts, "community-feed");
    toggleClearButton(query);
  } catch (e) {
    console.error(e);
    document.getElementById(
      "community-feed"
    ).innerHTML = `<div class="text-center py-10 text-red-400">Erro ao carregar.</div>`;
  }
}

// BUSCA DE USUÁRIOS (COM LÓGICA DE VER MAIS)
async function searchUsers(query, fetchAll = false) {
  const container = document.getElementById("user-search-results");
  if (!container) return;

  try {
    const url = `${API_BASE}/community/users?q=${encodeURIComponent(query)}${
      fetchAll ? "&all=true" : ""
    }`;

    const res = await fetch(url, { headers });
    if (res.ok) {
      const users = await res.json();
      renderUserResults(users, fetchAll, query);
    }
  } catch (e) {
    console.error("Erro busca usuários", e);
  }
}

function renderUserResults(users, isFullList, query) {
  const container = document.getElementById("user-search-results");
  container.innerHTML = "";

  if (!users || users.length === 0) {
    container.classList.add("hidden");
    return;
  }

  container.innerHTML = `<p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Pessoas Encontradas</p>`;

  let displayUsers = users;
  let showButton = false;

  if (!isFullList && users.length > 5) {
    displayUsers = users.slice(0, 5); 
    showButton = true;
  }

  displayUsers.forEach((u) => {
    const avatarSrc =
      u.avatar ||
      `https://ui-avatars.com/api/?name=${u.name}&background=random`;
    
    const html = `
            <div onclick="window.location.href='perfil.html?id=${
              u.id
            }'" class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors group mb-2">
                <div class="flex items-center gap-3">
                    <img src="${avatarSrc}" class="w-10 h-10 rounded-full object-cover border border-slate-100">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">${
                          u.name
                        }</h4>
                        <p class="text-xs text-slate-500 line-clamp-1">${
                          u.bio || "Sem biografia"
                        }</p>
                    </div>
                </div>
                <div class="text-indigo-500 text-xs font-bold px-3 py-1 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">Ver Perfil</div>
            </div>`;
    container.innerHTML += html;
  });

  if (showButton) {
    const btnDiv = document.createElement("div");
    btnDiv.className = "text-center pt-1";
    btnDiv.innerHTML = `
            <button class="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors" id="btn-see-more-users">
                Ver todos os resultados para "${query}"
            </button>
        `;
    btnDiv.querySelector("button").onclick = () => searchUsers(query, true);
    container.appendChild(btnDiv);
  }

  container.classList.remove("hidden");
}

function clearUserResults() {
  const container = document.getElementById("user-search-results");
  if (container) {
    container.innerHTML = "";
    container.classList.add("hidden");
  }
}

function debounceSearch() {
  const term = document.getElementById("search-input").value.trim();
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (term.length > 0) {
      isSearching = true;
      searchUsers(term); 
      loadPosts(term); 
    } else {
      isSearching = false;
      clearUserResults();
      loadPosts();
    }
  }, 500);
}

function clearSearch() {
  document.getElementById("search-input").value = "";
  isSearching = false;
  clearUserResults();
  loadPosts();
  toggleClearButton("");
}

function toggleClearButton(query) {
  const btn = document.getElementById("btn-clear-search");
  if (btn) {
    if (query) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
  }
}

async function checkForNewPosts() {
  if (isSearching || !document.getElementById("community-feed")) return;
  try {
    const res = await fetch(`${API_BASE}/community/posts`, { headers });
    if (res.ok) {
      const posts = await res.json();
      if (
        Array.isArray(posts) &&
        posts.length > 0 &&
        posts[0].id > latestPostId
      ) {
        document.getElementById("new-posts-btn")?.classList.remove("hidden");
      }
    }
  } catch (e) {}
}

// --- RENDERIZAÇÃO POSTS ---

function renderFeed(posts, targetId = "community-feed") {
  const feed = document.getElementById(targetId);
  if (!feed) return;

  feed.innerHTML = "";

  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    const msg = posts && posts.msg ? posts.msg : "Nenhuma postagem encontrada.";
    feed.innerHTML = `<div class="text-center py-10 text-slate-400">${msg}</div>`;
    return;
  }

  posts.forEach((p) => {
    const isMyPost = p.user_id === user.id;
    const ytId = extractYoutubeId(p.youtube_link);
    const userVote = p.my_vote;

    const avatarUrl = p.author_avatar || "";
    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-slate-200">`
      : `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg">${p.author_name
          .charAt(0)
          .toUpperCase()}</div>`;

    let typeIcon = "fa-utensils";
    let typeLabel = "Receita";
    if (
      p.content_json.planner ||
      (p.content_json.data && p.content_json.data.planner)
    ) {
      typeIcon = "fa-calendar-days";
      typeLabel = "Plano Mensal";
    } else if (Array.isArray(p.content_json)) {
      typeIcon = "fa-layer-group";
      typeLabel = `Pacote (${p.content_json.length})`;
    }

    const likeClass =
      userVote === "like"
        ? "text-green-600 bg-green-50 font-bold ring-1 ring-green-200"
        : "";
    const dislikeClass =
      userVote === "dislike"
        ? "text-red-600 bg-red-50 font-bold ring-1 ring-red-200"
        : "";

    // HTML do container de comentários
    const commentsHtml = `
      <div id="comments-section-${p.id}" class="hidden border-t border-slate-100 bg-slate-50/50 p-4">
          <div id="comments-list-${p.id}" class="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
              <div class="text-center text-slate-400 text-xs py-2"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>
          </div>
          <div class="flex gap-2">
              <input type="text" id="comment-input-${p.id}" placeholder="Escreva um comentário..." class="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" onkeydown="if(event.key === 'Enter') submitComment(${p.id})">
              <button onclick="submitComment(${p.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition-colors"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
      </div>
    `;

    // CORREÇÃO: Adicionado || 0 para evitar undefined nos contadores
    let html = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden fade-in relative group mb-6 scroll-mt-24" id="post-${p.id}">
            <div class="p-4 flex justify-between items-start">
                <div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onclick="window.location.href='perfil.html?id=${p.user_id}'">
                    ${avatarHtml}
                    <div><h3 class="font-bold text-slate-800 leading-tight hover:text-indigo-600 transition-colors">${p.title}</h3><p class="text-xs text-slate-500">por <span class="font-bold text-indigo-600">${p.author_name}</span> • ${new Date(p.created_at).toLocaleDateString()}</p></div>
                </div>
                <div class="relative">
                    ${
                      isMyPost || user.is_owner
                        ? `<button onclick="deletePost(${p.id})" class="text-slate-300 hover:text-red-500 p-2"><i class="fa-solid fa-trash"></i></button>`
                        : `<button onclick="openReportModal(${p.id})" class="text-slate-300 hover:text-red-500 p-2"><i class="fa-solid fa-flag"></i></button>`
                    }
                </div>
            </div>
            <div class="px-4 pb-2"><p class="text-sm text-slate-600 whitespace-pre-line">${p.description}</p></div>
            <div class="px-4 pb-4">
                <button onclick="openPostDetails(${p.id})" class="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center justify-between group/btn transition-all">
                    <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500 group-hover/btn:scale-110 transition-transform"><i class="fa-solid ${typeIcon}"></i></div><div class="text-left"><p class="text-xs text-slate-400 font-bold uppercase">Conteúdo</p><p class="text-sm font-bold text-slate-700">${typeLabel}</p></div></div>
                    <div class="text-indigo-600 text-sm font-bold flex items-center gap-2">Ver <i class="fa-solid fa-arrow-right"></i></div>
                </button>
            </div>
            ${
              ytId
                ? `<div class="w-full aspect-video bg-black relative group/video cursor-pointer overflow-hidden" onclick="playVideo(this, '${ytId}')"><img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-full h-full object-cover opacity-90 group-hover/video:opacity-80 transition-opacity"><div class="absolute inset-0 flex items-center justify-center"><div class="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white shadow-xl"><i class="fa-solid fa-play text-2xl ml-1"></i></div></div></div>`
                : ""
            }
            <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <button onclick="vote(${p.id}, 'like')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-green-100 text-slate-500 hover:text-green-600 transition-colors ${likeClass}"><i class="fa-solid fa-thumbs-up"></i> <span id="likes-${p.id}">${p.likes_count || 0}</span></button>
                    <button onclick="vote(${p.id}, 'dislike')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors ${dislikeClass}"><i class="fa-solid fa-thumbs-down"></i></button>
                    
                    <button onclick="toggleComments(${p.id})" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 transition-colors">
                        <i class="fa-regular fa-comment-dots"></i> <span id="comments-count-${p.id}">${p.comments_count || 0}</span>
                    </button>
                </div>
                <div class="flex gap-2">
                    <button onclick="sharePost(${p.id}, ${p.user_id})" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"><i class="fa-solid fa-link"></i></button>
                    <button onclick="prepareImport(${p.id})" class="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-full hover:bg-slate-900 shadow-md flex items-center gap-2 active:scale-95"><i class="fa-solid fa-download"></i> <span>Importar</span></button>
                </div>
            </div>
            ${commentsHtml}
        </div>`;
    feed.innerHTML += html;
  });
}

// --- BOILERPLATE, MODAIS & ANEXOS ---
async function vote(postId, type) {
  if (!token) return (window.location.href = "login.html");
  try {
    const res = await fetch(`${API_BASE}/community/vote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ post_id: postId, vote_type: type }),
    });
    if (res.ok) {
      if (
        typeof loadProfileLikes === "function" &&
        document
          .getElementById("tab-likes")
          ?.classList.contains("border-indigo-600")
      )
        loadProfileLikes();
      else if (
        typeof loadProfilePosts === "function" &&
        document
          .getElementById("tab-posts")
          ?.classList.contains("border-indigo-600")
      )
        loadProfilePosts();
      else loadPosts();
    }
  } catch (e) {
    console.error(e);
  }
}
async function fetchUserLibrary() {
  try {
    const [lib, pre] = await Promise.all([
      fetch(`${API_BASE}/library`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/presets`, { headers }).then((r) => r.json()),
    ]);
    myLibrary = Array.isArray(lib) ? lib : [];
    myPresets = Array.isArray(pre) ? pre : [];
  } catch (e) {}
}
function openAttachModal() {
  document.getElementById("attach-modal")?.classList.remove("hidden");
  loadAttachList("recipe");
}
function closeAttachModal() {
  document.getElementById("attach-modal")?.classList.add("hidden");
}
function loadAttachList(type) {
  currentAttachType = type; 
  selectedAttachments.clear(); 

  const list = document.getElementById("attach-list");
  const btnRec = document.getElementById("tab-recipe");
  const btnPlan = document.getElementById("tab-plan");
  list.innerHTML = "";
  
  const items = type === "recipe" ? myLibrary : myPresets;
  
  if (type === "recipe") {
    btnRec.className = "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700 transition-colors";
    btnPlan.className = "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500 transition-colors";
  } else {
    btnPlan.className = "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700 transition-colors";
    btnRec.className = "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500 transition-colors";
  }

  if (!items || items.length === 0) {
    list.innerHTML = '<div class="p-4 text-center text-sm text-slate-400">Vazio.</div>';
    return;
  }

  items.forEach((i) => {
    const div = document.createElement("div");
    const chkId = `chk-${i.id}`;
    div.className = "p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex items-center gap-3 select-none rounded-lg";
    
    div.innerHTML = `
      <input type="checkbox" id="${chkId}" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" onclick="event.stopPropagation(); toggleSelection('${i.id}')">
      <label for="${chkId}" class="flex-1 cursor-pointer font-medium text-sm text-slate-700 flex items-center gap-2">
        ${
          type === "recipe"
            ? `<span class="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-500"><i class="fa-solid ${i.icon || "fa-utensils"}"></i></span>`
            : '<i class="fa-solid fa-calendar-days text-indigo-400"></i>'
        } ${i.name}
      </label>`;
      
    div.onclick = () => {
      document.getElementById(chkId).click();
    };
    list.appendChild(div);
  });

  if (items.length > 0) {
    const btn = document.createElement("button");
    btn.className = "w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition-colors";
    btn.innerText = "Confirmar Seleção";
    btn.onclick = confirmRecipePackage;
    list.appendChild(btn);
  }
}
function toggleSelection(id) {
  if (currentAttachType === "plan") {
    if (selectedAttachments.has(id)) {
      selectedAttachments.delete(id);
    } else {
      selectedAttachments.clear();
      selectedAttachments.add(id);

      const checkboxes = document.querySelectorAll('#attach-list input[type="checkbox"]');
      checkboxes.forEach((cb) => {
        if (cb.id !== `chk-${id}`) cb.checked = false;
      });
    }
  } else {
    if (selectedAttachments.has(id)) selectedAttachments.delete(id);
    else selectedAttachments.add(id);
  }
}

function confirmRecipePackage() {
  if (selectedAttachments.size === 0)
    return notify("Selecione pelo menos um item.", "error");
  const allItems = [...myLibrary, ...myPresets];
  const packageList = allItems.filter((r) => selectedAttachments.has(r.id));
  const content = packageList.length === 1 ? packageList[0] : packageList;
  const label =
    packageList.length === 1
      ? `Anexo: ${packageList[0].name}`
      : `Pacote: ${packageList.length} Itens`;
  selectAttachment(content, label);
}
function selectAttachment(obj, label) {
  document.getElementById("post-json-content").value = JSON.stringify(obj);
  document.getElementById("attach-label").innerText = label;
  const btn = document.getElementById("attach-label").parentElement;
  btn.classList.remove("bg-indigo-50", "text-indigo-700");
  btn.classList.add("bg-green-100", "text-green-700", "border-green-200");
  closeAttachModal();
}
async function createPost() {
  const title = document.getElementById("post-title").value.trim();
  const desc = document.getElementById("post-desc").value.trim();
  const yt = document.getElementById("post-yt").value.trim();
  const jsonStr = document.getElementById("post-json-content").value;
  if (!title) return notify("Dê um título para o post.", "error");
  if (!jsonStr)
    return notify("Você precisa anexar uma receita ou plano!", "error");
  const content_json = JSON.parse(jsonStr);
  try {
    const res = await fetch(`${API_BASE}/community/post`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description: desc,
        youtube_link: yt,
        content_json,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      notify("Publicado com sucesso!");
      document.getElementById("post-title").value = "";
      document.getElementById("post-desc").value = "";
      document.getElementById("post-yt").value = "";
      document.getElementById("post-json-content").value = "";
      const btn = document.getElementById("attach-label").parentElement;
      btn.classList.add("bg-indigo-50", "text-indigo-700");
      btn.classList.remove(
        "bg-green-100",
        "text-green-700",
        "border-green-200"
      );
      document.getElementById("attach-label").innerText = "Anexar";
      loadPosts();
    } else {
      notify(data.msg || "Erro ao postar.", "error");
    }
  } catch (e) {
    notify("Erro de conexão.", "error");
  }
}
let currentPreviewData = null;
function openPostDetails(postId) {
  // CORREÇÃO: Usar window.allPosts
  const post = window.allPosts.find((p) => p.id === postId);
  if (!post) return;
  openPreviewModalGeneric(post.content_json, post.title, false);
}
function prepareImport(postId) {
  // CORREÇÃO: Usar window.allPosts
  const post = window.allPosts.find((p) => p.id === postId);
  if (!post) return;
  openPreviewModalGeneric(post.content_json, post.title, true);
}
function openPreviewModalGeneric(content, title, isImportMode) {
  currentPreviewData = content;
  const container = document.getElementById("preview-body-content");
  const titleEl = document.getElementById("preview-modal-title");
  if (!container) {
    injectPreviewModal();
    setTimeout(() => openPreviewModalGeneric(content, title, isImportMode), 50);
    return;
  }
  if (titleEl)
    titleEl.innerText = isImportMode ? "Confirmar Importação" : title;
  const actionBtn = document.getElementById("preview-action-btn");
  if (actionBtn) {
    if (isImportMode) {
      actionBtn.innerText = "Confirmar Importação";
      actionBtn.onclick = () => executeImport(content);
      actionBtn.classList.remove("hidden");
      actionBtn.className =
        "px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-lg";
    } else {
      actionBtn.classList.add("hidden");
    }
  }
  container.innerHTML = "";
  if (content.planner || (content.data && content.data.planner))
    renderPlanPreview(content, container);
  else if (Array.isArray(content)) renderPackagePreview(content, container);
  else renderRecipeCard(content, container);
  document.getElementById("post-preview-modal").classList.remove("hidden");
}
async function executeImport(content) {
  if (!token) return (window.location.href = "login.html");
  const isPlan = content.planner || (content.data && content.data.planner);
  try {
    if (isPlan) {
      const newPlan = {
        ...content,
        id: "plan_imp_" + Date.now(),
        name: (content.name || "Imp") + " (Comunidade)",
      };
      await fetch(`${API_BASE}/presets`, {
        method: "POST",
        headers,
        body: JSON.stringify(newPlan),
      });
      notify("Plano importado!");
    } else {
      const list = Array.isArray(content) ? content : [content];
      for (let r of list) {
        const newRecipe = {
          ...r,
          id:
            "rec_imp_" + Date.now() + Math.random().toString(36).substr(2, 5),
        };
        await fetch(`${API_BASE}/library`, {
          method: "POST",
          headers,
          body: JSON.stringify(newRecipe),
        });
      }
      notify("Receitas importadas!");
    }
    document.getElementById("post-preview-modal").classList.add("hidden");
  } catch (e) {
    notify("Erro ao importar.", "error");
  }
}
function renderRecipeCard(recipe, container) {
  const steps = Array.isArray(recipe.steps)
    ? recipe.steps
    : typeof recipe.steps === "string"
    ? recipe.steps.split("\n")
    : [];
  const html = `<div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-4"><div class="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3"><div class="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl"><i class="fa-solid ${
    recipe.icon || "fa-utensils"
  }"></i></div><div><h4 class="font-bold text-slate-800 text-lg">${
    recipe.name
  }</h4><span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-bold tracking-wide">${
    recipe.cat || "Geral"
  }</span></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><p class="text-xs font-bold text-slate-400 uppercase mb-2">Ingredientes</p><ul class="space-y-1">${(
    recipe.ingredients || []
  )
    .map(
      (i) =>
        `<li class="text-sm text-slate-600 flex items-center gap-2"><i class="fa-solid fa-circle-check text-green-500 text-[10px]"></i><span>${
          i.q_daily || ""
        }${i.u || ""} <b>${i.n}</b></span></li>`
    )
    .join(
      ""
    )}</ul></div><div><p class="text-xs font-bold text-slate-400 uppercase mb-2">Preparo</p><div class="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">${
    steps.length > 0
      ? steps
          .map(
            (s, idx) =>
              `<div class="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100"><span class="font-bold text-indigo-500 mr-1">${
                idx + 1
              }.</span> ${s}</div>`
          )
          .join("")
      : '<div class="text-sm text-slate-400 italic">Não informado.</div>'
  }</div></div></div></div>`;
  container.innerHTML += html;
}
function renderPackagePreview(list, container) {
  container.innerHTML = `<p class="text-center text-slate-500 mb-4 font-medium">Este pacote contém ${list.length} receitas:</p>`;
  list.forEach((r) => renderRecipeCard(r, container));
}
function renderPlanPreview(plan, container) {
  const pData = plan.data || plan;
  const planner = pData.planner || {};
  const themes = pData.themes || {};
  const lib = pData.library || [];
  container.dataset.planner = JSON.stringify(planner);
  container.dataset.themes = JSON.stringify(themes);
  container.dataset.lib = JSON.stringify(lib);
  let html = `<div class="flex gap-2 mb-4 overflow-x-auto pb-2" id="preview-tabs">${[
    1, 2, 3, 4,
  ]
    .map(
      (w) =>
        `<button onclick="switchPreviewWeek(${w})" id="btn-week-${w}" class="flex-1 py-2 px-3 rounded-lg border text-sm font-bold whitespace-nowrap transition-colors ${
          w === 1
            ? "bg-indigo-600 text-white border-indigo-600"
            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
        }">Semana ${w}</button>`
    )
    .join("")}</div><div id="week-content" class="min-h-[200px]"></div>`;
  container.innerHTML = html;
  renderWeekContent(1);
}
window.switchPreviewWeek = function (w) {
  [1, 2, 3, 4].forEach((i) => {
    const btn = document.getElementById(`btn-week-${i}`);
    if (btn)
      btn.className =
        i === w
          ? "flex-1 py-2 px-3 rounded-lg border text-sm font-bold whitespace-nowrap bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105 transition-all"
          : "flex-1 py-2 px-3 rounded-lg border text-sm font-bold whitespace-nowrap bg-white text-slate-500 border-slate-200 hover:bg-slate-50 transition-colors";
  });
  renderWeekContent(w);
};
window.togglePlanRecipe = function (uniqueId) {
  const el = document.getElementById(uniqueId);
  const btn = document.getElementById("btn-" + uniqueId);
  if (el.classList.contains("hidden")) {
    el.classList.remove("hidden");
    btn.innerHTML = 'Ocultar <i class="fa-solid fa-chevron-up"></i>';
  } else {
    el.classList.add("hidden");
    btn.innerHTML = 'Ver <i class="fa-solid fa-chevron-down"></i>';
  }
};
function renderWeekContent(w) {
  const container = document.getElementById("preview-body-content");
  const target = document.getElementById("week-content");
  if (!container || !target) return;
  const planner = JSON.parse(container.dataset.planner);
  const themes = JSON.parse(container.dataset.themes);
  const lib = JSON.parse(container.dataset.lib);
  const theme = themes[w] || "Sem tema definido";
  const weekData = planner[w] || {};
  const cats = {
    cafe: { label: "Café", color: "amber", icon: "fa-mug-hot" },
    almoco: { label: "Almoço", color: "orange", icon: "fa-utensils" },
    lanche: { label: "Lanche", color: "pink", icon: "fa-apple-whole" },
    jantar: { label: "Jantar", color: "indigo", icon: "fa-moon" },
  };
  let html = `<div class="bg-slate-800 text-white p-3 rounded-lg mb-4 flex items-center gap-3 shadow-md"><i class="fa-solid fa-calendar-week text-white/50 text-xl"></i><div><p class="text-[10px] uppercase font-bold text-white/60">Tema</p><p class="font-bold text-sm">${theme}</p></div></div><div class="grid grid-cols-1 gap-3">`;
  Object.keys(cats).forEach((key) => {
    const conf = cats[key];
    const recId = weekData[key];
    const rec = lib.find((r) => r.id === recId);
    if (rec) {
      const uniqueId = `rec-details-${w}-${key}-${Math.random()
        .toString(36)
        .substr(2, 5)}`;
      const stepsList = Array.isArray(rec.steps)
        ? rec.steps
        : typeof rec.steps === "string"
        ? rec.steps.split("\n")
        : [];
      html += `<div class="bg-white border border-slate-200 p-3 rounded-lg shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-${
        conf.color
      }-100 text-${
        conf.color
      }-600 flex items-center justify-center shrink-0"><i class="fa-solid ${
        rec.icon || conf.icon
      }"></i></div><div class="flex-1 min-w-0"><p class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">${
        conf.label
      }</p><p class="text-sm font-bold text-slate-800 truncate">${
        rec.name
      }</p></div><button id="btn-${uniqueId}" class="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1" onclick="togglePlanRecipe('${uniqueId}')">Ver <i class="fa-solid fa-chevron-down"></i></button></div><div id="${uniqueId}" class="hidden mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 rounded p-2"><div class="mb-2"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Ingredientes</p><ul class="text-xs text-slate-600 space-y-1">${(
        rec.ingredients || []
      )
        .map((i) => `<li>• ${i.q_daily || ""} ${i.u || ""} ${i.n}</li>`)
        .join(
          ""
        )}</ul></div><div><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Modo de Preparo</p><div class="text-xs text-slate-600 space-y-1">${
        stepsList.length > 0
          ? stepsList
              .map(
                (s, idx) =>
                  `<div><span class="font-bold text-indigo-400">${
                    idx + 1
                  }.</span> ${s}</div>`
              )
              .join("")
          : "Não informado."
      }</div></div></div></div>`;
    } else {
      html += `<div class="flex items-center bg-slate-50 border border-slate-100 p-3 rounded-lg gap-3 opacity-60"><div class="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center shrink-0"><i class="fa-solid ${conf.icon}"></i></div><div><p class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">${conf.label}</p><p class="text-sm font-medium text-slate-400 italic">Livre</p></div></div>`;
    }
  });
  html += `</div>`;
  target.innerHTML = html;
}
function sharePost(id, userId) {
  const url = `${window.location.origin}/perfil.html?id=${userId}&post=${id}`;
  if (navigator.share) {
    navigator
      .share({ title: "Diet & Ride", text: "Confira esta receita!", url })
      .catch(() => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
}
function fallbackCopy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => notify("Link copiado!"))
      .catch(() => notify("Erro ao copiar.", "error"));
  } else {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
    notify("Link copiado!");
  }
}
function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("post_id");
  if (postId) {
    const checkExist = setInterval(() => {
      const el = document.getElementById(`post-${postId}`);
      if (el) {
        clearInterval(checkExist);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(
          "ring-4",
          "ring-indigo-400",
          "shadow-2xl",
          "scale-[1.01]",
          "transition-all",
          "duration-500"
        );
        setTimeout(() => {
          el.classList.remove(
            "ring-4",
            "ring-indigo-400",
            "shadow-2xl",
            "scale-[1.01]"
          );
        }, 3000);
      }
    }, 500);
    setTimeout(() => clearInterval(checkExist), 10000);
  }
}
function injectPreviewModal() {
  if (document.getElementById("post-preview-modal")) return;
  const modalHtml = `<div id="post-preview-modal" class="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm hidden flex items-center justify-center p-4 animate-fade-in"><div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"><div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 id="preview-modal-title" class="font-bold text-lg text-slate-800 truncate pr-4">Detalhes</h3><button onclick="document.getElementById('post-preview-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors"><i class="fa-solid fa-xmark"></i></button></div><div id="preview-body-content" class="p-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50"></div><div class="p-4 border-t border-slate-100 bg-white flex justify-end gap-2"><button onclick="document.getElementById('post-preview-modal').classList.add('hidden')" class="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-lg transition-colors">Fechar</button><button id="preview-action-btn" class="hidden"></button></div></div></div><style>.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fadeIn 0.2s ease-out; }</style>`;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

// --- NOVO: MODAL DE CONFIRMAÇÃO PERSONALIZADO ---
function injectConfirmModal() {
  if (document.getElementById("custom-confirm-modal")) return;
  const html = `
    <div id="custom-confirm-modal" class="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm hidden flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all">
            <div class="p-6 text-center">
                <div class="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                    <i class="fa-solid fa-trash"></i>
                </div>
                <h3 class="font-bold text-lg text-slate-800 mb-2">Excluir Postagem</h3>
                <p id="confirm-modal-msg" class="text-sm text-slate-500 mb-6">Tem certeza que deseja remover este post? Esta ação não pode ser desfeita.</p>
                <div class="flex gap-3">
                    <button id="btn-confirm-cancel" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">Cancelar</button>
                    <button id="btn-confirm-yes" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg shadow-red-200 transition-colors">Excluir</button>
                </div>
            </div>
        </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);

  // Fecha no cancelar
  document.getElementById("btn-confirm-cancel").onclick = () => {
    document.getElementById("custom-confirm-modal").classList.add("hidden");
  };
}

function openConfirmModal(msg, onConfirm) {
  injectConfirmModal();
  const modal = document.getElementById("custom-confirm-modal");
  if (msg) document.getElementById("confirm-modal-msg").innerText = msg;

  // Reseta o botão Sim para remover listeners antigos
  const btnYes = document.getElementById("btn-confirm-yes");
  const newBtn = btnYes.cloneNode(true);
  btnYes.parentNode.replaceChild(newBtn, btnYes);

  newBtn.onclick = () => {
    modal.classList.add("hidden");
    if (onConfirm) onConfirm();
  };

  modal.classList.remove("hidden");
}

function extractYoutubeId(url) {
  if (!url) return null;
  const m = url.match(
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  );
  return m && m[2].length === 11 ? m[2] : null;
}
function playVideo(c, v) {
  c.onclick = null;
  c.innerHTML = `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${v}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
}
function notify(t, type = "success") {
  if (typeof Toastify === "function") {
    Toastify({
      text: t,
      duration: 2000,
      gravity: "top",
      position: "center",
      style: {
        background: type === "error" ? "#ef4444" : "#22c55e",
        borderRadius: "8px",
      },
    }).showToast();
  } else {
    alert(t);
  }
}
// --- DELETE POST ATUALIZADO ---
function deletePost(id) {
  openConfirmModal(
    "Tem certeza que deseja remover este post? Esta ação não pode ser desfeita.",
    async () => {
      try {
        const res = await fetch(`${API_BASE}/community/post/${id}`, {
          method: "DELETE",
          headers,
        });
        if (res.ok || res.status === 404) {
          notify("Post excluído.");
          const el = document.getElementById(`post-${id}`);
          if (el) el.remove();
        } else {
          notify("Erro ao excluir.", "error");
        }
      } catch (e) {
        notify("Erro de conexão.", "error");
      }
    }
  );
}

// Abre o modal sabendo se é POST ou COMMENT
function openReportModal(id, type = 'post') {
  if (!token) return (window.location.href = "login.html");
  
  reportType = type; // Define o tipo atual
  document.getElementById("report-post-id").value = id; // Usa o mesmo input hidden para guardar o ID
  
  // Atualiza o título visualmente para o usuário saber o que está denunciando
  const title = document.querySelector("#report-modal h3");
  if(title) title.innerText = type === 'post' ? "Denunciar Postagem" : "Denunciar Comentário";
  
  document.getElementById("report-modal").classList.remove("hidden");
}

function closeReportModal() {
  document.getElementById("report-modal").classList.add("hidden");
  document.getElementById("report-reason").value = ""; // Limpa o texto
}

async function submitReport() {
  const id = document.getElementById("report-post-id").value;
  const reason = document.getElementById("report-reason").value.trim();
  
  if (!reason) return notify("Informe o motivo.", "error");

  let url = '';
  let body = {};

  if (reportType === 'post') {
      url = `${API_BASE}/community/report`; 
      body = { post_id: id, reason }; 
  } else {
      url = `${API_BASE}/community/report/comment`;
      body = { comment_id: id, reason };
  }
  
  try {
      const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
      });
      
      if(res.ok) {
          notify("Denúncia enviada.");
          closeReportModal();
      } else {
          notify("Erro ao enviar.", "error");
      }
  } catch (e) {
      notify("Erro de conexão.", "error");
  }
}
// --- LÓGICA DE COMENTÁRIOS ---

function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        loadComments(postId);
    } else {
        section.classList.add('hidden');
    }
}

async function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    try {
        const res = await fetch(`${API_BASE}/community/post/${postId}/comments`, { headers });
        if (res.ok) {
            const comments = await res.json();
            renderCommentsList(postId, comments);
        }
    } catch (e) {
        list.innerHTML = '<p class="text-xs text-red-400 text-center">Erro ao carregar.</p>';
    }
}

function renderCommentsList(postId, comments) {
    const list = document.getElementById(`comments-list-${postId}`);
    const countEl = document.getElementById(`comments-count-${postId}`);
    
    if(countEl) countEl.innerText = comments.length;

    if (comments.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center italic py-2">Seja o primeiro a comentar!</p>';
        return;
    }

    list.innerHTML = comments.map(c => {
        const isMine = c.user_id === user.id;
        const isOwner = user.is_owner;
        const canDelete = isMine || isOwner;
        const avatar = c.author_avatar || `https://ui-avatars.com/api/?name=${c.author_name}&background=random`;

        return `
            <div class="flex gap-3 text-sm group/comment" id="comment-${c.id}">
                <img src="${avatar}" class="w-8 h-8 rounded-full border border-slate-200 mt-1 cursor-pointer" onclick="window.location.href='perfil.html?id=${c.user_id}'">
                <div class="flex-1 bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative">
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-bold text-slate-700 text-xs hover:text-indigo-600 cursor-pointer" onclick="window.location.href='perfil.html?id=${c.user_id}'">${c.author_name}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleDateString()}</span>
                            
                            ${canDelete ? `<button onclick="deleteComment(${c.id}, ${postId})" class="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/comment:opacity-100" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
                            
                            ${!isMine ? `<button onclick="openReportModal(${c.id}, 'comment')" class="text-slate-300 hover:text-amber-500 transition-colors opacity-0 group-hover/comment:opacity-100" title="Denunciar"><i class="fa-solid fa-flag text-xs"></i></button>` : ''}
                        </div>
                    </div>
                    <p class="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">${c.comment}</p>
                </div>
            </div>
        `;
    }).join('');
}
async function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    // Feedback visual imediato (Opcional: desabilitar input)
    input.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/community/post/${postId}/comment`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ comment: text })
        });
        
        if (res.ok) {
            input.value = "";
            loadComments(postId); // Recarrega a lista
        } else {
            notify("Erro ao enviar comentário.", "error");
        }
    } catch (e) {
        notify("Erro de conexão.", "error");
    } finally {
        input.disabled = false;
        input.focus();
    }
}

async function deleteComment(commentId, postId) {
    if(!confirm("Apagar comentário?")) return;
    
    try {
        const res = await fetch(`${API_BASE}/community/comment/${commentId}`, {
            method: 'DELETE',
            headers
        });
        if (res.ok) {
            // Remove visualmente ou recarrega
            const el = document.getElementById(`comment-${commentId}`);
            if(el) el.remove();
            // Atualiza contador baixando em 1 (truque visual rápido)
            const countEl = document.getElementById(`comments-count-${postId}`);
            if(countEl) countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);
            
            // Se quiser consistência total, chame loadComments(postId) em vez disso.
        } else {
            notify("Erro ao apagar.", "error");
        }
    } catch (e) {
        notify("Erro ao apagar.", "error");
    }
}