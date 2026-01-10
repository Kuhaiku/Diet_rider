// ===== BOOTSTRAP =====
const IS_DEV_PERFIL = window.location.port === "8080" || window.location.port === "5500";
const API_BASE_PERFIL = IS_DEV_PERFIL ? `http://${window.location.hostname}:3000/api` : "/api";

const loggedUser = JSON.parse(localStorage.getItem("user")) || null;
const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get("id") || (loggedUser ? loggedUser.id : null);
const deepLinkPostId = urlParams.get("post");

let profileUser = {};

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {

  const bioEl = document.getElementById("edit-bio");
  if (bioEl) {
    bioEl.addEventListener("input", () => {
      document.getElementById("bio-counter").innerText = `${bioEl.value.length}/255`;
    });
  }

  if (!targetId) {
    alert("Perfil não encontrado.");
    window.location.href = "community.html";
    return;
  }

  setupSidebarLinks();
  setupAuthUI();
  await loadProfileData();
  switchTab("posts");
});

// ===== UI =====
function setupSidebarLinks() {
  const profileLink = document.getElementById("link-my-profile");
  if (profileLink) {
    profileLink.href = loggedUser ? `perfil.html?id=${loggedUser.id}` : "login.html";
  }
}

function setupAuthUI() {
  const container = document.getElementById("auth-actions");
  if (!loggedUser && container) {
    container.classList.remove("hidden");
    container.innerHTML = `<a href="login.html" class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg">Entrar / Cadastrar</a>`;
  }
}

// ===== PROFILE =====
async function loadProfileData() {
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}`);
  profileUser = await res.json();

  document.getElementById("profile-name").innerText = profileUser.name;
  document.getElementById("profile-bio").innerText = profileUser.bio || "Sem biografia.";
  document.getElementById("profile-avatar").src =
    profileUser.avatar || `https://ui-avatars.com/api/?name=${profileUser.name}`;

  if (loggedUser && loggedUser.id == targetId) {
    document.getElementById("btn-edit-profile").classList.remove("hidden");
  }
}

// ===== TABS =====
async function switchTab(tab) {
  if (tab === "posts") await loadProfilePosts();
  if (tab === "likes") await loadProfileLikes();
  if (tab === "plans") await loadProfilePlans();
  if (tab === "recipes") await loadProfileRecipes();
}

async function loadProfilePosts() {
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/posts`);
  const posts = await res.json();
  if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
}

async function loadProfileLikes() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/likes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) return renderPrivateMessage("Curtidas Privadas", "Usuário ocultou.");
  const posts = await res.json();
  if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
}

async function loadProfilePlans() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/plans`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) return renderPrivateMessage("Planos Privados", "Usuário ocultou.");
  const plans = await res.json();

  document.getElementById("profile-feed").innerHTML = plans.map(p =>
    `<div class="p-4 bg-white border rounded">${p.name || "Plano Sem Nome"}</div>`
  ).join("");
}

async function loadProfileRecipes() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) return renderPrivateMessage("Receitas Privadas", "Usuário ocultou.");
  const recipes = await res.json();

  document.getElementById("profile-feed").innerHTML = recipes.map(r =>
    `<div class="p-4 bg-white border rounded">${r.title || "Receita"}</div>`
  ).join("");
}

function renderPrivateMessage(title, subtitle) {
  document.getElementById("profile-feed").innerHTML =
    `<div class="text-center py-10">${title}<br>${subtitle}</div>`;
}
function openEditProfile() {
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-bio").value = profileUser.bio || "";

  document.getElementById("edit-likes-public").checked = profileUser.likes_public == 1;
  document.getElementById("edit-plans-public").checked = profileUser.plans_public == 1;
  document.getElementById("edit-recipes-public").checked = profileUser.recipes_public == 1;

  const container = document.getElementById("social-list");
  container.innerHTML = "";

  const links =
    typeof profileUser.social_links === "string"
      ? JSON.parse(profileUser.social_links)
      : profileUser.social_links || [];

  links.forEach(l => addSocialInput(l.name, l.url));
}

function closeEditProfile() {
  document.getElementById("edit-modal").classList.add("hidden");
}

function addSocialInput(name = "Instagram", url = "") {
  const div = document.createElement("div");
  div.className = "flex gap-2 items-center social-row";
  div.innerHTML = `
    <select class="s-name w-1/3 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs">
      <option value="Instagram" ${name==="Instagram"?"selected":""}>Instagram</option>
      <option value="YouTube" ${name==="YouTube"?"selected":""}>YouTube</option>
      <option value="TikTok" ${name==="TikTok"?"selected":""}>TikTok</option>
      <option value="Site" ${name==="Site"?"selected":""}>Site</option>
    </select>
    <input class="s-url flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs" value="${url}">
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500">
      <i class="fa-solid fa-trash"></i>
    </button>`;
  document.getElementById("social-list").appendChild(div);
}
