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
    const s = document.getElementById('searchBar').value.toLowerCase();
    const pF = document.getElementById('filter-country').value;
    const mF = document.getElementById('filter-brand').value;
    const sC = document.getElementById('sort-container');
    main.innerHTML = "";

    let fil = tutteLeAuto.filter(a => {
        const chiaveAuto = `${a.gioco}-${a.id}`;
        const isOwned = localStorage.getItem(chiaveAuto) === 'true';
        let matchBase = a.gioco === giocoAttivo && a.nome.toLowerCase().includes(s);
        
        if (giocoAttivo !== "mfgt") {
            if (pF !== "all" && a.paese !== pF) matchBase = false;
            if (mF !== "all" && a.marca !== mF) matchBase = false;
        }

        let matchGarage = true;
        if (filtroGarage === "possedute") matchGarage = isOwned;
        else if (filtroGarage === "mancanti") matchGarage = !isOwned;

        return matchBase && matchGarage;
    });

    if (giocoAttivo === "mfgt") {
        if(sC) sC.style.display = "none";
        if (fil.length === 0) {
            main.innerHTML = `<p style="text-align:center; color:gray; margin-top:50px;">Nessuna auto trovata.</p>`;
        } else {
            const g = document.createElement('div');
            g.className = 'car-grid';
            fil.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
            main.appendChild(g);
        }
    } else {
        if(sC) sC.style.display = "flex";
        if (fil.length === 0) {
            main.innerHTML = `<p style="text-align:center; color:gray; margin-top:50px;">Nessuna auto trovata.</p>`;
            aggiornaContatore();
            return;
        }

        if (mF !== "all") {
            const paeseMarca = fil[0].paese || "Altro";
            renderHeader(`${mF} (${paeseMarca})`, fil, main);
            const infoIcon = `<span class="brand-info-icon" onclick="mostraInfoBrand('${mF}')">i</span>`;
            const t = document.createElement('h3');
            t.className = 'brand-title';
            const pM = fil.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
            t.innerHTML = `— ${mF} ${infoIcon} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${pM}/${fil.length}</span>`;
            main.appendChild(t);

            const g = document.createElement('div');
            g.className = 'car-grid';
            fil.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
            main.appendChild(g);
            aggiornaContatore();
            return;
        }

        let groups = {};
        const ordineTrasmissioni = ["FF", "FR", "MR", "RR", "Altro", "4WD"];
        const ordineAspirazioni = ["Aspirazione Naturale", "Turbocompressore", "Compressore Volumetrico", "Turbo + Compressore", "Elettrico"];

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
        } else if (sortAttivo === "anno") {
            fil.forEach(a => addToGroup(a.anno || "Altro", a));
        } else if (sortAttivo === "trasmissione") {
            ordineTrasmissioni.forEach(o => groups[o] = []);
            fil.forEach(a => addToGroup(mapTrasmissione(a.trasmissione), a));
        } else if (sortAttivo === "aspirazione") {
            ordineAspirazioni.forEach(o => groups[o] = []);
            fil.forEach(a => {
                const asp = a.aspirazione || "";
                let cat = "Altro";
                if (asp.includes("Veicolo elettrico") || asp.includes("Elettrico")) cat = "Elettrico";
                else if (asp.includes("Turbo + Compressore") || asp.includes("TC + CV")) cat = "Turbo + Compressore";
                else if (asp.includes("Aspirazione Naturale") || asp.includes("(AN)")) cat = "Aspirazione Naturale";
                else if (asp.includes("Turbocompressore") || asp.includes("(TC)")) cat = "Turbocompressore";
                else if (asp.includes("Compressore Volumetrico") || asp.includes("(CV)")) cat = "Compressore Volumetrico";
                addToGroup(cat, a);
            });
        } else if (sortAttivo === "potenza" || sortAttivo === "peso") {
            const isPot = sortAttivo === "potenza";
            const cats = isPot ? ["1'600 CV -", "1'300 - 1'599 CV", "1'100 - 1'299 CV", "1'000 - 1'099 CV", "900 - 999 CV", "800 - 899 CV", "700 - 799 CV", "600 - 699 CV", "500 - 599 CV", "400 - 499 CV", "300 - 399 CV", "200 - 299 CV", "100 - 199 CV", "- 99 CV", "Altro"] : ["2'300 Kg -", "2'000 - 2'299 Kg", "1'800 - 1'999 Kg", "1'700 - 1'799 Kg", "1'600 - 1'699 Kg", "1'500 - 1'599 Kg", "1'400 - 1'499 Kg", "1'300 - 1'399 Kg", "1'200 - 1'299 Kg", "1'100 - 1'199 Kg", "1'000 - 1'099 Kg", "900 - 999 Kg", "800 - 899 Kg", "700 - 799 Kg", "600 - 699 Kg", "500 - 599 Kg", "- 499 Kg", "Altro"];
            
            cats.forEach(c => groups[c] = []);
            fil.forEach(a => {
                const v = parseVal(isPot ? a.cv : a.peso);
                let c = "Altro";
                if(v !== null) {
                    if(isPot) {
                        if(v >= 1600) c = cats[0]; else if(v >= 1300) c = cats[1]; else if(v >= 1100) c = cats[2]; else if(v >= 1000) c = cats[3]; else if(v >= 900) c = cats[4]; else if(v >= 800) c = cats[5]; else if(v >= 700) c = cats[6]; else if(v >= 600) c = cats[7]; else if(v >= 500) c = cats[8]; else if(v >= 400) c = cats[9]; else if(v >= 300) c = cats[10]; else if(v >= 200) c = cats[11]; else if(v >= 100) c = cats[12]; else c = cats[13];
                    } else {
                        if(v >= 2300) c = cats[0]; else if(v >= 2000) c = cats[1]; else if(v >= 1800) c = cats[2]; else if(v >= 1700) c = cats[3]; else if(v >= 1600) c = cats[4]; else if(v >= 1500) c = cats[5]; else if(v >= 1400) c = cats[6]; else if(v >= 1300) c = cats[7]; else if(v >= 1200) c = cats[8]; else if(v >= 1100) c = cats[9]; else if(v >= 1000) c = cats[10]; else if(v >= 900) c = cats[11]; else if(v >= 800) c = cats[12]; else if(v >= 700) c = cats[13]; else if(v >= 600) c = cats[14]; else if(v >= 500) c = cats[15]; else c = cats[16];
                    }
                }
                groups[c].push(a);
            });

            cats.forEach(k => {
                if (groups[k].length === 0) return;
                renderHeader(k, groups[k], main);
                const g = document.createElement('div');
                g.className = 'car-grid';
                groups[k].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
                main.appendChild(g);
            });
            aggiornaContatore();
            return;
        }

        const keys = Object.keys(groups).sort((a, b) => {
            if (sortAttivo === "trasmissione") return ordineTrasmissioni.indexOf(a) - ordineTrasmissioni.indexOf(b);
            if (sortAttivo === "aspirazione") return ordineAspirazioni.indexOf(a) - ordineAspirazioni.indexOf(b);
            if (sortAttivo === "anno") {
                if (a === "Altro") return 1; if (b === "Altro") return -1;
                return parseInt(a) - parseInt(b);
            }
            if (a === "Altro") return 1; if (b === "Altro") return -1;
            return a.localeCompare(b);
        });

        keys.forEach(k => {
            if (sortAttivo === "default") {
                const marcheNelPaese = Object.keys(groups[k]);
                if (marcheNelPaese.length === 0) return;
                renderHeader(k, Object.values(groups[k]).flat(), main);
                
                marcheNelPaese.sort().forEach(m => {
                    const subList = groups[k][m];
                    const t = document.createElement('h3');
                    t.className = 'brand-title';
                    const pM = subList.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
                    const infoIcon = `<span class="brand-info-icon" onclick="mostraInfoBrand('${m}')">i</span>`;
                    t.innerHTML = `— ${m} ${infoIcon} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${pM}/${subList.length}</span>`;
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

    card.innerHTML = `
        <img src="${a.immagine_small || a.immagine}" loading="lazy" alt="${a.nome}" width="280" height="180">
        <div class="car-info">
            <span class="car-brand-tag">${a.marca}</span>
            <h3>${a.nome}</h3>
        </div>
        
        <div class="owned-container" onclick="togglePossesso(event, '${a.gioco}', '${safeId}')">
            <input type="checkbox" ${isOwned ? 'checked' : ''} style="pointer-events:none;">
            <span>Nel garage</span>
        </div>
    `;

    card.onclick = (e) => {
        if(!e.target.closest('.owned-container')) mostraDettagli(a);
    };
    return card;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal");
    const b = document.getElementById("modal-body");
    
    // Lista campi per GT7
    const campiGT7 = ['categoria', 'anno', 'pp', 'aspirazione', 'trasmissione', 'cilindrata', 'tipo_motore', 'cv', 'peso', 'prezzo', 'acquisto'];
    const s = a.gioco === "mfgt" ? ['anno','trasmissione','velocita','accelerazione','frenata','sterzata','stabilita'] : campiGT7;
    
    const lbl = {categoria: 'Categoria', pp:'Punti Prestazione', cv:'Potenza', acquisto:'Negozio', velocita:'Velocità'};
    
    // Griglia informazioni in stile tabella
    let g = '<div class="specs-list" style="margin-top: 15px; border-top: 1px solid #333;">';
    s.forEach(x => {
        if (a[x]) {
            g += `
            <div class="spec-row" style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid #222; font-size: 0.9rem;">
                <span style="color: #888; text-transform: uppercase; font-weight: bold; font-size: 0.75rem;">${lbl[x] || x.replace('_', ' ')}</span>
                <span style="color: #fff; font-weight: 500;">${a[x]}</span>
            </div>`;
        }
    });
    g += '</div>';

    // Link rossi
    const link1 = a.link ? `<a href="${a.link}" target="_blank" class="external-link" style="background:#e10600; padding: 10px 20px; color:white; text-decoration:none; font-weight:bold; display:inline-block; border-radius:2px; font-size:0.9rem;">Sito Ufficiale</a>` : '';
    const link2 = a.link2 ? `<a href="${a.link2}" target="_blank" class="external-link" style="background:#e10600; padding: 10px 20px; color:white; text-decoration:none; font-weight:bold; display:inline-block; border-radius:2px; margin-left:10px; font-size:0.9rem;">Pagina Ufficiale</a>` : '';

    b.innerHTML = `
        <img src="${a.immagine}" class="modal-img" style="width:100%; display:block;">
        <div style="padding:25px; background: #111; color: white;">
            <h2 style="font-size: 1.8rem; margin: 0 0 5px 0; text-transform: uppercase;">${a.nome}</h2>
            <p style="color: #888; margin: 0; font-weight: bold; font-size: 1rem;">${a.marca}</p>
            
            ${a.isVGT ? `<p style="color: #e10600; font-weight: 900; text-transform: uppercase; margin: 15px 0 5px 0; font-size: 0.85rem; letter-spacing: 1px;">Vision Gran Turismo</p>` : ''}
            
            ${g}
            
            ${a.titolo ? `<h4 style="color: #ffffff; margin-top: 25px; margin-bottom: 10px; font-size: 1.1rem; font-weight: 500; line-height: 1.4; border-left: 3px solid #e10600; padding-left: 15px;">${a.titolo}</h4>` : ''}
            
            <p style="line-height: 1.6; color: #ccc; margin-top: 15px; font-size: 0.95rem;">${a.descrizione || 'Dati tecnici non ancora disponibili.'}</p>
            
            <div style="margin-top:25px; display:flex;">
                ${link1} ${link2}
            </div>
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
