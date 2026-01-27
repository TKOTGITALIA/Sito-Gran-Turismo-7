console.log("Script inizializzato");
alert("Script Caricato!"); // Se non vedi questo, il problema è il percorso del file su GitHub

let tutteLeAuto = [], giocoAttivo = "gt7", utenteCorrente = null;
const loginBtn = document.getElementById('login-btn');

if (loginBtn) {
    loginBtn.onclick = () => {
        console.log("Click su login");
        if (!utenteCorrente) {
            auth.signInWithPopup(provider).catch(e => alert("Errore Login: " + e.message));
        } else {
            auth.signOut();
        }
    };
}

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

window.onload = async () => {
    try {
        const res = await fetch('data.json?v=4');
        if (!res.ok) throw new Error("File data.json non trovato");
        tutteLeAuto = await res.json();
        popolaFiltri();
        renderizzaAuto();
    } catch (e) {
        console.error(e);
        alert("Errore nel caricamento dei dati (data.json)");
    }
};

// ... (resto delle funzioni popolaFiltri, renderizzaAuto, creaCard, mostraDettagli rimangono uguali)
function popolaFiltri() {
    const cS = document.getElementById('filter-country'), bS = document.getElementById('filter-brand'), cont = document.getElementById('filter-container');
    if (!cS || !bS) return;
    if (giocoAttivo === "mfgt") { cont.style.display = "none"; return; }
    cont.style.display = "flex";
    const filtered = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const p = [...new Set(filtered.map(a => a.paese))].sort(), m = [...new Set(filtered.map(a => a.marca))].sort();
    cS.innerHTML = '<option value="all">Tutti i Paesi</option>' + p.map(x => `<option value="${x}">${x}</option>`).join('');
    bS.innerHTML = '<option value="all">Tutte le Marche</option>' + m.map(x => `<option value="${x}">${x}</option>`).join('');
}

function renderizzaAuto() {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = "";
    const s = document.getElementById('searchBar').value.toLowerCase();
    const p = document.getElementById('filter-country').value;
    const m = document.getElementById('filter-brand').value;
    
    let filtered = tutteLeAuto.filter(a => a.gioco === giocoAttivo && a.nome.toLowerCase().includes(s) && (p === "all" || a.paese === p) && (m === "all" || a.marca === m));
    
    const g = document.createElement('div'); g.className = 'car-grid';
    filtered.forEach(a => g.appendChild(creaCard(a)));
    main.appendChild(g);
    aggiornaContatore();
}

function creaCard(a) {
    const k = `${a.gioco}-${a.id}`, owned = localStorage.getItem(k) === 'true', c = document.createElement('div');
    c.className = `car-card ${owned ? 'owned' : ''}`;
    c.innerHTML = `<img src="${a.immagine}" class="car-thumb"><h3>${a.nome}</h3><div class="owned-container"><input type="checkbox" ${owned ? 'checked' : ''}><label>Nel garage</label></div>`;
    c.querySelector('input').onchange = async (e) => {
        const v = e.target.checked; localStorage.setItem(k, v); c.classList.toggle('owned', v);
        if (utenteCorrente) await db.collection('garages').doc(utenteCorrente.uid).set({[k]: v}, {merge: true});
        aggiornaContatore();
    };
    return c;
}

function aggiornaContatore() {
    const list = tutteLeAuto.filter(a => a.gioco === giocoAttivo), own = list.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length, p = list.length > 0 ? Math.round((own / list.length) * 100) : 0;
    document.getElementById('owned-count').innerText = own;
    document.getElementById('total-count').innerText = list.length;
    document.getElementById('progress-bar').style.width = p + "%";
}

document.getElementById('searchBar').oninput = renderizzaAuto;
document.getElementById('filter-country').onchange = renderizzaAuto;
document.getElementById('filter-brand').onchange = renderizzaAuto;
document.querySelectorAll('.game-btn').forEach(b => b.onclick = (e) => {
    if(e.target.id === 'login-btn') return;
    document.querySelectorAll('.game-btn').forEach(x => x.classList.remove('active'));
    e.target.classList.add('active');
    giocoAttivo = e.target.dataset.game;
    popolaFiltri();
    renderizzaAuto();
});
