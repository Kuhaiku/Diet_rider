// --- CONFIGURAÇÃO ---
const IS_DEV_PERFIL = window.location.port === "8080" || window.location.port === "5500";
const API_BASE_PERFIL = IS_DEV_PERFIL ? `http://${window.location.hostname}:3000/api` : "/api";

// CLOUDINARY (Substitua pelo seu Cloud Name e Preset Unsigned)
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhu8un8ty/image/upload";
const CLOUDINARY_PRESET = "diet_userperfil"; 

let profileUser = {}; 
const loggedUser = JSON.parse(localStorage.getItem('user')) || null;
const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('id') || (loggedUser ? loggedUser.id : null);
const deepLinkPostId = urlParams.get('post'); 

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    // Injeta o modal de preview, pois vamos precisar dele para os posts
    if(typeof injectPreviewModal === 'function') injectPreviewModal();

    if (!targetId) {
        alert("Perfil não encontrado.");
        window.location.href = 'community.html';
        return;
    }

    setupAuthUI();
    await loadProfileData();
    await loadProfilePosts();
    
    if(deepLinkPostId) {
        setTimeout(() => {
            const el = document.getElementById(`post-${deepLinkPostId}`);
            if(el) {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
                // Chama função do community.js
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

        document.getElementById('profile-name').innerText = profileUser.name;
        document.getElementById('profile-bio').innerText = profileUser.bio || "Sem biografia.";
        
        const avatarEl = document.getElementById('profile-avatar');
        if (profileUser.avatar) avatarEl.src = profileUser.avatar;
        else avatarEl.src = `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`;

        const linksContainer = document.getElementById('profile-links');
        linksContainer.innerHTML = "";
        const links = typeof profileUser.social_links === 'string' ? JSON.parse(profileUser.social_links) : (profileUser.social_links || []);
        
        links.forEach(l => {
            let icon = 'fa-link';
            if(l.name === 'Instagram') icon = 'fa-instagram';
            if(l.name === 'YouTube') icon = 'fa-youtube';
            if(l.name === 'TikTok') icon = 'fa-tiktok';
            
            linksContainer.innerHTML += `
                <a href="${l.url}" target="_blank" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold flex items-center gap-2 transition-colors border border-slate-200">
                    <i class="fa-brands ${icon}"></i> ${l.name}
                </a>`;
        });

        if (loggedUser && loggedUser.id == targetId) {
            document.getElementById('btn-edit-profile').classList.remove('hidden');
            document.getElementById('btn-edit-avatar').classList.remove('hidden');
        }

    } catch (e) {
        console.error(e);
        document.getElementById('profile-name').innerText = "Erro ao carregar";
    }
}

async function loadProfilePosts() {
    try {
        const res = await fetch(`${API_BASE_PERFIL}/public/user/${targetId}/posts`);
        const posts = await res.json();
        
        // Seta globalmente para os modais funcionarem
        window.allPosts = posts; 

        // !!! CORREÇÃO AQUI !!! 
        // Passamos 'profile-feed' como o ID do container
        if(typeof renderFeed === 'function') {
            renderFeed(posts, 'profile-feed');
        } else {
            console.error("renderFeed não encontrado. Verifique se community.js foi carregado.");
        }

    } catch (e) {
        console.error(e);
    }
}

function openEditProfile() {
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-bio').value = profileUser.bio || "";
    document.getElementById('bio-counter').innerText = `${(profileUser.bio||"").length}/255`;
    
    const socialList = document.getElementById('social-list');
    socialList.innerHTML = "";
    const links = typeof profileUser.social_links === 'string' ? JSON.parse(profileUser.social_links) : (profileUser.social_links || []);
    links.forEach(l => addSocialInput(l.name, l.url));
}

function closeEditProfile() {
    document.getElementById('edit-modal').classList.add('hidden');
}

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

async function uploadAvatar(input) {
    const originalFile = input.files[0];
    if (!originalFile) return;

    // Feedback visual
    const btn = document.getElementById('btn-edit-avatar');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; // Loading...

    try {
        let fileToSend = originalFile;

        // SE o arquivo for maior que 1MB (1048576 bytes), comprime!
        if (originalFile.size > 1048576) {
            notify("Otimizando imagem...", "info"); // Avisa o user (opcional)
            fileToSend = await compressImage(originalFile); 
        }

        const formData = new FormData();
        formData.append("file", fileToSend);
        formData.append("upload_preset", CLOUDINARY_PRESET); 

        // Envia para o Cloudinary
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();
        
        if (data.secure_url) {
            document.getElementById("profile-avatar").src = data.secure_url;
            profileUser.avatar = data.secure_url; 
            await saveProfile(true); 
            notify("Foto atualizada com sucesso!");
        } else {
            console.error(data);
            notify("Erro no upload. Tente outra foto.", "error");
        }
    } catch (e) {
        console.error(e);
        notify("Erro de conexão.", "error");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-camera"></i>'; // Restaura ícone
        input.value = ""; // Limpa o input para permitir selecionar a mesma foto se quiser
    }
}

async function saveProfile(silent = false) {
    const bio = document.getElementById('edit-bio').value;
    const rows = document.querySelectorAll('.social-row');
    const links = [];
    rows.forEach(r => {
        const name = r.querySelector('.s-name').value;
        const url = r.querySelector('.s-url').value;
        if(url) links.push({name, url});
    });

    const payload = {
        bio: bio,
        avatar: profileUser.avatar, 
        social_links: links
    };

    try {
        const token = localStorage.getItem('token'); 
        const res = await fetch(`${API_BASE_PERFIL}/user/profile`, {
            method: 'PUT',
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            if(!silent) {
                if(typeof notify === 'function') notify("Perfil atualizado!");
                else alert("Perfil atualizado!");
                closeEditProfile();
                loadProfileData(); 
            }
            if(payload.avatar) {
                loggedUser.avatar = payload.avatar;
                localStorage.setItem('user', JSON.stringify(loggedUser));
            }
        } else {
            alert("Erro ao salvar.");
        }
    } catch(e) { alert("Erro de conexão."); }
}