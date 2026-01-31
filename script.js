let tutteLeAuto = [];
let giocoAttivo = "gt7";
let utenteCorrente = null;
let sortAttivo = "default";
let searchTimeout = null;

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
            console.error("Errore login:", e);
            alert("Errore durante il login: " + e.message);
        });
    } else {
        const confirmLogout = confirm("Vuoi disconnetterti?");
        if(confirmLogout) auth.signOut();
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
        console.error("Errore recupero dati:", error);
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

    aggiornaContatore();
    aggiornaBarreCategoria();
    aggiornaContatoriMarche();

    if (utenteCorrente) {
        try {
            const docRef = db.collection('garages').doc(utenteCorrente.uid);
            const updatePayload = {};
            updatePayload[key] = newState ? "true" : "false";
            await docRef.set(updatePayload, { merge: true });
        } catch (error) {
            console.error("Errore Firebase:", error);
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
            const poss = tutteLeAuto.filter(a => 
                a.gioco === gioco && 
                localStorage.getItem(`${a.gioco}-${a.id}`) === 'true'
            );

            if (poss.length === 0) continue;

            // Controllo spazio rimanente per l'header (se non è l'inizio della pagina)
            if (yCorrente > 230) {
                doc.addPage();
                yCorrente = 25;
            }

            // --- INTESTAZIONE STILE GT7 ---
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

            yCorrente += 23; // Spazio prima di iniziare la griglia
            
            let x = 15;
            poss.sort((a, b) => a.marca.localeCompare(b.marca) || a.nome.localeCompare(b.nome));
            
            // Impostazioni colonne
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
                
                doc.setFontSize(6); // Font leggermente più piccolo per 4 colonne
                doc.setTextColor(225, 6, 0);
                doc.text(a.marca.toUpperCase(), x + 21, yCorrente + 4);
                
                doc.setTextColor(0);
                const limiteTesto = gioco === 'gt7' ? 22 : 38;
                const splitTitle = doc.splitTextToSize(a.nome, limiteTesto);
                doc.text(splitTitle, x + 21, yCorrente + 7);
                
                // Logica spostamento X e Y
                if ((i + 1) % numColonne === 0) {
                    x = 15;
                    yCorrente += 18; 
                } else {
                    x += larghezzaCella;
                }
            }
            
            // Se la riga non è finita, resetta x e scendi per il gioco successivo
            if (x !== 15) {
                yCorrente += 25;
                x = 15;
            } else {
                yCorrente += 10;
            }
        }

        // --- AGGIUNTA NUMERAZIONE PAGINE ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text(`Pagina ${i} di ${pageCount}`, 195, 285, { align: 'right' });
        }

        doc.save(`${nomeFile}.pdf`);
    } catch (e) {
        console.error("Errore PDF:", e);
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

window.onload = async () => {
    document.getElementById('login-btn').onclick = gestisciLogin;
    try {
        const r = await fetch('data.json?v=' + new Date().getTime());
        tutteLeAuto = await r.json();
        popolaFiltri();
        renderizzaAuto();
    } catch(e) { 
        console.error("Errore caricamento JSON:", e); 
    }
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
    const s = document.getElementById('searchBar').value.toLowerCase();
    const pF = document.getElementById('filter-country').value;
    const mF = document.getElementById('filter-brand').value;
    const sC = document.getElementById('sort-container');
    main.innerHTML = "";

    let fil = tutteLeAuto.filter(a => 
        a.gioco === giocoAttivo && 
        a.nome.toLowerCase().includes(s) && 
        (pF === "all" || a.paese === pF) && 
        (mF === "all" || a.marca === mF)
    );

    if (giocoAttivo === "mfgt") {
        if(sC) sC.style.display = "none";
        const g = document.createElement('div'); 
        g.className = 'car-grid';
        fil.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
        main.appendChild(g);
    } else {
        if(sC) sC.style.display = "flex";
        let groups = {};
        const ordineTrasmissioni = ["FF", "FR", "MR", "RR", "Altro", "4WD"];

        const addToGroup = (key, item) => {
            if(!groups[key]) groups[key] = [];
            groups[key].push(item);
        };

        if (sortAttivo === "default") {
            fil.forEach(a => {
                const p = a.paese || "Altro";
                if(!groups[p]) groups[p] = {};
                if(!groups[p][a.marca]) groups[p][a.marca] = [];
                groups[p][a.marca].push(a);
            });
        } else if (sortAttivo === "marca" || sortAttivo === "paese") {
            fil.forEach(a => addToGroup(sortAttivo === "marca" ? (a.marca || "Altro") : (a.paese || "Altro"), a));
        } else if (sortAttivo === "trasmissione") {
            ordineTrasmissioni.forEach(o => groups[o] = []);
            fil.forEach(a => addToGroup(mapTrasmissione(a.trasmissione), a));
        } else if (sortAttivo === "potenza" || sortAttivo === "peso") {
            const isPot = sortAttivo === "potenza";
            
            // Categorie Potenza Decrescenti
            const catsPot = [
                "1'600 CV -", "1'300 - 1'599 CV", "1'100 - 1'299 CV", "1'000 - 1'099 CV", 
                "900 - 999 CV", "800 - 899 CV", "700 - 799 CV", "600 - 699 CV", 
                "500 - 599 CV", "400 - 499 CV", "300 - 399 CV", "200 - 299 CV", 
                "100 - 199 CV", "- 99 CV", "Altro"
            ];
            
            // Categorie Peso Decrescenti
            const catsPeso = [
                "2'300 Kg -", "2'000 - 2'299 Kg", "1'800 - 1'999 Kg", "1'700 - 1'799 Kg", 
                "1'600 - 1'699 Kg", "1'500 - 1'599 Kg", "1'400 - 1'499 Kg", "1'300 - 1'399 Kg", 
                "1'200 - 1'299 Kg", "1'100 - 1'199 Kg", "1'000 - 1'099 Kg", "900 - 999 Kg", 
                "800 - 899 Kg", "700 - 799 Kg", "600 - 699 Kg", "500 - 599 Kg", "- 499 Kg", "Altro"
            ];
            
            const activeCats = isPot ? catsPot : catsPeso;
            activeCats.forEach(c => groups[c] = []);
            
            fil.forEach(a => {
                const v = parseVal(isPot ? a.cv : a.peso);
                let c = "Altro";
                if(v !== null) {
                    if(isPot) {
                        if(v >= 1600) c = catsPot[0];
                        else if(v >= 1300) c = catsPot[1];
                        else if(v >= 1100) c = catsPot[2];
                        else if(v >= 1000) c = catsPot[3];
                        else if(v >= 900)  c = catsPot[4];
                        else if(v >= 800)  c = catsPot[5];
                        else if(v >= 700)  c = catsPot[6];
                        else if(v >= 600)  c = catsPot[7];
                        else if(v >= 500)  c = catsPot[8];
                        else if(v >= 400)  c = catsPot[9];
                        else if(v >= 300)  c = catsPot[10];
                        else if(v >= 200)  c = catsPot[11];
                        else if(v >= 100)  c = catsPot[12];
                        else c = catsPot[13];
                    } else {
                        if(v >= 2300)      c = catsPeso[0];
                        else if(v >= 2000) c = catsPeso[1];
                        else if(v >= 1800) c = catsPeso[2];
                        else if(v >= 1700) c = catsPeso[3];
                        else if(v >= 1600) c = catsPeso[4];
                        else if(v >= 1500) c = catsPeso[5];
                        else if(v >= 1400) c = catsPeso[6];
                        else if(v >= 1300) c = catsPeso[7];
                        else if(v >= 1200) c = catsPeso[8];
                        else if(v >= 1100) c = catsPeso[9];
                        else if(v >= 1000) c = catsPeso[10];
                        else if(v >= 900)  c = catsPeso[11];
                        else if(v >= 800)  c = catsPeso[12];
                        else if(v >= 700)  c = catsPeso[13];
                        else if(v >= 600)  c = catsPeso[14];
                        else if(v >= 500)  c = catsPeso[15];
                        else c = catsPeso[16];
                    }
                }
                groups[c].push(a);
            });

            activeCats.forEach(k => {
                const haAuto = groups[k].length > 0;
                const labelHeader = haAuto ? k : `${k} *`;
                
                renderHeader(labelHeader, groups[k], main);
                
                if (haAuto) {
                    const g = document.createElement('div'); 
                    g.className = 'car-grid';
                    groups[k].sort((a, b) => a.nome.localeCompare(b.nome))
                             .forEach(a => g.appendChild(creaCard(a)));
                    main.appendChild(g);
                }
            });
            aggiornaContatore();
            return; 
        }

        // Ordinamento per gli altri casi (Marca, Paese, Trasmissione)
        const keys = Object.keys(groups).sort((a, b) => {
            if (sortAttivo === "trasmissione") return ordineTrasmissioni.indexOf(a) - ordineTrasmissioni.indexOf(b);
            if (a === "Altro") return 1; if (b === "Altro") return -1;
            return a.localeCompare(b);
        });

        keys.forEach(k => {
            if (sortAttivo === "default") {
                const marcheNelPaese = Object.keys(groups[k]);
                if (marcheNelPaese.length === 0) return;
                const allInCountry = Object.values(groups[k]).flat();
                renderHeader(k, allInCountry, main);
                marcheNelPaese.sort().forEach(m => {
                    const subList = groups[k][m];
                    const t = document.createElement('h3'); 
                    t.className = 'brand-title';
                    const pM = subList.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
                    t.innerHTML = `— ${m} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${pM}/${subList.length}</span>`;
                    main.appendChild(t);
                    const g = document.createElement('div'); 
                    g.className = 'car-grid';
                    subList.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
                    main.appendChild(g);
                });
            } else {
                if (groups[k].length === 0) return;
                renderHeader(k, groups[k], main);
                const g = document.createElement('div'); 
                g.className = 'car-grid';
                groups[k].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
                main.appendChild(g);
            }
        });
    }
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
    h.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:baseline;">
            <h2 class="country-title">${title}</h2>
            <span class="header-stats" style="font-size:0.9rem; font-weight:bold; color:${pr===100?'#e10600':'white'}">
                ${p}/${list.length} (${pr}%)
            </span>
        </div>
        <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; margin-top:10px; overflow:hidden;">
            <div class="header-progress-bar" style="width:${pr}%; height:100%; background:linear-gradient(90deg, #e10600, #ff4d4d); transition:width 0.8s ease;"></div>
        </div>`;
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
    card.innerHTML = `
        <img src="${a.immagine_small || a.immagine}" loading="lazy" alt="${a.nome}" width="280" height="180">
        <div class="car-info">
            <span class="car-brand-tag">${a.marca}</span>
            <h3>${a.nome}</h3>
        </div>
        <div class="owned-container" onclick="togglePossesso(event, '${a.gioco}', '${safeId}')">
            <input type="checkbox" ${isOwned ? 'checked' : ''} style="pointer-events:none;"> 
            <span>Nel garage</span>
        </div>`;
    card.onclick = (e) => {
        if(!e.target.closest('.owned-container')) mostraDettagli(a);
    };
    return card;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal");
    const b = document.getElementById("modal-body");
    const s = a.gioco === "mfgt" ? ['anno','trasmissione','velocita','accelerazione','frenata','sterzata','stabilita'] 
                                 : ['anno','pp','aspirazione','trasmissione','cilindrata','tipo_motore','cv','peso','prezzo','acquisto'];
    const lbl = {pp:'Punti Prestazione', cv:'Potenza', acquisto:'Negozio', velocita:'Velocità Massima'};
    let g = '<div class="specs-grid">';
    s.forEach(x => {
        g += `<div class="spec-item"><strong>${lbl[x] || x.replace('_', ' ')}</strong>${a[x] || '-'}</div>`;
    });
    g += '</div>';
    b.innerHTML = `
        <img src="${a.immagine}" class="modal-img">
        <div style="padding:20px;">
            <h2>${a.nome}</h2>
            <p class="modal-brand">${a.marca}</p>
            ${g}
            ${a.titolo ? `<h4 class="mfgt-subtitle">${a.titolo}</h4>` : ''}
            <p class="modal-description">${a.descrizione || 'Nessuna descrizione disponibile.'}</p>
            ${a.link ? `<a href="${a.link}" target="_blank" class="external-link">Sito Ufficiale</a>` : ''}
        </div>`;
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
    searchTimeout = setTimeout(() => {
        renderizzaAuto();
    }, 300);
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
        document.getElementById('legenda-aspirazione').style.display = giocoAttivo === "mfgt" ? "none" : "block";
        document.getElementById('filter-container').style.display = giocoAttivo === "mfgt" ? "none" : "flex";
        popolaFiltri();
        renderizzaAuto();
    };
});

document.querySelectorAll('.sort-btn').forEach(b => {
    b.onclick = (e) => {
        document.querySelectorAll('.sort-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        sortAttivo = e.target.dataset.sort;
        renderizzaAuto();
    };
});

document.getElementById('legenda-toggle').onclick = e => {
    e.stopPropagation();
    document.getElementById('legenda-content').classList.toggle('show');
};

window.onclick = e => {
    if(!e.target.matches('#legenda-toggle') && !e.target.closest('#legenda-content')) 
        document.getElementById('legenda-content').classList.remove('show');
    const m = document.getElementById('carModal');
    if(e.target === m) m.style.display = 'none';
};

function aggiornaContatoriMarche() {
    const brandTitles = document.querySelectorAll('.brand-title');
    brandTitles.forEach(titleElement => {
        const brandName = titleElement.innerText.split('—')[1].split(/[0-9]/)[0].trim();
        const grid = titleElement.nextElementSibling;
        if (grid && grid.classList.contains('car-grid')) {
            const cards = grid.querySelectorAll('.car-card');
            const total = cards.length;
            const owned = grid.querySelectorAll('.car-card.owned').length;
            titleElement.innerHTML = `— ${brandName} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${owned}/${total}</span>`;
        }
    });
}
