let tutteLeAuto = [], giocoAttivo = "gt7", utenteCorrente = null;
const loginBtn = document.getElementById('login-btn');

if (loginBtn) loginBtn.onclick = () => !utenteCorrente ? auth.signInWithPopup(provider) : auth.signOut();

auth.onAuthStateChanged(u => {
    utenteCorrente = u;
    if (u) {
        loginBtn.innerText = `Esci (${u.displayName.split(' ')[0]})`;
        caricaDatiUtente();
    } else {
        loginBtn.innerText = "Accedi con Google";
        localStorage.clear();
        renderizzaAuto();
    }
});

// Cambiato window.onload con un listener più solido
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('data.json'); // Rimosso ./ per GitHub
        if (!res.ok) throw new Error();
        tutteLeAuto = await res.json();
        popolaFiltri();
        renderizzaAuto();
    } catch (e) {
        console.error("Errore: file data.json non trovato o non valido");
    }
});

async function caricaDatiUtente() {
    if (!utenteCorrente) return;
    const doc = await db.collection('garages').doc(utenteCorrente.uid).get();
    if (doc.exists) {
        const d = doc.data();
        Object.keys(d).forEach(k => localStorage.setItem(k, d[k]));
    }
    renderizzaAuto();
}

function popolaFiltri() {
    const cS = document.getElementById('filter-country'), bS = document.getElementById('filter-brand'), cont = document.getElementById('filter-container');
    if (giocoAttivo === "mfgt") { cont.style.display = "none"; return; }
    cont.style.display = "flex";
    const filtered = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const p = [...new Set(filtered.map(a => a.paese))].sort(), m = [...new Set(filtered.map(a => a.marca))].sort();
    cS.innerHTML = '<option value="all">Tutti i Paesi</option>' + p.map(x => `<option value="${x}">${x}</option>`).join('');
    bS.innerHTML = '<option value="all">Tutte le Marche</option>' + m.map(x => `<option value="${x}">${x}</option>`).join('');
}

function renderizzaAuto() {
    const main = document.querySelector('main'), s = document.getElementById('searchBar').value.toLowerCase(), p = document.getElementById('filter-country').value, m = document.getElementById('filter-brand').value;
    if (!main) return;
    main.innerHTML = "";
    let filtered = tutteLeAuto.filter(a => a.gioco === giocoAttivo && a.nome.toLowerCase().includes(s) && (p === "all" || a.paese === p) && (m === "all" || a.marca === m));
    
    if (giocoAttivo === "mfgt") {
        const g = document.createElement('div'); g.className = 'car-grid';
        filtered.forEach(a => g.appendChild(creaCard(a)));
        main.appendChild(g);
    } else {
        const cat = {};
        filtered.forEach(a => { if(!cat[a.paese]) cat[a.paese]={}; if(!cat[a.paese][a.marca]) cat[a.paese][a.marca]=[]; cat[a.paese][a.marca].push(a); });
        for (let x in cat) {
            const h = document.createElement('div'); h.className = 'category-header'; h.innerHTML = `<h2 class="country-title">${x}</h2>`; main.appendChild(h);
            for (let y in cat[x]) {
                const t = document.createElement('h3'); t.className = 'brand-title'; t.innerText = `— ${y}`; main.appendChild(t);
                const g = document.createElement('div'); g.className = 'car-grid';
                cat[x][y].forEach(a => g.appendChild(creaCard(a)));
                main.appendChild(g);
            }
        }
    }
    aggiornaContatore();
}

function creaCard(a) {
    const k = `${a.gioco}-${a.id}`, owned = localStorage.getItem(k) === 'true', c = document.createElement('div');
    c.className = `car-card ${owned ? 'owned' : ''}`;
    c.innerHTML = `<img src="${a.immagine}" class="car-thumb" loading="lazy"><h3>${a.nome}</h3><div class="owned-container"><input type="checkbox" ${owned ? 'checked' : ''}><label>Nel garage</label></div>`;
    c.querySelector('input').onchange = async (e) => {
        const v = e.target.checked; localStorage.setItem(k, v); c.classList.toggle('owned', v);
        if (utenteCorrente) await db.collection('garages').doc(utenteCorrente.uid).set({[k]: v}, {merge: true});
        aggiornaContatore();
    };
    c.querySelector('img').onclick = () => mostraDettagli(a);
    return c;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal"), b = document.getElementById("modal-body");
    let s = a.gioco === "mfgt" ? `<div class="specs-grid"><div class="spec-item"><strong>Anno</strong> ${a.anno}</div><div class="spec-item"><strong>Velocità</strong> ${a.velocita||'-'}</div><div class="spec-item"><strong>Acc.</strong> ${a.accelerazione||'-'}</div><div class="spec-item"><strong>Frenata</strong> ${a.frenata||'-'}</div><div class="spec-item"><strong>Sterzo</strong> ${a.sterzata||'-'}</div><div class="spec-item"><strong>Stabilità</strong> ${a.stabilita||'-'}</div></div>` : `<div class="specs-grid"><div class="spec-item"><strong>Anno</strong> ${a.anno}</div><div class="spec-item"><strong>PP</strong> ${a.pp}</div><div class="spec-item"><strong>Prezzo</strong> ${a.prezzo}</div><div class="spec-item"><strong>Negozio</strong> ${a.acquisto}</div><div class="spec-item"><strong>CV</strong> ${a.cv}</div><div class="spec-item"><strong>Peso</strong> ${a.peso}</div></div>`;
    b.innerHTML = `<img src="${a.immagine}" class="modal-img"><div style="padding:20px;"><h2>${a.nome}</h2><p style="color:#e10600;font-weight:bold;text-transform:uppercase;">${a.paese} | ${a.marca}</p>${s}<hr style="border:0.5px solid #333;margin:20px 0;"><p>${a.descrizione}</p>${a.gioco==='gt7'?`<div style="text-align:center;margin-top:20px;"><a href="${a.link}" target="_blank" class="btn-link">Sito Ufficiale</a></div>`:''}</div>`;
    m.style.display = "block"; document.body.style.overflow = "hidden";
    document.querySelector(".close-button").onclick = () => { m.style.display = "none"; document.body.style.overflow = "auto"; };
}

function aggiornaContatore() {
    const list = tutteLeAuto.filter(a => a.gioco === giocoAttivo), own = list.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length, p = list.length > 0 ? Math.round((own / list.length) * 100) : 0;
    document.getElementById('owned-count').innerText = own;
    document.getElementById('total-count').innerText = list.length;
    document.getElementById('completion-perc').innerText = p + "%";
    document.getElementById('progress-bar').style.width = p + "%";
}

document.getElementById('filter-country').onchange = renderizzaAuto;
document.getElementById('filter-brand').onchange = renderizzaAuto;
document.getElementById('searchBar').oninput = renderizzaAuto;
document.getElementById('reset-filters').onclick = () => { document.getElementById('searchBar').value = ""; document.getElementById('filter-country').value = "all"; document.getElementById('filter-brand').value = "all"; renderizzaAuto(); };
document.querySelectorAll('.game-btn').forEach(b => b.onclick = (e) => { if(e.target.id === 'login-btn') return; document.querySelectorAll('.game-btn').forEach(x => x.classList.remove('active')); e.target.classList.add('active'); giocoAttivo = e.target.dataset.game; popolaFiltri(); renderizzaAuto(); });
