// --- CONFIGURAÇÃO INTELIGENTE DA API ---
const IS_DEV =
  window.location.port === "5500" || window.location.port === "8080";
const API_BASE = IS_DEV
  ? `http://${window.location.hostname}:3000/api`
  : "/api";
const AUTH_URL = IS_DEV
  ? `http://${window.location.hostname}:3000/auth`
  : "/auth";

console.log(`🔌 Conectando API em: ${API_BASE}`);

/* ============================================================
   SISTEMA DE NOTIFICAÇÃO & CONFIRMAÇÃO (UI MODERN)
   ============================================================ */

function notify(text, type = "success") {
  const bg = type === "error" ? "#ef4444" : "#22c55e";
  Toastify({
    text: text,
    duration: 3000,
    gravity: "top",
    position: "center",
    style: {
      background: bg,
      borderRadius: "50px",
      padding: "8px 16px",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      fontWeight: "600",
      fontSize: "12px",
      textAlign: "center",
    },
    stopOnFocus: true,
  }).showToast();
}

window.alert = function (msg) {
  const isError =
    msg &&
    (msg.toLowerCase().includes("erro") ||
      msg.toLowerCase().includes("preencha"));
  notify(msg, isError ? "error" : "success");
};

let confirmResolver = null;
function showConfirm(text) {
  const modal = document.getElementById("confirm-modal");
  const msg = document.getElementById("confirm-msg");
  if (msg) msg.innerText = text || "Essa ação não pode ser desfeita.";
  if (modal) modal.classList.remove("hidden");
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

window.resolveConfirm = function (result) {
  const modal = document.getElementById("confirm-modal");
  if (modal) modal.classList.add("hidden");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
};

// --- HELPER: COMPARAÇÃO DE INGREDIENTES ---
function areIngredientsSame(ing1, ing2) {
  if (!ing1 && !ing2) return true;
  if (!ing1 || !ing2) return false;
  if (ing1.length !== ing2.length) return false;

  // Ordena para garantir comparação correta
  const s1 = [...ing1].sort((a, b) => a.n.localeCompare(b.n));
  const s2 = [...ing2].sort((a, b) => a.n.localeCompare(b.n));

  for (let i = 0; i < s1.length; i++) {
    if (s1[i].n.toLowerCase() !== s2[i].n.toLowerCase()) return false;
    if (parseFloat(s1[i].q_daily) !== parseFloat(s2[i].q_daily)) return false;
    if (s1[i].u !== s2[i].u) return false;
  }
  return true;
}

const ICON_OPTIONS = [
  { val: "fa-utensils", label: "Geral" },
  { val: "fa-mug-hot", label: "Café" },
  { val: "fa-bread-slice", label: "Pão" },
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

const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";
const user = JSON.parse(localStorage.getItem("user")) || {};
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

let library = [];
let planner = { 1: {}, 2: {}, 3: {}, 4: {} };
let themes = {};
let savedPlans = [];
let pickerContext = null;
let currentImportType = "";
let currentPreviewId = null;
let selectedRecipes = new Set();

const TEMPLATE_PLAN = `Atue como um Nutricionista. Gere JSON válido (4 semanas). PERFIL: [PERFIL]. REGRAS: "q_daily" em 'g'/'ml'. JSON: { "library": [{ "id": "rec_01", "name": "Nome", "cat": "almoco", "icon": "fa-drumstick-bite", "ingredients": [{"n": "Item", "q_daily": 200, "u": "g", "cat": "carnes"}], "steps": ["Passo"] }], "planner": { "1": { "almoco": "rec_01" } }, "themes": { "1": "Tema" } }`;
const TEMPLATE_RECIPE = `Atue como Nutricionista. Gere JSON Array com [QTD] receitas: [PERFIL]. REGRAS: "q_daily" em 'g'/'ml'. JSON: [{ "id": "rec_01", "name": "Nome", "cat": "cafe", "icon": "fa-mug-hot", "ingredients": [{"n": "Item", "q_daily": 200, "u": "g", "cat": "mercearia"}], "steps": ["Passo"] }]`;

window.onload = async function () {
  if (user.is_owner === 1) {
    const nav = document.querySelector("aside nav");
    if (nav) {
      const ownerBtn = document.createElement("a");
      ownerBtn.href = "owner.html";
      ownerBtn.className =
        "flex items-center w-full px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors mb-4 shadow-lg shadow-red-200 animate-pulse";
      ownerBtn.innerHTML =
        '<i class="fa-solid fa-user-shield w-4 mr-2"></i> Painel do Dono';
      nav.prepend(ownerBtn);
    }
  }

  const btnOpen = document.getElementById("btn-open-sidebar");
  const btnClose = document.getElementById("btn-close-sidebar");
  const overlay = document.getElementById("mobile-overlay");
  if (btnOpen) btnOpen.onclick = toggleSidebar;
  if (btnClose) btnClose.onclick = toggleSidebar;
  if (overlay) overlay.onclick = toggleSidebar;

  try {
    await Promise.all([loadLibrary(), loadPlanner(), loadPresets()]);
  } catch (e) {
    console.error("Erro conexão:", e);
    if (e && e.status === 401) logout();
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("action") === "gen") {
    openPromptGen();
    switchView("presets");
  } else if (params.get("view") === "library") switchView("library");
  else switchView("presets");
};

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("mobile-overlay");
  if (sb) sb.classList.toggle("-translate-x-full");
  if (ov) ov.classList.toggle("hidden");
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// --- API ---
async function loadLibrary() {
  try {
    const res = await fetch(`${API_BASE}/library`, { headers });
    if (res.ok) library = await res.json();
    renderLibrary();
  } catch (e) {
    console.error("Erro library", e);
  }
}

async function loadPlanner() {
  try {
    const res = await fetch(`${API_BASE}/planner`, { headers });
    if (res.ok) {
      const data = await res.json();
      const ld = data.planner_data || {};
      planner = {
        1: ld[1] || {},
        2: ld[2] || {},
        3: ld[3] || {},
        4: ld[4] || {},
      };
      themes = data.themes_data || {};
      renderPlanner();
      loadThemesUI();
    }
  } catch (e) {
    console.error("Erro planner", e);
  }
}

async function loadPresets() {
  try {
    const res = await fetch(`${API_BASE}/presets`, { headers });
    if (res.ok) savedPlans = await res.json();
    renderPresets();
  } catch (e) {
    console.error("Erro presets", e);
  }
}

// --- LÓGICA & UI: BIBLIOTECA ---

function renderLibrary() {
  const g = document.getElementById("recipe-grid");
  g.innerHTML = "";
  const term =
    document.getElementById("library-search")?.value.toLowerCase() || "";
  const filtered = library.filter(
    (r) =>
      r.name.toLowerCase().includes(term) || r.cat.toLowerCase().includes(term)
  );

  if (filtered.length === 0) {
    document.getElementById("empty-library").classList.remove("hidden");
    return;
  }
  document.getElementById("empty-library").classList.add("hidden");

  filtered.forEach((r) => {
    const isSelected = selectedRecipes.has(r.id);
    const cardHtml = `
        <div class="bg-white border ${
          isSelected
            ? "border-indigo-500 ring-1 ring-indigo-500"
            : "border-slate-200"
        } rounded-lg p-3 hover:shadow-md relative group transition-all cursor-pointer" onclick="openRecipeModal('${
      r.id
    }')">
            <div class="flex justify-between mb-2">
                <div class="flex items-center gap-2">
                    <div onclick="event.stopPropagation(); toggleRecipeSelection('${
                      r.id
                    }')" 
                         class="w-6 h-6 rounded cursor-pointer flex items-center justify-center transition-colors ${
                           isSelected
                             ? "bg-indigo-600 text-white"
                             : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                         }">
                        <i class="fa-solid fa-check text-[10px]"></i>
                    </div>
                    <span class="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                        <i class="fa-solid ${r.icon || "fa-utensils"}"></i>
                    </span>
                </div>
                <div class="flex gap-1">
                    <button onclick="deleteRecipe('${
                      r.id
                    }', event)" class="text-slate-300 hover:text-red-500 p-1 delete-btn text-xs">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <h4 class="font-bold text-slate-700 text-xs mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors" title="${
              r.name
            }">${r.name}</h4>
            <span class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase font-bold tracking-wide">${
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
  const btnExport = document.getElementById("btn-export-selected");
  const btnDelete = document.getElementById("btn-delete-selected");
  const countExp = document.getElementById("count-selected");
  const countDel = document.getElementById("count-delete-selected");

  if (selectedRecipes.size > 0) {
    if (btnExport) {
      btnExport.classList.remove("hidden");
      btnExport.classList.add("flex");
      countExp.innerText = selectedRecipes.size;
    }
    if (btnDelete) {
      btnDelete.classList.remove("hidden");
      btnDelete.classList.add("flex");
      if (countDel) countDel.innerText = selectedRecipes.size;
    }
  } else {
    if (btnExport) {
      btnExport.classList.add("hidden");
      btnExport.classList.remove("flex");
    }
    if (btnDelete) {
      btnDelete.classList.add("hidden");
      btnDelete.classList.remove("flex");
    }
  }
}

function exportSelectedRecipes() {
  if (selectedRecipes.size === 0) return;
  const exportData = library.filter((r) => selectedRecipes.has(r.id));
  downloadJSON(exportData, `receitas_${new Date().getTime()}.json`);
  selectedRecipes.clear();
  renderLibrary();
  notify(`${exportData.length} exportadas!`);
}

async function deleteSelectedRecipes() {
  if (selectedRecipes.size === 0) return;
  const count = selectedRecipes.size;
  const confirmed = await showConfirm(`Apagar ${count} receitas selecionadas?`);
  if (confirmed) {
    notify("Excluindo...", "success");
    const ids = Array.from(selectedRecipes);
    await Promise.all(
      ids.map(async (id) => {
        try {
          await fetch(`${API_BASE}/library/${id}`, {
            method: "DELETE",
            headers,
          });
          const idx = library.findIndex((r) => r.id === id);
          if (idx !== -1) library.splice(idx, 1);
        } catch (e) {
          console.error(e);
        }
      })
    );
    selectedRecipes.clear();
    renderLibrary();
    syncPlanner(); // Remove do planner se estiverem lá
    renderPlanner();
    notify(`${count} excluídas!`);
  }
}

function downloadAllRecipes() {
  downloadJSON(library, `backup_full.json`);
}

// --- UI: PLANOS ---

function renderPresets() {
  const g = document.getElementById("presets-grid");
  g.innerHTML = "";
  if (savedPlans.length === 0) {
    document.getElementById("empty-presets").classList.remove("hidden");
    return;
  }
  document.getElementById("empty-presets").classList.add("hidden");

  savedPlans.forEach((p) => {
    g.innerHTML += `
        <div class="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all relative group flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-start mb-1">
                    <h3 class="font-bold text-slate-800 text-sm leading-tight line-clamp-2 pr-2" title="${
                      p.name
                    }">${p.name}</h3>
                    <div class="flex gap-1 ml-1 shrink-0">
                        <button onclick="renamePreset('${p.id}', '${
      p.name
    }')" class="text-slate-300 hover:text-blue-500 p-1 text-xs"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="sharePreset('${
                          p.id
                        }')" class="text-slate-300 hover:text-green-500 p-1 text-xs"><i class="fa-solid fa-share-nodes"></i></button>
                        <button onclick="deletePreset('${
                          p.id
                        }')" class="text-slate-300 hover:text-red-500 p-1 text-xs"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p class="text-[10px] text-slate-400 font-medium mb-2"><i class="fa-regular fa-calendar mr-1"></i>${
                  p.date || "Hoje"
                }</p>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-auto">
                <button onclick="openPreview('${
                  p.id
                }')" class="w-full py-1.5 text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded">Detalhes</button>
                <button onclick="loadPreset('${
                  p.id
                }')" class="w-full py-1.5 text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-900 rounded shadow-sm">Carregar</button>
            </div>
        </div>`;
  });
}

function sharePreset(id) {
  const p = savedPlans.find((x) => x.id === id);
  if (p) downloadJSON(p, `plano_${p.name.replace(/[^a-z0-9]/gi, "_")}.json`);
}

async function renamePreset(id, currentName) {
  const newName = prompt("Novo nome:", currentName);
  if (newName && newName !== currentName) {
    await fetch(`${API_BASE}/presets/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ name: newName }),
    });
    const p = savedPlans.find((x) => x.id === id);
    if (p) p.name = newName;
    renderPresets();
  }
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

// --- CRUD ---

async function saveRecipeToLibrary() {
  const id = document.getElementById("edit-id").value || "rec_" + Date.now();
  const name = document.getElementById("rec-name").value;
  if (!name) return notify("Nome obrigatório", "error");

  const ings = [];
  document.querySelectorAll(".ing-row").forEach((r) => {
    const n = r.querySelector(".i-n").value;
    if (n) {
      let q = parseFloat(r.querySelector(".i-q").value) || 0;
      let u = r.querySelector(".i-u").value.toLowerCase();
      if (u === "kg") {
        q *= 1000;
        u = "g";
      } else if (u === "l") {
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
  renderPlanner();
  notify("Salvo!");
}

async function deleteRecipe(id, e) {
  if (e) e.stopPropagation();
  const confirmed = await showConfirm("Excluir definitivamente?");
  if (confirmed) {
    try {
      await fetch(`${API_BASE}/library/${id}`, { method: "DELETE", headers });
      library = library.filter((x) => x.id !== id);
      if (selectedRecipes.has(id)) {
        selectedRecipes.delete(id);
        updateExportButton();
      }
      renderLibrary();
      renderPlanner(); // Atualiza planner para remover referências
      notify("Excluída!");
    } catch (err) {
      notify("Erro ao excluir", "error");
    }
  }
}

async function syncPlanner() {
  await fetch(`${API_BASE}/planner`, {
    method: "POST",
    headers,
    body: JSON.stringify({ planner, themes }),
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

function saveThemes() {
  [1, 2, 3, 4].forEach(
    (w) => (themes[w] = document.getElementById(`theme-w${w}`).value)
  );
  syncPlanner();
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
  notify("Salvo!");
}

async function deletePreset(id) {
  if (await showConfirm("Excluir plano?")) {
    await fetch(`${API_BASE}/presets/${id}`, { method: "DELETE", headers });
    savedPlans = savedPlans.filter((x) => x.id !== id);
    renderPresets();
    notify("Excluído!");
  }
}

// --- UTILS ---
function formatDisplay(q, u) {
  let val = parseFloat(q) || 0;
  let unit = (u || "").toLowerCase();
  if (unit === "g" && val >= 1000)
    return { v: (val / 1000).toFixed(2), u: "kg" };
  if (unit === "ml" && val >= 1000)
    return { v: (val / 1000).toFixed(2), u: "l" };
  if (val % 1 !== 0) val = val.toFixed(1);
  return { v: val, u: unit };
}

function switchView(v) {
  ["library", "planner", "presets"].forEach((x) =>
    document.getElementById(`view-${x}`).classList.add("hidden")
  );
  document.getElementById(`view-${v}`).classList.remove("hidden");
  ["nav-library", "nav-planner", "nav-presets"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isActive = id === `nav-${v}`;
    btn.className = isActive
      ? "flex items-center w-full px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg shadow-sm mb-1 border border-blue-100"
      : "flex items-center w-full px-3 py-2 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors mb-1";
    const icon = btn.querySelector("i");
    if (icon) {
      icon.classList.remove("text-blue-600", "text-slate-400");
      icon.classList.add(isActive ? "text-blue-600" : "text-slate-400");
    }
  });
  const sb = document.getElementById("sidebar");
  if (
    sb &&
    !sb.classList.contains("-translate-x-full") &&
    window.innerWidth < 768
  )
    toggleSidebar();
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

// --- CARREGAMENTO INTELIGENTE (MESCLAGEM) ---
async function loadPreset(id) {
  const p = savedPlans.find((x) => x.id === id);
  if (!p) return notify("Erro: Plano não encontrado.", "error");

  const data = p.data || {};
  const planLibrary = data.library
    ? JSON.parse(JSON.stringify(data.library))
    : [];
  let planPlanner = data.planner
    ? JSON.parse(JSON.stringify(data.planner))
    : {};
  themes = data.themes ? JSON.parse(JSON.stringify(data.themes)) : {};

  notify("Mesclando receitas...", "success");
  const idMapping = {};

  // Mesclagem Inteligente
  for (let r of planLibrary) {
    r = sanitizeRecipe(r);
    const originalId = r.id;
    let finalId = originalId;

    const existingRecipe = library.find(
      (ex) => ex.name.toLowerCase() === r.name.toLowerCase()
    );

    if (existingRecipe) {
      if (areIngredientsSame(existingRecipe.ingredients, r.ingredients)) {
        // IGUAL: Reutiliza
        finalId = existingRecipe.id;
      } else {
        // VARIAÇÃO: Cria nova
        finalId =
          "rec_var_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 5);
        const newRec = { ...r, id: finalId, name: r.name + " (Variação)" };
        await fetch(`${API_BASE}/library`, {
          method: "POST",
          headers,
          body: JSON.stringify(newRec),
        });
        library.push(newRec);
      }
    } else {
      // NOVA: Cria
      const idExists = library.find((ex) => ex.id === finalId);
      if (idExists)
        finalId =
          "rec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      const newRec = { ...r, id: finalId };
      await fetch(`${API_BASE}/library`, {
        method: "POST",
        headers,
        body: JSON.stringify(newRec),
      });
      library.push(newRec);
    }
    if (originalId !== finalId) idMapping[originalId] = finalId;
  }

  // Atualiza IDs no planner
  for (let w in planPlanner) {
    for (let meal in planPlanner[w]) {
      const oldId = planPlanner[w][meal];
      if (idMapping[oldId]) planPlanner[w][meal] = idMapping[oldId];
    }
  }

  planner = planPlanner;
  syncPlanner();
  renderLibrary();
  renderPlanner();
  loadThemesUI();
  switchView("planner");
  notify("Plano carregado e mesclado!");
}

function renderPlanner() {
  const b = document.getElementById("planner-body");
  if (!b) return;
  b.innerHTML = "";
  [1, 2, 3, 4].forEach((w) => {
    if (!planner[w]) planner[w] = {};
    let h = `<tr class="hover:bg-slate-50 group"><td class="px-3 py-3 text-xs font-bold text-slate-700 text-center border-r border-slate-200 bg-white group-hover:bg-slate-50 sticky left-0 z-10 w-12">Sem ${w}</td>`;
    ["cafe", "almoco", "lanche", "jantar"].forEach((s) => {
      const rid = planner[w][s];
      const r = library.find((x) => x.id === rid);
      if (r) {
        h += `<td class="px-2 py-2 min-w-[100px]"><div onclick="openPicker(${w},'${s}')" class="bg-white border border-blue-200 p-1.5 rounded shadow-sm cursor-pointer flex items-center gap-2 group/card relative h-10"><div class="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex flex-shrink-0 items-center justify-center text-[9px] font-bold border border-blue-100"><i class="fa-solid ${
          r.icon || "fa-utensils"
        }"></i></div><span class="font-bold text-[9px] text-slate-700 truncate w-16">${
          r.name
        }</span><button onclick="clearSlot(${w},'${s}',event)" class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[8px] shadow-sm md:opacity-0 group-hover/card:opacity-100"><i class="fa-solid fa-xmark"></i></button></div></td>`;
      } else {
        h += `<td class="px-2 py-2 min-w-[100px]"><button onclick="openPicker(${w},'${s}')" class="w-full border border-dashed border-slate-300 rounded h-10 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500"><i class="fa-solid fa-plus text-[10px]"></i></button></td>`;
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
      '<p class="text-xs text-slate-400 text-center p-2">Nada...</p>';
    return;
  }
  filtered.forEach((r) => {
    l.innerHTML += `<div onclick="assignRecipe('${
      r.id
    }')" class="p-2 hover:bg-blue-50 cursor-pointer rounded flex items-center gap-2 border border-transparent hover:border-blue-100 mb-1 group"><div class="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] group-hover:bg-white group-hover:text-blue-500"><i class="fa-solid ${
      r.icon || "fa-utensils"
    }"></i></div><div><p class="text-[10px] font-bold text-slate-700 group-hover:text-blue-700">${
      r.name
    }</p></div></div>`;
  });
}

// --- PREVIEW ---
function openPreview(id) {
  const p = savedPlans.find((x) => x.id === id);
  if (!p) return;
  currentPreviewId = id;
  document.getElementById("preview-title").innerText = p.name;
  document.getElementById("preview-modal").classList.remove("hidden");
  let tabsHtml = `<div class="flex gap-2 mb-3 border-b border-slate-200 pb-1 overflow-x-auto">`;
  [1, 2, 3, 4].forEach((w) => {
    tabsHtml += `<button id="tab-btn-${w}" onclick="switchPreviewTab(${w})" class="px-3 py-1.5 text-[10px] font-bold rounded-t transition-colors border-b-2 border-transparent text-slate-500 hover:text-blue-500 hover:bg-slate-50 whitespace-nowrap">Sem ${w}</button>`;
  });
  tabsHtml += `</div><div id="preview-tab-content" class="min-h-[200px]"></div>`;
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
        "px-3 py-1.5 text-[10px] font-bold rounded-t border-b-2 border-blue-600 text-blue-600 bg-blue-50/50";
    else
      btn.className =
        "px-3 py-1.5 text-[10px] font-bold rounded-t border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50";
  });
  const data = p.data || {};
  const plannerData = data.planner || {};
  const themesData = data.themes || {};
  const libData = data.library || [];
  const theme = themesData[w] || "Sem Tema";
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
  let html = `<div class="animate-fade-in"><div class="mb-3 p-3 bg-slate-800 rounded-lg text-white shadow relative overflow-hidden"><p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Semana ${w}</p><h3 class="text-sm font-bold text-white leading-tight">${theme}</h3></div><div class="grid grid-cols-1 md:grid-cols-2 gap-2">`;
  ["cafe", "almoco", "lanche", "jantar"].forEach((cat) => {
    const recipeId = plannerData[w]?.[cat];
    const recipe = libData.find((r) => r.id === recipeId);
    const style = config[cat];
    if (recipe) {
      html += `<div class="relative bg-white p-2 rounded-lg border border-slate-200 shadow-sm"><div class="absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${style.color.replace(
        "border-",
        "bg-"
      )}"></div><div class="pl-2"><div class="flex justify-between items-start mb-0.5"><span class="text-[8px] font-bold uppercase tracking-wider ${
        style.text
      } ${style.bg} px-1.5 py-0.5 rounded-full">${
        style.label
      }</span><i class="fa-solid ${
        recipe.icon || style.icon
      } text-slate-300 text-[10px]"></i></div><h4 class="font-bold text-slate-800 text-[10px] leading-snug mb-0.5">${
        recipe.name
      }</h4><p class="text-[8px] text-slate-400 font-medium">${
        recipe.ingredients ? recipe.ingredients.length : 0
      } ing</p></div></div>`;
    } else {
      html += `<div class="bg-slate-50 p-2 rounded-lg border border-slate-200 border-dashed flex flex-col justify-center items-center h-full opacity-60"><span class="text-[8px] font-bold uppercase text-slate-400">${style.label}</span></div>`;
    }
  });
  html += `</div></div>`;
  document.getElementById("preview-tab-content").innerHTML = html;
}
function closePreview() {
  document.getElementById("preview-modal").classList.add("hidden");
}

// --- OUTROS ---
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
  notify("Dados App OK!");
}
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
  if (!val) return notify("Preencha!", "error");
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
  navigator.clipboard.writeText(txt.value).then(() => notify("Copiado!"));
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
        p.name = (p.name || "Import") + " (Cópia)";
      } else {
        p = {
          id: "plan_ia_" + Date.now(),
          name: prompt("Nome:") || "Importado",
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
        notify("Plano OK!");
        closeImportModal();
      });
    } else {
      let list = Array.isArray(json) ? json : json.library || [];
      if (list.length === 0) return notify("Vazio!", "error");
      let count = 0;
      Promise.all(
        list.map(async (r) => {
          count++;
          await fetch(`${API_BASE}/library`, {
            method: "POST",
            headers,
            body: JSON.stringify(sanitizeRecipe(r)),
          });
        })
      ).then(() => {
        loadLibrary();
        notify(`${count} importadas!`);
        closeImportModal();
      });
    }
  } catch (e) {
    notify("JSON Inválido", "error");
  }
}

function openRecipeModal(id) {
  document.getElementById("recipe-modal").classList.remove("hidden");
  document.getElementById("edit-id").value = id || "";
  document.getElementById("rec-ingredients").innerHTML = "";
  document.getElementById("rec-steps").innerHTML = "";

  const iconSelect = document.getElementById("rec-icon");
  if (iconSelect) {
    iconSelect.innerHTML = "";
    ICON_OPTIONS.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.val;
      o.textContent = opt.label;
      iconSelect.appendChild(o);
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
  document.getElementById("rec-icon").value = ICON_OPTIONS.some(
    (i) => i.val === r.icon
  )
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
const tplIngRow = `<div class="grid grid-cols-1 md:grid-cols-12 gap-2 ing-row items-center mb-1 bg-slate-50 p-1.5 rounded"><div class="md:col-span-5"><input type="text" placeholder="Item" class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs i-n"></div><div class="grid grid-cols-3 gap-1 md:col-span-6"><input type="number" placeholder="0" class="w-full bg-white border border-slate-200 rounded px-1 py-1 text-xs text-center i-q"><input type="text" placeholder="un" class="w-full bg-white border border-slate-200 rounded px-1 py-1 text-xs text-center i-u"><select class="w-full bg-white border border-slate-200 rounded px-0 py-1 text-[10px] i-c"><option value="carnes">Carnes</option><option value="horti">Horti</option><option value="mercearia">Merc.</option><option value="outros">Out.</option></select></div><div class="md:col-span-1 text-center"><button onclick="this.closest('.ing-row').remove()" class="text-red-400 text-xs"><i class="fa-solid fa-xmark"></i></button></div></div>`;
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
      `<div class="flex gap-2 mb-1"><textarea class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs h-8 s-txt" placeholder="Passo..."></textarea><button onclick="this.parentElement.remove()" class="text-red-400 text-xs"><i class="fa-solid fa-trash"></i></button></div>`
    );
}
