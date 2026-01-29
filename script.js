let tutteLeAuto = [], giocoAttivo = "gt7", utenteCorrente = null;

const gestisciLogin = () => { 
    !utenteCorrente ? auth.signInWithPopup(provider).catch(e => alert(e.message)) : auth.signOut(); 
};

const scaricaPDF = async () => {
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(), gameNome = giocoAttivo === "gt7" ? "Gran Turismo 7" : "My First Gran Turismo";
    let titolo = (utenteCorrente?.displayName) ? `GARAGE DI ${utenteCorrente.displayName.toUpperCase()}` : "GARAGE PERSONALE";
    const btn = document.getElementById('download-pdf'); 
    btn.innerText = "Generazione..."; btn.disabled = true;

    doc.setFontSize(18); doc.setTextColor(225, 6, 0); doc.text(titolo, 15, 15);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(gameNome, 15, 22);
    doc.setDrawColor(225, 6, 0); doc.line(15, 25, 195, 25);
    
    const poss = tutteLeAuto.filter(a => a.gioco === giocoAttivo && localStorage.getItem(`${a.gioco}-${a.id}`) === 'true');
    if (!poss.length) { 
        doc.setFontSize(10); doc.setTextColor(0); doc.text("Il garage è vuoto.", 15, 35); 
    } else {
        let x = 15, y = 35; 
        for (const a of poss) {
            if (y > 270) { doc.addPage(); y = 20; x = 15; }
            try { doc.addImage(await getBase64Image(a.immagine), 'JPEG', x, y, 20, 11); } catch(e) { doc.rect(x, y, 20, 11); }
            doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text(`${a.marca.toUpperCase()} (${a.paese || '-'})`, x + 22, y + 4);
            doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(a.nome, 37), x + 22, y + 8);
            (x > 130) ? (x = 15, y += 28) : x += 65;
        }
    }
    doc.save(`Garage_${giocoAttivo}.pdf`); 
    btn.innerText = "Scarica Lista PDF"; btn.disabled = false;
};

const getBase64Image = url => new Promise((resolve, reject) => {
    const img = new Image(); img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => { 
        const cvs = document.createElement("canvas"); cvs.width = img.width; cvs.height = img.height; 
        cvs.getContext("2d").drawImage(img, 0, 0); resolve(cvs.toDataURL("image/jpeg", 0.7)); 
    };
    img.onerror = reject; img.src = url;
});

auth.onAuthStateChanged(u => { 
    utenteCorrente = u; 
    const btn = document.getElementById('login-btn'); 
    btn.innerText = u ? `Esci (${u.displayName.split(' ')[0]})` : "Accedi con Google";
    if (u) caricaDatiUtente(); else { localStorage.clear(); renderizzaAuto(); }
});

window.onload = async () => {
    document.getElementById('login-btn').onclick = gestisciLogin; 
    document.getElementById('download-pdf').onclick = scaricaPDF;
    try { 
        const res = await fetch('data.json?v=11'); 
        tutteLeAuto = await res.json(); 
        popolaFiltri(); renderizzaAuto(); 
    } catch(e) { console.error("Errore dati"); }
};

async function caricaDatiUtente() {
    const doc = await db.collection('garages').doc(utenteCorrente.uid).get();
    if (doc.exists) Object.entries(doc.data()).forEach(([k,v]) => localStorage.setItem(k, v));
    renderizzaAuto();
}

function popolaFiltri() {
    const cS = document.getElementById('filter-country'), bS = document.getElementById('filter-brand'), f = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const p = [...new Set(f.map(a => a.paese))].sort(), m = [...new Set(f.map(a => a.marca))].sort();
    cS.innerHTML = '<option value="all">Tutti i Paesi</option>' + p.map(x => `<option value="${x}">${x}</option>`).join('');
    bS.innerHTML = '<option value="all">Tutte le Marche</option>' + m.map(x => `<option value="${x}">${x}</option>`).join('');
}

function renderizzaAuto() {
    const main = document.querySelector('main'), s = document.getElementById('searchBar').value.toLowerCase();
    const pF = document.getElementById('filter-country').value, mF = document.getElementById('filter-brand').value;
    main.innerHTML = "";
    const filtered = tutteLeAuto.filter(a => a.gioco === giocoAttivo && a.nome.toLowerCase().includes(s) && (pF === "all" || a.paese === pF) && (mF === "all" || a.marca === mF));
    
    if (giocoAttivo === "mfgt") {
        const grid = document.createElement('div'); grid.className = 'car-grid';
        filtered.forEach(a => grid.appendChild(creaCard(a))); 
        main.appendChild(grid);
    } else {
        const g = {}; filtered.forEach(a => { if(!g[a.paese]) g[a.paese] = {}; if(!g[a.paese][a.marca]) g[a.paese][a.marca] = []; g[a.paese][a.marca].push(a); });
        for (let p in g) {
            const autoP = tutteLeAuto.filter(a => a.gioco === giocoAttivo && a.paese === p), possP = autoP.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
            const percP = autoP.length ? Math.round((possP / autoP.length) * 100) : 0;
            const h = document.createElement('div'); h.className = 'category-header';
            h.style = "flex-direction:column; align-items:flex-start; padding:15px 40px;";
            h.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%; align-items:baseline;"><h2 class="country-title">${p}</h2><span style="font-size:0.9rem; font-weight:bold; color:${percP===100?'var(--primary-red)':'white'}">${possP}/${autoP.length} (${percP}%)</span></div>
                <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; margin-top:10px; overflow:hidden;"><div id="bar-${p}" style="width:0%; height:100%; background:linear-gradient(90deg, var(--primary-red), #ff4d4d); transition:width 0.8s cubic-bezier(0.22, 1, 0.36, 1);"></div></div>`;
            main.appendChild(h);
            setTimeout(() => { if(document.getElementById(`bar-${p}`)) document.getElementById(`bar-${p}`).style.width = percP + "%"; }, 50);

            for (let m in g[p]) {
                const autoM = autoP.filter(a => a.marca === m), possM = autoM.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
                const b = document.createElement('h3'); b.className = 'brand-title';
                b.innerHTML = `— ${m} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">${possM}/${autoM.length} (${Math.round((possM/autoM.length)*100)}%)</span>`;
                main.appendChild(b);
                const grid = document.createElement('div'); grid.className = 'car-grid'; filtered.filter(a => a.paese === p && a.marca === m).forEach(a => grid.appendChild(creaCard(a)));
                main.appendChild(grid);
            }
        }
    }
    aggiornaContatore();
}

function creaCard(a) {
    const k = `${a.gioco}-${a.id}`, owned = localStorage.getItem(k) === 'true', c = document.createElement('div');
    c.className = `car-card ${owned ? 'owned' : ''}`;
    c.innerHTML = `<img src="${a.immagine}" class="car-thumb"><div class="car-info"><span class="car-brand-tag">${a.marca}</span><h3>${a.nome}</h3></div><div class="owned-container"><input type="checkbox" ${owned ? 'checked' : ''}><label>Nel garage</label></div>`;
    const ck = c.querySelector('input');
    ck.onchange = async () => { 
        localStorage.setItem(k, ck.checked); 
        if (utenteCorrente) await db.collection('garages').doc(utenteCorrente.uid).set({[k]: ck.checked}, {merge: true}); 
        renderizzaAuto(); 
    };
    c.querySelector('img').onclick = () => mostraDettagli(a); 
    return c;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal"), b = document.getElementById("modal-body");
    const specs = a.gioco === "mfgt" ? ['anno','trasmissione','velocita','accelerazione','frenata','sterzata','stabilita'] : ['anno','pp','aspirazione','trasmissione','cilindrata','tipo_motore','cv','peso','prezzo','acquisto'];
    const labels = {pp:'Punti Prestazione', cv:'Potenza', acquisto:'Negozio', velocita:'Velocità Massima'};
    
    let grid = '<div class="specs-grid">';
    specs.forEach(s => grid += `<div class="spec-item"><strong>${labels[s]||s}</strong>${a[s]||'-'}</div>`);
    grid += '</div>';

    b.innerHTML = `<img src="${a.immagine}" class="modal-img"><div style="padding:20px;"><h2>${a.nome}</h2><p class="modal-brand">${a.marca}</p>${grid}<h4 class="mfgt-subtitle">${a.titolo || ''}</h4><p class="modal-description">${a.descrizione || ''}</p>${a.link ? `<a href="${a.link}" target="_blank" class="external-link">Sito Ufficiale</a>`:''}</div>`;
    m.style.display = "block"; 
    document.querySelector(".close-button").onclick = () => m.style.display = "none";
}

function aggiornaContatore() {
    const l = tutteLeAuto.filter(a => a.gioco === giocoAttivo), o = l.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length, p = l.length ? Math.round((o / l.length) * 100) : 0;
    document.getElementById('owned-count').innerText = o; 
    document.getElementById('total-count').innerText = l.length;
    document.getElementById('progress-bar').style.width = p + "%"; 
    document.getElementById('completion-perc').innerText = p + "%";
}

document.getElementById('searchBar').oninput = renderizzaAuto;
document.getElementById('filter-country').onchange = renderizzaAuto;
document.getElementById('filter-brand').onchange = renderizzaAuto;
document.getElementById('reset-filters').onclick = () => { ['searchBar','filter-country','filter-brand'].forEach(id => document.getElementById(id).value = id === 'searchBar' ? "" : "all"); renderizzaAuto(); };

document.querySelectorAll('.game-btn').forEach(b => { 
    b.onclick = (e) => { 
        if (e.target.id === 'download-pdf') return; 
        document.querySelectorAll('.game-btn').forEach(x => x.classList.remove('active')); 
        e.target.classList.add('active'); giocoAttivo = e.target.dataset.game; 
        if(document.getElementById('legenda-aspirazione')) document.getElementById('legenda-aspirazione').style.display = (giocoAttivo === "mfgt") ? "none" : "block";
        document.getElementById('filter-container').style.display = giocoAttivo === "mfgt" ? "none" : "flex"; 
        popolaFiltri(); renderizzaAuto(); 
    }; 
});

document.getElementById('legenda-toggle').onclick = e => { e.stopPropagation(); document.getElementById('legenda-content').classList.toggle('show'); };
window.onclick = e => { if (!e.target.matches('#legenda-toggle') && !e.target.closest('#legenda-content')) document.getElementById('legenda-content').classList.remove('show'); };
