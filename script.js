let tutteLeAuto = [];
let infoMarchi = {};
let giocoAttivo = "gt7";
let utenteCorrente = null;
let sortAttivo = "default";
let searchTimeout = null;
let filtroGarage = "all";

const parseVal = s => {
    if (!s || s === "-") return null;
    const m = s.toString().replace(/'/g, '').replace(/\./g, '').match(/\d+/);
    return m ? parseInt(m[0]) : null;
};

const mapTrasmissione = t => {
    if (!t) return "Altro";
    const s = t.toLowerCase();
    if (s.includes("4wd") || s.includes("integrale") || s.includes("awd")) return "4WD";
    if (s.includes("mr") || (s.includes("centrale") && s.includes("posteriore"))) return "MR";
    if (s.includes("rr") || (s.includes("motore posteriore") && s.includes("trazione posteriore"))) return "RR";
    if (s.includes("ff") || (s.includes("motore anteriore") && s.includes("trazione anteriore"))) return "FF";
    if (s.includes("fr") || (s.includes("motore anteriore") && s.includes("trazione posteriore"))) return "FR";
    return "Altro";
};

const getBase64Image = u => new Promise(r => {
    const i = new Image();
    i.setAttribute('crossOrigin', 'anonymous');
    i.onload = () => {
        const c = document.createElement("canvas");
        c.width = i.width; c.height = i.height;
        c.getContext("2d").drawImage(i, 0, 0);
        r(c.toDataURL("image/jpeg", 0.7));
    };
    i.onerror = () => {
        r("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
    };
    i.src = u;
});

const gestisciLogin = () => {
    if (!utenteCorrente) {
        auth.signInWithPopup(provider).catch(e => {
            console.error(e);
            alert("Errore login: " + e.message);
        });
    } else {
        if(confirm("Vuoi disconnetterti?")) auth.signOut();
    }
};

auth.onAuthStateChanged(u => {
    utenteCorrente = u;
    const b = document.getElementById('login-btn');
    if (b) b.innerText = u ? `Esci (${u.displayName.split(' ')[0]})` : "Accedi con Google";
    if (u) {
        caricaDatiUtente();
    } else {
        renderizzaAuto();
    }
});

async function caricaDatiUtente() {
    try {
        const docRef = db.collection('garages').doc(utenteCorrente.uid);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            Object.entries(data).forEach(([k, v]) => {
                localStorage.setItem(k, v);
            });
        }
        renderizzaAuto();
    } catch (error) {
        console.error(error);
    }
}

async function togglePossesso(event, gioco, id) {
    event.stopPropagation();
    const key = `${gioco}-${id}`;
    const isOwned = localStorage.getItem(key) === 'true';
    const newState = !isOwned;
    if (newState) {
        localStorage.setItem(key, 'true');
    } else {
        localStorage.removeItem(key);
    }
    const card = event.target.closest('.car-card');
    if (card) {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (newState) {
            card.classList.add('owned');
            if(checkbox) checkbox.checked = true;
        } else {
            card.classList.remove('owned');
            if(checkbox) checkbox.checked = false;
        }
    }
    if (filtroGarage !== 'all') {
        setTimeout(() => { renderizzaAuto(); }, 300);
    }
    aggiornaContatore();
    aggiornaBarreCategoria();
    aggiornaContatorsMarche();
    if (utenteCorrente) {
        try {
            const docRef = db.collection('garages').doc(utenteCorrente.uid);
            const updatePayload = {};
            updatePayload[key] = newState ? "true" : "false";
            await docRef.set(updatePayload, { merge: true });
        } catch (error) {
            console.error(error);
        }
    }
}

async function scaricaPDF(tipo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const btn = document.getElementById('pdf-main-btn');
    const originalText = "Scarica Lista PDF ▼";
    if (btn) btn.disabled = true;
    try {
        let giochiDaEsportare = [];
        let nomeFile = "Garage_GT_Completo";
        if (tipo === 'gt7') {
            giochiDaEsportare = ['gt7'];
            nomeFile = "Garage_GT7";
        } else if (tipo === 'mfgt') {
            giochiDaEsportare = ['mfgt'];
            nomeFile = "Garage_MFGT";
        } else {
            giochiDaEsportare = ['gt7', 'mfgt'];
        }
        let yCorrente = 25;
        for (const gioco of giochiDaEsportare) {
            const poss = tutteLeAuto.filter(a => a.gioco === gioco && localStorage.getItem(`${a.gioco}-${a.id}`) === 'true');
            if (poss.length === 0) continue;
            if (yCorrente > 230) {
                doc.addPage();
                yCorrente = 25;
            }
            doc.setFontSize(26);
            doc.setTextColor(225, 6, 0);
            const titoloGioco = gioco === "gt7" ? "GRAN TURISMO 7" : "MY FIRST GRAN TURISMO";
            doc.text(titoloGioco, 15, yCorrente);
            doc.setFontSize(12);
            doc.setTextColor(120, 120, 120); 
            doc.text(`Garage - ${poss.length} auto`, 15, yCorrente + 8);
            doc.setDrawColor(225, 6, 0);
            doc.setLineWidth(0.5);
            doc.line(15, yCorrente + 11, 195, yCorrente + 11); 
            yCorrente += 23;
            let x = 15;
            poss.sort((a, b) => a.marca.localeCompare(b.marca) || a.nome.localeCompare(b.nome));
            const numColonne = gioco === 'gt7' ? 4 : 2;
            const larghezzaCella = gioco === 'gt7' ? 45 : 90;
            for (let i = 0; i < poss.length; i++) {
                const a = poss[i];
                if (btn) btn.innerText = `Generazione... ${Math.round((i / poss.length) * 100)}%`;
                if (yCorrente > 275) { 
                    doc.addPage(); 
                    yCorrente = 25; 
                    x = 15; 
                }
                const imgData = await getBase64Image(a.immagine);
                doc.addImage(imgData, 'JPEG', x, yCorrente, 20, 11);
                doc.setFontSize(6);
                doc.setTextColor(225, 6, 0);
                doc.text(a.marca.toUpperCase(), x + 21, yCorrente + 4);
                doc.setTextColor(0);
                const limiteTesto = gioco === 'gt7' ? 22 : 38;
                const splitTitle = doc.splitTextToSize(a.nome, limiteTesto);
                doc.text(splitTitle, x + 21, yCorrente + 7);
                if ((i + 1) % numColonne === 0) {
                    x = 15;
                    yCorrente += 18; 
                } else {
                    x += larghezzaCella;
                }
            }
            if (x !== 15) {
                yCorrente += 25;
                x = 15;
            } else {
                yCorrente += 10;
            }
        }
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text(`Pagina ${i} di ${pageCount}`, 195, 285, { align: 'right' });
        }
        doc.save(`${nomeFile}.pdf`);
    } catch (e) {
        console.error(e);
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

async function caricaDati() {
    try {
        const [resAuto, resBrands] = await Promise.all([
            fetch('data.json?v=' + new Date().getTime()),
            fetch('brands.json?v=' + new Date().getTime())
        ]);
        tutteLeAuto = await resAuto.json();
        infoMarchi = await resBrands.json();
        popolaFiltri();
        renderizzaAuto();
    } catch(e) { 
        console.error(e); 
    }
}

window.onload = () => {
    document.getElementById('login-btn').onclick = gestisciLogin;
    caricaDati();
};

function popolaFiltri() {
    const f = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const p = [...new Set(f.map(a => a.paese).filter(Boolean))].sort();
    const m = [...new Set(f.map(a => a.marca).filter(Boolean))].sort();
    document.getElementById('filter-country').innerHTML = '<option value="all">Tutti i Paesi</option>' + p.map(x => `<option value="${x}">${x}</option>`).join('');
    document.getElementById('filter-brand').innerHTML = '<option value="all">Tutte le Marche</option>' + m.map(x => `<option value="${x}">${x}</option>`).join('');
}

function renderizzaAuto() {
    const main = document.querySelector('main');
    const searchVal = document.getElementById('searchBar').value.toLowerCase();
    const countryFilter = document.getElementById('filter-country').value;
    const brandFilter = document.getElementById('filter-brand').value;
    const sortContainer = document.getElementById('sort-container');
    main.innerHTML = "";

    let filtrati = tutteLeAuto.filter(auto => {
        const idUnivoco = `${auto.gioco}-${auto.id}`;
        const isOwned = localStorage.getItem(idUnivoco) === 'true';
        let matchBase = auto.gioco === giocoAttivo && auto.nome.toLowerCase().includes(searchVal);
        
        if (giocoAttivo !== "mfgt") {
            if (countryFilter !== "all" && auto.paese !== countryFilter) matchBase = false;
            if (brandFilter !== "all" && auto.marca !== brandFilter) matchBase = false;
        }

        let matchGarage = true;
        if (filtroGarage === "possedute") matchGarage = isOwned;
        else if (filtroGarage === "mancanti") matchGarage = !isOwned;

        return matchBase && matchGarage;
    });

    if (filtrati.length === 0) {
        main.innerHTML = `<p style="text-align:center; color:gray; margin-top:50px;">Nessuna auto trovata.</p>`;
        aggiornaContatore();
        return;
    }

    if (giocoAttivo === "mfgt") {
        if(sortContainer) sortContainer.style.display = "none";
        const grid = document.createElement('div');
        grid.className = 'car-grid';
        filtrati.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(a => grid.appendChild(creaCard(a)));
        main.appendChild(grid);
        aggiornaContatore();
        return;
    }

    if(sortContainer) sortContainer.style.display = "flex";
    let groups = {};

    const ordineAspirazioni = [
        "Aspirazione Naturale", 
        "Turbocompressore", 
        "Compressore Volumetrico", 
        "Turbocompressore + Compressore Volumetrico",
        "Elettrico"
    ];

    const nomiTrasmissioni = {
        "FF": "Motore anteriore Trazione anteriore",
        "FR": "Motore anteriore Trazione posteriore",
        "MR": "Motore centrale Trazione posteriore",
        "RR": "Motore posteriore Trazione posteriore",
        "4WD": "Trazione integrale",
        "Altro": "Altro"
    };

    const ordineTrasmissioni = [
        nomiTrasmissioni["FF"],
        nomiTrasmissioni["FR"],
        nomiTrasmissioni["MR"],
        nomiTrasmissioni["RR"],
        nomiTrasmissioni["4WD"],
        "Altro"
    ];

    const addToGroup = (key, item) => {
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    };

    filtrati.forEach(auto => {
        if (sortAttivo === "default") {
            const p = auto.paese || "Altro";
            if (!groups[p]) groups[p] = {};
            if (!groups[p][auto.marca]) groups[p][auto.marca] = [];
            groups[p][auto.marca].push(auto);
        } 
        else if (sortAttivo === "anno") {
            const annoVal = (!auto.anno || auto.anno === "/" || auto.anno === "") ? "Altro" : auto.anno;
            addToGroup(annoVal, auto);
        } 
        else if (sortAttivo === "aspirazione") {
            const asp = auto.aspirazione || "";
            let cat = "Altro";
            
            if (asp.includes("Veicolo elettrico") || asp.includes("Elettrico")) {
                cat = "Elettrico";
            } else if (asp.includes("Turbo + Compressore") || asp.includes("TC + CV")) {
                cat = "Turbocompressore + Compressore Volumetrico";
            } else if (asp.includes("Aspirazione Naturale") || asp.includes("(AN)")) {
                cat = "Aspirazione Naturale";
            } else if (asp.includes("Turbocompressore") || asp.includes("(TC)")) {
                cat = "Turbocompressore";
            } else if (asp.includes("Compressore Volumetrico") || asp.includes("(CV)")) {
                cat = "Compressore Volumetrico";
            }
            
            addToGroup(cat, auto);
        }
        else if (sortAttivo === "marca") {
            addToGroup(auto.marca || "Altro", auto);
        }
        else if (sortAttivo === "paese") {
            addToGroup(auto.paese || "Altro", auto);
        }
        else if (sortAttivo === "trasmissione") {
            const sigla = mapTrasmissione(auto.trasmissione); 
            const nomeEsteso = nomiTrasmissioni[sigla] || "Altro";
            addToGroup(nomeEsteso, auto);
        }
    });

    const keys = Object.keys(groups).sort((a, b) => {
        if (a === "Altro") return 1;
        if (b === "Altro") return -1;

        if (sortAttivo === "anno") return parseInt(a) - parseInt(b);
        if (sortAttivo === "aspirazione") return ordineAspirazioni.indexOf(a) - ordineAspirazioni.indexOf(b);
        if (sortAttivo === "trasmissione") return ordineTrasmissioni.indexOf(a) - ordineTrasmissioni.indexOf(b);
        
        return a.localeCompare(b);
    });

    keys.forEach(k => {
        if (sortAttivo === "default") {
            const marche = Object.keys(groups[k]);
            renderHeader(k, Object.values(groups[k]).flat(), main);
            
            marche.sort().forEach(m => {
                const autoList = groups[k][m];
                const title = document.createElement('h3');
                title.className = 'brand-title';
                const possedute = autoList.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
                title.innerHTML = `— ${m} <span class="brand-info-icon" onclick="mostraInfoBrand('${m}')">i</span> <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${possedute}/${autoList.length}</span>`;
                main.appendChild(title);

                const grid = document.createElement('div');
                grid.className = 'car-grid';
                autoList.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(a => grid.appendChild(creaCard(a)));
                main.appendChild(grid);
            });
        } else {
            if (groups[k].length === 0) return;
            renderHeader(k, groups[k], main);
            const grid = document.createElement('div');
            grid.className = 'car-grid';
            groups[k].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(a => grid.appendChild(creaCard(a)));
            main.appendChild(grid);
        }
    });

    aggiornaContatore();
}

function renderHeader(title, list, container) {
    const p = list.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
    const pr = list.length ? Math.round((p/list.length)*100) : 0;
    const safeId = title.replace(/[^a-zA-Z0-9]/g, '_');
    const ids = list.map(a => a.id).join(',');
    const h = document.createElement('div');
    h.className = 'category-header';
    h.dataset.groupList = ids; 
    h.dataset.groupTitle = title;
    h.id = `header-${safeId}`;
    h.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%; align-items:baseline;"><h2 class="country-title">${title}</h2><span class="header-stats" style="font-size:0.9rem; font-weight:bold; color:${pr===100?'#e10600':'white'}">${p}/${list.length} (${pr}%)</span></div><div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; margin-top:10px; overflow:hidden;"><div class="header-progress-bar" style="width:${pr}%; height:100%; background:linear-gradient(90deg, #e10600, #ff4d4d); transition:width 0.8s ease;"></div></div>`;
    container.appendChild(h);
}

function aggiornaBarreCategoria() {
    document.querySelectorAll('.category-header').forEach(header => {
        const ids = header.dataset.groupList.split(',');
        const total = ids.length;
        if(total === 0) return;
        let owned = 0;
        ids.forEach(id => {
            if(localStorage.getItem(`${giocoAttivo}-${id}`) === 'true') owned++;
        });
        const perc = Math.round((owned/total)*100);
        const statsEl = header.querySelector('.header-stats');
        const barEl = header.querySelector('.header-progress-bar');
        if(statsEl) {
            statsEl.innerText = `${owned}/${total} (${perc}%)`;
            statsEl.style.color = perc === 100 ? '#e10600' : 'white';
        }
        if(barEl) barEl.style.width = `${perc}%`;
    });
}

function creaCard(a) {
    const isOwned = localStorage.getItem(`${a.gioco}-${a.id}`) === 'true';
    const card = document.createElement('div');
    card.className = `car-card ${isOwned ? 'owned' : ''}`;
    const safeId = a.id.replace(/'/g, "\\'"); 
    card.innerHTML = `<img src="${a.immagine_small || a.immagine}" loading="lazy" alt="${a.nome}" width="280" height="180"><div class="car-info"><span class="car-brand-tag">${a.marca}</span><h3>${a.nome}</h3></div><div class="owned-container" onclick="togglePossesso(event, '${a.gioco}', '${safeId}')"><input type="checkbox" ${isOwned ? 'checked' : ''} style="pointer-events:none;"><span>Nel garage</span></div>`;
    card.onclick = (e) => {
        if(!e.target.closest('.owned-container')) mostraDettagli(a);
    };
    return card;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal");
    const b = document.getElementById("modal-body");
    const s = a.gioco === "mfgt" ? ['anno','trasmissione','velocita','accelerazione','frenata','sterzata','stabilita'] : ['anno','pp','aspirazione','trasmissione','cilindrata','tipo_motore','cv','peso','prezzo','acquisto'];
    const lbl = {pp:'Punti Prestazione', cv:'Potenza', acquisto:'Negozio', velocita:'Velocità Massima'};
    let g = '<div class="specs-grid">';
    s.forEach(x => {
        g += `<div class="spec-item"><strong>${lbl[x] || x.replace('_', ' ')}</strong>${a[x] || '-'}</div>`;
    });
    g += '</div>';
    b.innerHTML = `<img src="${a.immagine}" class="modal-img"><div style="padding:20px;"><h2>${a.nome}</h2><p class="modal-brand">${a.marca}</p>${g}${a.titolo ? `<h4 class="mfgt-subtitle">${a.titolo}</h4>` : ''}<p class="modal-description">${a.descrizione || 'Nessuna descrizione disponibile.'}</p>${a.link ? `<a href="${a.link}" target="_blank" class="external-link">Sito Ufficiale</a>` : ''}</div>`;
    m.style.display = "block";
    document.querySelector(".close-button").onclick = () => m.style.display = "none";
}

function aggiornaContatore() {
    const l = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const o = l.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
    const p = l.length ? Math.round((o/l.length)*100) : 0;
    document.getElementById('owned-count').innerText = o;
    document.getElementById('total-count').innerText = l.length;
    document.getElementById('progress-bar').style.width = p + "%";
    document.getElementById('completion-perc').innerText = p + "%";
}

document.getElementById('searchBar').oninput = (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { renderizzaAuto(); }, 300);
};

document.getElementById('filter-country').onchange = renderizzaAuto;
document.getElementById('filter-brand').onchange = renderizzaAuto;
document.getElementById('reset-filters').onclick = () => { 
    document.getElementById('searchBar').value = ""; 
    document.getElementById('filter-country').value = "all"; 
    document.getElementById('filter-brand').value = "all"; 
    renderizzaAuto(); 
};

document.querySelectorAll('.game-btn').forEach(b => {
    b.onclick = (e) => {
        const id = e.target.id;
        if(id === 'pdf-main-btn' || id === 'login-btn') return;
        document.querySelectorAll('.game-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        giocoAttivo = e.target.dataset.game;
        document.getElementById('searchBar').value = ""; 
        document.getElementById('filter-country').value = "all"; 
        document.getElementById('filter-brand').value = "all"; 
        filtroGarage = "all";
        const garageContainer = document.getElementById('garage-filter-selector');
        if (garageContainer) {
            garageContainer.querySelectorAll('.sort-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('onclick').includes("'all'")) btn.classList.add('active');
            });
        }
        document.getElementById('legenda-aspirazione').style.display = giocoAttivo === "mfgt" ? "none" : "block";
        document.getElementById('filter-container').style.display = giocoAttivo === "mfgt" ? "none" : "flex";
        popolaFiltri();
        renderizzaAuto();
    };
});

document.querySelectorAll('.sort-btn').forEach(b => {
    b.addEventListener('click', (e) => {
        if (e.target.closest('#sort-container')) {
            document.querySelectorAll('#sort-container .sort-btn').forEach(x => x.classList.remove('active'));
            e.target.classList.add('active');
            sortAttivo = e.target.dataset.sort;
            renderizzaAuto();
        }
    });
});

document.getElementById('legenda-toggle').onclick = function(e) {
    e.stopPropagation();
    const content = document.getElementById('legenda-content');
    content.classList.toggle('show');
    this.textContent = content.classList.contains('show') ? "Legenda Abbreviazioni ▴" : "Legenda Abbreviazioni ▾";
};

window.onclick = e => {
    const lc = document.getElementById('legenda-content');
    const lt = document.getElementById('legenda-toggle');
    if(lc && lc.classList.contains('show') && !lc.contains(e.target) && e.target !== lt) {
        lc.classList.remove('show');
        lt.textContent = "Legenda Abbreviazioni ▾";
    }
    const m = document.getElementById('carModal');
    if(e.target === m) m.style.display = 'none';
    const bm = document.getElementById('brandModal');
    if(e.target === bm) bm.style.display = 'none';
};

function aggiornaContatorsMarche() {
    document.querySelectorAll('.brand-title').forEach(titleElement => {
        const brandName = titleElement.innerText.split('—')[1].split('i')[0].trim();
        const grid = titleElement.nextElementSibling;
        if (grid && grid.classList.contains('car-grid')) {
            const total = grid.querySelectorAll('.car-card').length;
            const owned = grid.querySelectorAll('.car-card.owned').length;
            const infoIcon = `<span class="brand-info-icon" onclick="mostraInfoBrand('${brandName}')">i</span>`;
            titleElement.innerHTML = `— ${brandName} ${infoIcon} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${owned}/${total}</span>`;
        }
    });
}

window.setFiltroGarage = function(tipo, btn) {
    filtroGarage = tipo; 
    const container = document.getElementById('garage-filter-selector');
    if (container) {
        container.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    }
    if (btn) btn.classList.add('active');
    renderizzaAuto();
};

function mostraInfoBrand(nomeBrand) {
    const data = infoMarchi[nomeBrand];
    const modal = document.getElementById("brandModal");
    const body = document.getElementById("brand-modal-body");

    if (!data) {
        alert("Informazioni non disponibili per " + nomeBrand);
        return;
    }

    body.innerHTML = `
        <img src="${data.logo}" class="brand-logo-img" alt="Logo ${nomeBrand}" onerror="this.style.display='none'">
        <h2 style="margin: 10px 0;">${nomeBrand}</h2>
        ${data.slogan ? `<p class="brand-slogan">"${data.slogan}"</p>` : ''}
        
        <div class="brand-details-list">
            <div><strong>Paese:</strong> ${data.paese || 'N/D'}</div>
            <div><strong>Sede:</strong> ${data.sede || 'N/D'}</div>
            <div><strong>Fondazione:</strong> ${data.fondazione || 'N/D'}</div>
            <div><strong>Fondatore:</strong> ${data.fondatore || 'N/D'}</div>
        </div>
    `;

    modal.style.display = "block";
    const closeBtn = document.querySelector(".close-brand-button");
    closeBtn.onclick = () => modal.style.display = "none";
}
