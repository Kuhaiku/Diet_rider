// --- CONFIGURAÇÃO ---
const IS_DEV_PERFIL = window.location.port === "8080" || window.location.port === "5500";
const API_BASE_PERFIL = IS_DEV_PERFIL ? `http://${window.location.hostname}:3000/api` : "/api";

// !!! CONFIGURAÇÃO CLOUDINARY !!!
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/SEU_CLOUD_NAME_AQUI/image/upload";
const CLOUDINARY_PRESET = "diet_userperfil"; // Seu preset Unsigned

let profileUser = {}; 
const loggedUser = JSON.parse(localStorage.getItem('user')) || null;
const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('id') || (loggedUser ? loggedUser.id : null);
const deepLinkPostId = urlParams.get('post'); 

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    if(typeof injectPreviewModal === 'function') injectPreviewModal();

    if (!targetId) {
        alert("Perfil não encontrado.");
        window.location.href = 'community.html';
        return;
    }

    setupAuthUI();
    await loadProfileData();
    switchTab('posts'); // Carrega posts por padrão
    
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

function setupAuthUI() {
    const container = document.getElementById('auth-actions');
    if (loggedUser) {
        container.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-500 hidden md:inline">Olá, ${loggedUser.name}</span>
                <img src="${loggedUser.avatar || 'https://ui-avatars.com/api/?name='+loggedUser.name}" class="w-8 h-8 rounded-full border border-slate-200">
            </div>`;
    } else {
        container.innerHTML = `<a href="login.html" class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700">Entrar</a>`;
    }
}

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
            linksContainer.innerHTML += `<a href="${l.url}" target="_blank" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200"><i class="fa-brands ${icon}"></i> ${l.name}</a>`;
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
        document.getElementById('profile-name').innerText = "Erro ao carregar";
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
    } catch (e) { console.error(e); document.getElementById('profile-feed').innerHTML = '<div class="text-center text-red-400 py-10">Erro ao carregar.</div>'; }
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
                    <p class="text-slate-500 font-bold">Curtidas Privadas</p>
                </div>`;
            return;
        }

        if(!res.ok) throw new Error("Erro na API");

        const posts = await res.json();
        
        if (!Array.isArray(posts)) {
            // Se não for array, pode ser erro {msg: "..."}
            throw new Error("Formato inválido de resposta.");
        }

        window.allPosts = posts;
        if(typeof renderFeed === 'function') renderFeed(posts, 'profile-feed');
        else document.getElementById('profile-feed').innerHTML = "Erro: Community script não carregado.";

    } catch (e) { 
        console.error(e);
        document.getElementById('profile-feed').innerHTML = '<div class="text-center text-red-400 py-10">Não foi possível carregar as curtidas.</div>';
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
            
            loggedUser.avatar = data.secure_url;
            localStorage.setItem('user', JSON.stringify(loggedUser));
            
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
    // Pega links do DOM se necessário, aqui simplificado
    const payload = {
        bio: bio,
        avatar: profileUser.avatar,
        social_links: profileUser.social_links,
        likes_public: profileUser.likes_public
    };
    // Reutiliza logica de put
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE_PERFIL}/user/profile`, { method: 'PUT', headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}, body: JSON.stringify(payload) });
    if(!silent) { closeEditProfile(); loadProfileData(); }
}