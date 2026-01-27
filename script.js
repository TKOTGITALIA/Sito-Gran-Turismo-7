// --- VARIABILI GLOBALI ---
// Nota: db, auth e provider sono già definiti nell'HTML
let tutteLeAuto = [];
let giocoAttivo = "gt7";
let utenteCorrente = null;

// --- GESTIONE LOGIN ---
const loginBtn = document.getElementById('login-btn');

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        if (!utenteCorrente) {
            auth.signInWithPopup(provider).catch(err => console.error("Errore login:", err));
        } else {
            auth.signOut();
        }
    });
}

// Monitora lo stato dell'utente
auth.onAuthStateChanged(user => {
    utenteCorrente = user;
    if (user) {
        loginBtn.innerText = `Esci (${user.displayName.split(' ')[0]})`;
        caricaDatiUtente();
    } else {
        loginBtn.innerText = "Accedi con Google";
        localStorage.clear(); 
        renderizzaAuto();
    }
});

// --- CARICAMENTO DATI ---
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('./data.json');
        tutteLeAuto = await response.json();
        popolaFiltri();
        renderizzaAuto();
    } catch (err) {
        console.error("Errore caricamento data.json:", err);
    }
});

async function caricaDatiUtente() {
    if (!utenteCorrente) return;
    try {
        const doc = await db.collection('garages').doc(utenteCorrente.uid).get();
        if (doc.exists) {
            const data = doc.data();
            // Sincronizza il cloud con il localStorage
            Object.keys(data).forEach(key => localStorage.setItem(key, data[key]));
        }
        renderizzaAuto();
    } catch (err) {
        console.error("Errore recupero dati cloud:", err);
    }
}

function popolaFiltri() {
    const countryS = document.getElementById('filter-country');
    const brandS = document.getElementById('filter-brand');
    const container = document.getElementById('filter-container');

    if (giocoAttivo === "mfgt") {
        container.style.display = "none";
        return;
    }
    container.style.display = "flex";

    const autoGioco = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const paesi = [...new Set(autoGioco.map(a => a.paese))].sort();
    const marche = [...new Set(autoGioco.map(a => a.marca))].sort();

    countryS.innerHTML = '<option value="all">Tutti i Paesi</option>';
    brandS.innerHTML = '<option value="all">Tutte le Marche</option>';
    paesi.forEach(p => countryS.innerHTML += `<option value="${p}">${p}</option>`);
    marche.forEach(m => brandS.innerHTML += `<option value="${m}">${m}</option>`);
}

function renderizzaAuto() {
    const main = document.querySelector('main');
    if(!main) return;
    
    const termine = document.getElementById('searchBar').value.toLowerCase();
    const paese = document.getElementById('filter-country').value;
    const marca = document.getElementById('filter-brand').value;

    main.innerHTML = "";

    let autoFiltrate = tutteLeAuto.filter(a => {
        return a.gioco === giocoAttivo && 
               a.nome.toLowerCase().includes(termine) &&
               (paese === "all" || a.paese === paese) &&
               (marca === "all" || a.marca === marca);
    });

    if (giocoAttivo === "mfgt") {
        const grid = document.createElement('div');
        grid.className = 'car-grid';
        autoFiltrate.forEach(auto => grid.appendChild(creaCard(auto)));
        main.appendChild(grid);
    } else {
        const categorie = {};
        autoFiltrate.forEach(a => {
            if (!categorie[a.paese]) categorie[a.paese] = {};
            if (!categorie[a.paese][a.marca]) categorie[a.paese][a.marca] = [];
            categorie[a.paese][a.marca].push(a);
        });

        for (const p in categorie) {
            const head = document.createElement('div');
            head.className = 'category-header';
            head.innerHTML = `<h2 class="country-title">${p}</h2>`;
            main.appendChild(head);

            for (const m in categorie[p]) {
                const bTitle = document.createElement('h3');
                bTitle.className = "brand-title";
                bTitle.innerText = `— ${m}`;
                main.appendChild(bTitle);

                const grid = document.createElement('div');
                grid.className = 'car-grid';
                categorie[p][m].forEach(auto => grid.appendChild(creaCard(auto)));
                main.appendChild(grid);
            }
        }
    }
    aggiornaContatore();
}

function creaCard(auto) {
    const key = `${auto.gioco}-${auto.id}`;
    const isOwned = localStorage.getItem(key) === 'true';
    const card = document.createElement('div');
    card.className = `car-card ${isOwned ? 'owned' : ''}`;
    card.innerHTML = `
        <img src="${auto.immagine}" class="car-thumb" loading="lazy">
        <h3>${auto.nome}</h3>
        <div class="owned-container">
            <input type="checkbox" ${isOwned ? 'checked' : ''}>
            <label>Nel garage</label>
        </div>
    `;

    card.querySelector('input').addEventListener('change', async (e) => {
        const val = e.target.checked;
        localStorage.setItem(key, val);
        card.classList.toggle('owned', val);
        
        if (utenteCorrente) {
            await db.collection('garages').doc(utenteCorrente.uid).set({ [key]: val }, { merge: true });
        }
        aggiornaContatore();
    });

    card.querySelector('img').onclick = () => mostraDettagli(auto);
    return card;
}

function mostraDettagli(auto) {
    const modal = document.getElementById("carModal");
    const modalBody = document.getElementById("modal-body");
    let specsHTML = "";
    let linkHTML = "";

    if (auto.gioco === "mfgt") {
        specsHTML = `
            <div class="specs-grid">
                <div class="spec-item"><strong>Anno</strong> ${auto.anno}</div>
                <div class="spec-item"><strong>Velocità Max.</strong> ${auto.velocita || '-'}</div>
                <div class="spec-item"><strong>Accelerazione</strong> ${auto.accelerazione || '-'}</div>
                <div class="spec-item"><strong>Frenata</strong> ${auto.frenata || '-'}</div>
                <div class="spec-item"><strong>Sterzata</strong> ${auto.sterzata || '-'}</div>
                <div class="spec-item"><strong>Stabilità</strong> ${auto.stabilita || '-'}</div>
            </div>`;
    } else {
        specsHTML = `
            <div class="specs-grid">
                <div class="spec-item"><strong>Anno</strong> ${auto.anno}</div>
                <div class="spec-item"><strong>PP</strong> ${auto.pp}</div>
                <div class="spec-item"><strong>Prezzo</strong> ${auto.prezzo}</div>
                <div class="spec-item"><strong>Negozio</strong> ${auto.acquisto}</div>
                <div class="spec-item"><strong>Potenza</strong> ${auto.cv}</div>
                <div class="spec-item"><strong>Peso</strong> ${auto.peso}</div>
            </div>`;
        linkHTML = `<div style="margin-top: 25px; text-align: center;">
                        <a href="${auto.link}" target="_blank" class="btn-link">Sito Ufficiale</a>
                    </div>`;
    }

    modalBody.innerHTML = `
        <img src="${auto.immagine}" class="modal-img">
        <div style="padding: 20px;">
            <h2 style="margin-bottom: 5px;">${auto.nome}</h2>
            <p style="color: #e10600; font-weight: bold; margin-bottom: 20px; text-transform: uppercase;">
                ${auto.paese} | ${auto.marca}
            </p>
            ${specsHTML}
            <hr style="border: 0.5px solid #333; margin: 20px 0;">
            <p class="modal-desc">${auto.descrizione}</p>
            ${linkHTML} 
        </div>`;

    modal.style.display = "block";
    document.body.style.overflow = "hidden";

    document.querySelector(".close-button").onclick = chiudiModale;
    window.onclick = (event) => { if (event.target == modal) chiudiModale(); };
}

function chiudiModale() {
    document.getElementById("carModal").style.display = "none";
    document.body.style.overflow = "auto";
}

function aggiornaContatore() {
    const autoG = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const possedute = autoG.filter(a => localStorage.getItem(`${a.gioco}-${a.id}`) === 'true').length;
    const perc = autoG.length > 0 ? Math.round((possedute / autoG.length) * 100) : 0;

    document.getElementById('owned-count').innerText = possedute;
    document.getElementById('total-count').innerText = autoG.length;
    document.getElementById('completion-perc').innerText = perc + "%";
    document.getElementById('progress-bar').style.width = perc + "%";
}

// Listeners
document.getElementById('filter-country').addEventListener('change', renderizzaAuto);
document.getElementById('filter-brand').addEventListener('change', renderizzaAuto);
document.getElementById('searchBar').addEventListener('input', renderizzaAuto);
document.getElementById('reset-filters').onclick = () => {
    document.getElementById('searchBar').value = "";
    document.getElementById('filter-country').value = "all";
    document.getElementById('filter-brand').value = "all";
    renderizzaAuto();
};

document.querySelectorAll('.game-btn').forEach(btn => {
    btn.onclick = (e) => {
        if (e.target.id === 'login-btn') return;
        document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        giocoAttivo = e.target.dataset.game;
        popolaFiltri();
        renderizzaAuto();
    };
});
