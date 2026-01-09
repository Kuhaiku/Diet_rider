// --- CONFIGURAÇÃO ---
const IS_DEV = window.location.port === "8080" || window.location.port === "5500"; 
const API_BASE = "http://localhost:3000/api"; 
const AUTH_URL = "http://localhost:3000/auth";

const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
};

const user = JSON.parse(localStorage.getItem('user')) || {};
let myLibrary = [];
let myPresets = [];

// --- INICIALIZAÇÃO ---
window.onload = async function() {
    await loadPosts();
    checkDeepLink();
    fetchUserLibrary(); 
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('mobile-overlay');
    if (sb.classList.contains('-translate-x-full')) {
        sb.classList.remove('-translate-x-full');
        ov.classList.remove('hidden');
    } else {
        sb.classList.add('-translate-x-full');
        ov.classList.add('hidden');
    }
}

// --- LÓGICA DE FEED ---

async function loadPosts() {
    try {
        const res = await fetch(`${API_BASE}/community/posts`, { headers });
        if (!res.ok) throw new Error("Erro ao carregar feed");
        const posts = await res.json();
        renderFeed(posts);
    } catch (e) {
        console.error(e);
        document.getElementById('community-feed').innerHTML = 
            `<div class="text-center py-10 text-red-400 font-bold">Erro ao carregar posts.</div>`;
    }
}

function renderFeed(posts) {
    const feed = document.getElementById('community-feed');
    feed.innerHTML = "";

    if (posts.length === 0) {
        feed.innerHTML = `<div class="text-center py-10 text-slate-400">Nenhuma postagem ainda. Seja o primeiro!</div>`;
        return;
    }

    posts.forEach(p => {
        const isMyPost = p.user_id === user.id;
        const ytId = extractYoutubeId(p.youtube_link);
        const userVote = p.my_vote;

        let html = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden fade-in relative group" id="post-${p.id}">
            
            <div class="p-4 flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                        ${p.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 leading-tight">${p.title}</h3>
                        <p class="text-xs text-slate-500">por ${p.author_name} • ${new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div class="relative">
                    ${isMyPost || user.is_owner ? 
                        `<button onclick="deletePost(${p.id})" class="text-slate-300 hover:text-red-500 p-2" title="Excluir"><i class="fa-solid fa-trash"></i></button>` 
                        : `<button onclick="openReportModal(${p.id})" class="text-slate-300 hover:text-red-500 p-2" title="Denunciar"><i class="fa-solid fa-flag"></i></button>`
                    }
                </div>
            </div>

            <div class="px-4 pb-2">
                <p class="text-sm text-slate-600 whitespace-pre-line">${p.description}</p>
            </div>

            ${ytId ? `
            <div class="w-full aspect-video bg-black relative group/video cursor-pointer overflow-hidden mt-2" onclick="playVideo(this, '${ytId}')">
                <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-full h-full object-cover opacity-90 group-hover/video:opacity-80 transition-opacity">
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white shadow-xl group-hover/video:scale-110 transition-transform backdrop-blur-sm pointer-events-none">
                        <i class="fa-solid fa-play text-2xl ml-1"></i>
                    </div>
                </div>
                <div class="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider pointer-events-none">
                    Toque para assistir
                </div>
            </div>` : ''}

            <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                
                <div class="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                    <button onclick="vote(${p.id}, 'like')" class="px-3 py-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors ${userVote === 'like' ? 'text-green-600 bg-green-50 font-bold' : ''} like-anim">
                        <i class="fa-solid fa-thumbs-up"></i> <span id="likes-${p.id}">${p.likes_count}</span>
                    </button>
                    <div class="w-px h-4 bg-slate-200"></div>
                    <button onclick="vote(${p.id}, 'dislike')" class="px-3 py-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors ${userVote === 'dislike' ? 'text-red-600 bg-red-50 font-bold' : ''} like-anim">
                        <i class="fa-solid fa-thumbs-down"></i>
                    </button>
                </div>

                <div class="flex gap-2">
                    <button onclick="sharePost(${p.id})" class="px-3 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100">
                        <i class="fa-solid fa-share-nodes mr-1"></i>
                    </button>
                    
                    <button onclick='importContent(${JSON.stringify(p.content_json).replace(/'/g, "&#39;")})' class="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 shadow-md flex items-center gap-2">
                        <i class="fa-solid fa-download"></i> <span class="hidden md:inline">Importar</span>
                    </button>
                </div>

            </div>
        </div>`;
        feed.innerHTML += html;
    });
}

// --- AÇÕES DO USUÁRIO ---

async function createPost() {
    const title = document.getElementById('post-title').value.trim();
    const desc = document.getElementById('post-desc').value.trim();
    const yt = document.getElementById('post-yt').value.trim();
    const jsonStr = document.getElementById('post-json-content').value;

    if (!title) return notify("Dê um título para o post.", "error");
    if (!jsonStr) return notify("Você precisa anexar uma receita ou plano!", "error");

    const content_json = JSON.parse(jsonStr);

    try {
        const res = await fetch(`${API_BASE}/community/post`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                title,
                description: desc,
                youtube_link: yt,
                content_json
            })
        });
        const data = await res.json();

        if (res.ok) {
            notify("Publicado com sucesso!");
            document.getElementById('post-title').value = "";
            document.getElementById('post-desc').value = "";
            document.getElementById('post-yt').value = "";
            document.getElementById('post-json-content').value = "";
            document.getElementById('attach-label').innerText = "Anexar";
            document.getElementById('btn-attach').className = "flex-1 px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 border border-slate-200 flex items-center justify-center gap-2 whitespace-nowrap transition-colors";
            
            loadPosts(); 
        } else {
            notify(data.msg || "Erro ao postar.", "error");
        }
    } catch (e) {
        notify("Erro de conexão.", "error");
    }
}

async function vote(postId, type) {
    try {
        const res = await fetch(`${API_BASE}/community/vote`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ post_id: postId, vote_type: type })
        });
        if (res.ok) {
            loadPosts(); 
        }
    } catch (e) { console.error(e); }
}

async function deletePost(id) {
    if (!confirm("Tem certeza que deseja excluir este post?")) return;
    try {
        const res = await fetch(`${API_BASE}/community/post/${id}`, { method: 'DELETE', headers });
        if (res.ok) {
            notify("Post excluído.");
            document.getElementById(`post-${id}`).remove();
        } else {
            notify("Erro ao excluir.", "error");
        }
    } catch (e) { notify("Erro de conexão.", "error"); }
}

async function importContent(content) {
    if (!confirm("Deseja importar este conteúdo para sua biblioteca pessoal?")) return;
    const isPlan = content.data && content.planner;
    try {
        if (isPlan) {
            const newPlan = { ...content, id: "plan_imp_" + Date.now(), name: content.name + " (Comunidade)" };
            await fetch(`${API_BASE}/presets`, { method: 'POST', headers, body: JSON.stringify(newPlan) });
            notify("Plano importado! Vá em 'Configurações > Meus Planos' para usar.");
        } else {
            const list = Array.isArray(content) ? content : [content];
            let count = 0;
            for (let r of list) {
                const newRecipe = { ...r, id: "rec_imp_" + Date.now() + Math.random() };
                await fetch(`${API_BASE}/library`, { method: 'POST', headers, body: JSON.stringify(newRecipe) });
                count++;
            }
            notify(`${count} receita(s) importada(s)!`);
        }
    } catch (e) { notify("Erro ao importar.", "error"); }
}

function sharePost(id) {
    const url = `${window.location.origin}/community.html?post_id=${id}`;
    const text = `Veja essa postagem incrível no Diet & Ride!`;
    if (navigator.share) {
        navigator.share({ title: 'Diet & Ride', text: text, url: url }).catch(() => copyToClip(url));
    } else {
        copyToClip(url);
    }
}

function copyToClip(text) {
    navigator.clipboard.writeText(text).then(() => notify("Link copiado!"));
}

async function fetchUserLibrary() {
    try {
        const [resLib, resPresets] = await Promise.all([
            fetch(`${API_BASE}/library`, { headers }),
            fetch(`${API_BASE}/presets`, { headers })
        ]);
        if (resLib.ok) myLibrary = await resLib.json();
        if (resPresets.ok) myPresets = await resPresets.json();
    } catch(e) { console.error(e); }
}

function openAttachModal() {
    document.getElementById('attach-modal').classList.remove('hidden');
    loadAttachList('recipe');
}
function closeAttachModal() {
    document.getElementById('attach-modal').classList.add('hidden');
}

function loadAttachList(type) {
    const list = document.getElementById('attach-list');
    const btnRec = document.getElementById('tab-recipe');
    const btnPlan = document.getElementById('tab-plan');
    list.innerHTML = "";

    if (type === 'recipe') {
        btnRec.className = "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700";
        btnPlan.className = "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500";
        myLibrary.forEach(r => {
            const el = document.createElement('div');
            el.className = "p-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer flex items-center gap-3";
            el.innerHTML = `<i class="fa-solid ${r.icon || 'fa-utensils'} text-slate-400"></i><span class="text-sm font-medium text-slate-700">${r.name}</span>`;
            el.onclick = () => selectAttachment(r, 'Receita: ' + r.name);
            list.appendChild(el);
        });
    } else {
        btnPlan.className = "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700";
        btnRec.className = "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500";
        myPresets.forEach(p => {
            const el = document.createElement('div');
            el.className = "p-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer flex items-center gap-3";
            el.innerHTML = `<i class="fa-solid fa-calendar-days text-slate-400"></i><span class="text-sm font-medium text-slate-700">${p.name}</span>`;
            el.onclick = () => selectAttachment(p, 'Plano: ' + p.name);
            list.appendChild(el);
        });
    }
}

function selectAttachment(obj, label) {
    document.getElementById('post-json-content').value = JSON.stringify(obj);
    document.getElementById('attach-label').innerText = label;
    document.getElementById('btn-attach').className = "flex-1 px-4 py-2 bg-green-50 text-green-700 border border-green-200 text-xs font-bold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition-colors";
    closeAttachModal();
}

function openReportModal(id) {
    document.getElementById('report-post-id').value = id;
    document.getElementById('report-modal').classList.remove('hidden');
}
function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
    document.getElementById('report-reason').value = "";
}
async function submitReport() {
    const id = document.getElementById('report-post-id').value;
    const reason = document.getElementById('report-reason').value;
    if(!reason) return notify("Descreva o motivo.", "error");
    try {
        await fetch(`${API_BASE}/community/report`, { method: 'POST', headers, body: JSON.stringify({ post_id: id, reason }) });
        notify("Denúncia enviada.");
        closeReportModal();
    } catch(e) { notify("Erro ao enviar.", "error"); }
}

function notify(text, type = "success") {
    Toastify({
        text: text, duration: 3000, gravity: "top", position: "center",
        style: { background: type === "error" ? "#ef4444" : "#22c55e", borderRadius: "8px" }
    }).showToast();
}

function extractYoutubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post_id');
    if (postId) {
        setTimeout(() => {
            const el = document.getElementById(`post-${postId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-indigo-300', 'transition-all', 'duration-1000');
                setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-300'), 3000);
            }
        }, 1500);
    }
}

// --- PLAYER OTIMIZADO (SEM BUGS) ---
function playVideo(container, videoId) {
    // 1. Remove qualquer evento de clique para evitar duplo disparo
    container.onclick = null;
    container.classList.remove('cursor-pointer', 'group/video');
    
    // 2. Substitui com parâmetros de autplay e interface limpa
    container.innerHTML = `
        <iframe class="w-full h-full" 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1" 
            title="YouTube video player" frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
        </iframe>`;
}