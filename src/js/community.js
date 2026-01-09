// --- CONFIGURAÇÃO ---
const IS_DEV = window.location.port === "5500" || window.location.hostname === "localhost";
const API_BASE = IS_DEV ? `http://${window.location.hostname}:3000/api` : "/api";
const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
};

const user = JSON.parse(localStorage.getItem("user")) || {};
if (!localStorage.getItem("token") && !IS_DEV) window.location.href = "login.html";

let myLibrary = [];
let myPresets = [];
let selectedAttachments = new Set();
let allPosts = []; // Armazena posts carregados para referência rápida

// --- INICIALIZAÇÃO ---
window.onload = async function () {
    injectPreviewModal(); // Cria o HTML do modal via JS
    await loadPosts();
    checkDeepLink(); // Verifica se tem link compartilhado
    fetchUserLibrary();
};

function toggleSidebar() {
    const sb = document.getElementById("sidebar");
    const ov = document.getElementById("mobile-overlay");
    if (sb.classList.contains("-translate-x-full")) {
        sb.classList.remove("-translate-x-full");
        ov.classList.remove("hidden");
    } else {
        sb.classList.add("-translate-x-full");
        ov.classList.add("hidden");
    }
}

// --- LÓGICA DE FEED ---

async function loadPosts() {
    try {
        const res = await fetch(`${API_BASE}/community/posts`, { headers });
        if (!res.ok) throw new Error("Erro ao carregar feed");
        
        const posts = await res.json();
        
        if (!Array.isArray(posts)) throw new Error("Formato inválido");
        
        allPosts = posts; // Salva em memória
        renderFeed(posts);
    } catch (e) {
        console.error(e);
        document.getElementById("community-feed").innerHTML = 
            `<div class="text-center py-10 text-red-400 font-bold">Erro ao carregar posts. Tente recarregar.</div>`;
    }
}

function renderFeed(posts) {
    const feed = document.getElementById("community-feed");
    feed.innerHTML = "";

    if (posts.length === 0) {
        feed.innerHTML = `<div class="text-center py-10 text-slate-400">Nenhuma postagem ainda. Seja o primeiro!</div>`;
        return;
    }

    posts.forEach((p) => {
        const isMyPost = p.user_id === user.id;
        const ytId = extractYoutubeId(p.youtube_link);
        const userVote = p.my_vote;

        // Detecta tipo de conteúdo para o rótulo
        let typeLabel = "Conteúdo";
        let typeIcon = "fa-box-open";
        
        if (p.content_json.planner || (p.content_json.data && p.content_json.data.planner)) {
            typeLabel = "Plano Mensal";
            typeIcon = "fa-calendar-days";
        } else if (Array.isArray(p.content_json)) {
            typeLabel = `Pacote (${p.content_json.length} Receitas)`;
            typeIcon = "fa-layer-group";
        } else {
            typeLabel = "Receita";
            typeIcon = "fa-utensils";
        }

        let html = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden fade-in relative group mb-6 scroll-mt-24" id="post-${p.id}">
            
            <div class="p-4 flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        ${p.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 leading-tight text-lg">${p.title}</h3>
                        <p class="text-xs text-slate-500">por <span class="font-bold text-indigo-600">${p.author_name}</span> • ${new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div class="relative">
                    ${isMyPost || user.is_owner
                        ? `<button onclick="deletePost(${p.id})" class="text-slate-300 hover:text-red-500 p-2 transition-colors" title="Excluir"><i class="fa-solid fa-trash"></i></button>`
                        : `<button onclick="openReportModal(${p.id})" class="text-slate-300 hover:text-red-500 p-2 transition-colors" title="Denunciar"><i class="fa-solid fa-flag"></i></button>`
                    }
                </div>
            </div>

            <div class="px-4 pb-4">
                <p class="text-sm text-slate-600 whitespace-pre-line leading-relaxed">${p.description}</p>
            </div>

            <div class="px-4 pb-4">
                <button onclick="openPostDetails(${p.id})" class="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center justify-between group/btn transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500 group-hover/btn:scale-110 transition-transform">
                            <i class="fa-solid ${typeIcon}"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-xs text-slate-400 font-bold uppercase">Anexo</p>
                            <p class="text-sm font-bold text-slate-700">${typeLabel}</p>
                        </div>
                    </div>
                    <div class="text-indigo-600 text-sm font-bold flex items-center gap-2">
                        Ver Detalhes <i class="fa-solid fa-arrow-right"></i>
                    </div>
                </button>
            </div>

            ${ytId ? `
            <div class="w-full aspect-video bg-black relative group/video cursor-pointer overflow-hidden" onclick="playVideo(this, '${ytId}')">
                <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-full h-full object-cover opacity-90 group-hover/video:opacity-80 transition-opacity">
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white shadow-xl group-hover/video:scale-110 transition-transform backdrop-blur-sm pointer-events-none">
                        <i class="fa-solid fa-play text-2xl ml-1"></i>
                    </div>
                </div>
            </div>` : ""}

            <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                
                <div class="flex items-center gap-2">
                    <button onclick="vote(${p.id}, 'like')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-green-100 text-slate-500 hover:text-green-600 transition-colors ${userVote === 'like' ? 'text-green-600 bg-green-50 font-bold ring-1 ring-green-200' : ''}">
                        <i class="fa-solid fa-thumbs-up"></i> <span id="likes-${p.id}" class="text-xs">${p.likes_count}</span>
                    </button>
                    
                    <button onclick="vote(${p.id}, 'dislike')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors ${userVote === 'dislike' ? 'text-red-600 bg-red-50 font-bold ring-1 ring-red-200' : ''}">
                        <i class="fa-solid fa-thumbs-down"></i>
                    </button>
                </div>

                <div class="flex gap-2">
                    <button onclick="sharePost(${p.id})" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors" title="Copiar Link">
                        <i class="fa-solid fa-link"></i>
                    </button>
                    
                    <button onclick='importContent(${JSON.stringify(p.content_json).replace(/'/g, "&#39;")})' class="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-full hover:bg-slate-900 shadow-md flex items-center gap-2 transition-transform active:scale-95">
                        <i class="fa-solid fa-download"></i> <span>Importar</span>
                    </button>
                </div>

            </div>
        </div>`;
        feed.innerHTML += html;
    });
}

// --- VISUALIZAÇÃO DE DETALHES (MODAL) ---

function openPostDetails(postId) {
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;

    const content = post.content_json;
    const container = document.getElementById("preview-body-content");
    const title = document.getElementById("preview-modal-title");

    title.innerText = post.title;
    container.innerHTML = ""; // Limpa anterior

    // 1. Verifica se é Plano
    if (content.planner || (content.data && content.data.planner)) {
        renderPlanPreview(content, container);
    }
    // 2. Verifica se é Pacote (Array)
    else if (Array.isArray(content)) {
        renderPackagePreview(content, container);
    }
    // 3. É Receita única
    else {
        renderRecipeCard(content, container);
    }

    document.getElementById("post-preview-modal").classList.remove("hidden");
}

function renderRecipeCard(recipe, container) {
    // Tratamento para garantir que steps seja array
    const steps = Array.isArray(recipe.steps) ? recipe.steps : 
                  (typeof recipe.steps === 'string' ? recipe.steps.split('\n') : []);
    
    const html = `
        <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-4">
            <div class="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
                <div class="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                    <i class="fa-solid ${recipe.icon || "fa-utensils"}"></i>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-lg">${recipe.name}</h4>
                    <span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-bold tracking-wide">${recipe.cat || "Geral"}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p class="text-xs font-bold text-slate-400 uppercase mb-2">Ingredientes</p>
                    <ul class="space-y-1">
                        ${(recipe.ingredients || []).map((i) => `
                            <li class="text-sm text-slate-600 flex items-center gap-2">
                                <i class="fa-solid fa-circle-check text-green-500 text-[10px]"></i>
                                <span>${i.q_daily || ""}${i.u || ""} <b>${i.n}</b></span>
                            </li>
                        `).join("")}
                    </ul>
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-400 uppercase mb-2">Preparo</p>
                    <div class="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        ${steps.length > 0 ? steps.map((s, idx) => `
                            <div class="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                <span class="font-bold text-indigo-500 mr-1">${idx + 1}.</span> ${s}
                            </div>
                        `).join("") : '<div class="text-sm text-slate-400 italic">Modo de preparo não informado.</div>'}
                    </div>
                </div>
            </div>
        </div>
    `;
    container.innerHTML += html;
}

function renderPackagePreview(list, container) {
    container.innerHTML = `<p class="text-center text-slate-500 mb-4 font-medium">Este pacote contém ${list.length} receitas:</p>`;
    list.forEach((r) => renderRecipeCard(r, container));
}

function renderPlanPreview(plan, container) {
    const pData = plan.data || plan;
    const planner = pData.planner || {};
    const themes = pData.themes || {};
    const lib = pData.library || [];

    // Cria abas simples para as semanas
    let html = `
        <div class="flex gap-2 mb-4 overflow-x-auto pb-2" id="preview-tabs">
            ${[1, 2, 3, 4].map((w) => `
                <button onclick="switchPreviewWeek(${w})" id="btn-week-${w}" class="flex-1 py-2 px-3 rounded-lg border text-sm font-bold whitespace-nowrap transition-colors ${w === 1 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}">
                    Semana ${w}
                </button>
            `).join("")}
        </div>
        <div id="week-content" class="min-h-[200px]"></div>
    `;
    container.innerHTML = html;

    container.dataset.planner = JSON.stringify(planner);
    container.dataset.themes = JSON.stringify(themes);
    container.dataset.lib = JSON.stringify(lib);

    renderWeekContent(1);
}

// Função global para trocar semana no modal
window.switchPreviewWeek = function (w) {
    [1, 2, 3, 4].forEach((i) => {
        const btn = document.getElementById(`btn-week-${i}`);
        if (btn) {
            if (i === w) {
                btn.className = "flex-1 py-2 px-3 rounded-lg border text-sm font-bold whitespace-nowrap bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105 transition-all";
            } else {
                btn.className = "flex-1 py-2 px-3 rounded-lg border text-sm font-bold whitespace-nowrap bg-white text-slate-500 border-slate-200 hover:bg-slate-50 transition-colors";
            }
        }
    });
    renderWeekContent(w);
};

// === CORREÇÃO: Função auxiliar para alternar detalhes da receita no plano ===
window.togglePlanRecipe = function(uniqueId) {
    const el = document.getElementById(uniqueId);
    const btn = document.getElementById('btn-' + uniqueId);
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        el.classList.add('fade-in'); // Adicione classe de animação se quiser
        btn.innerHTML = 'Ocultar <i class="fa-solid fa-chevron-up"></i>';
    } else {
        el.classList.add('hidden');
        btn.innerHTML = 'Ver <i class="fa-solid fa-chevron-down"></i>';
    }
}

function renderWeekContent(w) {
    const container = document.getElementById("preview-body-content");
    const target = document.getElementById("week-content");
    if (!container || !target) return;

    const planner = JSON.parse(container.dataset.planner);
    const themes = JSON.parse(container.dataset.themes);
    const lib = JSON.parse(container.dataset.lib);

    const theme = themes[w] || "Sem tema definido";
    const weekData = planner[w] || {};

    const cats = {
        cafe: { label: "Café", color: "amber", icon: "fa-mug-hot" },
        almoco: { label: "Almoço", color: "orange", icon: "fa-utensils" },
        lanche: { label: "Lanche", color: "pink", icon: "fa-apple-whole" },
        jantar: { label: "Jantar", color: "indigo", icon: "fa-moon" },
    };

    let html = `
        <div class="bg-slate-800 text-white p-3 rounded-lg mb-4 flex items-center gap-3 shadow-md">
            <i class="fa-solid fa-calendar-week text-white/50 text-xl"></i>
            <div>
                <p class="text-[10px] uppercase font-bold text-white/60">Tema</p>
                <p class="font-bold text-sm">${theme}</p>
            </div>
        </div>
        <div class="grid grid-cols-1 gap-3">
    `;

    Object.keys(cats).forEach((key) => {
        const conf = cats[key];
        const recId = weekData[key];
        const rec = lib.find((r) => r.id === recId);

        if (rec) {
            // Gera um ID único para o toggle
            const uniqueId = `rec-details-${w}-${key}-${Math.random().toString(36).substr(2, 5)}`;
            
            // Prepara os steps (pode vir como array ou string)
            let stepsList = [];
            if(Array.isArray(rec.steps)) stepsList = rec.steps;
            else if(typeof rec.steps === 'string') stepsList = rec.steps.split('\n');

            html += `
                <div class="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-${conf.color}-100 text-${conf.color}-600 flex items-center justify-center shrink-0">
                            <i class="fa-solid ${rec.icon || conf.icon}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">${conf.label}</p>
                            <p class="text-sm font-bold text-slate-800 truncate">${rec.name}</p>
                        </div>
                        <button id="btn-${uniqueId}" class="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1" onclick="togglePlanRecipe('${uniqueId}')">
                            Ver <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </div>

                    <div id="${uniqueId}" class="hidden mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 rounded p-2">
                        <div class="mb-2">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Ingredientes</p>
                            <ul class="text-xs text-slate-600 space-y-1">
                                ${(rec.ingredients || []).map(i => `<li>• ${i.q_daily||''} ${i.u||''} ${i.n}</li>`).join('')}
                            </ul>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Modo de Preparo</p>
                            <div class="text-xs text-slate-600 space-y-1">
                                ${stepsList.length > 0 ? stepsList.map((s, idx) => `<div><span class="font-bold text-indigo-400">${idx+1}.</span> ${s}</div>`).join('') : 'Não informado.'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="flex items-center bg-slate-50 border border-slate-100 p-3 rounded-lg gap-3 opacity-60">
                    <div class="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                        <i class="fa-solid ${conf.icon}"></i>
                    </div>
                     <div>
                        <p class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">${conf.label}</p>
                        <p class="text-sm font-medium text-slate-400 italic">Livre</p>
                    </div>
                </div>
            `;
        }
    });

    html += `</div>`;
    target.innerHTML = html;
}

// --- LINK & SHARE ---

function sharePost(id) {
    const url = `${window.location.origin}${window.location.pathname}?post_id=${id}`;

    // Tenta usar a API de compartilhamento nativa (Mobile)
    if (navigator.share) {
        navigator.share({
            title: "Diet & Ride - Comunidade",
            text: "Dá uma olhada nesse conteúdo incrível!",
            url: url,
        }).catch(() => fallbackCopy(url));
    } else {
        fallbackCopy(url); // Usa fallback se não for mobile/nativo
    }
}

// === CORREÇÃO: Fallback Robusto para Clipboard ===
function fallbackCopy(text) {
    // Tenta API moderna primeiro
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => notify("Link copiado!"))
            .catch(() => oldSchoolCopy(text));
    } else {
        oldSchoolCopy(text);
    }
}

function oldSchoolCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; // Evita scroll
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) notify("Link copiado!");
        else notify("Não foi possível copiar.", "error");
    } catch (err) {
        notify("Erro ao copiar.", "error");
    }
    document.body.removeChild(textArea);
}

function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("post_id");

    if (postId) {
        const checkExist = setInterval(() => {
            const el = document.getElementById(`post-${postId}`);
            if (el) {
                clearInterval(checkExist);
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-4", "ring-indigo-400", "shadow-2xl", "scale-[1.01]", "transition-all", "duration-500");
                setTimeout(() => {
                    el.classList.remove("ring-4", "ring-indigo-400", "shadow-2xl", "scale-[1.01]");
                }, 3000);
            }
        }, 500);
        setTimeout(() => clearInterval(checkExist), 10000);
    }
}

// --- UTILS & BOILERPLATE ---

function injectPreviewModal() {
    if (document.getElementById("post-preview-modal")) return;

    const modalHtml = `
    <div id="post-preview-modal" class="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm hidden flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 id="preview-modal-title" class="font-bold text-lg text-slate-800 truncate pr-4">Detalhes</h3>
                <button onclick="document.getElementById('post-preview-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            
            <div id="preview-body-content" class="p-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
            </div>

            <div class="p-4 border-t border-slate-100 bg-white flex justify-end">
                <button onclick="document.getElementById('post-preview-modal').classList.add('hidden')" class="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg transition-colors shadow-lg">
                    Fechar
                </button>
            </div>
        </div>
    </div>
    <style>
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    </style>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
}

async function createPost() {
    const title = document.getElementById("post-title").value.trim();
    const desc = document.getElementById("post-desc").value.trim();
    const yt = document.getElementById("post-yt").value.trim();
    const jsonStr = document.getElementById("post-json-content").value;

    if (!title) return notify("Dê um título para o post.", "error");
    if (!jsonStr) return notify("Você precisa anexar uma receita ou plano!", "error");

    const content_json = JSON.parse(jsonStr);

    try {
        const res = await fetch(`${API_BASE}/community/post`, {
            method: "POST",
            headers,
            body: JSON.stringify({ title, description: desc, youtube_link: yt, content_json }),
        });
        const data = await res.json();

        if (res.ok) {
            notify("Publicado com sucesso!");
            document.getElementById("post-title").value = "";
            document.getElementById("post-desc").value = "";
            document.getElementById("post-yt").value = "";
            document.getElementById("post-json-content").value = "";
            document.getElementById("attach-label").innerText = "Anexar";
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
            method: "POST",
            headers,
            body: JSON.stringify({ post_id: postId, vote_type: type }),
        });
        if (res.ok) {
            loadPosts();
        }
    } catch (e) {
        console.error(e);
    }
}

// === CORREÇÃO: Tratamento de Erro 404 no Delete ===
async function deletePost(id) {
    if (!confirm("Tem certeza?")) return;
    try {
        const res = await fetch(`${API_BASE}/community/post/${id}`, {
            method: "DELETE",
            headers,
        });
        
        // Se sucesso ou se já não existe (404), remove da tela
        if (res.ok || res.status === 404) {
            notify("Post excluído.");
            const el = document.getElementById(`post-${id}`);
            if (el) el.remove();
        } else {
            notify("Erro ao excluir.", "error");
        }
    } catch (e) {
        notify("Erro de conexão.", "error");
    }
}

async function importContent(content) {
    if (!confirm("Importar para sua biblioteca?")) return;
    const isPlan = content.planner || (content.data && content.data.planner);
    try {
        if (isPlan) {
            const newPlan = {
                ...content,
                id: "plan_imp_" + Date.now(),
                name: (content.name || "Imp") + " (Comunidade)",
            };
            await fetch(`${API_BASE}/presets`, {
                method: "POST",
                headers,
                body: JSON.stringify(newPlan),
            });
            notify("Plano importado!");
        } else {
            const list = Array.isArray(content) ? content : [content];
            for (let r of list) {
                const newRecipe = {
                    ...r,
                    id: "rec_imp_" + Date.now() + Math.random().toString(36).substr(2, 5),
                };
                await fetch(`${API_BASE}/library`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(newRecipe),
                });
            }
            notify("Receitas importadas!");
        }
    } catch (e) {
        notify("Erro ao importar.", "error");
    }
}

// === CORREÇÃO: Tratamento de Erro na Busca de Dados Pessoais (evita forEach error) ===
function fetchUserLibrary() {
    fetch(`${API_BASE}/library`, { headers })
        .then((r) => {
            if(!r.ok) throw new Error("Erro na Library");
            return r.json();
        })
        .then((d) => (myLibrary = Array.isArray(d) ? d : []))
        .catch(err => {
            console.error("Falha ao carregar library", err);
            myLibrary = [];
        });

    fetch(`${API_BASE}/presets`, { headers })
        .then((r) => {
            if(!r.ok) throw new Error("Erro nos Presets");
            return r.json();
        })
        .then((d) => (myPresets = Array.isArray(d) ? d : []))
        .catch(err => {
            console.error("Falha ao carregar presets", err);
            myPresets = [];
        });
}

function openAttachModal() {
    document.getElementById("attach-modal").classList.remove("hidden");
    selectedAttachments.clear();
    loadAttachList("recipe");
}
function closeAttachModal() {
    document.getElementById("attach-modal").classList.add("hidden");
}

// === AQUI ONDE OCORRIA O ERRO FOREACH, AGORA BLINDADO ===
function loadAttachList(type) {
    const list = document.getElementById("attach-list");
    const btnRec = document.getElementById("tab-recipe");
    const btnPlan = document.getElementById("tab-plan");
    list.innerHTML = "";

    // Garante que são arrays antes de tentar iterar
    if(!Array.isArray(myLibrary)) myLibrary = [];
    if(!Array.isArray(myPresets)) myPresets = [];

    if (type === "recipe") {
        btnRec.className = "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700";
        btnPlan.className = "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500";
        
        if(myLibrary.length === 0) {
            list.innerHTML = '<div class="p-4 text-center text-sm text-slate-400">Nenhuma receita encontrada.</div>';
        }

        myLibrary.forEach((r) => {
            const el = document.createElement("div");
            const chkId = `chk-${r.id}`;
            el.className = "p-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer flex items-center gap-3 select-none";
            el.innerHTML = `<input type="checkbox" id="${chkId}" class="w-4 h-4 text-indigo-600 rounded" onclick="event.stopPropagation(); toggleSelection('${r.id}')"><label for="${chkId}" class="flex-1 cursor-pointer font-medium text-sm text-slate-700">${r.name}</label>`;
            el.onclick = () => {
                document.getElementById(chkId).click();
            };
            list.appendChild(el);
        });
        
        if(myLibrary.length > 0) {
            const btn = document.createElement("button");
            btn.className = "w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow";
            btn.innerText = "Confirmar Pacote";
            btn.onclick = confirmRecipePackage;
            list.appendChild(btn);
        }

    } else {
        btnPlan.className = "flex-1 py-2 text-xs font-bold rounded bg-indigo-100 text-indigo-700";
        btnRec.className = "flex-1 py-2 text-xs font-bold rounded hover:bg-slate-100 text-slate-500";
        
        if(myPresets.length === 0) {
            list.innerHTML = '<div class="p-4 text-center text-sm text-slate-400">Nenhum plano encontrado.</div>';
        }

        myPresets.forEach((p) => {
            const el = document.createElement("div");
            el.className = "p-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer flex items-center gap-3";
            el.innerHTML = `<i class="fa-solid fa-calendar-days text-slate-400"></i><span class="text-sm font-medium text-slate-700">${p.name}</span>`;
            el.onclick = () => selectAttachment(p, "Plano: " + p.name);
            list.appendChild(el);
        });
    }
}

function toggleSelection(id) {
    if (selectedAttachments.has(id)) selectedAttachments.delete(id);
    else selectedAttachments.add(id);
}
function confirmRecipePackage() {
    if (selectedAttachments.size === 0) return;
    const packageList = myLibrary.filter((r) => selectedAttachments.has(r.id));
    const content = packageList.length === 1 ? packageList[0] : packageList;
    const label = packageList.length === 1 ? `Receita: ${packageList[0].name}` : `Pacote: ${packageList.length} Receitas`;
    selectAttachment(content, label);
}
function selectAttachment(obj, label) {
    document.getElementById("post-json-content").value = JSON.stringify(obj);
    document.getElementById("attach-label").innerText = label;
    closeAttachModal();
}
function openReportModal(id) {
    document.getElementById("report-post-id").value = id;
    document.getElementById("report-modal").classList.remove("hidden");
}
function closeReportModal() {
    document.getElementById("report-modal").classList.add("hidden");
}
async function submitReport() {
    notify("Denúncia enviada.");
    closeReportModal();
}
function notify(text, type = "success") {
    // Verifica se Toastify existe (dependência externa)
    if (typeof Toastify === 'function') {
        Toastify({
            text: text,
            duration: 3000,
            gravity: "top",
            position: "center",
            style: {
                background: type === "error" ? "#ef4444" : "#22c55e",
                borderRadius: "8px",
            },
        }).showToast();
    } else {
        alert(text);
    }
}
function extractYoutubeId(url) {
    if (!url) return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
}
function playVideo(container, videoId) {
    container.onclick = null;
    container.innerHTML = `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
}