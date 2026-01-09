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
let allPosts = [];
let myLibrary = [];
let myPresets = [];
let selectedAttachments = new Set();
let latestPostId = 0;
let searchTimeout = null;
let isSearching = false;

// --- INICIALIZAÇÃO ---
if (
  window.location.pathname.includes("community.html") ||
  document.getElementById("community-feed")
) {
  window.onload = async function () {
    if (!token) window.location.href = "login.html";

    injectPreviewModal();
    setupSidebarLinks();

    await Promise.all([loadPosts(), fetchUserLibrary()]);

    checkDeepLink();

    // Polling de novos posts
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
  if (!document.getElementById("community-feed")) return; // Evita erro se estiver no perfil

  document.getElementById("new-posts-btn")?.classList.add("hidden");

  try {
    const url = query
      ? `${API_BASE}/community/posts?q=${encodeURIComponent(query)}`
      : `${API_BASE}/community/posts`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Erro API");
    const posts = await res.json();

    allPosts = posts;
    if (!query && posts.length > 0) latestPostId = posts[0].id;

    renderFeed(posts, "community-feed");
  } catch (e) {
    console.error(e);
    const el = document.getElementById("community-feed");
    if (el)
      el.innerHTML = `<div class="text-center py-10 text-red-400">Erro ao carregar.</div>`;
  }
}

function debounceSearch() {
  const term = document.getElementById("search-input").value.trim();
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (term.length > 0) {
      isSearching = true;
      loadPosts(term);
    } else {
      isSearching = false;
      loadPosts();
    }
  }, 500);
}

async function checkForNewPosts() {
  if (isSearching || !document.getElementById("community-feed")) return;
  try {
    const res = await fetch(`${API_BASE}/community/posts`, { headers });
    if (res.ok) {
      const posts = await res.json();
      if (posts.length > 0 && posts[0].id > latestPostId) {
        document.getElementById("new-posts-btn")?.classList.remove("hidden");
      }
    }
  } catch (e) {}
}

// --- RENDERIZAÇÃO (CORE) ---

function renderFeed(posts, targetId = "community-feed") {
  const feed = document.getElementById(targetId);
  if (!feed) return;

  feed.innerHTML = "";

  if (!posts || posts.length === 0) {
    feed.innerHTML = `<div class="text-center py-10 text-slate-400">Nenhuma postagem encontrada.</div>`;
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

    // Classes de estilo para Likes Ativos
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
                        ? `<button onclick="deletePost(${p.id})" class="text-slate-300 hover:text-red-500 p-2"><i class="fa-solid fa-trash"></i></button>`
                        : `<button onclick="openReportModal(${p.id})" class="text-slate-300 hover:text-red-500 p-2"><i class="fa-solid fa-flag"></i></button>`
                    }
                </div>
            </div>

            <div class="px-4 pb-2"><p class="text-sm text-slate-600 whitespace-pre-line">${
              p.description
            }</p></div>

            <div class="px-4 pb-4">
                <button onclick="openPostDetails(${
                  p.id
                })" class="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center justify-between group/btn transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500 group-hover/btn:scale-110 transition-transform"><i class="fa-solid ${typeIcon}"></i></div>
                        <div class="text-left"><p class="text-xs text-slate-400 font-bold uppercase">Conteúdo</p><p class="text-sm font-bold text-slate-700">${typeLabel}</p></div>
                    </div>
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
    })" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"><i class="fa-solid fa-link"></i></button>
                    <button onclick="prepareImport(${
                      p.id
                    })" class="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-full hover:bg-slate-900 shadow-md flex items-center gap-2 active:scale-95"><i class="fa-solid fa-download"></i> <span>Importar</span></button>
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
      // Recarrega a lista correta baseado na página atual
      if (
        typeof loadProfileLikes === "function" &&
        document
          .getElementById("tab-likes")
          ?.classList.contains("border-indigo-600")
      ) {
        loadProfileLikes();
      } else if (
        typeof loadProfilePosts === "function" &&
        document
          .getElementById("tab-posts")
          ?.classList.contains("border-indigo-600")
      ) {
        loadProfilePosts();
      } else {
        loadPosts(); // Feed normal
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// --- UTILS & ANEXOS --- (Simplificados para caber, mantenha lógica original completa)
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
  const list = document.getElementById("attach-list");
  list.innerHTML = "";
  const items = type === "recipe" ? myLibrary : myPresets;

  // Toggle tabs UI
  const tabRec = document.getElementById("tab-recipe");
  const tabPlan = document.getElementById("tab-plan");
  if (type === "recipe") {
    tabRec.className =
      "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700";
    tabPlan.className =
      "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500";
  } else {
    tabPlan.className =
      "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700";
    tabRec.className =
      "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500";
  }

  if (items.length === 0)
    list.innerHTML =
      '<div class="p-4 text-center text-sm text-slate-400">Vazio.</div>';

  items.forEach((i) => {
    const div = document.createElement("div");
    div.className =
      "p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex items-center gap-2";
    div.innerHTML = `<span class="text-sm font-medium text-slate-700">${i.name}</span>`;
    div.onclick = () =>
      selectAttachment(
        i,
        (type === "recipe" ? "Receita: " : "Plano: ") + i.name
      );
    list.appendChild(div);
  });
}
function selectAttachment(obj, label) {
  document.getElementById("post-json-content").value = JSON.stringify(obj);
  document.getElementById("attach-label").innerText = label;
  document
    .getElementById("attach-label")
    .parentElement.classList.add("bg-green-100", "text-green-700");
  closeAttachModal();
}

async function createPost() {
  const title = document.getElementById("post-title").value.trim();
  const desc = document.getElementById("post-desc").value.trim();
  const yt = document.getElementById("post-yt").value.trim();
  const jsonStr = document.getElementById("post-json-content").value;
  if (!title || !jsonStr)
    return notify("Título e anexo são obrigatórios", "error");
  try {
    await fetch(`${API_BASE}/community/post`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description: desc,
        youtube_link: yt,
        content_json: JSON.parse(jsonStr),
      }),
    });
    notify("Postado!");
    window.location.reload();
  } catch (e) {
    notify("Erro.", "error");
  }
}

// Helpers padrão
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
    if (res.ok) document.getElementById(`post-${id}`).remove();
  } catch (e) {}
}

// Modais
function injectPreviewModal() {
  if (!document.getElementById("post-preview-modal"))
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="post-preview-modal" class="hidden fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-2xl h-[80vh] flex flex-col"><div class="p-4 border-b flex justify-between"><h3 id="preview-modal-title" class="font-bold">Detalhes</h3><button onclick="document.getElementById('post-preview-modal').classList.add('hidden')">X</button></div><div id="preview-body-content" class="p-4 overflow-y-auto flex-1"></div><div class="p-4 border-t"><button id="preview-action-btn" class="hidden w-full bg-green-600 text-white py-2 rounded">Confirmar</button></div></div></div>`
    );
}
function openPostDetails(id) {
  const p = allPosts.find((x) => x.id === id);
  if (p) {
    showGenericPreview(p.content_json, p.title, false);
  }
}
function prepareImport(id) {
  const p = allPosts.find((x) => x.id === id);
  if (p) {
    showGenericPreview(p.content_json, p.title, true);
  }
}
function showGenericPreview(content, title, isImport) {
  const el = document.getElementById("post-preview-modal");
  document.getElementById("preview-modal-title").innerText = title;
  const body = document.getElementById("preview-body-content");
  body.innerHTML =
    "<pre class='text-xs whitespace-pre-wrap'>" +
    JSON.stringify(content, null, 2) +
    "</pre>"; // Simplificado para exemplo, usar renderRecipeCard aqui
  const btn = document.getElementById("preview-action-btn");
  if (isImport) {
    btn.classList.remove("hidden");
    btn.onclick = () => executeImport(content);
  } else btn.classList.add("hidden");
  el.classList.remove("hidden");
}
async function executeImport(c) {
  // Lógica de importação simplificada
  const url = c.planner ? `${API_BASE}/presets` : `${API_BASE}/library`;
  await fetch(url, { method: "POST", headers, body: JSON.stringify(c) });
  notify("Importado!");
  document.getElementById("post-preview-modal").classList.add("hidden");
}
function checkDeepLink() {
  const p = new URLSearchParams(window.location.search).get("post_id");
  if (p)
    setTimeout(
      () => document.getElementById(`post-${p}`)?.scrollIntoView(),
      1000
    );
}
