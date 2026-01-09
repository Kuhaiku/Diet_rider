// ============================================================
// ARQUIVO: js/profile-manager.js
// FUNÇÃO: Gerenciar Avatar, Bio e Links Sociais
// DEPENDE DE: js/config.js
// ============================================================

let userProfile = {}; 

async function loadUserProfile() {
    try {
        // Usa API_BASE e user definidos no config.js
        const res = await fetch(`${API_BASE}/public/user/${user.id}`);
        if(res.ok) {
            userProfile = await res.json();
            populateProfileUI();
        }
    } catch(e) { 
        console.error("Erro ao carregar perfil:", e); 
    }
}

function populateProfileUI() {
    // 1. Atualiza Foto
    if(userProfile.avatar) {
        const preview = document.getElementById("profile-preview");
        const sidebar = document.getElementById("sidebar-avatar");
        
        if(preview) preview.src = userProfile.avatar;
        if(sidebar) sidebar.src = userProfile.avatar;
        
        // Atualiza local storage para persistência rápida
        user.avatar = userProfile.avatar;
        localStorage.setItem("user", JSON.stringify(user));
    }
    
    // 2. Atualiza Bio
    const bioArea = document.getElementById("profile-bio");
    if(bioArea) {
        bioArea.value = userProfile.bio || "";
        const counter = document.getElementById("bio-counter");
        if(counter) counter.innerText = `${(userProfile.bio || "").length}/255`;
    }

    // 3. Atualiza Redes Sociais
    const container = document.getElementById("social-list");
    if(container) {
        container.innerHTML = "";
        const links = typeof userProfile.social_links === 'string' 
            ? JSON.parse(userProfile.social_links) 
            : (userProfile.social_links || []);
        
        links.forEach(link => addSocialInput(link.name, link.url));
    }
}

// Adiciona uma linha de rede social no DOM
function addSocialInput(name = "", url = "") {
    const container = document.getElementById("social-list");
    if(!container) return;

    const div = document.createElement("div");
    div.className = "flex gap-2 items-center social-row animate-fade-in mb-2";
    div.innerHTML = `
        <div class="w-1/3">
            <select class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm s-name focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="Instagram" ${name === 'Instagram' ? 'selected' : ''}>Instagram</option>
                <option value="TikTok" ${name === 'TikTok' ? 'selected' : ''}>TikTok</option>
                <option value="YouTube" ${name === 'YouTube' ? 'selected' : ''}>YouTube</option>
                <option value="Site" ${name === 'Site' ? 'selected' : ''}>Site / Blog</option>
                <option value="Outro" ${name === 'Outro' ? 'selected' : ''}>Outro</option>
            </select>
        </div>
        <div class="w-2/3">
            <input type="text" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm s-url focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cole o link aqui..." value="${url}">
        </div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500 p-2 transition-colors">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
}

// Upload para Cloudinary
async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;

    const status = document.getElementById("upload-status");
    if(status) status.classList.remove("hidden");
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    // formData.append("folder", "diet_app"); // Opcional: define pasta no Cloudinary

    try {
        if(CLOUDINARY_PRESET === "SEU_PRESET_UNSIGNED_AQUI") {
            throw new Error("Configure o Cloudinary no arquivo config.js!");
        }

        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();
        
        if (data.secure_url) {
            document.getElementById("profile-preview").src = data.secure_url;
            userProfile.avatar = data.secure_url; // Salva na memória temp
            notify("Foto enviada! Clique em 'Salvar Alterações' para confirmar.");
        } else {
            throw new Error(data.error?.message || "Erro desconhecido no upload");
        }
    } catch (e) {
        console.error(e);
        notify("Erro ao enviar imagem: " + e.message, "error");
    } finally {
        if(status) status.classList.add("hidden");
        input.value = ""; // Limpa input para permitir re-upload do mesmo arquivo
    }
}

// Salva tudo no Backend (MySQL)
async function saveProfile() {
    const bioInput = document.getElementById("profile-bio");
    const bio = bioInput ? bioInput.value : "";
    
    const socialRows = document.querySelectorAll(".social-row");
    const socialLinks = [];

    socialRows.forEach(row => {
        const name = row.querySelector(".s-name").value;
        const url = row.querySelector(".s-url").value;
        if(url) socialLinks.push({ name, url });
    });

    const payload = {
        avatar: userProfile.avatar,
        bio: bio,
        social_links: socialLinks
    };

    try {
        const res = await fetch(`${API_BASE}/user/profile`, {
            method: "PUT",
            headers, // Headers vem do config.js
            body: JSON.stringify(payload)
        });
        
        if(res.ok) {
            notify("Perfil atualizado com sucesso!");
            
            // Atualiza sidebar instantaneamente
            const sidebarAvatar = document.getElementById("sidebar-avatar");
            if(payload.avatar && sidebarAvatar) sidebarAvatar.src = payload.avatar;
            
            // Persiste no navegador
            user.avatar = payload.avatar;
            localStorage.setItem("user", JSON.stringify(user));
        } else {
            notify("Erro ao salvar perfil no servidor.", "error");
        }
    } catch(e) {
        notify("Erro de conexão.", "error");
    }
}