// --- INIT ---
document.addEventListener("DOMContentLoaded", async () => {
  // Injeta modal se necessário (função pode estar em community.js ou definida aqui se preferir)
  if (typeof injectPreviewModal === "function") injectPreviewModal();

  if (!targetId) {
    alert("Perfil não encontrado.");
    window.location.href = "community.html";
    return;
  }

  setupSidebarLinks();
  setupAuthUI();
  await loadProfileData();
  switchTab("posts");

  if (deepLinkPostId) {
    setTimeout(() => {
      const el = document.getElementById(`post-${deepLinkPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Garante que a função global exista (vinda do community.js carregado no HTML)
        if (typeof openPostDetails === "function")
          openPostDetails(parseInt(deepLinkPostId));
      }
    }, 1000);
  }
});

function setupSidebarLinks() {
  const profileLink = document.getElementById("link-my-profile");
  if (loggedUser && loggedUser.id) {
    if (profileLink) {
      profileLink.href = `perfil.html?id=${loggedUser.id}`;
      if (loggedUser.id == targetId) {
        profileLink.classList.remove("text-slate-600", "hover:bg-slate-50");
        profileLink.classList.add(
          "bg-indigo-50",
          "text-indigo-700",
          "font-bold",
          "border",
          "border-indigo-100",
          "shadow-sm"
        );
      }
    }
  } else {
    if (profileLink) profileLink.href = "login.html";
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

function setupAuthUI() {
  const container = document.getElementById("auth-actions");
  if (!loggedUser) {
    container.classList.remove("hidden");
    container.innerHTML = `<a href="login.html" class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-sm">Entrar / Cadastrar</a>`;
  }
}

// --- DADOS DO PERFIL ---
async function loadProfileData() {
  try {
    const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}`);
    if (!res.ok) throw new Error("Usuário não encontrado");
    profileUser = await res.json();

    document.getElementById("profile-name").innerText = profileUser.name;
    document.getElementById("profile-bio").innerText =
      profileUser.bio || "Sem biografia.";

    const avatarEl = document.getElementById("profile-avatar");
    avatarEl.src =
      profileUser.avatar ||
      `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`;

    const linksContainer = document.getElementById("profile-links");
    linksContainer.innerHTML = "";
    const links =
      typeof profileUser.social_links === "string"
        ? JSON.parse(profileUser.social_links)
        : profileUser.social_links || [];

    links.forEach((l) => {
      let icon = "fa-link";
      if (l.name === "Instagram") icon = "fa-instagram";
      if (l.name === "YouTube") icon = "fa-youtube";
      if (l.name === "TikTok") icon = "fa-tiktok";
      linksContainer.innerHTML += `<a href="${l.url}" target="_blank" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 transition-colors"><i class="fa-brands ${icon}"></i> ${l.name}</a>`;
    });

    // Controles de Dono
    if (loggedUser && loggedUser.id == targetId) {
      document.getElementById("btn-edit-profile").classList.remove("hidden");
      document.getElementById("btn-edit-avatar").classList.remove("hidden");
      document.getElementById("privacy-control").classList.remove("hidden");
      document.getElementById("toggle-privacy").checked =
        profileUser.likes_public === 1;
    }
  } catch (e) {
    console.error(e);
    document.getElementById("profile-name").innerText = "Perfil não encontrado";
  }
}

// --- ABAS & LISTAGEM ---

async function switchTab(tab) {
  const feed = document.getElementById("profile-feed");
  const tabs = ["posts", "likes", "plans", "recipes"];

  // Atualiza estado visual das abas
  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-${t}`);
    if (t === tab) {
      btn.classList.add("border-indigo-600", "text-indigo-600");
      btn.classList.remove("border-transparent", "text-slate-400");
    } else {
      btn.classList.remove("border-indigo-600", "text-indigo-600");
      btn.classList.add("border-transparent", "text-slate-400");
    }
  });

  feed.innerHTML =
    '<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-indigo-500 text-2xl"></i></div>';

  if (tab === "posts") {
    await loadProfilePosts();
  } else if (tab === "likes") {
    await loadProfileLikes();
  } else if (tab === "plans") {
    await loadProfilePlans();
  } else if (tab === "recipes") {
    await loadProfileRecipes();
  }
}

async function loadProfilePosts() {
  try {
    const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/posts`);
    const posts = await res.json();
    if (!Array.isArray(posts)) throw new Error("Erro posts");

    // Importante: Compartilhar com community.js se estiver presente
    if (window.allPosts) window.allPosts = posts;
    else window.allPosts = posts; // fallback

    if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
  } catch (e) {
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-red-400 py-10">Erro ao carregar posts.</div>';
  }
}

async function loadProfileLikes() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${API_BASE_PERFIL}/public/user/${targetId}/likes`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.status === 403) {
      renderPrivateMessage(
        "Curtidas Privadas",
        "Este usuário optou por não mostrar o que curte."
      );
      return;
    }
    if (!res.ok) throw new Error("Erro API");
    const posts = await res.json();

    window.allPosts = posts;
    if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
  } catch (e) {
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-slate-400 py-10">Não foi possível carregar as curtidas.</div>';
  }
}

async function loadProfilePlans() {
  // Verificação de segurança: Só o dono vê seus planos (Limitação da API atual)
  if (!loggedUser || loggedUser.id != targetId) {
    renderPrivateMessage(
      "Planos Pessoais",
      "Apenas o dono do perfil pode ver seus planos salvos."
    );
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE_PERFIL}/presets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const plans = await res.json();

    if (!plans || plans.length === 0) {
      document.getElementById("profile-feed").innerHTML =
        '<div class="text-center text-slate-400 py-10">Nenhum plano salvo.</div>';
      return;
    }

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    plans.forEach((plan) => {
      html += `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">${
                              plan.name || "Plano Sem Nome"
                            }</h3>
                            <p class="text-xs text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> Salvo na conta</p>
                        </div>
                        <div class="bg-indigo-50 text-indigo-600 rounded-lg px-2 py-1">
                            <i class="fa-solid fa-calendar-days"></i>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-slate-100">
                        <p class="text-sm text-slate-500 mb-2">Contém dados de dieta e treino.</p>
                        <span class="text-xs font-bold text-indigo-500">Disponível em "Meus Planos"</span>
                    </div>
                </div>
            `;
    });
    html += "</div>";
    document.getElementById("profile-feed").innerHTML = html;
  } catch (e) {
    console.error(e);
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-red-400 py-10">Erro ao carregar planos.</div>';
  }
}

async function loadProfileRecipes() {
  if (!loggedUser || loggedUser.id != targetId) {
    renderPrivateMessage(
      "Livro de Receitas",
      "As receitas deste usuário são privadas."
    );
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE_PERFIL}/library`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const recipes = await res.json();

    if (!recipes || recipes.length === 0) {
      document.getElementById("profile-feed").innerHTML =
        '<div class="text-center text-slate-400 py-10">Nenhuma receita salva.</div>';
      return;
    }

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    recipes.forEach((recipe) => {
      const bgImage =
        recipe.image ||
        "https://images.unsplash.com/photo-1495521841625-f342588d6165?q=80&w=400&auto=format&fit=crop";

      html += `
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div class="h-32 bg-cover bg-center" style="background-image: url('${bgImage}')"></div>
                    <div class="p-4">
                        <h3 class="font-bold text-slate-800 mb-1 line-clamp-1">${
                          recipe.title || "Receita Sem Título"
                        }</h3>
                        <p class="text-xs text-slate-500 line-clamp-2 mb-3">${
                          recipe.instructions
                            ? recipe.instructions.substring(0, 80) + "..."
                            : "Sem descrição."
                        }</p>
                        <div class="flex items-center justify-between mt-2">
                             <span class="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-full font-bold">
                                ${
                                  recipe.calories
                                    ? recipe.calories + " kcal"
                                    : "N/A"
                                }
                             </span>
                        </div>
                    </div>
                </div>
            `;
    });
    html += "</div>";
    document.getElementById("profile-feed").innerHTML = html;
  } catch (e) {
    console.error(e);
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-red-400 py-10">Erro ao carregar receitas.</div>';
  }
}

function renderPrivateMessage(title, subtitle) {
  document.getElementById("profile-feed").innerHTML = `
        <div class="text-center py-10 bg-white rounded-xl border border-slate-200">
            <i class="fa-solid fa-lock text-slate-300 text-4xl mb-3"></i>
            <p class="text-slate-500 font-bold mt-2">${title}</p>
            <p class="text-slate-400 text-sm">${subtitle}</p>
        </div>`;
}

// --- UPLOAD & EDIÇÃO ---

async function togglePrivacy() {
  const isPublic = document.getElementById("toggle-privacy").checked;

  // Atualiza localmente antes de enviar para evitar delay visual
  profileUser.likes_public = isPublic ? 1 : 0;

  try {
    const payload = {
      bio: profileUser.bio,
      avatar: profileUser.avatar,
      social_links:
        typeof profileUser.social_links === "string"
          ? JSON.parse(profileUser.social_links)
          : profileUser.social_links,
      likes_public: isPublic,
    };
    const token = localStorage.getItem("token");
    await fetch(`${API_BASE_PERFIL}/user/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (typeof notify === "function")
      notify(
        isPublic ? "Curtidas agora são PÚBLICAS" : "Curtidas agora são PRIVADAS"
      );
  } catch (e) {
    document.getElementById("toggle-privacy").checked = !isPublic;
    profileUser.likes_public = !isPublic;
  }
}

async function uploadAvatar(input) {
  const originalFile = input.files[0];
  if (!originalFile) return;

  const btn = document.getElementById("btn-edit-avatar");
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    let fileToSend = originalFile;
    if (
      typeof compressImage === "function" &&
      originalFile.size > 1024 * 1024
    ) {
      fileToSend = await compressImage(originalFile);
    }

    const formData = new FormData();
    formData.append("file", fileToSend);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    const data = await res.json();

    if (data.secure_url) {
      document.getElementById("profile-avatar").src = data.secure_url;
      profileUser.avatar = data.secure_url;
      if (loggedUser) {
        loggedUser.avatar = data.secure_url;
        localStorage.setItem("user", JSON.stringify(loggedUser));
      }
      // Salva silenciosamente para atualizar o backend
      await saveProfile(true);
      if (typeof notify === "function") notify("Foto atualizada!");
    }
  } catch (e) {
    alert("Erro de envio.");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-camera"></i>';
    input.value = "";
  }
}

// CORREÇÃO: Função agora carrega os links existentes no modal
function openEditProfile() {
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-bio").value = profileUser.bio || "";

  // Limpa lista atual e recria inputs com dados salvos
  const container = document.getElementById("social-list");
  container.innerHTML = "";
  const links =
    typeof profileUser.social_links === "string"
      ? JSON.parse(profileUser.social_links)
      : profileUser.social_links || [];

  links.forEach((l) => {
    addSocialInput(l.name, l.url);
  });
}

function closeEditProfile() {
  document.getElementById("edit-modal").classList.add("hidden");
}

// CORREÇÃO: Função agora captura os links do DOM antes de salvar
async function saveProfile(silent = false) {
  const bio = document.getElementById("edit-bio").value;

  // Captura lista de redes sociais dos inputs
  const socialRows = document.querySelectorAll(".social-row");
  const newLinks = [];
  socialRows.forEach((row) => {
    const name = row.querySelector(".s-name").value;
    const url = row.querySelector(".s-url").value;
    if (url && url.trim() !== "") {
      newLinks.push({ name, url });
    }
  });

  const payload = {
    bio: bio,
    avatar: profileUser.avatar,
    social_links: newLinks,
    likes_public: profileUser.likes_public,
  };

  const token = localStorage.getItem("token");
  await fetch(`${API_BASE_PERFIL}/user/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  // Atualiza objeto local
  profileUser.bio = bio;
  profileUser.social_links = newLinks;

  if (!silent) {
    closeEditProfile();
    loadProfileData();
  }
}

function addSocialInput(name = "Instagram", url = "") {
  const div = document.createElement("div");
  div.className = "flex gap-2 items-center social-row"; // Classe importante para o saveProfile encontrar
  div.innerHTML = `
        <select class="s-name w-1/3 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs">
            <option value="Instagram" ${
              name === "Instagram" ? "selected" : ""
            }>Instagram</option>
            <option value="YouTube" ${
              name === "YouTube" ? "selected" : ""
            }>YouTube</option>
            <option value="TikTok" ${
              name === "TikTok" ? "selected" : ""
            }>TikTok</option>
            <option value="Site" ${
              name === "Site" ? "selected" : ""
            }>Site</option>
        </select>
        <input type="text" class="s-url flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs" placeholder="Cole o link..." value="${url}">
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
    `;
  document.getElementById("social-list").appendChild(div);
}

document.getElementById("edit-bio").addEventListener("input", function () {
  document.getElementById("bio-counter").innerText = `${this.value.length}/255`;
}); // --- CONFIGURAÇÃO ---
const IS_DEV_PERFIL =
  window.location.port === "8080" || window.location.port === "5500";
const API_BASE_PERFIL = IS_DEV_PERFIL
  ? `http://${window.location.hostname}:3000/api`
  : "/api";

// !!! COLOQUE SUAS CHAVES AQUI !!!
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhu8un8ty/image/upload";
const CLOUDINARY_PRESET = "diet_userperfil";

let profileUser = {};
const loggedUser = JSON.parse(localStorage.getItem("user")) || null;
const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get("id") || (loggedUser ? loggedUser.id : null);
const deepLinkPostId = urlParams.get("post");

// --- INIT ---
document.addEventListener("DOMContentLoaded", async () => {
  // Injeta modal se necessário (função pode estar em community.js ou definida aqui se preferir)
  if (typeof injectPreviewModal === "function") injectPreviewModal();

  if (!targetId) {
    alert("Perfil não encontrado.");
    window.location.href = "community.html";
    return;
  }

  setupSidebarLinks();
  setupAuthUI();
  await loadProfileData();
  switchTab("posts");

  if (deepLinkPostId) {
    setTimeout(() => {
      const el = document.getElementById(`post-${deepLinkPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Garante que a função global exista (vinda do community.js carregado no HTML)
        if (typeof openPostDetails === "function")
          openPostDetails(parseInt(deepLinkPostId));
      }
    }, 1000);
  }
});

function setupSidebarLinks() {
  const profileLink = document.getElementById("link-my-profile");
  if (loggedUser && loggedUser.id) {
    if (profileLink) {
      profileLink.href = `perfil.html?id=${loggedUser.id}`;
      if (loggedUser.id == targetId) {
        profileLink.classList.remove("text-slate-600", "hover:bg-slate-50");
        profileLink.classList.add(
          "bg-indigo-50",
          "text-indigo-700",
          "font-bold",
          "border",
          "border-indigo-100",
          "shadow-sm"
        );
      }
    }
  } else {
    if (profileLink) profileLink.href = "login.html";
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

function setupAuthUI() {
  const container = document.getElementById("auth-actions");
  if (!loggedUser) {
    container.classList.remove("hidden");
    container.innerHTML = `<a href="login.html" class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-sm">Entrar / Cadastrar</a>`;
  }
}

// --- DADOS DO PERFIL ---
async function loadProfileData() {
  try {
    const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}`);
    if (!res.ok) throw new Error("Usuário não encontrado");
    profileUser = await res.json();

    document.getElementById("profile-name").innerText = profileUser.name;
    document.getElementById("profile-bio").innerText =
      profileUser.bio || "Sem biografia.";

    const avatarEl = document.getElementById("profile-avatar");
    avatarEl.src =
      profileUser.avatar ||
      `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`;

    const linksContainer = document.getElementById("profile-links");
    linksContainer.innerHTML = "";
    const links =
      typeof profileUser.social_links === "string"
        ? JSON.parse(profileUser.social_links)
        : profileUser.social_links || [];

    links.forEach((l) => {
      let icon = "fa-link";
      if (l.name === "Instagram") icon = "fa-instagram";
      if (l.name === "YouTube") icon = "fa-youtube";
      if (l.name === "TikTok") icon = "fa-tiktok";
      linksContainer.innerHTML += `<a href="${l.url}" target="_blank" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 transition-colors"><i class="fa-brands ${icon}"></i> ${l.name}</a>`;
    });

    // Controles de Dono
    if (loggedUser && loggedUser.id == targetId) {
      document.getElementById("btn-edit-profile").classList.remove("hidden");
      document.getElementById("btn-edit-avatar").classList.remove("hidden");
      document.getElementById("privacy-control").classList.remove("hidden");
      document.getElementById("toggle-privacy").checked =
        profileUser.likes_public === 1;
    }
  } catch (e) {
    console.error(e);
    document.getElementById("profile-name").innerText = "Perfil não encontrado";
  }
}

// --- ABAS & LISTAGEM ---

async function switchTab(tab) {
  const feed = document.getElementById("profile-feed");
  const tabs = ["posts", "likes", "plans", "recipes"];

  // Atualiza estado visual das abas
  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-${t}`);
    if (t === tab) {
      btn.classList.add("border-indigo-600", "text-indigo-600");
      btn.classList.remove("border-transparent", "text-slate-400");
    } else {
      btn.classList.remove("border-indigo-600", "text-indigo-600");
      btn.classList.add("border-transparent", "text-slate-400");
    }
  });

  feed.innerHTML =
    '<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-indigo-500 text-2xl"></i></div>';

  if (tab === "posts") {
    await loadProfilePosts();
  } else if (tab === "likes") {
    await loadProfileLikes();
  } else if (tab === "plans") {
    await loadProfilePlans();
  } else if (tab === "recipes") {
    await loadProfileRecipes();
  }
}

async function loadProfilePosts() {
  try {
    const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/posts`);
    const posts = await res.json();
    if (!Array.isArray(posts)) throw new Error("Erro posts");

    // Importante: Compartilhar com community.js se estiver presente
    if (window.allPosts) window.allPosts = posts;
    else window.allPosts = posts; // fallback

    if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
  } catch (e) {
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-red-400 py-10">Erro ao carregar posts.</div>';
  }
}

async function loadProfileLikes() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${API_BASE_PERFIL}/public/user/${targetId}/likes`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.status === 403) {
      renderPrivateMessage(
        "Curtidas Privadas",
        "Este usuário optou por não mostrar o que curte."
      );
      return;
    }
    if (!res.ok) throw new Error("Erro API");
    const posts = await res.json();

    window.allPosts = posts;
    if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
  } catch (e) {
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-slate-400 py-10">Não foi possível carregar as curtidas.</div>';
  }
}

async function loadProfilePlans() {
  // Verificação de segurança: Só o dono vê seus planos (Limitação da API atual)
  if (!loggedUser || loggedUser.id != targetId) {
    renderPrivateMessage(
      "Planos Pessoais",
      "Apenas o dono do perfil pode ver seus planos salvos."
    );
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE_PERFIL}/presets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const plans = await res.json();

    if (!plans || plans.length === 0) {
      document.getElementById("profile-feed").innerHTML =
        '<div class="text-center text-slate-400 py-10">Nenhum plano salvo.</div>';
      return;
    }

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    plans.forEach((plan) => {
      html += `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">${
                              plan.name || "Plano Sem Nome"
                            }</h3>
                            <p class="text-xs text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> Salvo na conta</p>
                        </div>
                        <div class="bg-indigo-50 text-indigo-600 rounded-lg px-2 py-1">
                            <i class="fa-solid fa-calendar-days"></i>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-slate-100">
                        <p class="text-sm text-slate-500 mb-2">Contém dados de dieta e treino.</p>
                        <span class="text-xs font-bold text-indigo-500">Disponível em "Meus Planos"</span>
                    </div>
                </div>
            `;
    });
    html += "</div>";
    document.getElementById("profile-feed").innerHTML = html;
  } catch (e) {
    console.error(e);
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-red-400 py-10">Erro ao carregar planos.</div>';
  }
}

async function loadProfileRecipes() {
  if (!loggedUser || loggedUser.id != targetId) {
    renderPrivateMessage(
      "Livro de Receitas",
      "As receitas deste usuário são privadas."
    );
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE_PERFIL}/library`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const recipes = await res.json();

    if (!recipes || recipes.length === 0) {
      document.getElementById("profile-feed").innerHTML =
        '<div class="text-center text-slate-400 py-10">Nenhuma receita salva.</div>';
      return;
    }

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    recipes.forEach((recipe) => {
      const bgImage =
        recipe.image ||
        "https://images.unsplash.com/photo-1495521841625-f342588d6165?q=80&w=400&auto=format&fit=crop";

      html += `
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div class="h-32 bg-cover bg-center" style="background-image: url('${bgImage}')"></div>
                    <div class="p-4">
                        <h3 class="font-bold text-slate-800 mb-1 line-clamp-1">${
                          recipe.title || "Receita Sem Título"
                        }</h3>
                        <p class="text-xs text-slate-500 line-clamp-2 mb-3">${
                          recipe.instructions
                            ? recipe.instructions.substring(0, 80) + "..."
                            : "Sem descrição."
                        }</p>
                        <div class="flex items-center justify-between mt-2">
                             <span class="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-full font-bold">
                                ${
                                  recipe.calories
                                    ? recipe.calories + " kcal"
                                    : "N/A"
                                }
                             </span>
                        </div>
                    </div>
                </div>
            `;
    });
    html += "</div>";
    document.getElementById("profile-feed").innerHTML = html;
  } catch (e) {
    console.error(e);
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-red-400 py-10">Erro ao carregar receitas.</div>';
  }
}

function renderPrivateMessage(title, subtitle) {
  document.getElementById("profile-feed").innerHTML = `
        <div class="text-center py-10 bg-white rounded-xl border border-slate-200">
            <i class="fa-solid fa-lock text-slate-300 text-4xl mb-3"></i>
            <p class="text-slate-500 font-bold mt-2">${title}</p>
            <p class="text-slate-400 text-sm">${subtitle}</p>
        </div>`;
}

// --- UPLOAD & EDIÇÃO ---

async function togglePrivacy() {
  const isPublic = document.getElementById("toggle-privacy").checked;

  // Atualiza localmente antes de enviar para evitar delay visual
  profileUser.likes_public = isPublic ? 1 : 0;

  try {
    const payload = {
      bio: profileUser.bio,
      avatar: profileUser.avatar,
      social_links:
        typeof profileUser.social_links === "string"
          ? JSON.parse(profileUser.social_links)
          : profileUser.social_links,
      likes_public: isPublic,
    };
    const token = localStorage.getItem("token");
    await fetch(`${API_BASE_PERFIL}/user/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (typeof notify === "function")
      notify(
        isPublic ? "Curtidas agora são PÚBLICAS" : "Curtidas agora são PRIVADAS"
      );
  } catch (e) {
    document.getElementById("toggle-privacy").checked = !isPublic;
    profileUser.likes_public = !isPublic;
  }
}

async function uploadAvatar(input) {
  const originalFile = input.files[0];
  if (!originalFile) return;

  const btn = document.getElementById("btn-edit-avatar");
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    let fileToSend = originalFile;
    if (
      typeof compressImage === "function" &&
      originalFile.size > 1024 * 1024
    ) {
      fileToSend = await compressImage(originalFile);
    }

    const formData = new FormData();
    formData.append("file", fileToSend);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    const data = await res.json();

    if (data.secure_url) {
      document.getElementById("profile-avatar").src = data.secure_url;
      profileUser.avatar = data.secure_url;
      if (loggedUser) {
        loggedUser.avatar = data.secure_url;
        localStorage.setItem("user", JSON.stringify(loggedUser));
      }
      // Salva silenciosamente para atualizar o backend
      await saveProfile(true);
      if (typeof notify === "function") notify("Foto atualizada!");
    }
  } catch (e) {
    alert("Erro de envio.");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-camera"></i>';
    input.value = "";
  }
}

// CORREÇÃO: Função agora carrega os links existentes no modal
function openEditProfile() {
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-bio").value = profileUser.bio || "";

  // Limpa lista atual e recria inputs com dados salvos
  const container = document.getElementById("social-list");
  container.innerHTML = "";
  const links =
    typeof profileUser.social_links === "string"
      ? JSON.parse(profileUser.social_links)
      : profileUser.social_links || [];

  links.forEach((l) => {
    addSocialInput(l.name, l.url);
  });
}

function closeEditProfile() {
  document.getElementById("edit-modal").classList.add("hidden");
}

// CORREÇÃO: Função agora captura os links do DOM antes de salvar
async function saveProfile(silent = false) {
  const bio = document.getElementById("edit-bio").value;

  // Captura lista de redes sociais dos inputs
  const socialRows = document.querySelectorAll(".social-row");
  const newLinks = [];
  socialRows.forEach((row) => {
    const name = row.querySelector(".s-name").value;
    const url = row.querySelector(".s-url").value;
    if (url && url.trim() !== "") {
      newLinks.push({ name, url });
    }
  });

  const payload = {
    bio: bio,
    avatar: profileUser.avatar,
    social_links: newLinks,
    likes_public: profileUser.likes_public,
  };

  const token = localStorage.getItem("token");
  await fetch(`${API_BASE_PERFIL}/user/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  // Atualiza objeto local
  profileUser.bio = bio;
  profileUser.social_links = newLinks;

  if (!silent) {
    closeEditProfile();
    loadProfileData();
  }
}

function addSocialInput(name = "Instagram", url = "") {
  const div = document.createElement("div");
  div.className = "flex gap-2 items-center social-row"; // Classe importante para o saveProfile encontrar
  div.innerHTML = `
        <select class="s-name w-1/3 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs">
            <option value="Instagram" ${
              name === "Instagram" ? "selected" : ""
            }>Instagram</option>
            <option value="YouTube" ${
              name === "YouTube" ? "selected" : ""
            }>YouTube</option>
            <option value="TikTok" ${
              name === "TikTok" ? "selected" : ""
            }>TikTok</option>
            <option value="Site" ${
              name === "Site" ? "selected" : ""
            }>Site</option>
        </select>
        <input type="text" class="s-url flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs" placeholder="Cole o link..." value="${url}">
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
    `;
  document.getElementById("social-list").appendChild(div);
}

document.getElementById("edit-bio").addEventListener("input", function () {
  document.getElementById("bio-counter").innerText = `${this.value.length}/255`;
});
