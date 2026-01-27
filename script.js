let tutteLeAuto = [], giocoAttivo = "gt7", utenteCorrente = null;

// Gestione Login
const gestisciLogin = () => {
    if (!utenteCorrente) {
        auth.signInWithPopup(provider).catch(e => alert("Errore: " + e.message));
    } else {
        auth.signOut();
    }
};

// Listener Stato Autenticazione
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

// Avvio Applicazione
window.onload = async () => {
    document.getElementById('login-btn').onclick = gestisciLogin;
    try {
        const res = await fetch('data.json?v=5');
        if (!res.ok) throw new Error();
        tutteLeAuto = await res.json();
        popolaFiltri();
        renderizzaAuto();
    } catch (e) {
        console.error("Errore caricamento dati");
    }
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
    const filtered = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const p = [...new Set(filtered.map(a => a.paese))].sort();
    const m = [...new Set(filtered.map(a => a.marca))].sort();
    cS.innerHTML = '<option value="all">Tutti i Paesi</option>' + p.map(x => `<option value="${x}">${x}</option>`).join('');
    bS.innerHTML = '<option value="all">Tutte le Marche</option>' + m.map(x => `<option value="${x}">${x}</option>`).join('');
}

function renderizzaAuto() {
    const main = document.querySelector('main');
    const s = document.getElementById('searchBar').value.toLowerCase();
    const pF = document.getElementById('filter-country').value;
    const mF = document.getElementById('filter-brand').value;
    main.innerHTML = "";

    let filtered = tutteLeAuto.filter(a => 
        a.gioco === giocoAttivo && 
        a.nome.toLowerCase().includes(s) && 
        (pF === "all" || a.paese === pF) && 
        (mF === "all" || a.marca === mF)
    );

    // Logica di raggruppamento per Paese e Marca
    const gruppi = {};
    filtered.forEach(a => {
        if (!gruppi[a.paese]) gruppi[a.paese] = {};
        if (!gruppi[a.paese][a.marca]) gruppi[a.paese][a.marca] = [];
        gruppi[a.paese][a.marca].push(a);
    });

    for (let paese in gruppi) {
        const h2 = document.createElement('div');
        h2.className = 'category-header';
        h2.innerHTML = `<h2 class="country-title">${paese}</h2>`;
        main.appendChild(h2);

        for (let marca in gruppi[paese]) {
            const h3 = document.createElement('h3');
            h3.className = 'brand-title';
            h3.innerText = `— ${marca}`;
            main.appendChild(h3);

            const grid = document.createElement('div');
            grid.className = 'car-grid';
            gruppi[paese][marca].forEach(a => grid.appendChild(creaCard(a)));
            main.appendChild(grid);
        }
    }
    aggiornaContatore();
}

function creaCard(a) {
    const k = `${a.gioco}-${a.id}`, owned = localStorage.getItem(k) === 'true';
    const c = document.createElement('div');
    c.className = `car-card ${owned ? 'owned' : ''}`;
    c.innerHTML = `
        <img src="${a.immagine}" class="car-thumb">
        <h3>${a.nome}</h3>
        <div class="owned-container">
            <input type="checkbox" ${owned ? 'checked' : ''}>
            <label>Nel garage</label>
        </div>`;
    
    const ck = c.querySelector('input');
    ck.onchange = async () => {
        localStorage.setItem(k, ck.checked);
        c.classList.toggle('owned', ck.checked);
        if (utenteCorrente) {
            await db.collection('garages').doc(utenteCorrente.uid).set({[k]: ck.checked}, {merge: true});
        }
        aggiornaContatore();
    };
    c.querySelector('img').onclick = () => mostraDettagli(a);
    return c;
}

function mostraDettagli(a) {
    const m = document.getElementById("carModal"), b = document.getElementById("modal-body");
    let specs = a.gioco === "mfgt" ? 
        `<div class="specs-grid">
            <div class="spec-item"><strong>Velocità</strong> ${a.velocita}</div>
            <div class="spec-item"><strong>Acc.</strong> ${a.accelerazione}</div>
            <div class="spec-item"><strong>Frenata</strong> ${a.frenata}</div>
            <div class="spec-item"><strong>Sterzo</strong> ${a.sterzata}</div>
        </div>` : 
        `<div class="specs-grid">
            <div class="spec-item"><strong>PP</strong> ${a.pp}</div>
            <div class="spec-item"><strong>CV</strong> ${a.cv}</div>
            <div class="spec-item"><strong>Peso</strong> ${a.peso}kg</div>
            <div class="spec-item"><strong>Negozio</strong> ${a.acquisto}</div>
        </div>`;

    b.innerHTML = `
        <img src="${a.immagine}" class="modal-img">
        <div style="padding:20px;">
            <h2>${a.nome}</h2>
            <p>${a.paese} | ${a.marca}</p>
            ${specs}
            <p style="margin-top:15px; font-size:0.9rem;">${a.descrizione}</p>
        </div>`;
    m.style.display = "block";
    document.querySelector(".close-button").onclick = () => m.style.display = "none";
}

function aggiornaContatore() {
    const list = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const own = list.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
    const p = list.length > 0 ? Math.round((own / list.length) * 100) : 0;
    document.getElementById('owned-count').innerText = own;
    document.getElementById('total-count').innerText = list.length;
    document.getElementById('progress-bar').style.width = p + "%";
    document.getElementById('completion-perc').innerText = p + "%";
}

// Event Listeners
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
        if (e.target.id === 'login-btn') return;
        document.querySelectorAll('.game-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        giocoAttivo = e.target.dataset.game;
        popolaFiltri();
        renderizzaAuto();
    }
});
