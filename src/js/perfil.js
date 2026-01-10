// ===== CONFIG =====
const API = "/api";
const loggedUser = JSON.parse(localStorage.getItem("user")) || null;
const targetId = new URLSearchParams(window.location.search).get("id") || loggedUser?.id;
let profileUser = {};

// ===== SAFE PARSER =====
function parseLinks(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return []; }
  }
  return [];
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfileData();
  switchTab("posts");
});

// ===== PROFILE LOAD =====
async function loadProfileData() {
  const res = await fetch(`${API}/public/user/${targetId}`);
  profileUser = await res.json();

  document.getElementById("profile-name").innerText = profileUser.name;
  document.getElementById("profile-bio").innerText = profileUser.bio || "";
  document.getElementById("profile-avatar").src =
    profileUser.avatar || `https://ui-avatars.com/api/?name=${profileUser.name}`;

  if (loggedUser && loggedUser.id == targetId) {
    document.getElementById("btn-edit-profile").classList.remove("hidden");
  }

  const links = parseLinks(profileUser.social_links);
  document.getElementById("profile-links").innerHTML =
    links.map(l => `<a href="${l.url}" target="_blank" class="text-xs">${l.name}</a>`).join("");
}

// ===== TABS =====
function switchTab(tab) {
  if (tab === "posts") loadProfilePosts();
  if (tab === "likes") loadProfileLikes();
  if (tab === "plans") loadProfilePlans();
  if (tab === "recipes") loadProfileRecipes();
}

async function loadProfilePosts() {
  const r = await fetch(`${API}/public/user/${targetId}/posts`);
  const posts = await r.json();
  renderProfilePosts(posts);
}


async function loadProfileLikes() {
  const r = await fetch(`${API}/public/user/${targetId}/likes`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (r.status === 403) return renderPrivate("Curtidas privadas");
  document.getElementById("profile-feed").innerHTML = JSON.stringify(await r.json());
}

async function loadProfilePlans() {
  const r = await fetch(`${API}/public/user/${targetId}/plans`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (r.status === 403) return renderPrivate("Planos privados");
  document.getElementById("profile-feed").innerHTML = JSON.stringify(await r.json());
}

async function loadProfileRecipes() {
  const r = await fetch(`${API}/public/user/${targetId}/recipes`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (r.status === 403) return renderPrivate("Receitas privadas");
  document.getElementById("profile-feed").innerHTML = JSON.stringify(await r.json());
}

function renderPrivate(msg) {
  document.getElementById("profile-feed").innerHTML =
    `<p class="text-center text-slate-400 py-10">${msg}</p>`;
}

// ===== MODAL =====
function openEditProfile() {
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-bio").value = profileUser.bio || "";
  document.getElementById("edit-likes-public").checked = profileUser.likes_public == 1;
  document.getElementById("edit-plans-public").checked = profileUser.plans_public == 1;
  document.getElementById("edit-recipes-public").checked = profileUser.recipes_public == 1;

  const list = document.getElementById("social-list");
  list.innerHTML = "";
  parseLinks(profileUser.social_links).forEach(l => addSocialInput(l.name, l.url));
}

function closeEditProfile() {
  document.getElementById("edit-modal").classList.add("hidden");
}
function renderProfilePosts(posts) {
  const feed = document.getElementById("profile-feed");

  if (!posts || posts.length === 0) {
    feed.innerHTML = `<p class="text-center text-slate-400">Nenhum post ainda.</p>`;
    return;
  }

  feed.innerHTML = posts.map(p => `
    <div class="bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition">
      <div class="flex items-center gap-3 mb-3">
        <img src="${p.author_avatar || 'https://ui-avatars.com/api/?name='+p.author_name}"
             class="w-10 h-10 rounded-full">
        <div>
          <p class="text-sm font-bold text-slate-700">${p.author_name}</p>
          <p class="text-xs text-slate-400">${new Date(p.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <p class="text-sm text-slate-700 mb-3 whitespace-pre-line">
        ${p.description || ""}
      </p>

      <div class="flex items-center gap-4 text-xs text-slate-500">
        <span><i class="fa-solid fa-thumbs-up text-indigo-500"></i> ${p.likes_count || 0}</span>
        <span><i class="fa-regular fa-comment"></i> ${p.comments_count || 0}</span>
      </div>
    </div>
  `).join("");
}

function addSocialInput(name = "Instagram", url = "") {
  const div = document.createElement("div");
  div.className = "social-row flex gap-2 mb-1";
  div.innerHTML = `
    <input class="s-name" value="${name}">
    <input class="s-url" value="${url}">
    <button onclick="this.parentElement.remove()">X</button>`;
  document.getElementById("social-list").appendChild(div);
}

async function saveProfile() {
  const links = [];
  document.querySelectorAll(".social-row").forEach(r => {
    links.push({
      name: r.querySelector(".s-name").value,
      url: r.querySelector(".s-url").value,
    });
  });

  const payload = {
    bio: document.getElementById("edit-bio").value,
    avatar: profileUser.avatar,
    social_links: links,
    likes_public: document.getElementById("edit-likes-public").checked,
    plans_public: document.getElementById("edit-plans-public").checked,
    recipes_public: document.getElementById("edit-recipes-public").checked,
  };

  await fetch(`${API}/user/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify(payload),
  });

  closeEditProfile();
  loadProfileData();
}

// ===== GLOBAL EXPORT =====
window.openEditProfile = openEditProfile;
window.saveProfile = saveProfile;
window.closeEditProfile = closeEditProfile;
window.switchTab = switchTab;
window.addSocialInput = addSocialInput;

