// ============================================================
// ARQUIVO: js/mobile-app.js
// FUNÇÃO: Controla a visualização do cliente (app.html)
// ============================================================

// Estado Global da Tela (Use VAR para evitar conflitos de recarregamento)
var currentWeek = 1;
var currentMode = 'day'; 
var activeMeal = 'cafe';
var marketFilter = 'all';

// Dados
var dietData = JSON.parse(localStorage.getItem('dietData')) || {};

// INICIALIZAÇÃO
// Use uma verificação para não adicionar listener duplicado
if (!window.hasLoadedMobileApp) {
    window.onload = function() {
        if (!token) window.location.href = 'login.html';

        if (user && user.is_owner === 1) {
            var btnOwner = document.getElementById('btn-owner');
            if(btnOwner) {
                btnOwner.classList.remove('hidden');
                btnOwner.classList.add('flex');
            }
        }
        nav('diet', 1);
    };
    window.hasLoadedMobileApp = true;
}

// --- NAVEGAÇÃO PRINCIPAL ---

function toggleSidebar() {
    var sb = document.getElementById("sidebar");
    var ov = document.getElementById("mobile-overlay");
    if(sb) sb.classList.toggle("-translate-x-full");
    if(ov) ov.classList.toggle("hidden");
}

function nav(view, weekNum) {
    var dietView = document.getElementById("view-diet");
    var marketView = document.getElementById("view-market");
    
    // Fecha sidebar se estiver no mobile
    var sb = document.getElementById("sidebar");
    if(sb && !sb.classList.contains("-translate-x-full") && window.innerWidth < 768) {
        toggleSidebar();
    }

    if (view === 'diet') {
        marketView.classList.add("hidden");
        dietView.classList.remove("hidden");
        currentWeek = weekNum;
        
        [1, 2, 3, 4].forEach(w => {
            var btn = document.getElementById(`nav-w${w}`);
            if(btn) {
                if(w === weekNum) {
                    btn.classList.add("active-nav");
                    btn.classList.remove("inactive-nav");
                } else {
                    btn.classList.remove("active-nav");
                    btn.classList.add("inactive-nav");
                }
            }
        });
        var navMarket = document.getElementById("nav-market");
        if(navMarket) {
            navMarket.classList.remove("active-nav");
            navMarket.classList.add("inactive-nav");
        }

        renderDietView();
    } 
    else if (view === 'market') {
        dietView.classList.add("hidden");
        marketView.classList.remove("hidden");
        
        [1, 2, 3, 4].forEach(w => {
            var btn = document.getElementById(`nav-w${w}`);
            if(btn) {
                btn.classList.remove("active-nav");
                btn.classList.add("inactive-nav");
            }
        });
        var navMarket = document.getElementById("nav-market");
        if(navMarket) {
            navMarket.classList.add("active-nav");
            navMarket.classList.remove("inactive-nav");
        }

        renderMarket();
    }
}

// --- VISUALIZAÇÃO DA DIETA ---

function setMode(mode) {
    currentMode = mode;
    
    var btnDay = document.getElementById("mode-day");
    var btnWeek = document.getElementById("mode-week");

    if (mode === 'day') {
        btnDay.className = "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all bg-blue-600 text-white shadow-sm";
        btnWeek.className = "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all text-slate-500 hover:bg-slate-50";
    } else {
        btnWeek.className = "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all bg-blue-600 text-white shadow-sm";
        btnDay.className = "flex-1 py-1.5 text-xs font-bold rounded text-center transition-all text-slate-500 hover:bg-slate-50";
    }
    
    renderDietView();
}

function renderDietView() {
    var data = dietData[currentWeek];
    
    var sub = document.getElementById("diet-subtitle");
    if(sub) sub.innerText = `SEMANA ${currentWeek}`;
    
    if (data) {
        document.getElementById("diet-title").innerText = data.headerSubtitle || "Seu Plano";
        document.getElementById("diet-desc").innerText = "Siga o plano abaixo para atingir seus objetivos.";
    } else {
        document.getElementById("diet-title").innerText = "Sem Dados";
        document.getElementById("diet-desc").innerText = "Nenhum plano configurado para esta semana.";
    }

    selectMeal(activeMeal);
}

function selectMeal(type) {
    activeMeal = type;
    
    ['cafe', 'almoco', 'lanche', 'jantar'].forEach(t => {
        var card = document.getElementById(`card-${t}`);
        if(card) {
            if(t === type) {
                card.classList.add("meal-active");
                card.classList.remove("border-transparent");
            } else {
                card.classList.remove("meal-active");
            }
        }
    });

    var weekData = dietData[currentWeek];
    var mealData = weekData && weekData.meals ? weekData.meals[type] : null;

    var titleEl = document.getElementById("detail-title");
    var subEl = document.getElementById("detail-subtitle");
    var ingList = document.getElementById("ingredient-list");
    var stepList = document.getElementById("step-list");

    if(ingList) ingList.innerHTML = "";
    if(stepList) stepList.innerHTML = "";

    if (mealData) {
        titleEl.innerText = mealData.name;
        subEl.innerText = "Prepare sua refeição";

        if(mealData.ingredients && mealData.ingredients.length > 0) {
            mealData.ingredients.forEach(i => {
                var uniqueId = `ing-${currentWeek}-${type}-${Math.random().toString(36).substr(2,9)}`;
                ingList.innerHTML += `
                <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer bg-slate-50/50">
                    <input type="checkbox" class="peer check-row hidden" id="${uniqueId}">
                    <div class="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-green-500 peer-checked:border-green-500 flex items-center justify-center text-white text-xs transition-all"><i class="fa-solid fa-check"></i></div>
                    <div class="flex-1">
                        <span class="block text-sm font-bold text-slate-700">${i.n}</span>
                        <span class="text-xs text-slate-400 font-medium">${i.q_daily || ''}${i.u || ''}</span>
                    </div>
                </label>`;
            });
        } else {
            ingList.innerHTML = '<p class="text-slate-400 text-sm italic col-span-2">Sem ingredientes listados.</p>';
        }

        var steps = mealData.steps;
        if(typeof steps === 'string') steps = steps.split('\n');

        if(steps && steps.length > 0) {
            steps.forEach((s, idx) => {
                stepList.innerHTML += `
                <div class="flex gap-4">
                    <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs mt-0.5">${idx+1}</div>
                    <p class="text-sm text-slate-600 leading-relaxed">${s}</p>
                </div>`;
            });
        } else {
            stepList.innerHTML = '<p class="text-slate-400 text-sm italic">Modo de preparo não informado.</p>';
        }

    } else {
        titleEl.innerText = "Refeição Livre";
        subEl.innerText = "Não há receita planejada.";
        ingList.innerHTML = '<p class="text-slate-400 text-sm italic col-span-2">Aproveite sua refeição livre!</p>';
    }
}

// --- MERCADO ---

function setMarketFilter(filter) {
    marketFilter = filter;
    
    var ids = ['all', '1', '2', '3', '4'];
    ids.forEach(id => {
        var btn = document.getElementById(`btn-filt-${id}`);
        if(btn) {
            if((filter === 'all' && id === 'all') || (filter == id)) {
                btn.className = "whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white shadow transform scale-105 transition-all";
            } else {
                btn.className = "whitespace-nowrap px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all";
            }
        }
    });

    renderMarket();
}

function renderMarket() {
    var grid = document.getElementById("market-grid");
    if(!grid) return;
    grid.innerHTML = "";
    
    var allItems = [];
    var weeksToLoad = marketFilter === 'all' ? [1, 2, 3, 4] : [marketFilter];

    weeksToLoad.forEach(w => {
        if(dietData[w] && dietData[w].market) {
            dietData[w].market.forEach(item => {
                var existing = allItems.find(x => x.n.toLowerCase() === item.n.toLowerCase());
                if(existing) {
                    existing.q_daily += parseFloat(item.q_daily) || 0;
                } else {
                    allItems.push({ ...item, q_daily: parseFloat(item.q_daily) || 0 });
                }
            });
        }
    });

    if(allItems.length === 0) {
        grid.innerHTML = '<div class="col-span-2 text-center py-10 text-slate-400">Lista de compras vazia.</div>';
        return;
    }

    allItems.sort((a,b) => a.n.localeCompare(b.n));

    allItems.forEach(item => {
        var qtdDisplay = item.q_daily;
        var unitDisplay = item.u || '';
        
        if(unitDisplay.toLowerCase() === 'g' && qtdDisplay >= 1000) {
            qtdDisplay = (qtdDisplay / 1000).toFixed(2);
            unitDisplay = 'kg';
        } else if (unitDisplay.toLowerCase() === 'ml' && qtdDisplay >= 1000) {
            qtdDisplay = (qtdDisplay / 1000).toFixed(2);
            unitDisplay = 'l';
        } else {
            qtdDisplay = Math.round(qtdDisplay * 10) / 10;
        }

        grid.innerHTML += `
        <label class="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 transition-colors group">
            <div class="relative">
                <input type="checkbox" class="peer check-anim w-6 h-6 opacity-0 absolute inset-0 cursor-pointer">
                <div class="w-6 h-6 rounded-lg border-2 border-slate-300 flex items-center justify-center text-transparent transition-all group-hover:border-blue-400">
                    <i class="fa-solid fa-check"></i>
                </div>
            </div>
            <div class="flex-1">
                <p class="font-bold text-slate-700 text-sm peer-checked:line-through peer-checked:text-slate-400">${item.n}</p>
                <p class="text-xs text-slate-400 font-bold">${qtdDisplay}${unitDisplay}</p>
            </div>
        </label>`;
    });
}