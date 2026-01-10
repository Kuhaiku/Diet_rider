const API = "/api";
const loggedUser = JSON.parse(localStorage.getItem("user")) || null;
const targetId = new URLSearchParams(window.location.search).get("id") || loggedUser?.id;
let profileUser = {};

document.addEventListener("DOMContentLoaded", async () => {
  await loadProfileData();
  switchTab("posts");
});

// PERFIL
async function loadProfileData(){
  const res = await fetch(`${API}/public/user/${targetId}`);
  profileUser = await res.json();

  document.getElementById("profile-name").innerText = profileUser.name;
  document.getElementById("profile-bio").innerText = profileUser.bio || "";
  document.getElementById("profile-avatar").src = profileUser.avatar || `https://ui-avatars.com/api/?name=${profileUser.name}`;

  if(loggedUser && loggedUser.id == targetId){
    document.getElementById("btn-edit-profile").classList.remove("hidden");
  }

  const links = JSON.parse(profileUser.social_links||"[]");
  document.getElementById("profile-links").innerHTML = links.map(l=>`<a href="${l.url}" class="text-xs">${l.name}</a>`).join("");
}

// ABAS
async function switchTab(tab){
  if(tab==="posts") loadProfilePosts();
  if(tab==="likes") loadProfileLikes();
  if(tab==="plans") loadProfilePlans();
  if(tab==="recipes") loadProfileRecipes();
}

async function loadProfilePosts(){
  const r = await fetch(`${API}/public/user/${targetId}/posts`);
  document.getElementById("profile-feed").innerHTML = JSON.stringify(await r.json());
}
async function loadProfileLikes(){
  const r = await fetch(`${API}/public/user/${targetId}/likes`,{headers:{Authorization:`Bearer ${localStorage.getItem("token")}`}});
  if(r.status===403) return renderPrivate("Curtidas privadas");
  document.getElementById("profile-feed").innerHTML = JSON.stringify(await r.json());
}
async function loadProfilePlans(){
  const r = await fetch(`${API}/public/user/${targetId}/plans`,{headers:{Authorization:`Bearer ${localStorage.getItem("token")}`}});
  if(r.status===403) return renderPrivate("Planos privados");
  document.getElementById("profile-feed").innerHTML = JSON.stringify(await r.json());
}
async function loadProfileRecipes(){
  const r = await fetch(`${API}/public/user/${targetId}/recipes`,{headers:{Authorization:`Bearer ${localStorage.getItem("token")}`}});
  if(r.status===403) return renderPrivate("Receitas privadas");
  document.getElementById("profile-feed").innerHTML = JSON.stringify(await r.json());
}

function renderPrivate(msg){
  document.getElementById("profile-feed").innerHTML = `<p class="text-center text-slate-400">${msg}</p>`;
}

// MODAL
function openEditProfile(){
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-bio").value = profileUser.bio||"";
  document.getElementById("edit-likes-public").checked = profileUser.likes_public==1;
  document.getElementById("edit-plans-public").checked = profileUser.plans_public==1;
  document.getElementById("edit-recipes-public").checked = profileUser.recipes_public==1;

  const list = document.getElementById("social-list");
  list.innerHTML="";
  JSON.parse(profileUser.social_links||"[]").forEach(l=>addSocialInput(l.name,l.url));
}
function closeEditProfile(){ document.getElementById("edit-modal").classList.add("hidden"); }

function addSocialInput(name="Instagram",url=""){
  const d=document.createElement("div");
  d.className="social-row flex gap-2 mb-1";
  d.innerHTML=`<input class="s-name" value="${name}"><input class="s-url" value="${url}"><button onclick="this.parentElement.remove()">X</button>`;
  document.getElementById("social-list").appendChild(d);
}

async function saveProfile(){
  const links=[];
  document.querySelectorAll(".social-row").forEach(r=>{
    links.push({name:r.querySelector(".s-name").value,url:r.querySelector(".s-url").value});
  });

  const payload={
    bio:document.getElementById("edit-bio").value,
    avatar:profileUser.avatar,
    social_links:links,
    likes_public:document.getElementById("edit-likes-public").checked,
    plans_public:document.getElementById("edit-plans-public").checked,
    recipes_public:document.getElementById("edit-recipes-public").checked
  };

  await fetch(`${API}/user/profile`,{
    method:"PUT",
    headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")}`},
    body:JSON.stringify(payload)
  });

  closeEditProfile();
  loadProfileData();
}

// GLOBAL
window.openEditProfile=openEditProfile;
window.saveProfile=saveProfile;
window.closeEditProfile=closeEditProfile;
window.switchTab=switchTab;
window.addSocialInput=addSocialInput;
