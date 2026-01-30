let tutteLeAuto = [], giocoAttivo = "gt7", utenteCorrente = null, sortAttivo = "default";

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

const gestisciLogin = () => !utenteCorrente ? auth.signInWithPopup(provider).catch(e => alert(e.message)) : auth.signOut();

const getBase64Image = u => new Promise(r => {
    const i = new Image();
    i.setAttribute('crossOrigin', 'anonymous');
    i.onload = () => {
        const c = document.createElement("canvas");
        c.width = i.width; c.height = i.height;
        c.getContext("2d").drawImage(i, 0, 0);
        r(c.toDataURL("image/jpeg", 0.7));
    };
    i.onerror = () => r("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
    i.src = u;
});

const scaricaPDF = async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const btn = document.getElementById('download-pdf');
    btn.innerText = "Generazione..."; btn.disabled = true;
    
    doc.setFontSize(18); doc.setTextColor(225, 6, 0);
    doc.text(utenteCorrente?.displayName ? `GARAGE DI ${utenteCorrente.displayName.toUpperCase()}` : "GARAGE PERSONALE", 15, 15);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(giocoAttivo === "gt7" ? "Gran Turismo 7" : "My First Gran Turismo", 15, 22);
    doc.setDrawColor(225, 6, 0); doc.line(15, 25, 195, 25);
    
    const poss = tutteLeAuto.filter(a => a.gioco === giocoAttivo && localStorage.getItem(`${a.gioco}-${a.id}`) === 'true');
    if (!poss.length) doc.text("Il garage è vuoto.", 15, 35);
    else {
        let x = 15, y = 35;
        for (const a of poss) {
            if (y > 270) { doc.addPage(); y = 20; x = 15; }
            const imgData = await getBase64Image(a.immagine);
            doc.addImage(imgData, 'JPEG', x, y, 20, 11);
            doc.setFontSize(7); doc.text(a.marca.toUpperCase(), x + 22, y + 4);
            doc.text(doc.splitTextToSize(a.nome, 37), x + 22, y + 8);
            x > 130 ? (x = 15, y += 28) : x += 65;
        }
    }
    doc.save(`Garage_${giocoAttivo}.pdf`);
    btn.innerText = "Scarica Lista PDF"; btn.disabled = false;
};

auth.onAuthStateChanged(u => {
    utenteCorrente = u;
    const b = document.getElementById('login-btn');
    if(b) b.innerText = u ? `Esci (${u.displayName.split(' ')[0]})` : "Accedi con Google";
    u ? caricaDatiUtente() : (localStorage.clear(), renderizzaAuto());
});

window.onload = async () => {
    document.getElementById('login-btn').onclick = gestisciLogin;
    document.getElementById('download-pdf').onclick = scaricaPDF;
    try {
        const r = await fetch('data.json?v=15');
        tutteLeAuto = await r.json();
        popolaFiltri();
        renderizzaAuto();
    } catch(e) { console.error(e); }
};

async function caricaDatiUtente() {
    const d = await db.collection('garages').doc(utenteCorrente.uid).get();
    if (d.exists) Object.entries(d.data()).forEach(([k,v]) => localStorage.setItem(k, v));
    renderizzaAuto();
}

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

        if (sortAttivo === "default") {
            fil.forEach(a => {
                const p = a.paese || "Altro";
                if(!groups[p]) groups[p] = {};
                if(!groups[p][a.marca]) groups[p][a.marca] = [];
                groups[p][a.marca].push(a);
            });
        } else if (sortAttivo === "marca" || sortAttivo === "paese") {
            fil.forEach(a => {
                const k = sortAttivo === "marca" ? (a.marca || "Altro") : (a.paese || "Altro");
                if(!groups[k]) groups[k] = [];
                groups[k].push(a);
            });
        } else if (sortAttivo === "trasmissione") {
            ordineTrasmissioni.forEach(o => groups[o] = []);
            fil.forEach(a => groups[mapTrasmissione(a.trasmissione)].push(a));
        } else if (sortAttivo === "potenza" || sortAttivo === "peso") {
            const isPot = sortAttivo === "potenza";
            const cats = isPot ? ["1'600 Cv -","1'300 Cv - 1'599 Cv","1'100 Cv - 1'299 Cv","1'000 Cv - 1'099 Cv","900 Cv - 999 Cv","800 Cv - 899 Cv","700 Cv - 799 Cv","600 Cv - 699 Cv","500 Cv - 599 Cv","400 Cv - 499 Cv","300 Cv - 399 Cv","200 Cv - 299 Cv","100 Cv - 199 Cv","- 99 Cv","Altro"] 
                               : ["2'300 Kg -","2'000 Kg - 2'299 Kg","1'800 Kg - 1'999 Kg","1'700 Kg - 1'799 Kg","1'600 Kg - 1'699 Kg","1'500 Kg - 1'599 Kg","1'400 Kg - 1'499 Kg","1'300 Kg - 1'399 Kg","1'200 Kg - 1'299 Kg","1'100 Kg - 1'199 Kg","1'000 Kg - 1'099 Kg","900 Kg - 999 Kg","800 Kg - 899 Kg","700 Kg - 799 Kg","600 Kg - 699 Kg","500 Kg - 599 Kg","- 499 Kg","Altro"];
            cats.forEach(c => groups[c] = []);
            fil.forEach(a => {
                const v = parseVal(isPot ? a.cv : a.peso);
                let c = "Altro";
                if(v !== null) {
                    if(isPot) {
                        if(v>=1600)c=cats[0];else if(v>=1300)c=cats[1];else if(v>=1100)c=cats[2];else if(v>=1000)c=cats[3];else if(v>=900)c=cats[4];else if(v>=800)c=cats[5];else if(v>=700)c=cats[6];else if(v>=600)c=cats[7];else if(v>=500)c=cats[8];else if(v>=400)c=cats[9];else if(v>=300)c=cats[10];else if(v>=200)c=cats[11];else if(v>=100)c=cats[12];else c=cats[13];
                    } else {
                        if(v>=2300)c=cats[0];else if(v>=2000)c=cats[1];else if(v>=1800)c=cats[2];else if(v>=1700)c=cats[3];else if(v>=1600)c=cats[4];else if(v>=1500)c=cats[5];else if(v>=1400)c=cats[6];else if(v>=1300)c=cats[7];else if(v>=1200)c=cats[8];else if(v>=1100)c=cats[9];else if(v>=1000)c=cats[10];else if(v>=900)c=cats[11];else if(v>=800)c=cats[12];else if(v>=700)c=cats[13];else if(v>=600)c=cats[14];else if(v>=500)c=cats[15];else c=cats[16];
                    }
                }
                groups[c].push(a);
            });
        }

        Object.keys(groups).sort((a, b) => {
            if (sortAttivo === "trasmissione") return ordineTrasmissioni.indexOf(a) - ordineTrasmissioni.indexOf(b);
            if (a === "Altro") return 1;
            if (b === "Altro") return -1;
            return a.localeCompare(b);
        }).forEach(k => {
            if (sortAttivo === "default") {
                if (Object.keys(groups[k]).length === 0) return;
                renderHeader(k, fil.filter(a => (a.paese || "Altro") === k), main);
                
                Object.keys(groups[k]).sort((a, b) => {
                    if (a === "Altro") return 1;
                    if (b === "Altro") return -1;
                    return a.localeCompare(b);
                }).forEach(m => {
                    const t = document.createElement('h3'); 
                    t.className = 'brand-title';
                    const pM = groups[k][m].filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
                    t.innerHTML = `— ${m} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${pM}/${groups[k][m].length}</span>`;
                    main.appendChild(t);
                    
                    const g = document.createElement('div'); 
                    g.className = 'car-grid';
                    groups[k][m].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
                    main.appendChild(g);
                });
            } else {
                if (groups[k].length === 0) return;
                renderHeader(k, groups[k], main);
                const g = document.createElement('div'); 
                g.className = 'car-grid';
                groups[k].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(a => g.appendChild(creaCard(a)));
                main.appendChild(g);
            }
        });
    }
    aggiornaContatore();
}

function renderHeader(t, l, c) {
    const p = l.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
    const pr = l.length ? Math.round((p/l.length)*100) : 0;
    const id = t.replace(/[^a-z0-9]/gi, '');
    const h = document.createElement('div');
    h.className = 'category-header';
    h.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%; align-items:baseline;">
            <h2 class="country-title">${t}</h2>
            <span style="font-size:0.9rem; font-weight:bold; color:${pr===100?'#e10600':'white'}">${p}/${l.length} (${pr}%)</span>
        </div>
        <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; margin-top:10px; overflow:hidden;">
            <div id="bar-${id}" style="width:0%; height:100%; background:linear-gradient(90deg, #e10600, #ff4d4d); transition:width 0.8s ease;"></div>
        </div>`;
    c.appendChild(h);
    setTimeout(() => { const b = document.getElementById(`bar-${id}`); if(b) b.style.width = pr + "%"; }, 50);
}

function creaCard(a) {
    const k = `${a.gioco}-${a.id}`, o = localStorage.getItem(k) === 'true';
    const c = document.createElement('div');
    c.className = `car-card ${o ? 'owned' : ''}`;
    c.innerHTML = `<img src="${a.immagine}" class="car-thumb">
        <div class="car-info"><span class="car-brand-tag">${a.marca}</span><h3>${a.nome}</h3></div>
        <div class="owned-container"><input type="checkbox" ${o ? 'checked' : ''}><label>Nel garage</label></div>`;
    const ck = c.querySelector('input');
    ck.onchange = async () => {
        localStorage.setItem(k, ck.checked);
        if(utenteCorrente) await db.collection('garages').doc(utenteCorrente.uid).set({[k]: ck.checked}, {merge: true});
        renderizzaAuto();
    };
    c.querySelector('img').onclick = () => mostraDettagli(a);
    return c;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal"), b = document.getElementById("modal-body");
    const s = a.gioco === "mfgt" ? ['anno','trasmissione','velocita','accelerazione','frenata','sterzata','stabilita'] 
                                 : ['anno','pp','aspirazione','trasmissione','cilindrata','tipo_motore','cv','peso','prezzo','acquisto'];
    const lbl = {pp:'Punti Prestazione', cv:'Potenza', acquisto:'Negozio', velocita:'Velocità Massima'};
    let g = '<div class="specs-grid">';
    s.forEach(x => g += `<div class="spec-item"><strong>${lbl[x]||x}</strong>${a[x]||'-'}</div>`);
    g += '</div>';
    b.innerHTML = `<img src="${a.immagine}" class="modal-img">
        <div style="padding:20px;">
            <h2>${a.nome}</h2><p class="modal-brand">${a.marca}</p>${g}
            <h4 class="mfgt-subtitle">${a.titolo || ''}</h4>
            <p class="modal-description">${a.descrizione || ''}</p>
            ${a.link ? `<a href="${a.link}" target="_blank" class="external-link">Sito Ufficiale</a>`:''}
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

document.getElementById('searchBar').oninput = renderizzaAuto;
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
        if(e.target.id === 'download-pdf' || e.target.id === 'login-btn') return;
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
    if(!e.target.matches('#legenda-toggle') && !e.target.closest('#legenda-content')) document.getElementById('legenda-content').classList.remove('show');
    if(e.target.id === 'carModal') e.target.style.display = 'none';
};
