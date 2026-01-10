// --- CONFIGURAÇÃO ---
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
  // Injeta modal de preview se a função existir (vem do community.js)
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

  // Tratamento de Deep Link (Link direto para um post)
  if (deepLinkPostId) {
    setTimeout(() => {
      const el = document.getElementById(`post-${deepLinkPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
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

    // Habilita botões de edição apenas se for o dono
    if (loggedUser && loggedUser.id == targetId) {
      document.getElementById("btn-edit-profile").classList.remove("hidden");
      document.getElementById("btn-edit-avatar").classList.remove("hidden");
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

  // Loading State
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

    // IMPORTANTE: Atualiza variável global para que community.js (botões Ver/Comentar) funcione
    if (window.allPosts) window.allPosts = posts;
    else window.allPosts = posts;

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

    // Atualiza global para interações funcionarem
    window.allPosts = posts;
    if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
  } catch (e) {
    document.getElementById("profile-feed").innerHTML =
      '<div class="text-center text-slate-400 py-10">Não foi possível carregar as curtidas.</div>';
  }
}

// --- LÓGICA DE PLANOS PÚBLICOS/PRIVADOS ---
async function loadProfilePlans() {
  const isOwner = loggedUser && loggedUser.id == targetId;
  const isPublic = profileUser.plans_public === 1;

  // Lógica de Segurança: Se não for dono E não for público, bloqueia
  if (!isOwner && !isPublic) {
    renderPrivateMessage(
      "Planos Pessoais",
      "Apenas o dono do perfil pode ver seus planos salvos."
    );
    return;
  }

  try {
    const token = localStorage.getItem("token");
    let url = "";

    // Rota Privada (completos) vs Rota Pública (filtrados/seguros)
    if (isOwner) {
      url = `${API_BASE_PERFIL}/presets`;
    } else {
      url = `${API_BASE_PERFIL}/public/user/${targetId}/plans`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404 && !isOwner) {
        // Caso a rota pública não exista ainda ou não retorne nada
        document.getElementById("profile-feed").innerHTML =
          '<div class="text-center text-slate-400 py-10">Nenhum plano visível.</div>';
        return;
      }
      throw new Error("Erro API");
    }

    const plans = await res.json();

    if (!plans || plans.length === 0) {
      document.getElementById("profile-feed").innerHTML =
        '<div class="text-center text-slate-400 py-10">Nenhum plano encontrado.</div>';
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
                            <p class="text-xs text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> ${
                              isOwner ? "Salvo na conta" : "Plano Público"
                            }</p>
                        </div>
                        <div class="bg-indigo-50 text-indigo-600 rounded-lg px-2 py-1">
                            <i class="fa-solid fa-calendar-days"></i>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-slate-100">
                        <p class="text-sm text-slate-500 mb-2">Contém dados de dieta e treino.</p>
                        ${
                          isOwner
                            ? '<span class="text-xs font-bold text-indigo-500">Seu Plano</span>'
                            : ""
                        }
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

// --- LÓGICA DE RECEITAS PÚBLICAS/PRIVADAS ---
async function loadProfileRecipes() {
  const isOwner = loggedUser && loggedUser.id == targetId;
  const isPublic = profileUser.recipes_public === 1;

  if (!isOwner && !isPublic) {
    renderPrivateMessage(
      "Livro de Receitas",
      "As receitas deste usuário são privadas."
    );
    return;
  }

  try {
    const token = localStorage.getItem("token");
    let url = "";

    if (isOwner) {
      url = `${API_BASE_PERFIL}/library`;
    } else {
      url = `${API_BASE_PERFIL}/public/user/${targetId}/recipes`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404 && !isOwner) {
        document.getElementById("profile-feed").innerHTML =
          '<div class="text-center text-slate-400 py-10">Nenhuma receita visível.</div>';
        return;
      }
      throw new Error("Erro API");
    }

    const recipes = await res.json();

    if (!recipes || recipes.length === 0) {
      document.getElementById("profile-feed").innerHTML =
        '<div class="text-center text-slate-400 py-10">Nenhuma receita encontrada.</div>';
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

async function uploadAvatar(input) {
  const originalFile = input.files[0];
  if (!originalFile) return;

  const btn = document.getElementById("btn-edit-avatar");
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    let fileToSend = originalFile;
    // Se existir a função de compressão (carregada via script tag), usa-a
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

      // Atualiza local storage se for o próprio usuário logado
      if (loggedUser) {
        loggedUser.avatar = data.secure_url;
        localStorage.setItem("user", JSON.stringify(loggedUser));
      }

      await saveProfile(true);
      if (typeof notify === "function") notify("Foto atualizada!");
    }
  } catch (e) {
    alert("Erro de envio.");
    console.error(e);
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-camera"></i>';
    input.value = "";
  }
}

// CORREÇÃO: Abre modal e carrega TODOS os estados de privacidade
function openEditProfile() {
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-bio").value = profileUser.bio || "";

  // 1. Carregar Links Existentes
  const container = document.getElementById("social-list");
  container.innerHTML = ""; // Limpa antes de adicionar
  const links =
    typeof profileUser.social_links === "string"
      ? JSON.parse(profileUser.social_links)
      : profileUser.social_links || [];
  links.forEach((l) => {
    addSocialInput(l.name, l.url);
  });

  // 2. Carregar Status de Privacidade (Default = 0 se não existir)
  document.getElementById("toggle-privacy-likes").checked =
    profileUser.likes_public === 1;
  document.getElementById("toggle-privacy-plans").checked =
    profileUser.plans_public === 1;
  document.getElementById("toggle-privacy-recipes").checked =
    profileUser.recipes_public === 1;
}

function closeEditProfile() {
  document.getElementById("edit-modal").classList.add("hidden");
}

// CORREÇÃO: Salva TODOS os estados de privacidade
async function saveProfile(silent = false) {
  const bio = document.getElementById("edit-bio").value;

  // 1. Ler Links dos Inputs
  const socialRows = document.querySelectorAll(".social-row");
  const newLinks = [];
  socialRows.forEach((row) => {
    const name = row.querySelector(".s-name").value;
    const url = row.querySelector(".s-url").value;
    if (url && url.trim() !== "") newLinks.push({ name, url });
  });

  // 2. Ler Privacidade dos Checkboxes
  const likesPublic = document.getElementById("toggle-privacy-likes").checked;
  const plansPublic = document.getElementById("toggle-privacy-plans").checked;
  const recipesPublic = document.getElementById(
    "toggle-privacy-recipes"
  ).checked;

  const payload = {
    bio: bio,
    avatar: profileUser.avatar,
    social_links: newLinks,
    likes_public: likesPublic ? 1 : 0,
    plans_public: plansPublic ? 1 : 0,
    recipes_public: recipesPublic ? 1 : 0,
  };

  const token = localStorage.getItem("token");

  try {
    await fetch(`${API_BASE_PERFIL}/user/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    // Atualiza estado local imediatamente
    profileUser.bio = bio;
    profileUser.social_links = newLinks;
    profileUser.likes_public = payload.likes_public;
    profileUser.plans_public = payload.plans_public;
    profileUser.recipes_public = payload.recipes_public;

    if (!silent) {
      closeEditProfile();
      loadProfileData(); // Recarrega para refletir mudanças na UI
      if (typeof notify === "function") notify("Perfil atualizado!");
    }
  } catch (e) {
    console.error(e);
    if (!silent) alert("Erro ao salvar perfil.");
  }
}

function addSocialInput(name = "Instagram", url = "") {
  const div = document.createElement("div");
  div.className = "flex gap-2 items-center social-row";
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
