// --- CONFIGURAÇÃO INTELIGENTE DA API ---
// Se estiver rodando pelo Live Server (porta 5500), ele aponta para o Node na porta 3000 do MESMO IP.
// Isso permite que funcione tanto no localhost quanto acessando pelo celular via rede (ex: 10.0.0.x).
const IS_DEV = window.location.port === '5500';

const API_BASE = IS_DEV ? `http://${window.location.hostname}:3000/api` : '/api';
const AUTH_URL = IS_DEV ? `http://${window.location.hostname}:3000/auth` : '/auth';

console.log(`🔌 Conectando API em: ${API_BASE}`);

// --- VERIFICAÇÃO DE LOGIN ---
const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

const headers = { 
    'Content-Type': 'application/json', 
    'Authorization': `Bearer ${token}` 
};

// --- VARIÁVEIS GLOBAIS ---
let library = [];
let planner = { 1: {}, 2: {}, 3: {}, 4: {} };
let themes = {};
let savedPlans = [];
let pickerContext = null; 
let currentImportType = ''; 

// --- TEMPLATES DE PROMPT ---
const TEMPLATE_PLAN = `Atue como um Nutricionista Sênior. Gere um JSON válido com um plano mensal (4 semanas). SEU PERFIL: [PERFIL]. REGRAS: "ingredients" usa "q_daily" em 'g' ou 'ml'. JSON: { "library": [{ "id": "rec_01", "name": "Nome", "cat": "almoco", "icon": "fa-drumstick-bite", "ingredients": [{"n": "Item", "q_daily": 200, "u": "g", "cat": "carnes"}], "steps": ["Passo"] }], "planner": { "1": { "almoco": "rec_01" } }, "themes": { "1": "Tema" } }`;
const TEMPLATE_RECIPE = `Atue como Nutricionista. Gere JSON Array com [QTD] receitas: [PERFIL]. REGRAS: "q_daily" em 'g'/'ml'. JSON: [{ "id": "rec_01", "name": "Nome", "cat": "cafe", "icon": "fa-mug-hot", "ingredients": [{"n": "Item", "q_daily": 200, "u": "g", "cat": "mercearia"}], "steps": ["Passo"] }]`;

// --- INICIALIZAÇÃO ---
window.onload = async function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if(user && user.name) document.getElementById('user-display').innerText = user.name;
    
    // Configura Sidebar Mobile
    const btnOpen = document.getElementById('btn-open-sidebar');
    const btnClose = document.getElementById('btn-close-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if(btnOpen) btnOpen.onclick = toggleSidebar;
    if(btnClose) btnClose.onclick = toggleSidebar;
    if(overlay) overlay.onclick = toggleSidebar;

    // Carregamento inicial de dados
    try {
        await Promise.all([loadLibrary(), loadPlanner(), loadPresets()]);
    } catch(e) {
        console.error("Erro conexão:", e);
        if(e && e.status === 401) logout();
    }

    // Roteamento simples via URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'gen') { openPromptGen(); switchView('presets'); }
    else if (params.get('view') === 'library') switchView('library');
    else switchView('presets');
};

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('mobile-overlay');
    if(sb) sb.classList.toggle('-translate-x-full');
    if(ov) ov.classList.toggle('hidden');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// --- FUNÇÕES DE API (CLIENTE) ---

async function loadLibrary() {
    try {
        const res = await fetch(`${API_BASE}/library`, { headers });
        if(res.ok) library = await res.json();
        renderLibrary();
    } catch (e) { console.error("Erro ao carregar biblioteca", e); }
}

async function loadPlanner() {
    try {
        const res = await fetch(`${API_BASE}/planner`, { headers });
        if(res.ok) {
            const data = await res.json();
            // Garante a estrutura correta mesmo se o banco estiver vazio
            const loadedPlanner = data.planner_data || {};
            planner = { 
                1: loadedPlanner[1] || {}, 
                2: loadedPlanner[2] || {}, 
                3: loadedPlanner[3] || {}, 
                4: loadedPlanner[4] || {} 
            };
            themes = data.themes_data || {};
            renderPlanner(); loadThemesUI();
        }
    } catch (e) { console.error("Erro ao carregar planejador", e); }
}

async function loadPresets() {
    try {
        const res = await fetch(`${API_BASE}/presets`, { headers });
        if(res.ok) savedPlans = await res.json();
        renderPresets();
    } catch (e) { console.error("Erro ao carregar presets", e); }
}

// --- LÓGICA DE NEGÓCIO ---

async function saveRecipeToLibrary() {
    const id = document.getElementById('edit-id').value || 'rec_' + Date.now();
    const name = document.getElementById('rec-name').value;
    if(!name) return alert("Nome é obrigatório");

    const ings = [];
    document.querySelectorAll('.ing-row').forEach(r => {
        const n = r.querySelector('.i-n').value;
        if(n) {
            let q = parseFloat(r.querySelector('.i-q').value) || 0;
            let u = r.querySelector('.i-u').value.toLowerCase();
            // Normalização para gramas/ml
            if(u === 'kg') { q *= 1000; u = 'g'; }
            if(u === 'l') { q *= 1000; u = 'ml'; }
            ings.push({ n, q_daily: q, u, cat: r.querySelector('.i-c').value });
        }
    });
    
    const steps = [];
    document.querySelectorAll('.s-txt').forEach(t => { if(t.value) steps.push(t.value); });

    const recipe = {
        id, name,
        cat: document.getElementById('rec-cat').value,
        icon: document.getElementById('rec-icon').value,
        ingredients: ings, steps
    };

    // Salva no servidor
    await fetch(`${API_BASE}/library`, { method: 'POST', headers, body: JSON.stringify(recipe) });
    
    // Atualiza localmente
    const idx = library.findIndex(x => x.id === id);
    if(idx >= 0) library[idx] = recipe; else library.push(recipe);
    
    closeModal(); renderLibrary(); renderPlanner();
}

async function deleteRecipe(id, e) {
    e.stopPropagation();
    if(confirm("Excluir receita permanentemente?")) {
        await fetch(`${API_BASE}/library/${id}`, { method: 'DELETE', headers });
        library = library.filter(x => x.id !== id);
        renderLibrary(); renderPlanner();
    }
}

async function syncPlanner() {
    // Salva o estado atual do planejador no banco
    await fetch(`${API_BASE}/planner`, {
        method: 'POST', headers,
        body: JSON.stringify({ planner: planner, themes: themes })
    });
}

function assignRecipe(id) {
    if(!planner[pickerContext.w]) planner[pickerContext.w] = {}; 
    planner[pickerContext.w][pickerContext.s] = id;
    syncPlanner(); 
    closePicker(); renderPlanner();
}

function clearSlot(w, s, e) {
    e.stopPropagation();
    if(planner[w]) delete planner[w][s];
    syncPlanner(); 
    renderPlanner();
}

function saveThemes() {
    [1,2,3,4].forEach(w => themes[w] = document.getElementById(`theme-w${w}`).value);
    syncPlanner(); 
}

async function saveCurrentAsPreset() {
    const name = prompt("Nome do plano:");
    if(!name) return;
    const p = { 
        id: 'plan_' + Date.now(), 
        name, 
        date: new Date().toLocaleDateString(), 
        data: { library, planner, themes } 
    };
    
    await fetch(`${API_BASE}/presets`, { method: 'POST', headers, body: JSON.stringify(p) });
    savedPlans.push(p);
    renderPresets();
}

async function deletePreset(id) {
    if(confirm("Excluir plano?")) {
        await fetch(`${API_BASE}/presets/${id}`, { method: 'DELETE', headers });
        savedPlans = savedPlans.filter(x => x.id !== id);
        renderPresets();
    }
}

// --- FUNÇÕES DE UI E UTILITÁRIOS ---

function formatDisplay(q, u) {
    let val = parseFloat(q); let unit = u.toLowerCase();
    if (unit === 'g' && val >= 1000) { return { v: val/1000, u: 'kg' }; }
    if (unit === 'ml' && val >= 1000) { return { v: val/1000, u: 'l' }; }
    return { v: val, u: unit };
}

function switchView(v) {
    ['library','planner','presets'].forEach(x => document.getElementById(`view-${x}`).classList.add('hidden'));
    document.getElementById(`view-${v}`).classList.remove('hidden');
    
    // Atualiza navegação
    ['nav-library','nav-planner','nav-presets'].forEach(id => {
        const btn = document.getElementById(id);
        if(!btn) return;
        const isActive = id === `nav-${v}`;
        btn.className = isActive 
            ? "flex items-center w-full px-4 py-3 text-sm font-bold text-blue-700 bg-blue-50 rounded-lg shadow-sm mb-1 border border-blue-100"
            : "flex items-center w-full px-4 py-3 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors mb-1";
        const icon = btn.querySelector('i');
        if(icon) {
            icon.classList.remove('text-blue-600','text-slate-400');
            icon.classList.add(isActive ? 'text-blue-600' : 'text-slate-400');
        }
    });
    
    // Fecha menu mobile
    const sb = document.getElementById('sidebar');
    if(sb && !sb.classList.contains('-translate-x-full') && window.innerWidth < 768) toggleSidebar();
}

function loadFileContent(input) { 
    const f = input.files[0]; 
    if(!f) return; 
    const r = new FileReader(); 
    r.onload = e => { document.getElementById('import-text').value = e.target.result; }; 
    r.readAsText(f); 
    input.value = ''; 
}

function renderLibrary() { 
    const g = document.getElementById('recipe-grid'); g.innerHTML = '';
    if(library.length === 0) { document.getElementById('empty-library').classList.remove('hidden'); return; }
    document.getElementById('empty-library').classList.add('hidden');
    library.forEach(r => {
        g.innerHTML += `<div class="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md cursor-pointer relative group" onclick="if(!event.target.closest('button')) openRecipeModal('${r.id}')"><div class="flex justify-between mb-2"><span class="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-sm"><i class="fa-solid ${r.icon||'fa-utensils'}"></i></span><div class="flex gap-1"><button onclick="deleteRecipe('${r.id}', event)" class="text-slate-300 hover:text-red-500 p-1"><i class="fa-solid fa-trash"></i></button></div></div><h4 class="font-bold text-slate-800 text-sm mb-1">${r.name}</h4><span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase font-bold">${r.cat}</span></div>`;
    });
}

function renderPresets() {
    const g = document.getElementById('presets-grid'); g.innerHTML = '';
    if(savedPlans.length === 0) { document.getElementById('empty-presets').classList.remove('hidden'); return; }
    document.getElementById('empty-presets').classList.add('hidden');
    savedPlans.forEach(p => {
        g.innerHTML += `<div class="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg transition-all relative group flex flex-col justify-between"><div><div class="flex justify-between items-start mb-2"><h3 class="font-bold text-slate-800 text-lg leading-tight line-clamp-2">${p.name}</h3><div class="flex gap-1 ml-2"><button onclick="deletePreset('${p.id}')" class="text-slate-300 hover:text-red-500 p-1"><i class="fa-solid fa-trash"></i></button></div></div><p class="text-xs text-slate-400 font-medium mb-4"><i class="fa-regular fa-calendar mr-1"></i>${p.date || 'Hoje'}</p></div><div class="grid grid-cols-2 gap-3 mt-auto"><button onclick="openPreview('${p.id}')" class="w-full py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg">Ver Detalhes</button><button onclick="loadPreset('${p.id}')" class="w-full py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-md">Carregar</button></div></div>`;
    });
}

// CORREÇÃO: Função BLINDADA contra erros de JSON undefined
function loadPreset(id) {
    const p = savedPlans.find(x => x.id === id);
    if(p) {
        // Proteção: Garante que 'data' existe e que seus filhos também existam
        // antes de tentar cloná-los. Se não existirem, cria vazios.
        const data = p.data || {};
        
        library = data.library ? JSON.parse(JSON.stringify(data.library)) : [];
        planner = data.planner ? JSON.parse(JSON.stringify(data.planner)) : { 1: {}, 2: {}, 3: {}, 4: {} };
        themes = data.themes ? JSON.parse(JSON.stringify(data.themes)) : {};
        
        // Atualiza banco com os dados do preset carregado
        if(library.length > 0) {
            library.forEach(async r => {
                 await fetch(`${API_BASE}/library`, { method: 'POST', headers, body: JSON.stringify(r) });
            });
        }
        
        syncPlanner();
        
        renderLibrary(); renderPlanner(); loadThemesUI(); switchView('planner');
    } else {
        alert("Erro: Plano não encontrado.");
    }
}

function renderPlanner() {
    const b = document.getElementById('planner-body'); 
    if(!b) return;
    b.innerHTML = '';
    
    [1,2,3,4].forEach(w => {
        if(!planner[w]) planner[w] = {};

        let h = `<tr class="hover:bg-slate-50 group"><td class="px-6 py-4 text-sm font-bold text-slate-700 text-center border-r border-slate-200 bg-white group-hover:bg-slate-50 sticky left-0 z-10">Semana ${w}</td>`;
        
        ['cafe','almoco','lanche','jantar'].forEach(s => {
            const rid = planner[w][s]; 
            const r = library.find(x => x.id === rid);
            
            // Design com Ícones
            if(r) {
                h += `<td class="px-2 py-2 min-w-[140px]">
                    <div onclick="openPicker(${w},'${s}')" class="bg-white border border-blue-200 p-2 md:p-3 rounded-lg shadow-sm cursor-pointer flex items-center gap-2 md:gap-3 group/card relative h-16">
                        <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex flex-shrink-0 items-center justify-center text-xs font-bold border border-blue-100">
                            <i class="fa-solid ${r.icon||'fa-utensils'}"></i>
                        </div>
                        <span class="font-bold text-xs text-slate-700 truncate w-20 md:w-24">${r.name}</span>
                        <button onclick="clearSlot(${w},'${s}',event)" class="absolute -top-2 -right-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] shadow-sm md:opacity-0 group-hover/card:opacity-100">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </td>`;
            } else {
                h += `<td class="px-2 py-2 min-w-[140px]">
                    <button onclick="openPicker(${w},'${s}')" class="w-full border-2 border-dashed border-slate-200 rounded-lg h-16 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500">
                        <i class="fa-solid fa-plus text-sm mb-1"></i>
                        <span class="text-[10px] font-bold uppercase tracking-wide">Add</span>
                    </button>
                </td>`;
            }
        });
        b.innerHTML += h + '</tr>';
    });
}

function loadThemesUI() { [1,2,3,4].forEach(w => { if(themes[w]) document.getElementById(`theme-w${w}`).value = themes[w]; }); }

function openPicker(w,s) { pickerContext = {w,s}; document.getElementById('picker-modal').classList.remove('hidden'); renderPickerList(); document.getElementById('picker-search').focus(); }
function closePicker() { document.getElementById('picker-modal').classList.add('hidden'); }
function renderPickerList() { 
    const l = document.getElementById('picker-list'); 
    const q = document.getElementById('picker-search').value.toLowerCase(); 
    l.innerHTML = '';
    
    const filtered = library.filter(r => r.name.toLowerCase().includes(q));
    if(filtered.length === 0) {
        l.innerHTML = '<p class="text-xs text-slate-400 text-center p-4">Nenhuma receita encontrada.</p>';
        return;
    }

    filtered.forEach(r => {
        l.innerHTML += `<div onclick="assignRecipe('${r.id}')" class="p-3 hover:bg-blue-50 cursor-pointer rounded-lg flex items-center gap-3 border border-transparent hover:border-blue-100 mb-1 group">
            <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-xs group-hover:bg-white group-hover:text-blue-500">
                <i class="fa-solid ${r.icon||'fa-utensils'}"></i>
            </div>
            <div>
                <p class="text-sm font-bold text-slate-700 group-hover:text-blue-700">${r.name}</p>
            </div>
        </div>`;
    });
}

function openPreview(id) { 
    const p = savedPlans.find(x=>x.id===id); if(!p) return; 
    document.getElementById('preview-title').innerText = p.name;
    document.getElementById('preview-modal').classList.remove('hidden'); 
    
    // Preview Simples
    const data = p.data || {};
    const plannerPrev = data.planner || {};
    
    const weeks = [1,2,3,4].map(w => {
        const meals = Object.keys(plannerPrev[w] || {}).length;
        return `Semana ${w}: ${meals} refeições`;
    }).join('\n');
    document.getElementById('preview-content').innerHTML = `<pre class="text-xs font-mono bg-slate-100 p-4 rounded">${weeks}</pre>`; 
    document.getElementById('preview-confirm-btn').onclick = () => { loadPreset(id); closePreview(); };
}
function closePreview() { document.getElementById('preview-modal').classList.add('hidden'); }

// --- FUNÇÃO FINAL: PUBLICAÇÃO ---
function exportToApp() {
    let d = {};
    [1,2,3,4].forEach(w => {
        let m = {}, ml = [];
        ['cafe','almoco','lanche','jantar'].forEach(s => {
            if(!planner[w]) return;
            const rid = planner[w][s]; const r = library.find(x => x.id === rid);
            if(r) {
                m[s] = { name: r.name, ingredients: r.ingredients, steps: r.steps };
                r.ingredients.forEach(i => {
                    let ex = ml.find(x => x.n.toLowerCase() === i.n.toLowerCase());
                    if(ex) ex.q_daily += i.q_daily; else ml.push({ ...i, id: i.n.replace(/[^a-z0-9]/g,'') });
                });
            }
        });
        d[w] = { headerTitle: `Semana ${w}`, headerSubtitle: themes[w] || "", meals: m, market: ml };
    });
    localStorage.setItem('dietData', JSON.stringify(d));
    alert("Dados publicados para o App Mobile (Local Storage)!");
}

// --- MODAIS E AUXILIARES ---
function openPromptGen() { document.getElementById('prompt-modal').classList.remove('hidden'); toggleGenInputs(); }
function closePromptGen() { document.getElementById('prompt-modal').classList.add('hidden'); }
function toggleGenInputs() {
    const type = document.getElementById('gen-type').value;
    if(type==='recipe') { document.getElementById('gen-qty-container').classList.remove('hidden'); document.getElementById('gen-input-label').innerText='Tipos'; }
    else { document.getElementById('gen-qty-container').classList.add('hidden'); document.getElementById('gen-input-label').innerText='Seu Perfil'; }
}
function generatePromptText() {
    const type = document.getElementById('gen-type').value;
    const val = document.getElementById('gen-input').value;
    if(!val) return alert("Preencha os dados");
    let txt = type === 'plan' ? TEMPLATE_PLAN.replace('[PERFIL]', val) : TEMPLATE_RECIPE.replace('[QTD]', document.getElementById('gen-qty').value).replace('[PERFIL]', val);
    document.getElementById('gen-output').value = txt;
}
function copyPromptText() {
    const txt = document.getElementById('gen-output'); txt.select();
    txt.setSelectionRange(0, 99999);
    if(navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt.value).then(()=>alert("Copiado!")).catch(()=>fallbackCopy());
    } else fallbackCopy();
    
    function fallbackCopy(){ document.execCommand('copy'); alert("Copiado!"); }
}

function openImportModal(type) { currentImportType = type; document.getElementById('import-title').innerText = type==='plan'?'Importar Plano':'Importar Receitas'; document.getElementById('import-text').value=''; document.getElementById('import-modal').classList.remove('hidden'); }
function closeImportModal() { document.getElementById('import-modal').classList.add('hidden'); }
function processImport() {
    try {
        let text = document.getElementById('import-text').value.trim();
        // Correção de formatação JSON comum de IA
        if (!text.startsWith('{') && !text.startsWith('[')) { const s = text.search(/[\{\[]/); if(s!==-1) text = text.substring(s); const l = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']')); if(l!==-1) text = text.substring(0, l+1); }
        
        let json = JSON.parse(text);
        if(currentImportType === 'plan') {
            const p = { id: 'plan_ia_'+Date.now(), name: prompt("Nome do Plano:")||"Importado", date: new Date().toLocaleDateString(), data: { library: json.library, planner: json.planner, themes: json.themes||{} } };
            fetch(`${API_BASE}/presets`, { method: 'POST', headers, body: JSON.stringify(p) }).then(()=>{ savedPlans.push(p); renderPresets(); alert("Plano Importado!"); closeImportModal(); });
        } else {
            const list = Array.isArray(json) ? json : (json.library || []);
            list.forEach(async r => { await fetch(`${API_BASE}/library`, { method: 'POST', headers, body: JSON.stringify(r) }); });
            alert("Receitas importadas! Atualize a página."); closeImportModal();
        }
    } catch(e) { alert("JSON Inválido ou Mal formatado"); }
}

function openRecipeModal(id) {
    document.getElementById('recipe-modal').classList.remove('hidden');
    document.getElementById('edit-id').value = id || '';
    document.getElementById('rec-ingredients').innerHTML = ''; document.getElementById('rec-steps').innerHTML = '';
    const r = id ? library.find(x => x.id === id) : { name: '', cat: 'almoco', icon: 'fa-utensils', ingredients: [], steps: [] };
    document.getElementById('rec-name').value = r.name;
    document.getElementById('rec-cat').value = r.cat;
    document.getElementById('rec-icon').value = r.icon;
    if(r.ingredients) r.ingredients.forEach(i => { addRecLine(); const l = document.getElementById('rec-ingredients').lastElementChild; l.querySelector('.i-n').value=i.n; const f=formatDisplay(i.q_daily, i.u); l.querySelector('.i-q').value=f.v; l.querySelector('.i-u').value=f.u; l.querySelector('.i-c').value=i.cat||'mercearia'; });
    if(r.steps) r.steps.forEach(s => { addStepLine(); document.getElementById('rec-steps').lastElementChild.querySelector('textarea').value=s; });
    if(!id) { addRecLine(); addStepLine(); }
}
function closeModal() { document.getElementById('recipe-modal').classList.add('hidden'); }
const tplIngRow = `<div class="grid grid-cols-1 md:grid-cols-12 gap-2 ing-row items-center mb-2 bg-slate-50 p-2 rounded"><div class="md:col-span-5"><input type="text" placeholder="Item" class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm i-n"></div><div class="grid grid-cols-3 gap-2 md:col-span-6"><input type="number" placeholder="0" class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center i-q"><input type="text" placeholder="un" class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center i-u"><select class="w-full bg-white border border-slate-200 rounded px-1 py-1 text-xs i-c"><option value="carnes">Carnes</option><option value="horti">Horti</option><option value="mercearia">Merc.</option><option value="outros">Out.</option></select></div><div class="md:col-span-1 text-center"><button onclick="this.closest('.ing-row').remove()" class="text-red-400"><i class="fa-solid fa-xmark"></i></button></div></div>`;
function addRecLine() { document.getElementById('rec-ingredients').insertAdjacentHTML('beforeend', tplIngRow); }
function addStepLine() { document.getElementById('rec-steps').insertAdjacentHTML('beforeend', `<div class="flex gap-2 mb-2"><textarea class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm h-12 s-txt" placeholder="Passo..."></textarea><button onclick="this.parentElement.remove()" class="text-red-400"><i class="fa-solid fa-trash"></i></button></div>`); }