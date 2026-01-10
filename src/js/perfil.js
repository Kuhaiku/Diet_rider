//

const token = localStorage.getItem("token");
const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
};
const currentUser = JSON.parse(localStorage.getItem("user")) || {};

// Obtém o ID do perfil da URL (ex: perfil.html?id=123)
const urlParams = new URLSearchParams(window.location.search);
const profileId = urlParams.get("id") || currentUser.id;

// Globais
let profileUser = null;
let allPosts = []; // Necessário para o preview funcionar

window.onload = async function() {
    if (!token) return window.location.href = "login.html";
    
    // Injeta os modais necessários (Preview, Confirmação, Denúncia)
    injectPreviewModal(); 
    injectReportModal();

    await loadProfileHeader();
    loadProfilePosts();
};

// --- CARREGAMENTO DO PERFIL ---

async function loadProfileHeader() {
    try {
        const res = await fetch(`${API_BASE}/users/${profileId}`, { headers });
        if (!res.ok) throw new Error("Perfil não encontrado");
        
        profileUser = await res.json();
        
        // Preenche dados do topo
        document.getElementById("profile-name").innerText = profileUser.name;
        document.getElementById("profile-bio").innerText = profileUser.bio || "Sem biografia.";
        
        const avatarEl = document.getElementById("profile-avatar");
        if (profileUser.avatar) {
            avatarEl.src = profileUser.avatar;
        } else {
            avatarEl.src = `https://ui-avatars.com/api/?name=${profileUser.name}&background=random&size=128`;
        }

        // Botão Seguir/Editar
        const actionsDiv = document.getElementById("profile-actions");
        if (profileUser.id === currentUser.id) {
            actionsDiv.innerHTML = `<button onclick="window.location.href='config.html'" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors"><i class="fa-solid fa-gear"></i> Editar Perfil</button>`;
        } else {
            // Lógica de seguir poderia entrar aqui futuramente
            actionsDiv.innerHTML = `<button class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">Seguir</button>`;
        }

    } catch (e) {
        console.error(e);
        alert("Erro ao carregar perfil.");
        window.location.href = "community.html";
    }
}

async function loadProfilePosts() {
    const container = document.getElementById("profile-feed");
    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-indigo-500"></i></div>`;

    try {
        // Busca posts filtrados pelo usuário
        // Nota: O backend precisa suportar ?user_id=X na rota de posts ou usamos a busca
        // Se sua rota /api/community/posts suportar filtro, ótimo. 
        // Caso contrário, filtraremos no front (menos eficiente, mas funciona pra agora)
        const res = await fetch(`${API_BASE}/community/posts`, { headers });
        const posts = await res.json();
        
        // Filtra apenas os posts deste perfil
        allPosts = posts.filter(p => p.user_id == profileId);

        renderFeed(allPosts, "profile-feed");
    } catch (e) {
        container.innerHTML = `<div class="text-center py-10 text-red-400">Erro ao carregar posts.</div>`;
    }
}

// --- RENDERIZAÇÃO (Cópia adaptada do Community.js) ---

function renderFeed(posts, targetId) {
    const feed = document.getElementById(targetId);
    feed.innerHTML = "";

    if (posts.length === 0) {
        feed.innerHTML = `<div class="text-center py-10 text-slate-400 italic">Este usuário ainda não publicou nada.</div>`;
        return;
    }

    posts.forEach(p => {
        const isMyPost = p.user_id === currentUser.id;
        const ytId = extractYoutubeId(p.youtube_link);
        const userVote = p.my_vote; // Assumindo que a API retorna isso

        // Ícones de tipo
        let typeIcon = "fa-utensils";
        let typeLabel = "Receita";
        if (p.content_json.planner || (p.content_json.data && p.content_json.data.planner)) {
            typeIcon = "fa-calendar-days";
            typeLabel = "Plano Mensal";
        } else if (Array.isArray(p.content_json)) {
            typeIcon = "fa-layer-group";
            typeLabel = `Pacote (${p.content_json.length})`;
        }

        const likeClass = userVote === 'like' ? 'text-green-600 bg-green-50 font-bold ring-1 ring-green-200' : '';
        const dislikeClass = userVote === 'dislike' ? 'text-red-600 bg-red-50 font-bold ring-1 ring-red-200' : '';

        // HTML Comentários
        const commentsHtml = `
          <div id="comments-section-${p.id}" class="hidden border-t border-slate-100 bg-slate-50/50 p-4">
              <div id="comments-list-${p.id}" class="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                  <div class="text-center text-slate-400 text-xs py-2"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>
              </div>
              <div class="flex gap-2">
                  <input type="text" id="comment-input-${p.id}" placeholder="Escreva um comentário..." class="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" onkeydown="if(event.key === 'Enter') submitComment(${p.id})">
                  <button onclick="submitComment(${p.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition-colors"><i class="fa-solid fa-paper-plane"></i></button>
              </div>
          </div>
        `;

        const html = `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 relative group" id="post-${p.id}">
                <div class="p-4 flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 border border-slate-200">
                            ${p.author_name.charAt(0)}
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 leading-tight">${p.title}</h3>
                            <p class="text-[10px] text-slate-400">${new Date(p.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="relative">
                        ${(isMyPost || currentUser.is_owner) 
                            ? `<button onclick="deletePost(${p.id})" class="text-slate-300 hover:text-red-500 p-2"><i class="fa-solid fa-trash"></i></button>`
                            : `<button onclick="openReportModal(${p.id}, 'post')" class="text-slate-300 hover:text-red-500 p-2"><i class="fa-solid fa-flag"></i></button>`
                        }
                    </div>
                </div>
                
                <div class="px-4 pb-2">
                    <p class="text-sm text-slate-600 whitespace-pre-line">${p.description}</p>
                </div>

                <div class="px-4 pb-4">
                    <button onclick="openPostDetails(${p.id})" class="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center justify-between group/btn transition-all">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500 group-hover/btn:scale-110 transition-transform">
                                <i class="fa-solid ${typeIcon}"></i>
                            </div>
                            <div class="text-left">
                                <p class="text-xs text-slate-400 font-bold uppercase">Conteúdo</p>
                                <p class="text-sm font-bold text-slate-700">${typeLabel}</p>
                            </div>
                        </div>
                        <div class="text-indigo-600 text-sm font-bold flex items-center gap-2">
                            Ver <i class="fa-solid fa-arrow-right"></i>
                        </div>
                    </button>
                </div>

                ${ytId ? `<div class="w-full aspect-video bg-black relative group/video cursor-pointer overflow-hidden" onclick="playVideo(this, '${ytId}')"><img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-full h-full object-cover opacity-90 group-hover/video:opacity-80 transition-opacity"><div class="absolute inset-0 flex items-center justify-center"><div class="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white shadow-xl"><i class="fa-solid fa-play text-2xl ml-1"></i></div></div></div>` : ''}

                <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <button onclick="vote(${p.id}, 'like')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-green-100 text-slate-500 hover:text-green-600 transition-colors ${likeClass}">
                            <i class="fa-solid fa-thumbs-up"></i> <span id="likes-${p.id}">${p.likes_count || 0}</span>
                        </button>
                        <button onclick="vote(${p.id}, 'dislike')" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors ${dislikeClass}">
                            <i class="fa-solid fa-thumbs-down"></i>
                        </button>
                        <button onclick="toggleComments(${p.id})" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 transition-colors">
                            <i class="fa-regular fa-comment-dots"></i> <span id="comments-count-${p.id}">${p.comments_count || 0}</span>
                        </button>
                    </div>
                    <div>
                        <button onclick="prepareImport(${p.id})" class="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-full hover:bg-slate-900 shadow-md flex items-center gap-2 active:scale-95">
                            <i class="fa-solid fa-download"></i> <span>Importar</span>
                        </button>
                    </div>
                </div>
                ${commentsHtml}
            </div>
        `;
        feed.innerHTML += html;
    });
}

// --- FUNÇÕES DE INTERAÇÃO (Copiadas e adaptadas) ---

async function vote(postId, type) {
    if(!token) return;
    try {
        const res = await fetch(`${API_BASE}/community/vote`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ post_id: postId, vote_type: type })
        });
        if(res.ok) loadProfilePosts(); // Recarrega para atualizar contadores
    } catch(e) { console.error(e); }
}

function extractYoutubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function playVideo(container, id) {
    container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${id}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
}

// --- COMENTÁRIOS (Lógica Idêntica ao Community.js) ---

function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        loadComments(postId);
    } else {
        section.classList.add('hidden');
    }
}

async function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    try {
        const res = await fetch(`${API_BASE}/community/post/${postId}/comments`, { headers });
        if (res.ok) {
            const comments = await res.json();
            renderCommentsList(postId, comments);
        }
    } catch (e) {
        list.innerHTML = '<p class="text-xs text-red-400 text-center">Erro ao carregar.</p>';
    }
}

function renderCommentsList(postId, comments) {
    const list = document.getElementById(`comments-list-${postId}`);
    const countEl = document.getElementById(`comments-count-${postId}`);
    
    if(countEl) countEl.innerText = comments.length;

    if (comments.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center italic py-2">Seja o primeiro a comentar!</p>';
        return;
    }

    list.innerHTML = comments.map(c => {
        const isMine = c.user_id === currentUser.id;
        const canDelete = isMine || currentUser.is_owner;
        const avatar = c.author_avatar || `https://ui-avatars.com/api/?name=${c.author_name}&background=random`;

        return `
            <div class="flex gap-3 text-sm group/comment" id="comment-${c.id}">
                <img src="${avatar}" class="w-8 h-8 rounded-full border border-slate-200 mt-1 cursor-pointer" onclick="window.location.href='perfil.html?id=${c.user_id}'">
                <div class="flex-1 bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative">
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-bold text-slate-700 text-xs hover:text-indigo-600 cursor-pointer" onclick="window.location.href='perfil.html?id=${c.user_id}'">${c.author_name}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleDateString()}</span>
                            ${canDelete ? `<button onclick="deleteComment(${c.id}, ${postId})" class="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/comment:opacity-100"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
                            ${!isMine ? `<button onclick="openReportModal(${c.id}, 'comment')" class="text-slate-300 hover:text-amber-500 transition-colors opacity-0 group-hover/comment:opacity-100"><i class="fa-solid fa-flag text-xs"></i></button>` : ''}
                        </div>
                    </div>
                    <p class="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">${c.comment}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/community/post/${postId}/comment`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ comment: text })
        });
        if (res.ok) {
            input.value = "";
            loadComments(postId);
        } else {
            alert("Erro ao enviar comentário.");
        }
    } catch (e) {
        alert("Erro de conexão.");
    } finally {
        input.disabled = false;
        input.focus();
    }
}

async function deleteComment(commentId, postId) {
    if(!confirm("Apagar?")) return;
    try {
        const res = await fetch(`${API_BASE}/community/comment/${commentId}`, { method: 'DELETE', headers });
        if(res.ok) loadComments(postId);
    } catch(e) { alert("Erro"); }
}

// --- MODAIS E PREVIEW (Essencial para Importar) ---

function injectPreviewModal() {
    if (document.getElementById('post-preview-modal')) return;
    const modalHtml = `
    <div id="post-preview-modal" class="fixed inset-0 z-50 hidden">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="document.getElementById('post-preview-modal').classList.add('hidden')"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto transform transition-all scale-100">
                <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <h3 class="font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-eye text-indigo-500"></i> <span id="preview-modal-title">Visualizar</span></h3>
                    <button onclick="document.getElementById('post-preview-modal').classList.add('hidden')" class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-6 overflow-y-auto custom-scrollbar" id="preview-body-content"></div>
                <div class="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                    <button onclick="document.getElementById('post-preview-modal').classList.add('hidden')" class="px-4 py-2 text-slate-500 font-bold hover:text-slate-700">Fechar</button>
                    <button id="preview-action-btn" class="hidden px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-lg transition-transform active:scale-95">Ação</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function injectReportModal() {
    if (document.getElementById('report-modal')) return;
    const html = `
    <div id="report-modal" class="fixed inset-0 z-[60] hidden">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onclick="closeReportModal()"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto p-6">
                <h3 class="font-bold text-lg mb-4 text-slate-800">Denunciar Conteúdo</h3>
                <input type="hidden" id="report-post-id">
                <textarea id="report-reason" class="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none resize-none h-32" placeholder="Descreva o motivo da denúncia..."></textarea>
                <div class="flex justify-end gap-2 mt-4">
                    <button onclick="closeReportModal()" class="px-4 py-2 text-slate-500 font-bold text-sm">Cancelar</button>
                    <button onclick="submitReport()" class="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700">Enviar Denúncia</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

// Lógica de Preview e Importação
let currentPreviewData = null;
let reportType = 'post';

function openPostDetails(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    openPreviewModalGeneric(post.content_json, post.title, false);
}

function prepareImport(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    openPreviewModalGeneric(post.content_json, post.title, true);
}

function openPreviewModalGeneric(content, title, isImportMode) {
    currentPreviewData = content;
    const container = document.getElementById("preview-body-content");
    const titleEl = document.getElementById("preview-modal-title");
    
    if(!container) return; // Deve ter sido injetado no init

    titleEl.innerText = isImportMode ? "Confirmar Importação" : title;
    
    const actionBtn = document.getElementById("preview-action-btn");
    if(isImportMode) {
        actionBtn.innerText = "Confirmar Importação";
        actionBtn.onclick = () => executeImport(content);
        actionBtn.classList.remove("hidden");
    } else {
        actionBtn.classList.add("hidden");
    }

    container.innerHTML = "";
    // Detecta tipo
    if (content.planner || (content.data && content.data.planner)) {
        renderPlanPreview(content, container);
    } else if (Array.isArray(content)) {
        renderPackagePreview(content, container);
    } else {
        renderRecipeCard(content, container);
    }
    
    document.getElementById("post-preview-modal").classList.remove("hidden");
}

async function executeImport(content) {
    const isPlan = content.planner || (content.data && content.data.planner);
    try {
        if (isPlan) {
            const newPlan = { ...content, id: "plan_imp_" + Date.now(), name: (content.name || "Imp") + " (Comunidade)" };
            await fetch(`${API_BASE}/presets`, { method: "POST", headers, body: JSON.stringify(newPlan) });
            alert("Plano importado com sucesso!");
        } else {
            const list = Array.isArray(content) ? content : [content];
            for (let r of list) {
                const newRecipe = { ...r, id: "rec_imp_" + Date.now() + Math.random().toString(36).substr(2, 5) };
                await fetch(`${API_BASE}/library`, { method: "POST", headers, body: JSON.stringify(newRecipe) });
            }
            alert("Receitas importadas com sucesso!");
        }
        document.getElementById("post-preview-modal").classList.add("hidden");
    } catch (e) {
        alert("Erro ao importar.");
    }
}

// Renderizadores Auxiliares (Simplificados para não estourar o arquivo)
function renderRecipeCard(recipe, container) {
    container.innerHTML = `<div class="p-4 bg-slate-50 rounded-lg border border-slate-200"><h4 class="font-bold text-lg mb-2">${recipe.name}</h4><div class="text-sm text-slate-600 space-y-2">${(recipe.ingredients||[]).map(i=>`<div>• ${i}</div>`).join('')}</div></div>`;
}
function renderPlanPreview(plan, container) {
    container.innerHTML = `<div class="p-4 bg-indigo-50 rounded-lg border border-indigo-100 text-center"><i class="fa-solid fa-calendar-days text-4xl text-indigo-400 mb-2"></i><h4 class="font-bold text-lg text-indigo-900">Plano Mensal</h4><p class="text-sm text-indigo-700">Contém planejamento completo.</p></div>`;
}
function renderPackagePreview(list, container) {
    container.innerHTML = `<div class="space-y-2">${list.map(r => `<div class="p-3 bg-white border border-slate-200 rounded flex items-center gap-3"><i class="fa-solid fa-utensils text-slate-400"></i> <span class="font-bold text-slate-700">${r.name}</span></div>`).join('')}</div>`;
}

// Denúncias
function openReportModal(id, type) {
    reportType = type;
    document.getElementById("report-post-id").value = id;
    document.getElementById("report-modal").classList.remove("hidden");
}
function closeReportModal() {
    document.getElementById("report-modal").classList.add("hidden");
}
async function submitReport() {
    const id = document.getElementById("report-post-id").value;
    const reason = document.getElementById("report-reason").value;
    const url = reportType === 'post' ? `${API_BASE}/community/report` : `${API_BASE}/community/report/comment`;
    const body = reportType === 'post' ? { post_id: id, reason } : { comment_id: id, reason };
    
    await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    alert("Denúncia enviada.");
    closeReportModal();
}