let tutteLeAuto = []; 
let giocoAttivo = "gt7";

window.addEventListener('DOMContentLoaded', caricaAuto);

async function caricaAuto() {
    try {
        const response = await fetch('./data.json');
        tutteLeAuto = await response.json();
        popolaFiltri(); // Crea le opzioni nei menu a tendina
        renderizzaAuto();
    } catch (error) {
        console.error("Errore:", error);
    }
}

function popolaFiltri() {
    const countrySelect = document.getElementById('filter-country');
    const brandSelect = document.getElementById('filter-brand');
    
    // Prendiamo solo le auto del gioco attuale
    const autoGioco = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    
    // Estraiamo valori unici per Paesi e Marche
    const paesi = [...new Set(autoGioco.map(a => a.paese))].sort();
    const marche = [...new Set(autoGioco.map(a => a.marca))].sort();

    // Reset e ripopolamento
    countrySelect.innerHTML = '<option value="all">Tutti i Paesi</option>';
    brandSelect.innerHTML = '<option value="all">Tutte le Marche</option>';

    paesi.forEach(p => countrySelect.innerHTML += `<option value="${p}">${p}</option>`);
    marche.forEach(m => brandSelect.innerHTML += `<option value="${m}">${m}</option>`);
}

function renderizzaAuto() {
    const main = document.querySelector('main');
    const termine = document.getElementById('searchBar').value.toLowerCase();
    const paeseScelto = document.getElementById('filter-country').value;
    const marcaScelta = document.getElementById('filter-brand').value;

    main.innerHTML = ""; 

    // Applichiamo TUTTI i filtri insieme
    let autoFiltrate = tutteLeAuto.filter(auto => {
        const matchGioco = auto.gioco === giocoAttivo;
        const matchRicerca = auto.nome.toLowerCase().includes(termine);
        const matchPaese = paeseScelto === "all" || auto.paese === paeseScelto;
        const matchMarca = marcaScelta === "all" || auto.marca === marcaScelta;
        return matchGioco && matchRicerca && matchPaese && matchMarca;
    });

    if (giocoAttivo === "mfgt") {
        const grid = document.createElement('div');
        grid.className = 'car-grid';
        autoFiltrate.forEach(auto => grid.appendChild(creaCard(auto)));
        main.appendChild(grid);
    } else {
        // Logica raggruppata per GT7 (Paese -> Marca)
        const categorie = {};
        autoFiltrate.forEach(auto => {
            if (!categorie[auto.paese]) categorie[auto.paese] = {};
            if (!categorie[auto.paese][auto.marca]) categorie[auto.paese][auto.marca] = [];
            categorie[auto.paese][auto.marca].push(auto);
        });

        for (const paese in categorie) {
            const countrySection = document.createElement('div');
            countrySection.innerHTML = `<div class="category-header"><h2 class="country-title">${paese}</h2></div>`;
            main.appendChild(countrySection);

            for (const marca in categorie[paese]) {
                const brandHeader = document.createElement('h3');
                brandHeader.className = "brand-title";
                brandHeader.style.paddingLeft = "40px";
                brandHeader.innerText = `— ${marca}`;
                main.appendChild(brandHeader);

                const grid = document.createElement('div');
                grid.className = 'car-grid';
                categorie[paese][marca].forEach(auto => grid.appendChild(creaCard(auto)));
                main.appendChild(grid);
            }
        }
    }
    aggiornaContatore();
}

// Event Listeners per i filtri
document.getElementById('filter-country').addEventListener('change', renderizzaAuto);
document.getElementById('filter-brand').addEventListener('change', renderizzaAuto);
document.getElementById('searchBar').addEventListener('input', renderizzaAuto);

// Quando cambi gioco, resetta e aggiorna i filtri
document.querySelectorAll('.game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        giocoAttivo = e.target.getAttribute('data-game');
        popolaFiltri(); // Aggiorna le tendine con i nuovi paesi/marche
        renderizzaAuto();
    });
});

function creaCard(auto) {
    // MODIFICA: Creiamo una chiave unica che unisce gioco e ID
    const storageKey = `${auto.gioco}-${auto.id}`;
    
    const isOwned = localStorage.getItem(storageKey) === 'true';
    const card = document.createElement('div');
    card.className = `car-card ${isOwned ? 'owned' : ''}`;
    
    card.innerHTML = `
        <img src="${auto.immagine}" alt="${auto.nome}" class="car-thumb">
        <h3>${auto.nome}</h3>
        <div class="owned-container">
            <input type="checkbox" id="check-${storageKey}" ${isOwned ? 'checked' : ''}>
            <label for="check-${storageKey}">Nel garage</label>
        </div>
    `;

    card.querySelector('.car-thumb').onclick = () => mostraDettagli(auto);
    card.querySelector('h3').onclick = () => mostraDettagli(auto);
    
    card.querySelector('input').addEventListener('change', (e) => {
        // MODIFICA: Salviamo usando la chiave specifica per quel gioco
        localStorage.setItem(storageKey, e.target.checked);
        card.classList.toggle('owned', e.target.checked);
        aggiornaContatore();
    });

    return card;
}

// Gestione pulsanti gioco
document.querySelectorAll('.game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        giocoAttivo = e.target.getAttribute('data-game');
        renderizzaAuto();
    });
});

// Ricerca (aggiornata per funzionare con le card generate)
document.getElementById('searchBar').addEventListener('input', (e) => {
    const termine = e.target.value.toLowerCase();
    document.querySelectorAll('.car-card').forEach(card => {
        const nome = card.querySelector('h3').innerText.toLowerCase();
        card.style.display = nome.includes(termine) ? "block" : "none";
    });
});

function mostraDettagli(auto) {
    const modal = document.getElementById("carModal");
    const modalBody = document.getElementById("modal-body");
    
    // 1. Prepariamo la griglia delle specifiche e il link in base al gioco
    let specsHTML = "";
    let linkHTML = ""; // Variabile per contenere il pulsante del link

    if (auto.gioco === "mfgt") {
        // --- SPECIFICHE PER MY FIRST GRAN TURISMO ---
        specsHTML = `
            <div class="specs-grid">
                <div class="spec-item"><strong>Anno</strong> ${auto.anno}</div>
                <div class="spec-item"><strong>Velocità Max.</strong> ${auto.velocita}</div>
                <div class="spec-item"><strong>Accelerazione</strong> ${auto.accelerazione}</div>
                <div class="spec-item"><strong>Frenata</strong> ${auto.frenata}</div>
                <div class="spec-item"><strong>Sterzata</strong> ${auto.sterzata}</div>
                <div class="spec-item"><strong>Stabilità</strong> ${auto.stabilita}</div>
            </div>
        `;
        // Per MFGT linkHTML rimane vuoto
    } else {
        // --- SPECIFICHE PER GRAN TURISMO 7 ---
        specsHTML = `
            <div class="specs-grid">
                <div class="spec-item"><strong>Anno</strong> ${auto.anno}</div>
                <div class="spec-item"><strong>PP</strong> ${auto.pp}</div>
                <div class="spec-item"><strong>Prezzo</strong> ${auto.prezzo}</div>
                <div class="spec-item"><strong>Negozio</strong> ${auto.acquisto}</div>
                <div class="spec-item"><strong>Potenza</strong> ${auto.cv}</div>
                <div class="spec-item"><strong>Peso</strong> ${auto.peso}</div>
            </div>
        `;
        
        // Aggiungiamo il pulsante link solo per GT7
        linkHTML = `
            <div style="margin-top: 25px; text-align: center;">
                <a href="${auto.link}" target="_blank" class="btn-link">Sito Ufficiale</a>
            </div>
        `;
    }

    // 2. Costruiamo il corpo del modale
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
        </div>
    `;

    modal.style.display = "block";
    document.body.style.overflow = "hidden";

    // Gestione chiusura
    const closeBtn = document.querySelector(".close-button");
    closeBtn.onclick = () => chiudiModale();
    window.onclick = (event) => { if (event.target == modal) chiudiModale(); };
}

// Funzione unica per chiudere e ripristinare lo scroll
function chiudiModale() {
    const modal = document.getElementById("carModal");
    modal.style.display = "none";
    document.body.style.overflow = "auto"; // Riattiva lo scroll
}

document.querySelector(".close-button").onclick = () => {
    document.getElementById("carModal").style.display = "none";
    document.body.style.overflow = "auto";
};

function aggiornaContatore() {
    // 1. Statistiche Generali del Gioco Attivo
    const tutteLeAutoGioco = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const totaleGioco = tutteLeAutoGioco.length;
    let posseduteGioco = 0;
    
    tutteLeAutoGioco.forEach(auto => {
        if (localStorage.getItem(`${auto.gioco}-${auto.id}`) === 'true') {
            posseduteGioco++;
        }
    });

    const percGioco = totaleGioco > 0 ? Math.round((posseduteGioco / totaleGioco) * 100) : 0;
    
    document.getElementById('game-name-label').innerText = giocoAttivo === 'gt7' ? 'Gran Turismo 7' : 'My First Gran Turismo';
    document.getElementById('total-count').innerText = totaleGioco;
    document.getElementById('owned-count').innerText = posseduteGioco;
    document.getElementById('completion-perc').innerText = percGioco + "%";

    // 2. Statistiche Dettagliate (Nazione/Marca) - Solo per GT7
    const detailedStats = document.getElementById('detailed-stats');
    const paeseScelto = document.getElementById('filter-country').value;
    const marcaScelta = document.getElementById('filter-brand').value;

    if (giocoAttivo === 'gt7' && (paeseScelto !== 'all' || marcaScelta !== 'all')) {
        detailedStats.style.display = "block";
        
        let autoFiltrateDettaglio = tutteLeAutoGioco;
        let etichetta = "";

        if (marcaScelta !== 'all') {
            autoFiltrateDettaglio = tutteLeAutoGioco.filter(a => a.marca === marcaScelta);
            etichetta = marcaScelta;
        } else if (paeseScelto !== 'all') {
            autoFiltrateDettaglio = tutteLeAutoGioco.filter(a => a.paese === paeseScelto);
            etichetta = paeseScelto;
        }

        const totaleDettaglio = autoFiltrateDettaglio.length;
        let posseduteDettaglio = 0;
        autoFiltrateDettaglio.forEach(auto => {
            if (localStorage.getItem(`${auto.gioco}-${auto.id}`) === 'true') {
                posseduteDettaglio++;
            }
        });
        
        const percDettaglio = totaleDettaglio > 0 ? Math.round((posseduteDettaglio / totaleDettaglio) * 100) : 0;

        document.getElementById('detail-label').innerText = etichetta;
        
        // Questa riga ora mostra solo "X / Y (Z%)" senza pezzi extra alla fine
        document.getElementById('detail-owned').innerText = `${posseduteDettaglio} / ${totaleDettaglio} (${percDettaglio}%)`;
        
        // HO RIMOSSO LA RIGA: document.getElementById('detail-total').innerText = totaleDettaglio;
        // che era quella che causava il "/ 3" fastidioso.
    } else {
        detailedStats.style.display = "none";
    }
}