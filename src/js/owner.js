const API_BASE = "http://localhost:3000/api";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user")) || {};

// Segurança Client-Side (O Backend é a real segurança)
if (!token || user.is_owner !== 1) {
  window.location.href = "app.html";
}

window.onload = function () {
  loadStats();
  switchView("dashboard");
};

// --- UI HELPERS ---

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("mobile-overlay");
  if (sb.classList.contains("-translate-x-full")) {
    sb.classList.remove("-translate-x-full");
    ov.classList.remove("hidden");
  } else {
    sb.classList.add("-translate-x-full");
    ov.classList.add("hidden");
  }
}

function switchView(viewName) {
  // Esconde mobile sidebar se aberta
  const sb = document.getElementById("sidebar");
  if (!sb.classList.contains("-translate-x-full") && window.innerWidth < 768)
    toggleSidebar();

  ["dashboard", "users", "posts", "reports"].forEach((v) => {
    document.getElementById(`view-${v}`).classList.add("hidden");
    const btn = document.getElementById(`nav-${v}`);
    if (btn)
      btn.className =
        "flex items-center w-full px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg mb-1 transition-colors";
  });

  document.getElementById(`view-${viewName}`).classList.remove("hidden");
  const activeBtn = document.getElementById(`nav-${viewName}`);
  if (activeBtn)
    activeBtn.className =
      "flex items-center w-full px-4 py-3 text-sm font-bold bg-slate-50 text-indigo-700 rounded-lg mb-1 transition-colors border border-indigo-100";

  if (viewName === "users") loadUsers();
  if (viewName === "posts") loadAllPosts();
  if (viewName === "reports") loadReports();
  if (viewName === "dashboard") loadStats();
}

// --- ESTATÍSTICAS ---
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/owner/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    document.getElementById("stat-users").innerText = data.users;
    document.getElementById("stat-posts").innerText = data.posts;
    document.getElementById("stat-reports").innerText = data.reports;

    const badge = document.getElementById("badge-reports");
    if (data.reports > 0) {
      badge.innerText = data.reports;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  } catch (e) {
    console.error(e);
  }
}

// --- USUÁRIOS ---
async function loadUsers() {
  const tbody = document.getElementById("table-users-body");
  tbody.innerHTML =
    '<tr><td colspan="5" class="px-6 py-4 text-center text-slate-400">Carregando...</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/owner/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = await res.json();
    tbody.innerHTML = "";
    users.forEach((u) => {
      const isBan = u.can_post === 0;
      const statusHtml = isBan
        ? `<span class="bg-red-100 text-red-600 py-1 px-2 rounded text-xs font-bold">Banido</span>`
        : `<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs font-bold">Ativo</span>`;

      const btnHtml = isBan
        ? `<button onclick="toggleBan('${u.email}', 1)" class="text-xs font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded border border-green-200">Desbanir</button>`
        : `<button onclick="toggleBan('${u.email}', 0)" class="text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-200">Banir</button>`;

      const row = `<tr class="hover:bg-slate-50 border-b border-slate-50 last:border-0"><td class="px-6 py-4 text-slate-500 font-mono text-xs">#${u.id}</td><td class="px-6 py-4 font-bold text-slate-700">${u.name}</td><td class="px-6 py-4 text-slate-500 break-all">${u.email}</td><td class="px-6 py-4">${statusHtml}</td><td class="px-6 py-4 text-right">${btnHtml}</td></tr>`;
      tbody.innerHTML += row;
    });
  } catch (e) {
    notify("Erro ao carregar usuários", "error");
  }
}

async function toggleBan(email, status) {
  if (!confirm(`Alterar status de ${email}?`)) return;
  try {
    await fetch(`${API_BASE}/owner/ban`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, can_post: status }),
    });
    notify("Status atualizado!");
    loadUsers();
  } catch (e) {
    notify("Erro ao atualizar", "error");
  }
}

// --- POSTS ---
async function loadAllPosts() {
  const tbody = document.getElementById("table-posts-body");
  tbody.innerHTML =
    '<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Carregando...</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/owner/all_posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const posts = await res.json();
    tbody.innerHTML = "";
    posts.forEach((p) => {
      const row = `
                <tr class="hover:bg-slate-50 border-b border-slate-50 last:border-0">
                    <td class="px-6 py-4"><p class="font-bold text-slate-700 truncate max-w-[150px]">${
                      p.title
                    }</p><p class="text-xs text-slate-400 truncate max-w-[150px]">${
        p.description
      }</p></td>
                    <td class="px-6 py-4 text-sm text-slate-600">${
                      p.author_name
                    }<br><span class="text-xs text-slate-400">${
        p.author_email
      }</span></td>
                    <td class="px-6 py-4 text-xs text-slate-500">${new Date(
                      p.created_at
                    ).toLocaleDateString()}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="previewReportedPost(${
                          p.id
                        })" class="mr-2 text-indigo-500 hover:text-indigo-700"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="deletePost(${
                          p.id
                        }, true)" class="text-slate-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
      tbody.innerHTML += row;
    });
  } catch (e) {
    notify("Erro ao carregar posts", "error");
  }
}

// --- DENÚNCIAS ---
async function loadReports() {
  const grid = document.getElementById("reports-grid");
  const empty = document.getElementById("reports-empty");
  grid.innerHTML = "";
  try {
    const res = await fetch(`${API_BASE}/owner/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reports = await res.json();
    if (reports.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    reports.forEach((r) => {
      const card = document.createElement("div");
      card.className =
        "bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col";
      card.innerHTML = `
                <div class="flex justify-between items-start mb-3"><span class="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-100">Denúncia #${
                  r.id
                }</span><span class="text-xs text-slate-400">${new Date(
        r.created_at
      ).toLocaleDateString()}</span></div>
                <p class="text-sm text-slate-600 mb-1 font-bold">Motivo:</p>
                <p class="text-sm text-slate-800 bg-slate-50 p-2 rounded mb-4 border border-slate-100">${
                  r.reason
                }</p>
                <div class="mt-auto"><button onclick="previewReportedPost(${
                  r.post_id
                })" class="w-full py-2 text-xs font-bold bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors">Ver Post</button></div>`;
      grid.appendChild(card);
    });
  } catch (e) {
    notify("Erro ao carregar denúncias", "error");
  }
}

// --- PREVIEW AVANÇADO (Card vs JSON) ---
async function previewReportedPost(postId) {
  try {
    const res = await fetch(`${API_BASE}/community/post/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Post não encontrado");
    const p = await res.json();

    // 1. Preencher ABA JSON (Técnica)
    document.getElementById("raw-title").innerText = p.title;
    document.getElementById("raw-desc").innerText = p.description;
    document.getElementById("raw-json").innerText = JSON.stringify(
      p.content_json,
      null,
      2
    );

    // 2. Preencher ABA VISUAL (Card Real - Igual Community.js)
    const container = document.getElementById("content-visual");
    const ytId = extractYoutubeId(p.youtube_link);

    container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="p-4 flex items-center gap-3 border-b border-slate-50">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">${
                      p.author_name
                        ? p.author_name.charAt(0).toUpperCase()
                        : "?"
                    }</div>
                    <div><h3 class="font-bold text-slate-800 leading-tight">${
                      p.title
                    }</h3><p class="text-xs text-slate-500">por ${
      p.author_name || "Desconhecido"
    } • ${new Date(p.created_at).toLocaleDateString()}</p></div>
                </div>
                <div class="px-4 py-3"><p class="text-sm text-slate-600 whitespace-pre-line">${
                  p.description
                }</p></div>
                ${
                  ytId
                    ? `
                <div class="w-full aspect-video bg-black relative group cursor-pointer" onclick="playVideo(this, '${ytId}')">
                    <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-full h-full object-cover opacity-90">
                    <div class="absolute inset-0 flex items-center justify-center"><div class="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white shadow-xl"><i class="fa-solid fa-play text-2xl ml-1"></i></div></div>
                </div>`
                    : ""
                }
                <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between opacity-70 pointer-events-none grayscale">
                    <div class="flex gap-2"><button class="px-3 py-1 bg-white border rounded"><i class="fa-solid fa-thumbs-up"></i> ${
                      p.likes_count
                    }</button></div>
                    <button class="px-3 py-1 bg-slate-800 text-white rounded text-xs">Importar (Demo)</button>
                </div>
            </div>
            <p class="text-center text-xs text-slate-400 mt-2">Este é o visual exato que os usuários veem.</p>
        `;

    // Botão de deletar global
    document.getElementById("btn-delete-post").onclick = () => deletePost(p.id);

    switchTab("visual"); // Reseta para visual
    document.getElementById("preview-modal").classList.remove("hidden");
  } catch (e) {
    notify(e.message, "error");
  }
}

function switchTab(tab) {
  const btnV = document.getElementById("tab-visual");
  const btnJ = document.getElementById("tab-json");
  const contentV = document.getElementById("content-visual");
  const contentJ = document.getElementById("content-json");

  if (tab === "visual") {
    btnV.className =
      "flex-1 py-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 bg-white";
    btnJ.className =
      "flex-1 py-3 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors";
    contentV.classList.remove("hidden");
    contentJ.classList.add("hidden");
  } else {
    btnJ.className =
      "flex-1 py-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 bg-white";
    btnV.className =
      "flex-1 py-3 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors";
    contentJ.classList.remove("hidden");
    contentV.classList.add("hidden");
  }
}

function closePreview() {
  document.getElementById("preview-modal").classList.add("hidden");
  document.getElementById("content-visual").innerHTML = ""; // Para vídeo
}

async function deletePost(id, reloadList = false) {
  if (!confirm("Apagar post permanentemente?")) return;
  try {
    await fetch(`${API_BASE}/community/post/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    notify("Post deletado.");
    if (reloadList) loadAllPosts();
    closePreview();
    loadReports();
    loadStats();
  } catch (e) {
    notify("Erro ao deletar", "error");
  }
}

// --- UTILS (REPETIDOS DO COMMUNITY PARA O PLAYER FUNCIONAR) ---
function extractYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
function playVideo(container, videoId) {
  container.onclick = null;
  container.innerHTML = `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}
function notify(text, type = "success") {
  Toastify({
    text: text,
    duration: 3000,
    gravity: "top",
    position: "center",
    style: {
      background: type === "error" ? "#ef4444" : "#22c55e",
      borderRadius: "8px",
    },
  }).showToast();
}
