// --- CONFIGURAÇÃO ---
const IS_DEV_PERFIL = window.location.port === "8080" || window.location.port === "5500";
const API_BASE_PERFIL = IS_DEV_PERFIL ? `http://${window.location.hostname}:3000/api` : "/api";

// !!! COLOQUE SUAS CHAVES AQUI !!!
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhu8un8ty/image/upload";
const CLOUDINARY_PRESET = "diet_userperfil"; // Seu preset Unsigned

let profileUser = {}; 
const loggedUser = JSON.parse(localStorage.getItem('user')) || null;
const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('id') || (loggedUser ? loggedUser.id : null);
const deepLinkPostId = urlParams.get('post'); 

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    // Injeta modal de preview se necessário
    if(typeof injectPreviewModal === 'function') injectPreviewModal();

    if (!targetId) {
        alert("Perfil não encontrado.");
        window.location.href = 'community.html';
        return;
    }

    // Configura a Sidebar (Link "Meu Perfil" e User Logado)
    setupSidebarLinks();

    setupAuthUI();
    await loadProfileData();
    switchTab('posts'); 
    
    if(deepLinkPostId) {
        setTimeout(() => {
            const el = document.getElementById(`post-${deepLinkPostId}`);
            if(el) {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
                if(typeof openPostDetails === 'function') openPostDetails(parseInt(deepLinkPostId)); 
            }
        }, 1000);
    }
});

// --- SIDEBAR & AUTH (Replicado/Ajustado para Perfil) ---

function setupSidebarLinks() {
    const profileLink = document.getElementById('link-my-profile');
    if (loggedUser && loggedUser.id) {
        if (profileLink) {
            profileLink.href = `perfil.html?id=${loggedUser.id}`;
            // Se estou vendo meu próprio perfil, destaca o link
            if (loggedUser.id == targetId) {
                profileLink.classList.remove('text-slate-600', 'hover:bg-slate-50');
                profileLink.classList.add('bg-indigo-50', 'text-indigo-700', 'font-bold', 'border', 'border-indigo-100', 'shadow-sm');
            }
        }
    } else {
        if (profileLink) profileLink.href = "login.html";
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('mobile-overlay');
    if (sb && sb.classList.contains('-translate-x-full')) {
        sb.classList.remove('-translate-x-full');
        ov.classList.remove('hidden');
    } else if (sb) {
        sb.classList.add('-translate-x-full');
        ov.classList.add('hidden');
    }
}

function logout() {
    if(confirm("Deseja realmente sair?")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "login.html";
    }
}

function setupAuthUI() {
    const container = document.getElementById('auth-actions');
    // Como agora temos sidebar, o botão de login no header pode ser opcional ou para mobile
    // Mas vamos manter a lógica:
    if (!loggedUser) {
        container.classList.remove('hidden');
        container.innerHTML = `<a href="login.html" class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-sm">Entrar / Cadastrar</a>`;
    }
}

// --- DADOS DO PERFIL ---

async function loadProfileData() {
    try {
        const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}`);
        if (!res.ok) throw new Error("Usuário não encontrado");
        profileUser = await res.json();

        // UI Header
        document.getElementById('profile-name').innerText = profileUser.name;
        document.getElementById('profile-bio').innerText = profileUser.bio || "Sem biografia.";
        
        const avatarEl = document.getElementById('profile-avatar');
        avatarEl.src = profileUser.avatar || `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`;

        const linksContainer = document.getElementById('profile-links');
        linksContainer.innerHTML = "";
        const links = typeof profileUser.social_links === 'string' ? JSON.parse(profileUser.social_links) : (profileUser.social_links || []);
        
        links.forEach(l => {
            let icon = 'fa-link';
            if(l.name === 'Instagram') icon = 'fa-instagram';
            if(l.name === 'YouTube') icon = 'fa-youtube';
            if(l.name === 'TikTok') icon = 'fa-tiktok';
            linksContainer.innerHTML += `<a href="${l.url}" target="_blank" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 transition-colors"><i class="fa-brands ${icon}"></i> ${l.name}</a>`;
        });

        // Controles de Dono
        if (loggedUser && loggedUser.id == targetId) {
            document.getElementById('btn-edit-profile').classList.remove('hidden');
            document.getElementById('btn-edit-avatar').classList.remove('hidden');
            document.getElementById('privacy-control').classList.remove('hidden');
            document.getElementById('toggle-privacy').checked = (profileUser.likes_public === 1);
        }

    } catch (e) {
        console.error(e);
        document.getElementById('profile-name').innerText = "Perfil não encontrado";
    }
}

// --- ABAS & LISTAGEM ---

async function switchTab(tab) {
    const feed = document.getElementById('profile-feed');
    const btnPosts = document.getElementById('tab-posts');
    const btnLikes = document.getElementById('tab-likes');
    
    feed.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-indigo-500 text-2xl"></i></div>';

    if (tab === 'posts') {
        btnPosts.classList.add('border-indigo-600', 'text-indigo-600');
        btnPosts.classList.remove('border-transparent', 'text-slate-400');
        btnLikes.classList.remove('border-indigo-600', 'text-indigo-600');
        btnLikes.classList.add('border-transparent', 'text-slate-400');
        
        await loadProfilePosts();
    } else {
        btnLikes.classList.add('border-indigo-600', 'text-indigo-600');
        btnLikes.classList.remove('border-transparent', 'text-slate-400');
        btnPosts.classList.remove('border-indigo-600', 'text-indigo-600');
        btnPosts.classList.add('border-transparent', 'text-slate-400');
        
        await loadProfileLikes();
    }
}

async function loadProfilePosts() {
    try {
        const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/posts`);
        const posts = await res.json();
        
        if (!Array.isArray(posts)) throw new Error("Erro na resposta de posts");

        window.allPosts = posts; 
        if(typeof renderFeed === 'function') renderFeed(posts, 'profile-feed');
    } catch (e) { 
        console.error(e); 
        document.getElementById('profile-feed').innerHTML = '<div class="text-center text-red-400 py-10">Erro ao carregar posts.</div>'; 
    }
}

async function loadProfileLikes() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/likes`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.status === 403) {
            document.getElementById('profile-feed').innerHTML = `
                <div class="text-center py-10 bg-white rounded-xl border border-slate-200">
                    <i class="fa-solid fa-lock text-slate-300 text-4xl mb-3"></i>
                    <p class="text-slate-500 font-bold mt-2">Curtidas Privadas</p>
                    <p class="text-slate-400 text-sm">Este usuário optou por não mostrar o que curte.</p>
                </div>`;
            return;
        }

        if(!res.ok) throw new Error("Erro na API");

        const posts = await res.json();
        
        if (!Array.isArray(posts)) throw new Error("Formato inválido.");

        window.allPosts = posts;
        if(typeof renderFeed === 'function') renderFeed(posts, 'profile-feed');

    } catch (e) { 
        console.error(e);
        document.getElementById('profile-feed').innerHTML = '<div class="text-center text-slate-400 py-10">Não foi possível carregar as curtidas.</div>';
    }
}

// --- UPLOAD & EDIÇÃO ---

async function togglePrivacy() {
    const isPublic = document.getElementById('toggle-privacy').checked;
    profileUser.likes_public = isPublic ? 1 : 0;
    
    try {
        const payload = {
            bio: profileUser.bio,
            avatar: profileUser.avatar,
            social_links: typeof profileUser.social_links === 'string' ? JSON.parse(profileUser.social_links) : profileUser.social_links,
            likes_public: isPublic
        };
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_PERFIL}/user/profile`, {
            method: 'PUT',
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if(typeof notify === 'function') notify(isPublic ? "Curtidas agora são PÚBLICAS" : "Curtidas agora são PRIVADAS");
    } catch(e) { 
        document.getElementById('toggle-privacy').checked = !isPublic; 
    }
}

async function uploadAvatar(input) {
    const originalFile = input.files[0];
    if (!originalFile) return;

    const btn = document.getElementById('btn-edit-avatar');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        let fileToSend = originalFile;
        // Compressão
        if (typeof compressImage === 'function' && originalFile.size > 1024 * 1024) {
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
            
            if(loggedUser) {
                loggedUser.avatar = data.secure_url;
                localStorage.setItem('user', JSON.stringify(loggedUser));
            }
            
            await saveProfile(true); 
            if(typeof notify === 'function') notify("Foto atualizada!");
        } else {
            alert("Erro Cloudinary: " + (data.error?.message || "Desconhecido"));
        }
    } catch (e) { alert("Erro de envio."); } 
    finally { btn.innerHTML = '<i class="fa-solid fa-camera"></i>'; input.value = ""; }
}

function openEditProfile() { document.getElementById('edit-modal').classList.remove('hidden'); document.getElementById('edit-bio').value = profileUser.bio || ""; }
function closeEditProfile() { document.getElementById('edit-modal').classList.add('hidden'); }
async function saveProfile(silent = false) {
    const bio = document.getElementById('edit-bio').value;
    const payload = {
        bio: bio,
        avatar: profileUser.avatar,
        social_links: profileUser.social_links,
        likes_public: profileUser.likes_public
    };
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE_PERFIL}/user/profile`, { method: 'PUT', headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}, body: JSON.stringify(payload) });
    if(!silent) { closeEditProfile(); loadProfileData(); }
}

// Funções auxiliares para adicionar inputs de redes sociais
function addSocialInput(name = "Instagram", url = "") {
    const div = document.createElement('div');
    div.className = "flex gap-2 items-center social-row";
    div.innerHTML = `
        <select class="s-name w-1/3 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs">
            <option value="Instagram" ${name==='Instagram'?'selected':''}>Instagram</option>
            <option value="YouTube" ${name==='YouTube'?'selected':''}>YouTube</option>
            <option value="TikTok" ${name==='TikTok'?'selected':''}>TikTok</option>
            <option value="Site" ${name==='Site'?'selected':''}>Site</option>
        </select>
        <input type="text" class="s-url flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-xs" placeholder="Cole o link..." value="${url}">
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
    `;
    document.getElementById('social-list').appendChild(div);
}

document.getElementById('edit-bio').addEventListener('input', function() {
    document.getElementById('bio-counter').innerText = `${this.value.length}/255`;
});