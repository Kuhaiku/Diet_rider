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

const defaultData = {
  1: {
    headerTitle: "Bem-vindo",
    headerSubtitle: "Aguardando dados...",
    meals: {},
    market: [],
  },
};
let weeksData = {};
let state = {
  week: 1,
  selectedMeal: "almoco",
  mode: "week",
  marketFilter: "all",
  prices: JSON.parse(localStorage.getItem("pricesV23")) || {},
  checks: JSON.parse(localStorage.getItem("checksV23")) || {},
};
const categories = {
  carnes: {
    label: "Açougue",
    icon: "fa-drumstick-bite",
    color: "text-red-600",
    bg: "bg-red-50",
  },
  horti: {
    label: "Hortifruti",
    icon: "fa-carrot",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  mercearia: {
    label: "Mercearia",
    icon: "fa-jar",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  outros: {
    label: "Outros",
    icon: "fa-box-open",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
};

function init() {
  const stored = localStorage.getItem("dietData");
  weeksData = stored ? JSON.parse(stored) : defaultData;
  setMode("day");
  nav("diet", 1);
}

function formatDisplay(q, u) {
  let val = parseFloat(q);
  let unit = u.toLowerCase();
  if (unit === "g" && val >= 1000) {
    return { v: val / 1000, u: "kg" };
  }
  if (unit === "ml" && val >= 1000) {
    return { v: val / 1000, u: "l" };
  }
  return { v: val, u: unit };
}

function setMode(m) {
  state.mode = m;
  const btnDay = document.getElementById("mode-day");
  const btnWeek = document.getElementById("mode-week");
  if (m === "day") {
    btnDay.className =
      "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all bg-blue-600 text-white shadow";
    btnWeek.className =
      "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all text-blue-600 hover:bg-blue-50";
  } else {
    btnWeek.className =
      "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all bg-blue-600 text-white shadow";
    btnDay.className =
      "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all text-blue-600 hover:bg-blue-50";
  }
  renderDetails();
  renderMarket();
}

function nav(view, val) {
  if (window.innerWidth < 768) {
    const sb = document.getElementById("sidebar");
    if (!sb.classList.contains("-translate-x-full")) toggleSidebar();
  }
  document.querySelectorAll("aside button").forEach((b) => {
    if (b.id.startsWith("nav-"))
      b.className =
        "w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors inactive-nav text-sm font-medium";
    if (b.id === "nav-market")
      b.className += " group flex items-center justify-between text-slate-600";
  });
  if (view === "diet") {
    state.week = val;
    document.getElementById(`nav-w${val}`).className =
      "w-full text-left px-4 py-3 rounded-lg bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-bold text-sm transition-colors";
    document.getElementById("view-diet").classList.remove("hidden");
    document.getElementById("view-market").classList.add("hidden");
    const wd = weeksData[val] || {
      headerTitle: `Semana ${val}`,
      headerSubtitle: "Sem dados",
    };
    document.getElementById("diet-subtitle").innerText = wd.headerTitle;
    document.getElementById("diet-desc").innerText = wd.headerSubtitle;
    const mainMeal =
      wd.meals && wd.meals.almoco ? wd.meals.almoco.name : "Cardápio da Semana";
    document.getElementById("diet-title").innerText = mainMeal;
    selectMeal(state.selectedMeal);
  } else {
    state.marketFilter = "all";
    document.getElementById("nav-market").className =
      "w-full text-left px-4 py-3 rounded-lg bg-green-50 text-green-800 border-l-4 border-green-600 font-bold text-sm transition-colors group flex items-center justify-between";
    document.getElementById("view-diet").classList.add("hidden");
    document.getElementById("view-market").classList.remove("hidden");
    setMarketFilter("all");
  }
}

function selectMeal(type) {
  state.selectedMeal = type;
  ["cafe", "almoco", "lanche", "jantar"].forEach((c) => {
    const el = document.getElementById(`card-${c}`);
    if (c === type)
      el.className =
        "meal-card meal-active bg-white p-3 rounded-xl flex flex-col md:flex-row gap-3 items-center text-center md:text-left cursor-pointer transform scale-105";
    else
      el.className =
        "meal-card bg-white p-3 rounded-xl flex flex-col md:flex-row gap-3 items-center text-center md:text-left cursor-pointer opacity-70 hover:opacity-100";
  });
  renderDetails();
}

function renderDetails() {
  const week = weeksData[state.week] || {};
  const meal =
    week.meals && week.meals[state.selectedMeal]
      ? week.meals[state.selectedMeal]
      : null;
  const titleEl = document.getElementById("detail-title");
  const listIng = document.getElementById("ingredient-list");
  const listStep = document.getElementById("step-list");

  if (!meal) {
    titleEl.innerText = "Refeição não planejada";
    listIng.innerHTML =
      "<p class='text-sm text-slate-400'>Nenhum ingrediente cadastrado.</p>";
    listStep.innerHTML = "";
    return;
  }

  titleEl.innerText = meal.name;
  document.getElementById("detail-subtitle").innerText =
    state.mode === "week"
      ? "Ingredientes para 7 dias"
      : "Ingredientes para hoje (1 dia)";

  listIng.innerHTML = (meal.ingredients || [])
    .map((i) => {
      let dailyQty = parseFloat(i.q_daily || i.q_week || 0);
      let unit = i.u ? i.u.toLowerCase() : "";
      let finalQty = state.mode === "week" ? dailyQty * 7 : dailyQty;

      let fmt = formatDisplay(finalQty, unit);
      let displayVal = Number.isInteger(fmt.v)
        ? fmt.v
        : parseFloat(fmt.v.toFixed(2));

      return `<label class="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer group hover:bg-blue-50 transition-colors"><input type="checkbox" class="hidden check-anim"><div class="w-5 h-5 rounded-full border-2 border-slate-300 mr-3 flex items-center justify-center transition-colors bg-white"><i class="fa-solid fa-check text-[10px] text-transparent"></i></div><div class="flex-1"><p class="font-bold text-slate-700 text-sm leading-tight">${i.n}</p><p class="text-xs text-blue-500 font-bold mt-0.5">${displayVal} <span class="text-slate-400 font-normal lowercase">${fmt.u}</span></p></div></label>`;
    })
    .join("");

  listStep.innerHTML = (meal.steps || [])
    .map((s, idx) => {
      const txt = s.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-slate-900">$1</strong>'
      );
      return `<div class="flex gap-4 items-start"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mt-0.5">${
        idx + 1
      }</span><p class="text-sm text-slate-600 leading-relaxed">${txt}</p></div>`;
    })
    .join("");

  const p = document.getElementById("detail-panel");
  p.classList.remove("fade-in");
  void p.offsetWidth;
  p.classList.add("fade-in");
}

function setMarketFilter(f) {
  state.marketFilter = f;
  ["all", 1, 2, 3, 4].forEach((t) => {
    const btn = document.getElementById(`btn-filt-${t}`);
    if (t == f)
      btn.className =
        "whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white shadow";
    else
      btn.className =
        "whitespace-nowrap px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100";
  });
  renderMarket();
}

function renderMarket() {
  const grid = document.getElementById("market-grid");
  grid.innerHTML = "";
  let grandTotal = 0;
  let items = [];

  if (state.marketFilter === "all") {
    let agg = {};
    for (let w = 1; w <= 4; w++) {
      if (weeksData[w] && weeksData[w].market) {
        weeksData[w].market.forEach((i) => {
          let val = parseFloat(i.q_daily || i.q_week || 0);
          if (agg[i.n]) agg[i.n].q_daily += val;
          else {
            agg[i.n] = { ...i };
            agg[i.n].q_daily = val;
          }
        });
      }
    }
    items = Object.values(agg);
  } else {
    const wd = weeksData[state.marketFilter];
    items = wd && wd.market ? [...wd.market] : [];
  }

  const grouped = { carnes: [], horti: [], mercearia: [], outros: [] };
  items.forEach((i) => {
    if (grouped[i.cat]) grouped[i.cat].push(i);
    else grouped["outros"].push(i);
  });

  Object.keys(categories).forEach((catKey) => {
    if (grouped[catKey].length === 0) return;
    const catInfo = categories[catKey];

    let rows = grouped[catKey]
      .map((item) => {
        let daily = parseFloat(item.q_daily || item.q_week || 0);
        let finalQty = state.mode === "week" ? daily * 7 : daily;

        let fmt = formatDisplay(finalQty, item.u || "");
        let displayVal = Number.isInteger(fmt.v)
          ? fmt.v
          : parseFloat(fmt.v.toFixed(2));

        const pid = item.id || item.n.replace(/[^a-z0-9]/gi, "");
        const price = state.prices[pid] || 0;
        // Preço sempre calculado sobre a quantidade REAL BASE (seja g ou l) para manter precisão
        const sub = price * finalQty;
        grandTotal += sub;
        const isChecked = state.checks[`${pid}_${state.marketFilter}`];

        return `<div class="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"><div class="flex items-center gap-3 flex-1 min-w-0"><label class="cursor-pointer relative flex-shrink-0"><input type="checkbox" class="hidden check-row" ${
          isChecked ? "checked" : ""
        } onchange="toggleCheck('${pid}')"><div class="w-5 h-5 border-2 border-slate-300 rounded flex items-center justify-center transition-colors bg-white"><i class="fa-solid fa-check text-[10px] text-transparent"></i></div></label><div class="min-w-0 ${
          isChecked ? "opacity-50 line-through text-slate-400" : ""
        }"><p class="text-sm font-bold text-slate-700 leading-tight truncate">${
          item.n
        }</p><p class="text-[10px] text-blue-500 font-bold mt-0.5">${displayVal} <span class="text-slate-400 font-normal lowercase">${
          fmt.u
        }</span></p></div></div><div class="text-right flex-shrink-0 ml-2"><input type="number" placeholder="0.00" class="w-16 text-right text-xs bg-slate-100 rounded px-1 py-1 mb-0.5 focus:bg-white border border-transparent focus:border-blue-300 outline-none" value="${
          price || ""
        }" onchange="updatePrice('${pid}', this.value)"><p class="text-[10px] font-bold text-slate-500">R$ ${sub.toFixed(
          2
        )}</p></div></div>`;
      })
      .join("");

    grid.innerHTML += `<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div class="p-3 ${catInfo.bg} flex items-center gap-2 border-b border-slate-100"><i class="fa-solid ${catInfo.icon} ${catInfo.color}"></i><h4 class="font-bold text-sm text-slate-700">${catInfo.label}</h4></div><div>${rows}</div></div>`;
  });

  document.getElementById("market-total").innerText = `R$ ${grandTotal.toFixed(
    2
  )}`;
  document.getElementById("market-total-label").innerText =
    state.marketFilter === "all" ? "TOTAL MÊS" : "TOTAL SEMANA";
}

function updatePrice(id, val) {
  state.prices[id] = parseFloat(val) || 0;
  localStorage.setItem("pricesV23", JSON.stringify(state.prices));
  renderMarket();
}
function toggleCheck(id) {
  const k = `${id}_${state.marketFilter}`;
  state.checks[k] = !state.checks[k];
  localStorage.setItem("checksV23", JSON.stringify(state.checks));
  renderMarket();
}
init();