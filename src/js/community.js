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

// --- VARIÁVEIS GLOBAIS ---
let allPosts = []; // Armazena posts carregados
let myLibrary = []; // Para o modal de anexo
let myPresets = []; // Para o modal de anexo
let selectedAttachments = new Set();
let latestPostId = 0; // Para o polling de novos posts
let searchTimeout = null; // Para o debounce da busca
let isSearching = false; // Estado da busca

// --- INICIALIZAÇÃO ---
// Só roda o onload se estiver na página da comunidade ou se o elemento feed existir
if (
  window.location.pathname.includes("community.html") ||
  document.getElementById("community-feed")
) {
  window.onload = async function () {
    if (!token) window.location.href = "login.html";

    injectPreviewModal();
    setupSidebarLinks();

    // Carrega posts e biblioteca do usuário (para poder postar)
    await Promise.all([loadPosts(), fetchUserLibrary()]);

    checkDeepLink();

    // Inicia verificação de novos posts a cada 15s
    setInterval(checkForNewPosts, 15000);
  };
}

// --- BARRA LATERAL & NAVEGAÇÃO ---

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

// --- LÓGICA DE FEED & BUSCA ---

async function loadPosts(query = "") {
  // Se não existir o elemento community-feed, estamos provavelmente no perfil, então não carrega o feed geral aqui
  if (!document.getElementById("community-feed")) return;

  // Esconde o botão de "novos posts" se for um reload manual
  document.getElementById("new-posts-btn")?.classList.add("hidden");

  try {
    const url = query
      ? `${API_BASE}/community/posts?q=${encodeURIComponent(query)}`
      : `${API_BASE}/community/posts`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Erro ao carregar feed");
    const posts = await res.json();

    allPosts = posts; // Salva globalmente para referência dos modais

    // Atualiza o ID mais recente para o polling (apenas se não for busca)
    if (!query && Array.isArray(posts) && posts.length > 0) {
      latestPostId = posts[0].id;
    }

    renderFeed(posts, "community-feed");
  } catch (e) {
    console.error(e);
    const el = document.getElementById("community-feed");
    if (el)
      el.innerHTML = `<div class="text-center py-10 text-red-400 font-bold">Erro ao carregar posts.</div>`;
  }
}

// --- LÓGICA DE BUSCA DE PESSOAS ---

function clearUserResults() {
    const container = document.getElementById('user-search-results');
    if (container) {
        container.innerHTML = "";
        container.classList.add('hidden');
    }
}

async function searchUsers(query) {
    const container = document.getElementById('user-search-results');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/community/users?q=${encodeURIComponent(query)}`, { headers });
        if (res.ok) {
            const users = await res.json();
            renderUserResults(users);
        }
    } catch (e) {
        console.error("Erro ao buscar usuários", e);
    }
}

function renderUserResults(users) {
    const container = document.getElementById('user-search-results');
    container.innerHTML = "";

    if (!users || users.length === 0) {
        container.classList.add('hidden');
        return;
    }

    // Título da seção
    container.innerHTML = `<p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Pessoas</p>`;

    users.forEach(u => {
        const avatarSrc = u.avatar || `https://ui-avatars.com/api/?name=${u.name}&background=random`;
        
        // Card do Usuário
        const html = `
            <div onclick="window.location.href='perfil.html?id=${u.id}'" class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors group">
                <div class="flex items-center gap-3">
                    <img src="${avatarSrc}" class="w-10 h-10 rounded-full object-cover border border-slate-100">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">${u.name}</h4>
                        <p class="text-xs text-slate-500 line-clamp-1">${u.bio || "Sem biografia"}</p>
                    </div>
                </div>
                <div class="text-indigo-500 text-xs font-bold px-3 py-1 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    Ver Perfil
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    container.classList.remove('hidden');
}
// Função Debounce: Espera parar de digitar para buscar
function debounceSearch() {
    const term = document.getElementById('search-input').value.trim();
    
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
        if (term.length > 0) { 
            isSearching = true; 
            // Dispara as duas buscas em paralelo
            searchUsers(term); 
            loadPosts(term); 
        } else { 
            // Limpa tudo
            isSearching = false; 
            clearUserResults(); // Nova função para limpar a área de usuários
            loadPosts(); 
        }
    }, 500);
}

// Função para limpar busca (Atualizada)
function clearSearch() {
    document.getElementById('search-input').value = "";
    isSearching = false;
    clearUserResults(); // Limpa usuários
    loadPosts(); // Recarrega feed
    toggleClearButton("");
}
async function checkForNewPosts() {
  // Não verifica se estiver buscando ou se não estiver na página principal
  if (isSearching || !document.getElementById("community-feed")) return;

  try {
    const res = await fetch(`${API_BASE}/community/posts`, { headers });
    if (res.ok) {
      const posts = await res.json();
      if (Array.isArray(posts) && posts.length > 0) {
        // Se o post mais recente do servidor for maior que o nosso local
        if (posts[0].id > latestPostId) {
          document.getElementById("new-posts-btn")?.classList.remove("hidden");
        }
      }
    }
  } catch (e) {
    // Silencioso em caso de erro no polling
  }
}

// --- RENDERIZAÇÃO (CORE) ---

function renderFeed(posts, targetId = "community-feed") {
  const feed = document.getElementById(targetId);
  if (!feed) return;

  feed.innerHTML = "";

  // Blindagem: Se posts não for array (ex: erro 500 retornou objeto), mostra erro amigável
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    const msg = posts && posts.msg ? posts.msg : "Nenhuma postagem encontrada.";
    feed.innerHTML = `<div class="text-center py-10 text-slate-400">${msg}</div>`;
    return;
  }

  posts.forEach((p) => {
    const isMyPost = p.user_id === user.id;
    const ytId = extractYoutubeId(p.youtube_link);
    const userVote = p.my_vote; // 'like', 'dislike' ou null

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

    // Estilos condicionais para Likes/Dislikes ativos
    const likeClass =
      userVote === "like"
        ? "text-green-600 bg-green-50 font-bold ring-1 ring-green-200"
        : "";
    const dislikeClass =
      userVote === "dislike"
        ? "text-red-600 bg-red-50 font-bold ring-1 ring-red-200"
        : "";

    let html = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden fade-in relative group mb-6 scroll-mt-24" id="post-${
          p.id
        }">
            
            <div class="p-4 flex justify-between items-start">
                <div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onclick="window.location.href='perfil.html?id=${
                  p.user_id
                }'">
                    ${avatarHtml}
                    <div>
                        <h3 class="font-bold text-slate-800 leading-tight hover:text-indigo-600 transition-colors">${
                          p.title
                        }</h3>
                        <p class="text-xs text-slate-500">por <span class="font-bold text-indigo-600">${
                          p.author_name
                        }</span> • ${new Date(
      p.created_at
    ).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div class="relative">
                    ${
                      isMyPost || user.is_owner
                        ? `<button onclick="deletePost(${p.id})" class="text-slate-300 hover:text-red-500 p-2" title="Excluir"><i class="fa-solid fa-trash"></i></button>`
                        : `<button onclick="openReportModal(${p.id})" class="text-slate-300 hover:text-red-500 p-2" title="Denunciar"><i class="fa-solid fa-flag"></i></button>`
                    }
                </div>
            </div>

            <div class="px-4 pb-2">
                <p class="text-sm text-slate-600 whitespace-pre-line">${
                  p.description
                }</p>
            </div>

            <div class="px-4 pb-4">
                <button onclick="openPostDetails(${
                  p.id
                })" class="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center justify-between group/btn transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500 group-hover/btn:scale-110 transition-transform">
                            <i class="fa-solid ${typeIcon}"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-xs text-slate-400 font-bold uppercase">Conteúdo</p>
                            <p class="text-sm font-bold text-slate-700">${typeLabel}</p>
                        </div>
                    </div>
                    <div class="text-indigo-600 text-sm font-bold flex items-center gap-2">
                        Ver <i class="fa-solid fa-arrow-right"></i>
                    </div>
                </button>
            </div>

            ${
              ytId
                ? `
            <div class="w-full aspect-video bg-black relative group/video cursor-pointer overflow-hidden" onclick="playVideo(this, '${ytId}')">
                <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-full h-full object-cover opacity-90 group-hover/video:opacity-80 transition-opacity">
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white shadow-xl group-hover/video:scale-110 transition-transform backdrop-blur-sm pointer-events-none">
                        <i class="fa-solid fa-play text-2xl ml-1"></i>
                    </div>
                </div>
            </div>`
                : ""
            }

            <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                
                <div class="flex items-center gap-2">
                    <button onclick="vote(${
                      p.id
                    }, 'like')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-green-100 text-slate-500 hover:text-green-600 transition-colors ${likeClass}">
                        <i class="fa-solid fa-thumbs-up"></i> <span id="likes-${
                          p.id
                        }">${p.likes_count}</span>
                    </button>
                    <button onclick="vote(${
                      p.id
                    }, 'dislike')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors ${dislikeClass}">
                        <i class="fa-solid fa-thumbs-down"></i>
                    </button>
                </div>

                <div class="flex gap-2">
                    <button onclick="sharePost(${p.id}, ${
      p.user_id
    })" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors" title="Link Direto">
                        <i class="fa-solid fa-link"></i>
                    </button>
                    <button onclick="prepareImport(${
                      p.id
                    })" class="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-full hover:bg-slate-900 shadow-md flex items-center gap-2 transition-transform active:scale-95">
                        <i class="fa-solid fa-download"></i> <span>Importar</span>
                    </button>
                </div>

            </div>
        </div>`;
    feed.innerHTML += html;
  });
}

// --- AÇÕES DO USUÁRIO ---

async function vote(postId, type) {
  if (!token) return (window.location.href = "login.html");
  try {
    const res = await fetch(`${API_BASE}/community/vote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ post_id: postId, vote_type: type }),
    });

    if (res.ok) {
      // Lógica inteligente: recarrega apenas a lista que o usuário está vendo
      // Verifica se está na aba "Curtidas" do perfil
      if (
        typeof loadProfileLikes === "function" &&
        document.getElementById("tab-likes") &&
        document
          .getElementById("tab-likes")
          .classList.contains("border-indigo-600")
      ) {
        loadProfileLikes();
      }
      // Verifica se está na aba "Posts" do perfil
      else if (
        typeof loadProfilePosts === "function" &&
        document.getElementById("tab-posts") &&
        document
          .getElementById("tab-posts")
          .classList.contains("border-indigo-600")
      ) {
        loadProfilePosts();
      }
      // Senão, recarrega o feed da comunidade
      else {
        loadPosts();
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// --- SISTEMA DE ANEXOS ---

async function fetchUserLibrary() {
  try {
    const [lib, pre] = await Promise.all([
      fetch(`${API_BASE}/library`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/presets`, { headers }).then((r) => r.json()),
    ]);
    myLibrary = Array.isArray(lib) ? lib : [];
    myPresets = Array.isArray(pre) ? pre : [];
  } catch (e) {
    console.error("Erro ao carregar biblioteca para anexos", e);
  }
}

function openAttachModal() {
  const modal = document.getElementById("attach-modal");
  if (modal) modal.classList.remove("hidden");
  selectedAttachments.clear();
  loadAttachList("recipe");
}

function closeAttachModal() {
  document.getElementById("attach-modal").classList.add("hidden");
}

function loadAttachList(type) {
  const list = document.getElementById("attach-list");
  const btnRec = document.getElementById("tab-recipe");
  const btnPlan = document.getElementById("tab-plan");

  list.innerHTML = "";

  const items = type === "recipe" ? myLibrary : myPresets;

  if (type === "recipe") {
    btnRec.className =
      "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700 transition-colors";
    btnPlan.className =
      "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500 transition-colors";
  } else {
    btnPlan.className =
      "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700 transition-colors";
    btnRec.className =
      "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500 transition-colors";
  }

  if (!items || items.length === 0) {
    list.innerHTML =
      '<div class="p-4 text-center text-sm text-slate-400">Vazio.</div>';
    return;
  }

  items.forEach((i) => {
    const div = document.createElement("div");
    const chkId = `chk-${i.id}`;
    div.className =
      "p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex items-center gap-3 select-none rounded-lg";
    div.innerHTML = `
            <input type="checkbox" id="${chkId}" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" onclick="event.stopPropagation(); toggleSelection('${
      i.id
    }')">
            <label for="${chkId}" class="flex-1 cursor-pointer font-medium text-sm text-slate-700 flex items-center gap-2">
                ${
                  type === "recipe"
                    ? `<span class="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-500"><i class="fa-solid ${
                        i.icon || "fa-utensils"
                      }"></i></span>`
                    : '<i class="fa-solid fa-calendar-days text-indigo-400"></i>'
                }
                ${i.name}
            </label>`;
    div.onclick = () => {
      document.getElementById(chkId).click();
    };
    list.appendChild(div);
  });

  // Botão de confirmação dentro da lista
  if (items.length > 0) {
    const btn = document.createElement("button");
    btn.className =
      "w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition-colors";
    btn.innerText = "Confirmar Seleção";
    btn.onclick = confirmRecipePackage;
    list.appendChild(btn);
  }
}

function toggleSelection(id) {
  if (selectedAttachments.has(id)) selectedAttachments.delete(id);
  else selectedAttachments.add(id);
}

function confirmRecipePackage() {
  if (selectedAttachments.size === 0)
    return notify("Selecione pelo menos um item.", "error");

  // Procura nos dois arrays (pode ser ineficiente se tiver muitos itens, mas ok para uso pessoal)
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
  // Feedback visual no botão
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
      // Limpa form
      document.getElementById("post-title").value = "";
      document.getElementById("post-desc").value = "";
      document.getElementById("post-yt").value = "";
      document.getElementById("post-json-content").value = "";

      // Reseta botão
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

// --- MODAIS (PREVIEW & IMPORT) ---

let currentPreviewData = null;

function openPostDetails(postId) {
  const post = allPosts.find((p) => p.id === postId);
  if (!post) return;
  openPreviewModalGeneric(post.content_json, post.title, false);
}

function prepareImport(postId) {
  const post = allPosts.find((p) => p.id === postId);
  if (!post) return;
  openPreviewModalGeneric(post.content_json, post.title, true);
}

function openPreviewModalGeneric(content, title, isImportMode) {
  currentPreviewData = content;
  const container = document.getElementById("preview-body-content");
  const titleEl = document.getElementById("preview-modal-title");

  // Injeta modal se ainda não existir
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
  if (content.planner || (content.data && content.data.planner)) {
    renderPlanPreview(content, container);
  } else if (Array.isArray(content)) {
    renderPackagePreview(content, container);
  } else {
    renderRecipeCard(content, container);
  }

  const modal = document.getElementById("post-preview-modal");
  if (modal) modal.classList.remove("hidden");
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
          id: "rec_imp_" + Date.now() + Math.random().toString(36).substr(2, 5),
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

// --- RENDERIZADORES DE CONTEÚDO ---

function renderRecipeCard(recipe, container) {
  const steps = Array.isArray(recipe.steps)
    ? recipe.steps
    : typeof recipe.steps === "string"
    ? recipe.steps.split("\n")
    : [];
  const html = `
        <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-4">
            <div class="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
                <div class="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl"><i class="fa-solid ${
                  recipe.icon || "fa-utensils"
                }"></i></div>
                <div><h4 class="font-bold text-slate-800 text-lg">${
                  recipe.name
                }</h4><span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-bold tracking-wide">${
    recipe.cat || "Geral"
  }</span></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><p class="text-xs font-bold text-slate-400 uppercase mb-2">Ingredientes</p><ul class="space-y-1">${(
                  recipe.ingredients || []
                )
                  .map(
                    (i) =>
                      `<li class="text-sm text-slate-600 flex items-center gap-2"><i class="fa-solid fa-circle-check text-green-500 text-[10px]"></i><span>${
                        i.q_daily || ""
                      }${i.u || ""} <b>${i.n}</b></span></li>`
                  )
                  .join("")}</ul></div>
                <div><p class="text-xs font-bold text-slate-400 uppercase mb-2">Preparo</p><div class="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">${
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
                }</div></div>
            </div>
        </div>`;
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

// --- BOILERPLATE & HELPERS ---

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
      duration: 3000,
      style: {
        background: type === "error" ? "#ef4444" : "#22c55e",
        borderRadius: "8px",
      },
    }).showToast();
  } else {
    alert(t);
  }
}
async function deletePost(id) {
  if (!confirm("Tem certeza?")) return;
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
function openReportModal(id) {
  if (!token) return (window.location.href = "login.html");
  document.getElementById("report-post-id").value = id;
  document.getElementById("report-modal").classList.remove("hidden");
}
function closeReportModal() {
  document.getElementById("report-modal").classList.add("hidden");
}
async function submitReport() {
  notify("Denúncia enviada.");
  closeReportModal();
}
