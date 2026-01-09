// ============================================================
// ARQUIVO: js/app-core.js
// FUNÇÃO: Lógica Principal (Library, Planner, Presets)
// DEPENDE DE: js/config.js e js/profile-manager.js
// ============================================================

// --- ESTADO LOCAL DA APLICAÇÃO ---
const ICON_OPTIONS = [
  { val: "fa-utensils", label: "Geral" },
  { val: "fa-mug-hot", label: "Café" },
  { val: "fa-bread-slice", label: "Pão/Massas" },
  { val: "fa-apple-alt", label: "Fruta" },
  { val: "fa-carrot", label: "Legumes" },
  { val: "fa-leaf", label: "Salada" },
  { val: "fa-drumstick-bite", label: "Frango" },
  { val: "fa-hamburger", label: "Carne" },
  { val: "fa-fish", label: "Peixe" },
  { val: "fa-egg", label: "Ovos" },
  { val: "fa-soup", label: "Sopa" },
  { val: "fa-cheese", label: "Queijo" },
  { val: "fa-bolt", label: "Energia" },
  { val: "fa-moon", label: "Jantar" },
];

let library = [];
let planner = { 1: {}, 2: {}, 3: {}, 4: {} };
let themes = {};
let savedPlans = [];
let pickerContext = null;
let currentImportType = "";
let currentPreviewId = null;
let selectedRecipes = new Set();

// --- INICIALIZAÇÃO CENTRAL ---
window.onload = async function () {
  // 1. Setup UI Básico
  // user vem do config.js
  if (user && user.name) {
    const display = document.getElementById("user-display");
    if (display) display.innerText = user.name;
  }
  if (user.avatar) {
    const sbAvatar = document.getElementById("sidebar-avatar");
    if (sbAvatar) sbAvatar.src = user.avatar;
  }

  // 2. Setup Listeners
  setupMobileMenu();
  setupBioCounter();

  // 3. Botão Dono (Admin)
  if (user.is_owner === 1) renderOwnerButton();

  // 4. Carregar Dados (Em paralelo para ser mais rápido)
  try {
    await Promise.all([
      loadLibrary(),
      loadPlanner(),
      loadPresets(),
      loadUserProfile(), // Função do profile-manager.js
    ]);
  } catch (e) {
    console.error("Erro na inicialização:", e);
    if (e && e.status === 401) logout();
  }

  // 5. Roteamento Simples via URL
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "profile") switchView("profile");
  else switchView("presets");
};

function setupMobileMenu() {
  const btnOpen = document.getElementById("btn-open-sidebar");
  const btnClose = document.getElementById("btn-close-sidebar");
  const overlay = document.getElementById("mobile-overlay");
  if (btnOpen) btnOpen.onclick = toggleSidebar;
  if (btnClose) btnClose.onclick = toggleSidebar;
  if (overlay) overlay.onclick = toggleSidebar;
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("mobile-overlay");
  if (sb) sb.classList.toggle("-translate-x-full");
  if (ov) ov.classList.toggle("hidden");
}

function setupBioCounter() {
  const bioArea = document.getElementById("profile-bio");
  if (bioArea) {
    bioArea.addEventListener("input", function () {
      const counter = document.getElementById("bio-counter");
      if (counter) counter.innerText = `${this.value.length}/255`;
    });
  }
}

function renderOwnerButton() {
  const nav = document.querySelector("aside nav");
  if (!nav) return;

  // Evita duplicar se já existir
  if (document.getElementById("btn-owner-panel")) return;

  const ownerBtn = document.createElement("a");
  ownerBtn.id = "btn-owner-panel";
  ownerBtn.href = "owner.html";
  ownerBtn.className =
    "flex items-center w-full px-4 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors mb-4 shadow-lg shadow-red-200";
  ownerBtn.innerHTML =
    '<i class="fa-solid fa-user-shield w-5"></i> Painel do Dono';
  nav.prepend(ownerBtn);
}

function switchView(v) {
  // Esconde todas as views
  ["library", "planner", "presets", "profile"].forEach((x) => {
    const el = document.getElementById(`view-${x}`);
    if (el) el.classList.add("hidden");
  });

  // Mostra a selecionada
  const target = document.getElementById(`view-${v}`);
  if (target) target.classList.remove("hidden");

  // Atualiza sidebar
  ["nav-library", "nav-planner", "nav-presets", "nav-profile"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isActive = id === `nav-${v}`;
    btn.className = isActive
      ? "flex items-center w-full px-4 py-3 text-sm font-bold text-blue-700 bg-blue-50 rounded-lg shadow-sm mb-1 border border-blue-100"
      : "flex items-center w-full px-4 py-3 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors mb-1";

    const icon = btn.querySelector("i");
    if (icon) {
      icon.classList.remove("text-blue-600", "text-slate-400");
      icon.classList.add(isActive ? "text-blue-600" : "text-slate-400");
    }
  });

  // Fecha menu mobile ao trocar de tela
  if (window.innerWidth < 768) {
    const sb = document.getElementById("sidebar");
    if (sb && !sb.classList.contains("-translate-x-full")) toggleSidebar();
  }
}

// --- FUNÇÕES DE BIBLIOTECA (LIBRARY) ---

async function loadLibrary() {
  try {
    const res = await fetch(`${API_BASE}/library`, { headers });
    if (res.ok) library = await res.json();
    renderLibrary();
  } catch (e) {
    console.error("Erro library", e);
  }
}

function renderLibrary() {
  const g = document.getElementById("recipe-grid");
  if (!g) return;

  g.innerHTML = "";
  const searchInput = document.getElementById("library-search");
  const term = searchInput ? searchInput.value.toLowerCase() : "";
  const filtered = library.filter(
    (r) =>
      r.name.toLowerCase().includes(term) || r.cat.toLowerCase().includes(term)
  );

  const emptyMsg = document.getElementById("empty-library");
  if (filtered.length === 0) {
    if (emptyMsg) emptyMsg.classList.remove("hidden");
    return;
  }
  if (emptyMsg) emptyMsg.classList.add("hidden");

  filtered.forEach((r) => {
    const isSelected = selectedRecipes.has(r.id);
    const cardHtml = `
        <div class="bg-white border ${
          isSelected
            ? "border-indigo-500 ring-1 ring-indigo-500"
            : "border-slate-200"
        } rounded-xl p-4 hover:shadow-md relative group transition-all cursor-pointer" onclick="openRecipeModal('${
      r.id
    }')">
            <div class="flex justify-between mb-2">
                <div class="flex items-center gap-2">
                    <div onclick="event.stopPropagation(); toggleRecipeSelection('${
                      r.id
                    }')" class="w-8 h-8 rounded cursor-pointer flex items-center justify-center transition-colors ${
      isSelected
        ? "bg-indigo-600 text-white"
        : "bg-slate-100 text-slate-300 hover:bg-slate-200"
    }"><i class="fa-solid fa-check"></i></div>
                    <span class="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-sm"><i class="fa-solid ${
                      r.icon || "fa-utensils"
                    }"></i></span>
                </div>
                <div class="flex gap-1">
                    <button onclick="deleteRecipe('${
                      r.id
                    }', event)" class="text-slate-300 hover:text-red-500 p-1 delete-btn"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <h4 class="font-bold text-slate-800 text-sm mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">${
              r.name
            }</h4>
            <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase font-bold">${
              r.cat
            }</span>
        </div>`;
    g.innerHTML += cardHtml;
  });
  updateExportButton();
}

function toggleRecipeSelection(id) {
  if (selectedRecipes.has(id)) selectedRecipes.delete(id);
  else selectedRecipes.add(id);
  renderLibrary();
}

function updateExportButton() {
  const btn = document.getElementById("btn-export-selected");
  const count = document.getElementById("count-selected");
  if (!btn || !count) return;

  if (selectedRecipes.size > 0) {
    btn.classList.remove("hidden");
    btn.classList.add("flex");
    count.innerText = selectedRecipes.size;
  } else {
    btn.classList.add("hidden");
    btn.classList.remove("flex");
  }
}

function exportSelectedRecipes() {
  if (selectedRecipes.size === 0) return;
  const exportData = library.filter((r) => selectedRecipes.has(r.id));
  const filename = `receitas_export_${new Date()
    .toLocaleDateString()
    .replace(/\//g, "-")}.json`;
  downloadJSON(exportData, filename);
  selectedRecipes.clear();
  renderLibrary();
  notify(`${exportData.length} receitas exportadas!`);
}

async function saveRecipeToLibrary() {
  const id = document.getElementById("edit-id").value || "rec_" + Date.now();
  const name = document.getElementById("rec-name").value;
  if (!name) return notify("Nome é obrigatório", "error");

  const ings = [];
  document.querySelectorAll(".ing-row").forEach((r) => {
    const n = r.querySelector(".i-n").value;
    if (n) {
      let q = parseFloat(r.querySelector(".i-q").value) || 0;
      let u = r.querySelector(".i-u").value.toLowerCase();
      if (u === "kg") {
        q *= 1000;
        u = "g";
      }
      if (u === "l") {
        q *= 1000;
        u = "ml";
      }
      ings.push({ n, q_daily: q, u, cat: r.querySelector(".i-c").value });
    }
  });

  const steps = [];
  document.querySelectorAll(".s-txt").forEach((t) => {
    if (t.value) steps.push(t.value);
  });

  const recipe = {
    id,
    name,
    cat: document.getElementById("rec-cat").value,
    icon: document.getElementById("rec-icon").value,
    ingredients: ings,
    steps,
  };

  await fetch(`${API_BASE}/library`, {
    method: "POST",
    headers,
    body: JSON.stringify(recipe),
  });

  const idx = library.findIndex((x) => x.id === id);
  if (idx >= 0) library[idx] = recipe;
  else library.push(recipe);

  closeModal();
  renderLibrary();
  renderPlanner(); // Atualiza planner caso a receita tenha sido alterada
  notify("Receita salva com sucesso!");
}

async function deleteRecipe(id, e) {
  if (e) e.stopPropagation();
  const confirmed = await showConfirm("Excluir receita permanentemente?");
  if (confirmed) {
    try {
      await fetch(`${API_BASE}/library/${id}`, { method: "DELETE", headers });
      library = library.filter((x) => x.id !== id);
      renderLibrary();
      renderPlanner();
      if (selectedRecipes.has(id)) {
        selectedRecipes.delete(id);
        updateExportButton();
      }
      notify("Receita excluída!");
    } catch (err) {
      notify("Erro ao excluir", "error");
    }
  }
}

// --- FUNÇÕES DE PRESETS (PLANOS SALVOS) ---

async function loadPresets() {
  try {
    const res = await fetch(`${API_BASE}/presets`, { headers });
    if (res.ok) savedPlans = await res.json();
    renderPresets();
  } catch (e) {
    console.error("Erro presets", e);
  }
}

function renderPresets() {
  const g = document.getElementById("presets-grid");
  if (!g) return;
  g.innerHTML = "";

  const emptyMsg = document.getElementById("empty-presets");

  if (savedPlans.length === 0) {
    if (emptyMsg) emptyMsg.classList.remove("hidden");
    return;
  }
  if (emptyMsg) emptyMsg.classList.add("hidden");

  savedPlans.forEach((p) => {
    g.innerHTML += `
        <div class="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg transition-all relative group flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-slate-800 text-lg leading-tight line-clamp-2 pr-2">${
                      p.name
                    }</h3>
                    <div class="flex gap-1 ml-2 shrink-0">
                        <button onclick="renamePreset('${p.id}', '${
      p.name
    }')" class="text-slate-300 hover:text-blue-500 p-1" title="Renomear"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="sharePreset('${
                          p.id
                        }')" class="text-slate-300 hover:text-green-500 p-1" title="Compartilhar JSON"><i class="fa-solid fa-share-nodes"></i></button>
                        <button onclick="deletePreset('${
                          p.id
                        }')" class="text-slate-300 hover:text-red-500 p-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p class="text-xs text-slate-400 font-medium mb-4"><i class="fa-regular fa-calendar mr-1"></i>${
                  p.date || "Hoje"
                }</p>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-auto">
                <button onclick="openPreview('${
                  p.id
                }')" class="w-full py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg">Ver Detalhes</button>
                <button onclick="loadPreset('${
                  p.id
                }')" class="w-full py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-md">Carregar</button>
            </div>
        </div>`;
  });
}

async function renamePreset(id, currentName) {
  const newName = prompt("Novo nome para o plano:", currentName);
  if (newName && newName !== currentName) {
    try {
      const res = await fetch(`${API_BASE}/presets/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        const p = savedPlans.find((x) => x.id === id);
        if (p) p.name = newName;
        renderPresets();
      } else {
        notify("Erro ao renomear.", "error");
      }
    } catch (e) {
      notify("Erro de conexão.", "error");
    }
  }
}

async function deletePreset(id) {
  const confirmed = await showConfirm("Excluir este plano?");
  if (confirmed) {
    try {
      await fetch(`${API_BASE}/presets/${id}`, { method: "DELETE", headers });
      savedPlans = savedPlans.filter((x) => x.id !== id);
      renderPresets();
      notify("Plano excluído!");
    } catch (err) {
      notify("Erro ao excluir", "error");
    }
  }
}

async function saveCurrentAsPreset() {
  const name = prompt("Nome do plano:");
  if (!name) return;
  const p = {
    id: "plan_" + Date.now(),
    name,
    date: new Date().toLocaleDateString(),
    data: { library, planner, themes },
  };
  await fetch(`${API_BASE}/presets`, {
    method: "POST",
    headers,
    body: JSON.stringify(p),
  });
  savedPlans.push(p);
  renderPresets();
  notify("Plano salvo como preset!");
}

function loadPreset(id) {
  const p = savedPlans.find((x) => x.id === id);
  if (p) {
    const data = p.data || {};
    library = data.library ? JSON.parse(JSON.stringify(data.library)) : [];
    planner = data.planner
      ? JSON.parse(JSON.stringify(data.planner))
      : { 1: {}, 2: {}, 3: {}, 4: {} };
    themes = data.themes ? JSON.parse(JSON.stringify(data.themes)) : {};

    // Higieniza dados
    library = library.map((r) => sanitizeRecipe(r));

    // Salva receitas carregadas no banco para não quebrar IDs
    if (library.length > 0) {
      library.forEach(async (r) => {
        await fetch(`${API_BASE}/library`, {
          method: "POST",
          headers,
          body: JSON.stringify(r),
        });
      });
    }

    syncPlanner();
    renderLibrary();
    renderPlanner();
    loadThemesUI();
    switchView("planner");
    notify("Plano carregado!");
  } else {
    notify("Erro: Plano não encontrado.", "error");
  }
}

// --- FUNÇÕES DE PLANNER (PLANEJAMENTO) ---

async function loadPlanner() {
  try {
    const res = await fetch(`${API_BASE}/planner`, { headers });
    if (res.ok) {
      const data = await res.json();
      const loadedPlanner = data.planner_data || {};
      planner = {
        1: loadedPlanner[1] || {},
        2: loadedPlanner[2] || {},
        3: loadedPlanner[3] || {},
        4: loadedPlanner[4] || {},
      };
      themes = data.themes_data || {};
      renderPlanner();
      loadThemesUI();
    }
  } catch (e) {
    console.error("Erro planner", e);
  }
}

function renderPlanner() {
  const b = document.getElementById("planner-body");
  if (!b) return;
  b.innerHTML = "";
  [1, 2, 3, 4].forEach((w) => {
    if (!planner[w]) planner[w] = {};
    let h = `<tr class="hover:bg-slate-50 group"><td class="px-6 py-4 text-sm font-bold text-slate-700 text-center border-r border-slate-200 bg-white group-hover:bg-slate-50 sticky left-0 z-10">Semana ${w}</td>`;
    ["cafe", "almoco", "lanche", "jantar"].forEach((s) => {
      const rid = planner[w][s];
      const r = library.find((x) => x.id === rid);
      if (r) {
        h += `<td class="px-2 py-2 min-w-[140px]"><div onclick="openPicker(${w},'${s}')" class="bg-white border border-blue-200 p-2 md:p-3 rounded-lg shadow-sm cursor-pointer flex items-center gap-2 md:gap-3 group/card relative h-16"><div class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex flex-shrink-0 items-center justify-center text-xs font-bold border border-blue-100"><i class="fa-solid ${
          r.icon || "fa-utensils"
        }"></i></div><span class="font-bold text-xs text-slate-700 truncate w-20 md:w-24">${
          r.name
        }</span><button onclick="clearSlot(${w},'${s}',event)" class="absolute -top-2 -right-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] shadow-sm md:opacity-0 group-hover/card:opacity-100"><i class="fa-solid fa-xmark"></i></button></div></td>`;
      } else {
        h += `<td class="px-2 py-2 min-w-[140px]"><button onclick="openPicker(${w},'${s}')" class="w-full border-2 border-dashed border-slate-200 rounded-lg h-16 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500"><i class="fa-solid fa-plus text-sm mb-1"></i><span class="text-[10px] font-bold uppercase tracking-wide">Add</span></button></td>`;
      }
    });
    b.innerHTML += h + "</tr>";
  });
}

function loadThemesUI() {
  [1, 2, 3, 4].forEach((w) => {
    if (themes[w]) document.getElementById(`theme-w${w}`).value = themes[w];
  });
}
function openPicker(w, s) {
  pickerContext = { w, s };
  document.getElementById("picker-modal").classList.remove("hidden");
  renderPickerList();
  document.getElementById("picker-search").focus();
}
function closePicker() {
  document.getElementById("picker-modal").classList.add("hidden");
}

function renderPickerList() {
  const l = document.getElementById("picker-list");
  const q = document.getElementById("picker-search").value.toLowerCase();
  l.innerHTML = "";
  const filtered = library.filter((r) => r.name.toLowerCase().includes(q));
  if (filtered.length === 0) {
    l.innerHTML =
      '<p class="text-xs text-slate-400 text-center p-4">Nenhuma receita encontrada.</p>';
    return;
  }
  filtered.forEach((r) => {
    l.innerHTML += `<div onclick="assignRecipe('${
      r.id
    }')" class="p-3 hover:bg-blue-50 cursor-pointer rounded-lg flex items-center gap-3 border border-transparent hover:border-blue-100 mb-1 group"><div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-xs group-hover:bg-white group-hover:text-blue-500"><i class="fa-solid ${
      r.icon || "fa-utensils"
    }"></i></div><div><p class="text-sm font-bold text-slate-700 group-hover:text-blue-700">${
      r.name
    }</p></div></div>`;
  });
}

function assignRecipe(id) {
  if (!planner[pickerContext.w]) planner[pickerContext.w] = {};
  planner[pickerContext.w][pickerContext.s] = id;
  syncPlanner();
  closePicker();
  renderPlanner();
}

function clearSlot(w, s, e) {
  e.stopPropagation();
  if (planner[w]) delete planner[w][s];
  syncPlanner();
  renderPlanner();
}

async function syncPlanner() {
  await fetch(`${API_BASE}/planner`, {
    method: "POST",
    headers,
    body: JSON.stringify({ planner, themes }),
  });
}

function saveThemes() {
  [1, 2, 3, 4].forEach(
    (w) => (themes[w] = document.getElementById(`theme-w${w}`).value)
  );
  syncPlanner();
}

// --- UTILITÁRIOS E EXPORTAÇÃO ---

function exportToApp() {
  let d = {};
  [1, 2, 3, 4].forEach((w) => {
    let m = {},
      ml = [];
    ["cafe", "almoco", "lanche", "jantar"].forEach((s) => {
      if (!planner[w]) return;
      const rid = planner[w][s];
      const r = library.find((x) => x.id === rid);
      if (r) {
        m[s] = { name: r.name, ingredients: r.ingredients, steps: r.steps };
        r.ingredients.forEach((i) => {
          let ex = ml.find((x) => x.n.toLowerCase() === i.n.toLowerCase());
          if (ex) ex.q_daily += i.q_daily;
          else ml.push({ ...i, id: i.n.replace(/[^a-z0-9]/g, "") });
        });
      }
    });
    d[w] = {
      headerTitle: `Semana ${w}`,
      headerSubtitle: themes[w] || "",
      meals: m,
      market: ml,
    };
  });
  localStorage.setItem("dietData", JSON.stringify(d));
  notify("Dados publicados para o App Mobile!");
}

function downloadJSON(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sharePreset(id) {
  const p = savedPlans.find((x) => x.id === id);
  if (!p) return;
  const filename = `plano_${p.name
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()}.json`;
  downloadJSON(p, filename);
}

function sanitizeRecipe(r) {
  if (!r.ingredients) r.ingredients = [];
  r.ingredients.forEach((i) => {
    if (i.q_week !== undefined && i.q_daily === undefined)
      i.q_daily = i.q_week / 7;
    i.q_daily = parseFloat(i.q_daily) || 0;
  });
  return r;
}

function formatDisplay(q, u) {
  let val = parseFloat(q);
  if (isNaN(val)) val = 0;
  let unit = (u || "").toLowerCase();
  if (unit === "g" && val >= 1000)
    return { v: (val / 1000).toFixed(2), u: "kg" };
  if (unit === "ml" && val >= 1000)
    return { v: (val / 1000).toFixed(2), u: "l" };
  if (val % 1 !== 0) val = val.toFixed(1);
  return { v: val, u: unit };
}

// --- PREVIEW E IMPORTAÇÃO ---

function openPreview(id) {
  const p = savedPlans.find((x) => x.id === id);
  if (!p) return;
  currentPreviewId = id;
  document.getElementById("preview-title").innerText = p.name;
  document.getElementById("preview-modal").classList.remove("hidden");
  let tabsHtml = `<div class="flex gap-2 mb-6 border-b border-slate-200 pb-1 overflow-x-auto">`;
  [1, 2, 3, 4].forEach((w) => {
    tabsHtml += `<button id="tab-btn-${w}" onclick="switchPreviewTab(${w})" class="px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-transparent text-slate-500 hover:text-blue-500 hover:bg-slate-50 whitespace-nowrap">Semana ${w}</button>`;
  });
  tabsHtml += `</div><div id="preview-tab-content" class="min-h-[300px]"></div>`;
  document.getElementById("preview-content").innerHTML = tabsHtml;
  switchPreviewTab(1);
  document.getElementById("preview-confirm-btn").onclick = () => {
    loadPreset(id);
    closePreview();
  };
}

function switchPreviewTab(w) {
  const p = savedPlans.find((x) => x.id === currentPreviewId);
  if (!p) return;
  [1, 2, 3, 4].forEach((i) => {
    const btn = document.getElementById(`tab-btn-${i}`);
    if (i === w)
      btn.className =
        "px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 border-blue-600 text-blue-600 bg-blue-50/50";
    else
      btn.className =
        "px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50";
  });
  const data = p.data || {};
  const plannerData = data.planner || {};
  const themesData = data.themes || {};
  const libData = data.library || [];
  const theme = themesData[w] || "Sem Tema Definido";
  const config = {
    cafe: {
      color: "border-amber-400",
      bg: "bg-amber-50",
      text: "text-amber-700",
      label: "Café",
      icon: "fa-mug-hot",
    },
    almoco: {
      color: "border-orange-500",
      bg: "bg-orange-50",
      text: "text-orange-700",
      label: "Almoço",
      icon: "fa-utensils",
    },
    lanche: {
      color: "border-pink-400",
      bg: "bg-pink-50",
      text: "text-pink-700",
      label: "Lanche",
      icon: "fa-apple-whole",
    },
    jantar: {
      color: "border-indigo-500",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      label: "Jantar",
      icon: "fa-moon",
    },
  };
  let html = `<div class="animate-fade-in"><div class="mb-6 p-4 bg-slate-800 rounded-xl text-white shadow-lg relative overflow-hidden"><div class="absolute top-0 right-0 p-4 opacity-10"><i class="fa-solid fa-calendar-week text-6xl"></i></div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tema da Semana ${w}</p><h3 class="text-xl font-bold text-white leading-tight">${theme}</h3></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
  ["cafe", "almoco", "lanche", "jantar"].forEach((cat) => {
    const recipeId = plannerData[w]?.[cat];
    const recipe = libData.find((r) => r.id === recipeId);
    const style = config[cat];
    if (recipe) {
      html += `<div class="relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"><div class="absolute left-0 top-4 bottom-4 w-1 rounded-r ${style.color.replace(
        "border-",
        "bg-"
      )}"></div><div class="pl-3"><div class="flex justify-between items-start mb-2"><span class="text-[10px] font-bold uppercase tracking-wider ${
        style.text
      } ${style.bg} px-2 py-0.5 rounded-full">${
        style.label
      }</span><i class="fa-solid ${
        recipe.icon || style.icon
      } text-slate-300 group-hover:text-blue-500 transition-colors"></i></div><h4 class="font-bold text-slate-800 text-sm leading-snug mb-2">${
        recipe.name
      }</h4><p class="text-xs text-slate-400 font-medium">${
        recipe.ingredients ? recipe.ingredients.length : 0
      } ingredientes &bull; ${
        recipe.steps ? recipe.steps.length : 0
      } passos</p></div></div>`;
    } else {
      html += `<div class="bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed flex flex-col justify-center items-center h-full opacity-60"><span class="text-[10px] font-bold uppercase text-slate-400 mb-1">${style.label}</span><span class="text-xs text-slate-300 font-medium">Não planejado</span></div>`;
    }
  });
  html += `</div></div>`;
  document.getElementById("preview-tab-content").innerHTML = html;
}
function closePreview() {
  document.getElementById("preview-modal").classList.add("hidden");
}

// --- IMPORTAÇÃO E IA ---

const TEMPLATE_PLAN = `Atue como um Nutricionista Sênior. Gere um JSON válido com um plano mensal (4 semanas). SEU PERFIL: [PERFIL]. REGRAS: "ingredients" usa "q_daily" em 'g' ou 'ml'. JSON: { "library": [{ "id": "rec_01", "name": "Nome", "cat": "almoco", "icon": "fa-drumstick-bite", "ingredients": [{"n": "Item", "q_daily": 200, "u": "g", "cat": "carnes"}], "steps": ["Passo"] }], "planner": { "1": { "almoco": "rec_01" } }, "themes": { "1": "Tema" } }`;
const TEMPLATE_RECIPE = `Atue como Nutricionista. Gere JSON Array com [QTD] receitas: [PERFIL]. REGRAS: "q_daily" em 'g'/'ml'. JSON: [{ "id": "rec_01", "name": "Nome", "cat": "cafe", "icon": "fa-mug-hot", "ingredients": [{"n": "Item", "q_daily": 200, "u": "g", "cat": "mercearia"}], "steps": ["Passo"] }]`;

function openPromptGen() {
  document.getElementById("prompt-modal").classList.remove("hidden");
  toggleGenInputs();
}
function closePromptGen() {
  document.getElementById("prompt-modal").classList.add("hidden");
}

function toggleGenInputs() {
  const type = document.getElementById("gen-type").value;
  if (type === "recipe") {
    document.getElementById("gen-qty-container").classList.remove("hidden");
    document.getElementById("gen-input-label").innerText = "Tipos";
  } else {
    document.getElementById("gen-qty-container").classList.add("hidden");
    document.getElementById("gen-input-label").innerText = "Seu Perfil";
  }
}

function generatePromptText() {
  const type = document.getElementById("gen-type").value;
  const val = document.getElementById("gen-input").value;
  if (!val) return notify("Preencha os dados", "error");
  let txt =
    type === "plan"
      ? TEMPLATE_PLAN.replace("[PERFIL]", val)
      : TEMPLATE_RECIPE.replace(
          "[QTD]",
          document.getElementById("gen-qty").value
        ).replace("[PERFIL]", val);
  document.getElementById("gen-output").value = txt;
}

function copyPromptText() {
  const txt = document.getElementById("gen-output");
  txt.select();
  txt.setSelectionRange(0, 99999);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(txt.value)
      .then(() => notify("Copiado!"))
      .catch(() => fallbackCopy());
  } else fallbackCopy();
  function fallbackCopy() {
    document.execCommand("copy");
    notify("Copiado!");
  }
}

function openImportModal(type) {
  currentImportType = type;
  document.getElementById("import-title").innerText =
    type === "plan" ? "Importar Plano" : "Importar Receitas";
  document.getElementById("import-text").value = "";
  document.getElementById("import-modal").classList.remove("hidden");
}
function closeImportModal() {
  document.getElementById("import-modal").classList.add("hidden");
}

function loadFileContent(input) {
  const f = input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (e) => {
    document.getElementById("import-text").value = e.target.result;
  };
  r.readAsText(f);
  input.value = "";
}

function processImport() {
  try {
    let text = document.getElementById("import-text").value.trim();
    if (!text.startsWith("{") && !text.startsWith("[")) {
      const s = text.search(/[\{\[]/);
      if (s !== -1) text = text.substring(s);
      const l = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
      if (l !== -1) text = text.substring(0, l + 1);
    }
    let json = JSON.parse(text);
    if (currentImportType === "plan") {
      let p = {};
      if (json.data && json.data.library) {
        p = json;
        p.id = "plan_imp_" + Date.now();
        p.name = (p.name || "Importado") + " (Cópia)";
      } else {
        p = {
          id: "plan_ia_" + Date.now(),
          name: prompt("Nome do Plano:") || "Importado",
          date: new Date().toLocaleDateString(),
          data: {
            library: json.library || [],
            planner: json.planner || {},
            themes: json.themes || {},
          },
        };
      }
      fetch(`${API_BASE}/presets`, {
        method: "POST",
        headers,
        body: JSON.stringify(p),
      }).then(() => {
        savedPlans.push(p);
        renderPresets();
        notify("Plano Importado!");
        closeImportModal();
      });
    } else {
      let list = [];
      if (Array.isArray(json)) list = json;
      else if (json.library && Array.isArray(json.library)) list = json.library;
      else if (
        json.data &&
        json.data.library &&
        Array.isArray(json.data.library)
      )
        list = json.data.library;
      if (list.length === 0) return notify("JSON vazio ou inválido", "error");
      let count = 0;
      const promises = list.map(async (r) => {
        count++;
        const cleanRecipe = sanitizeRecipe(r);
        return await fetch(`${API_BASE}/library`, {
          method: "POST",
          headers,
          body: JSON.stringify(cleanRecipe),
        });
      });
      Promise.all(promises).then(() => {
        loadLibrary();
        notify(`${count} receitas importadas!`);
        closeImportModal();
      });
    }
  } catch (e) {
    console.error(e);
    notify("Erro no JSON: " + e.message, "error");
  }
}

// --- MODAL DE RECEITA ---

function openRecipeModal(id) {
  document.getElementById("recipe-modal").classList.remove("hidden");
  document.getElementById("edit-id").value = id || "";
  document.getElementById("rec-ingredients").innerHTML = "";
  document.getElementById("rec-steps").innerHTML = "";

  const iconSelect = document.getElementById("rec-icon");
  if (iconSelect) {
    iconSelect.innerHTML = "";
    ICON_OPTIONS.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.val;
      option.textContent = opt.label;
      iconSelect.appendChild(option);
    });
  }

  const r = id
    ? library.find((x) => x.id === id)
    : {
        name: "",
        cat: "almoco",
        icon: "fa-utensils",
        ingredients: [],
        steps: [],
      };

  document.getElementById("rec-name").value = r.name;
  document.getElementById("rec-cat").value = r.cat;

  const iconExists = ICON_OPTIONS.some((i) => i.val === r.icon);
  document.getElementById("rec-icon").value = iconExists
    ? r.icon
    : "fa-utensils";

  if (r.ingredients)
    r.ingredients.forEach((i) => {
      addRecLine();
      const l = document.getElementById("rec-ingredients").lastElementChild;
      l.querySelector(".i-n").value = i.n;
      const f = formatDisplay(i.q_daily, i.u);
      l.querySelector(".i-q").value = f.v;
      l.querySelector(".i-u").value = f.u;
      l.querySelector(".i-c").value = i.cat || "mercearia";
    });

  if (r.steps)
    r.steps.forEach((s) => {
      addStepLine();
      document
        .getElementById("rec-steps")
        .lastElementChild.querySelector("textarea").value = s;
    });

  if (!id) {
    addRecLine();
    addStepLine();
  }
}

function closeModal() {
  document.getElementById("recipe-modal").classList.add("hidden");
}

const tplIngRow = `<div class="grid grid-cols-1 md:grid-cols-12 gap-2 ing-row items-center mb-2 bg-slate-50 p-2 rounded"><div class="md:col-span-5"><input type="text" placeholder="Item" class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm i-n"></div><div class="grid grid-cols-3 gap-2 md:col-span-6"><input type="number" placeholder="0" class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center i-q"><input type="text" placeholder="un" class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center i-u"><select class="w-full bg-white border border-slate-200 rounded px-1 py-1 text-xs i-c"><option value="carnes">Carnes</option><option value="horti">Horti</option><option value="mercearia">Merc.</option><option value="outros">Out.</option></select></div><div class="md:col-span-1 text-center"><button onclick="this.closest('.ing-row').remove()" class="text-red-400"><i class="fa-solid fa-xmark"></i></button></div></div>`;

function addRecLine() {
  document
    .getElementById("rec-ingredients")
    .insertAdjacentHTML("beforeend", tplIngRow);
}

function addStepLine() {
  document
    .getElementById("rec-steps")
    .insertAdjacentHTML(
      "beforeend",
      `<div class="flex gap-2 mb-2"><textarea class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm h-12 s-txt" placeholder="Passo..."></textarea><button onclick="this.parentElement.remove()" class="text-red-400"><i class="fa-solid fa-trash"></i></button></div>`
    );
}
