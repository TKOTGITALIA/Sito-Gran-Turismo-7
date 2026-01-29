let tutteLeAuto = [], giocoAttivo = "gt7", utenteCorrente = null;

const gestisciLogin = () => { 
    if (!utenteCorrente) { 
        auth.signInWithPopup(provider).catch(e => alert(e.message)); 
    } else { 
        auth.signOut(); 
    } 
};

const scaricaPDF = async () => {
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF();
    const gameNome = giocoAttivo === "gt7" ? "Gran Turismo 7" : "My First Gran Turismo";
    let titoloGarage = (utenteCorrente && utenteCorrente.displayName) ? `GARAGE DI ${utenteCorrente.displayName.toUpperCase()}` : "GARAGE PERSONALE";
    const btn = document.getElementById('download-pdf'); 
    btn.innerText = "Generazione..."; btn.disabled = true;

    doc.setFontSize(18); doc.setTextColor(225, 6, 0); doc.text(titoloGarage, 15, 15);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(gameNome, 15, 22);
    doc.setDrawColor(225, 6, 0); doc.line(15, 25, 195, 25);
    
    const possedute = tutteLeAuto.filter(a => a.gioco === giocoAttivo && localStorage.getItem(`${a.gioco}-${a.id}`) === 'true');
    
    if (possedute.length === 0) { 
        doc.setFontSize(10); doc.setTextColor(0); doc.text("Il garage è attualmente vuoto.", 15, 35); 
    } else {
        let x = 15, y = 35; 
        const colWidth = 60, rowHeight = 28, imgW = 20, imgH = 11;      
        let count = 0;

        for (const a of possedute) {
            if (y > 270) { doc.addPage(); y = 20; x = 15; }
            try { 
                const imgData = await getBase64Image(a.immagine); 
                doc.addImage(imgData, 'JPEG', x, y, imgW, imgH); 
            } catch (e) { doc.setDrawColor(200); doc.rect(x, y, imgW, imgH); }

            doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
            doc.text(`${a.marca.toUpperCase()} (${a.paese || '-'})`, x + 22, y + 4);

            doc.setFont("helvetica", "normal"); doc.setTextColor(60); 
            doc.text(doc.splitTextToSize(a.nome, colWidth - 23), x + 22, y + 8);

            count++;
            if (count % 3 === 0) { x = 15; y += rowHeight; } else { x += colWidth + 5; }
        }
    }
    doc.save(`Garage_${giocoAttivo}.pdf`); 
    btn.innerText = "Scarica Lista PDF"; btn.disabled = false;
};

function getBase64Image(url) {
    return new Promise((resolve, reject) => {
        const img = new Image(); img.setAttribute('crossOrigin', 'anonymous');
        img.onload = () => { 
            const canvas = document.createElement("canvas"); 
            canvas.width = img.width; canvas.height = img.height; 
            canvas.getContext("2d").drawImage(img, 0, 0); 
            resolve(canvas.toDataURL("image/jpeg", 0.7)); 
        };
        img.onerror = reject; img.src = url;
    });
}

auth.onAuthStateChanged(u => { 
    utenteCorrente = u; 
    const btn = document.getElementById('login-btn'); 
    if (u) { 
        btn.innerText = `Esci (${u.displayName.split(' ')[0]})`; 
        caricaDatiUtente(); 
    } else { 
        btn.innerText = "Accedi con Google"; 
        localStorage.clear(); 
        renderizzaAuto(); 
    } 
});

window.onload = async () => {
    document.getElementById('login-btn').onclick = gestisciLogin; 
    document.getElementById('download-pdf').onclick = scaricaPDF;
    try { 
        const res = await fetch('data.json?v=10'); 
        tutteLeAuto = await res.json(); 
        popolaFiltri(); renderizzaAuto(); 
    } catch (e) { console.error("Errore dati"); }
};

async function caricaDatiUtente() {
    const doc = await db.collection('garages').doc(utenteCorrente.uid).get();
    if (doc.exists) { 
        const d = doc.data(); 
        Object.keys(d).forEach(k => localStorage.setItem(k, d[k])); 
    }
    renderizzaAuto();
}

function popolaFiltri() {
    const cS = document.getElementById('filter-country'), bS = document.getElementById('filter-brand');
    const f = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const p = [...new Set(f.map(a => a.paese))].sort(), m = [...new Set(f.map(a => a.marca))].sort();
    cS.innerHTML = '<option value="all">Tutti i Paesi</option>' + p.map(x => `<option value="${x}">${x}</option>`).join('');
    bS.innerHTML = '<option value="all">Tutte le Marche</option>' + m.map(x => `<option value="${x}">${x}</option>`).join('');
}

function renderizzaAuto() {
    const main = document.querySelector('main'), s = document.getElementById('searchBar').value.toLowerCase();
    const pF = document.getElementById('filter-country').value, mF = document.getElementById('filter-brand').value;
    main.innerHTML = "";
    let f = tutteLeAuto.filter(a => a.gioco === giocoAttivo && a.nome.toLowerCase().includes(s) && (pF === "all" || a.paese === pF) && (mF === "all" || a.marca === mF));
    
    if (giocoAttivo === "mfgt") {
        const grid = document.createElement('div'); grid.className = 'car-grid';
        f.forEach(a => grid.appendChild(creaCard(a))); 
        main.appendChild(grid);
    } else {
        const g = {}; f.forEach(a => { if (!g[a.paese]) g[a.paese] = {}; if (!g[a.paese][a.marca]) g[a.paese][a.marca] = []; g[a.paese][a.marca].push(a); });
        for (let p in g) {
            const h = document.createElement('div'); h.className = 'category-header'; h.innerHTML = `<h2 class="country-title">${p}</h2>`; main.appendChild(h);
            for (let m in g[p]) {
                const b = document.createElement('h3'); b.className = 'brand-title'; b.innerText = `— ${m}`; main.appendChild(b);
                const grid = document.createElement('div'); grid.className = 'car-grid'; 
                g[p][m].forEach(a => grid.appendChild(creaCard(a))); main.appendChild(grid);
            }
        }
    }
    aggiornaContatore();
}

function creaCard(a) {
    const k = `${a.gioco}-${a.id}`, owned = localStorage.getItem(k) === 'true';
    const c = document.createElement('div'); c.className = `car-card ${owned ? 'owned' : ''}`;
    c.innerHTML = `<img src="${a.immagine}" class="car-thumb"><div class="car-info"><span class="car-brand-tag">${a.marca}</span><h3>${a.nome}</h3></div><div class="owned-container"><input type="checkbox" ${owned ? 'checked' : ''}><label>Nel garage</label></div>`;
    const ck = c.querySelector('input');
    ck.onchange = async () => { 
        localStorage.setItem(k, ck.checked); c.classList.toggle('owned', ck.checked); 
        if (utenteCorrente) await db.collection('garages').doc(utenteCorrente.uid).set({[k]: ck.checked}, {merge: true}); 
        aggiornaContatore(); 
    };
    c.querySelector('img').onclick = () => mostraDettagli(a); 
    return c;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal"), b = document.getElementById("modal-body");
    let s = a.gioco === "mfgt" ? `
        <div class="specs-grid">
            <div class="spec-item"><strong>Anno</strong>${a.anno || '-'}</div>
            <div class="spec-item"><strong>Trasmissione</strong>${a.trasmissione || '-'}</div>
            <div class="spec-item"><strong>Velocità Massima</strong>${a.velocita || '-'}</div>
            <div class="spec-item"><strong>Accelerazione</strong>${a.accelerazione || '-'}</div>
            <div class="spec-item"><strong>Frenata</strong>${a.frenata || '-'}</div>
            <div class="spec-item"><strong>Sterzata</strong>${a.sterzata || '-'}</div>
            <div class="spec-item"><strong>Stabilità</strong>${a.stabilita || '-'}</div>
        </div>` : `
        <div class="specs-grid">
            <div class="spec-item"><strong>Anno</strong>${a.anno || '-'}</div>
            <div class="spec-item"><strong>Punti Prestazione</strong>${a.pp || '-'}</div>
            <div class="spec-item"><strong>Aspirazione</strong>${a.aspirazione || '-'}</div>
            <div class="spec-item"><strong>Trasmissione</strong>${a.trasmissione || '-'}</div>
            <div class="spec-item"><strong>Cilindrata</strong>${a.cilindrata || '-'}</div>
            <div class="spec-item"><strong>Tipo motore</strong>${a.tipo_motore || '-'}</div>
            <div class="spec-item"><strong>Potenza</strong>${a.cv || '-'}</div>
            <div class="spec-item"><strong>Peso</strong>${a.peso || '-'}</div>
            <div class="spec-item"><strong>Prezzo</strong>${a.prezzo || '-'}</div>
            <div class="spec-item"><strong>Negozio</strong>${a.acquisto || '-'}</div>
        </div>`;

    b.innerHTML = `<img src="${a.immagine}" class="modal-img"><div style="padding:20px;"><h2>${a.nome}</h2><p class="modal-brand">${a.marca}</p>${s}<h4 class="mfgt-subtitle">${a.titolo || ''}</h4><p class="modal-description">${a.descrizione || ''}</p>${a.link ? `<a href="${a.link}" target="_blank" class="external-link">Sito Ufficiale</a>`:''}</div>`;
    m.style.display = "block"; 
    document.querySelector(".close-button").onclick = () => m.style.display = "none";
}

function aggiornaContatore() {
    const l = tutteLeAuto.filter(a => a.gioco === giocoAttivo), o = l.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
    const p = l.length > 0 ? Math.round((o / l.length) * 100) : 0;
    document.getElementById('owned-count').innerText = o; 
    document.getElementById('total-count').innerText = l.length;
    document.getElementById('progress-bar').style.width = p + "%"; 
    document.getElementById('completion-perc').innerText = p + "%";
}

document.getElementById('searchBar').oninput = renderizzaAuto;
document.getElementById('filter-country').onchange = renderizzaAuto;
document.getElementById('filter-brand').onchange = renderizzaAuto;
document.getElementById('reset-filters').onclick = () => { 
    document.getElementById('searchBar').value = ""; document.getElementById('filter-country').value = "all"; 
    document.getElementById('filter-brand').value = "all"; renderizzaAuto(); 
};

document.querySelectorAll('.game-btn').forEach(b => { 
    b.onclick = (e) => { 
        if (e.target.id.includes('-btn') || e.target.id === 'download-pdf') return; 
        document.querySelectorAll('.game-btn').forEach(x => x.classList.remove('active')); 
        e.target.classList.add('active'); giocoAttivo = e.target.dataset.game; 
        const asp = document.getElementById('legenda-aspirazione');
        if (asp) asp.style.display = (giocoAttivo === "mfgt") ? "none" : "block";
        document.getElementById('filter-container').style.display = giocoAttivo === "mfgt" ? "none" : "flex"; 
        popolaFiltri(); renderizzaAuto(); 
    }; 
});

document.getElementById('legenda-toggle').onclick = (e) => { e.stopPropagation(); document.getElementById('legenda-content').classList.toggle('show'); };
window.onclick = (e) => { 
    const c = document.getElementById('legenda-content');
    if (!e.target.matches('#legenda-toggle') && !e.target.closest('#legenda-content')) c.classList.remove('show');
};
