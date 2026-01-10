// --- CONFIGURAÇÃO ---
const IS_DEV_PERFIL =
  window.location.port === "8080" || window.location.port === "5500";
const API_BASE_PERFIL = IS_DEV_PERFIL
  ? `http://${window.location.hostname}:3000/api`
  : "/api";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhu8un8ty/image/upload";
const CLOUDINARY_PRESET = "diet_userperfil";

let profileUser = {};
const loggedUser = JSON.parse(localStorage.getItem("user")) || null;
const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get("id") || (loggedUser ? loggedUser.id : null);
const deepLinkPostId = urlParams.get("post");

// --- INIT ---
document.addEventListener("DOMContentLoaded", async () => {
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
      if (el && typeof openPostDetails === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        openPostDetails(parseInt(deepLinkPostId));
      }
    }, 800);
  }
});

function setupSidebarLinks() {
  const profileLink = document.getElementById("link-my-profile");
  if (loggedUser && loggedUser.id && profileLink) {
    profileLink.href = `perfil.html?id=${loggedUser.id}`;
    if (loggedUser.id == targetId) {
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
}

function setupAuthUI() {
  const container = document.getElementById("auth-actions");
  if (!loggedUser && container) {
    container.classList.remove("hidden");
    container.innerHTML = `<a href="login.html" class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg">Entrar / Cadastrar</a>`;
  }
}

// --- PERFIL ---
async function loadProfileData() {
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}`);
  profileUser = await res.json();

  document.getElementById("profile-name").innerText = profileUser.name;
  document.getElementById("profile-bio").innerText =
    profileUser.bio || "Sem biografia.";
  document.getElementById("profile-avatar").src =
    profileUser.avatar ||
    `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`;

  const links =
    typeof profileUser.social_links === "string"
      ? JSON.parse(profileUser.social_links)
      : profileUser.social_links || [];
  document.getElementById("profile-links").innerHTML = links
    .map(
      (l) =>
        `<a href="${l.url}" target="_blank" class="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold">${l.name}</a>`
    )
    .join("");

  if (loggedUser && loggedUser.id == targetId) {
    document.getElementById("btn-edit-profile").classList.remove("hidden");
    document.getElementById("btn-edit-avatar").classList.remove("hidden");
  }
}

// --- ABAS ---
async function switchTab(tab) {
  document.getElementById(
    "profile-feed"
  ).innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-indigo-500 text-2xl"></i></div>`;
  if (tab === "posts") loadProfilePosts();
  if (tab === "likes") loadProfileLikes();
  if (tab === "plans") loadProfilePlans();
  if (tab === "recipes") loadProfileRecipes();
}

// --- POSTS ---
async function loadProfilePosts() {
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/posts`);
  const posts = await res.json();
  window.allPosts = posts;
  if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
}

// --- LIKES ---
async function loadProfileLikes() {
  if (!profileUser.likes_public && loggedUser?.id != targetId)
    return renderPrivateMessage(
      "Curtidas Privadas",
      "Este usuário ocultou suas curtidas."
    );
  const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/likes`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  const posts = await res.json();
  window.allPosts = posts;
  if (typeof renderFeed === "function") renderFeed(posts, "profile-feed");
}

// --- PLANOS ---
async function loadProfilePlans() {
  if (!profileUser.plans_public && loggedUser?.id != targetId)
    return renderPrivateMessage(
      "Planos Privados",
      "Este usuário ocultou seus planos."
    );
  const url =
    loggedUser?.id == targetId
      ? `${API_BASE_PERFIL}/presets`
      : `${API_BASE_PERFIL}/public/user/${targetId}/plans`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  const plans = await res.json();
  document.getElementById("profile-feed").innerHTML = plans
    .map((p) => `<div class="bg-white p-4 rounded-xl border">${p.name}</div>`)
    .join("");
}

// --- RECEITAS ---
async function loadProfileRecipes() {
  if (!profileUser.recipes_public && loggedUser?.id != targetId)
    return renderPrivateMessage(
      "Receitas Privadas",
      "Este usuário ocultou suas receitas."
    );
  const url =
    loggedUser?.id == targetId
      ? `${API_BASE_PERFIL}/library`
      : `${API_BASE_PERFIL}/public/user/${targetId}/recipes`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  const recipes = await res.json();
  document.getElementById("profile-feed").innerHTML = recipes
    .map((r) => `<div class="bg-white p-4 rounded-xl border">${r.title}</div>`)
    .join("");
}

function renderPrivateMessage(title, msg) {
  document.getElementById(
    "profile-feed"
  ).innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-lock text-3xl"></i><p class="font-bold">${title}</p><p>${msg}</p></div>`;
}
