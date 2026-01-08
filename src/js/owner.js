const API_BASE = "http://localhost:3000/api";
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user')) || {};

// Segurança
if (!token || user.is_owner !== 1) {
    window.location.href = 'app.html';
}

window.onload = function() {
    loadStats();
    // Default view
    switchView('dashboard');
}

function switchView(viewName) {
    // Esconde todas as views
    ['dashboard', 'users', 'posts', 'reports'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
        const btn = document.getElementById(`nav-${v}`);
        if(btn) btn.className = "flex items-center w-full px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg mb-1 transition-colors";
    });

    // Mostra a atual
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    
    // Destaca botão no menu
    const activeBtn = document.getElementById(`nav-${viewName}`);
    if(activeBtn) activeBtn.className = "flex items-center w-full px-4 py-3 text-sm font-bold bg-slate-50 text-indigo-700 rounded-lg mb-1 transition-colors border border-indigo-100";

    // Carrega dados da view
    if (viewName === 'users') loadUsers();
    if (viewName === 'posts') loadAllPosts();
    if (viewName === 'reports') loadReports();
    if (viewName === 'dashboard') loadStats();
}

// --- ESTATÍSTICAS ---
async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/owner/stats`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        document.getElementById('stat-users').innerText = data.users;
        document.getElementById('stat-posts').innerText = data.posts;
        document.getElementById('stat-reports').innerText = data.reports;
        
        // Atualiza badge
        const badge = document.getElementById('badge-reports');
        if(data.reports > 0) {
            badge.innerText = data.reports;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch(e) { console.error(e); }
}

// --- USUÁRIOS ---
async function loadUsers() {
    const tbody = document.getElementById('table-users-body');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-slate-400">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/owner/users`, { headers: { "Authorization": `Bearer ${token}` } });
        const users = await res.json();
        
        tbody.innerHTML = "";
        users.forEach(u => {
            const isBan = u.can_post === 0;
            const statusHtml = isBan 
                ? `<span class="bg-red-100 text-red-600 py-1 px-2 rounded text-xs font-bold">Banido</span>` 
                : `<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs font-bold">Ativo</span>`;
            
            const btnHtml = isBan
                ? `<button onclick="toggleBan('${u.email}', 1)" class="text-xs font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded border border-green-200">Desbanir</button>`
                : `<button onclick="toggleBan('${u.email}', 0)" class="text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-200">Banir</button>`;

            const row = `
                <tr class="hover:bg-slate-50 border-b border-slate-50 last:border-0">
                    <td class="px-6 py-4 text-slate-500 font-mono text-xs">#${u.id}</td>
                    <td class="px-6 py-4 font-bold text-slate-700">${u.name}</td>
                    <td class="px-6 py-4 text-slate-500">${u.email}</td>
                    <td class="px-6 py-4">${statusHtml}</td>
                    <td class="px-6 py-4 text-right">${btnHtml}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch(e) { notify("Erro ao carregar usuários", "error"); }
}

async function toggleBan(email, status) {
    if(!confirm(`Deseja alterar o status de ${email}?`)) return;
    try {
        await fetch(`${API_BASE}/owner/ban`, {
            method: 'POST',
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ email, can_post: status })
        });
        notify("Status atualizado!");
        loadUsers(); // Recarrega tabela
    } catch(e) { notify("Erro ao atualizar", "error"); }
}

// --- POSTS ---
async function loadAllPosts() {
    const tbody = document.getElementById('table-posts-body');
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Carregando...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE}/owner/all_posts`, { headers: { "Authorization": `Bearer ${token}` } });
        const posts = await res.json();
        
        tbody.innerHTML = "";
        posts.forEach(p => {
            const row = `
                <tr class="hover:bg-slate-50 border-b border-slate-50 last:border-0">
                    <td class="px-6 py-4">
                        <p class="font-bold text-slate-700 truncate max-w-xs">${p.title}</p>
                        <p class="text-xs text-slate-400 truncate max-w-xs">${p.description}</p>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-600">
                        ${p.author_name}<br><span class="text-xs text-slate-400">${p.author_email}</span>
                    </td>
                    <td class="px-6 py-4 text-xs text-slate-500">${new Date(p.created_at).toLocaleDateString()}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="deletePost(${p.id}, true)" class="text-slate-400 hover:text-red-600 transition-colors"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch(e) { notify("Erro ao carregar posts", "error"); }
}

async function deletePost(id, reloadList = false) {
    if(!confirm("Apagar post permanentemente?")) return;
    try {
        await fetch(`${API_BASE}/community/post/${id}`, { method: 'DELETE', headers: { "Authorization": `Bearer ${token}` } });
        notify("Post deletado.");
        if(reloadList) loadAllPosts();
        closePreview();
        loadReports(); // Atualiza reports se houver
        loadStats();
    } catch(e) { notify("Erro ao deletar", "error"); }
}

// --- DENÚNCIAS ---
async function loadReports() {
    const grid = document.getElementById('reports-grid');
    const empty = document.getElementById('reports-empty');
    grid.innerHTML = "";
    
    try {
        const res = await fetch(`${API_BASE}/owner/reports`, { headers: { "Authorization": `Bearer ${token}` } });
        const reports = await res.json();
        
        if(reports.length === 0) {
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        reports.forEach(r => {
            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <span class="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-100">Denúncia #${r.id}</span>
                    <span class="text-xs text-slate-400">${new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p class="text-sm text-slate-600 mb-1 font-bold">Motivo:</p>
                <p class="text-sm text-slate-800 bg-slate-50 p-2 rounded mb-4 border border-slate-100">${r.reason}</p>
                
                <div class="mt-auto flex gap-2">
                    <button onclick="previewReportedPost(${r.post_id})" class="flex-1 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors">Ver Post & Ações</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch(e) { notify("Erro ao carregar denúncias", "error"); }
}

async function previewReportedPost(postId) {
    try {
        const res = await fetch(`${API_BASE}/community/post/${postId}`, { headers: { "Authorization": `Bearer ${token}` } });
        if(!res.ok) throw new Error("Post não encontrado (talvez já deletado)");
        const p = await res.json();

        document.getElementById('prev-title').innerText = p.title;
        document.getElementById('prev-desc').innerText = p.description;
        document.getElementById('prev-json').innerText = JSON.stringify(p.content_json, null, 2);
        
        const ytBox = document.getElementById('prev-yt-box');
        if(p.youtube_link) {
            ytBox.classList.remove('hidden');
            const ytId = p.youtube_link.split('v=')[1] || p.youtube_link.split('/').pop();
            document.getElementById('prev-iframe').src = `https://www.youtube.com/embed/${ytId}`;
        } else {
            ytBox.classList.add('hidden');
        }

        // Configura botão de deletar do modal
        const btnDel = document.getElementById('btn-delete-post');
        btnDel.onclick = () => deletePost(p.id);

        document.getElementById('preview-modal').classList.remove('hidden');
    } catch(e) { notify(e.message, "error"); }
}

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden');
    document.getElementById('prev-iframe').src = ""; // Para o vídeo
}

function notify(text, type = "success") {
    Toastify({
        text: text, duration: 3000, gravity: "top", position: "center",
        style: { background: type === "error" ? "#ef4444" : "#22c55e", borderRadius: "8px" }
    }).showToast();
}