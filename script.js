let tutteLeAuto = []; 
let giocoAttivo = "gt7";

window.addEventListener('DOMContentLoaded', caricaAuto);

async function caricaAuto() {
    try {
        const response = await fetch('./data.json');
        tutteLeAuto = await response.json();
        popolaFiltri(); 
        renderizzaAuto();
    } catch (error) {
        console.error("Errore nel caricamento dati:", error);
    }
}

function popolaFiltri() {
    const countrySelect = document.getElementById('filter-country');
    const brandSelect = document.getElementById('filter-brand');
    const filterContainer = document.getElementById('filter-container'); // Prendiamo il contenitore

    // SE IL GIOCO È MFGT, NASCONDIAMO I FILTRI E USCIAMO DALLA FUNZIONE
    if (giocoAttivo === "mfgt") {
        filterContainer.style.display = "none";
        return; 
    } else {
        filterContainer.style.display = "flex"; // Mostriamo i filtri per GT7
    }
    
    // Il resto del codice rimane uguale...
    const autoGioco = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const paesi = [...new Set(autoGioco.map(a => a.paese))].sort();
    const marche = [...new Set(autoGioco.map(a => a.marca))].sort();

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

// --- EVENT LISTENERS ---
document.getElementById('filter-country').addEventListener('change', renderizzaAuto);
document.getElementById('filter-brand').addEventListener('change', renderizzaAuto);
document.getElementById('searchBar').addEventListener('input', renderizzaAuto);

// Tasto Ripristina Corretto
document.getElementById('reset-filters').addEventListener('click', () => {
    document.getElementById('searchBar').value = "";
    document.getElementById('filter-country').value = "all";
    document.getElementById('filter-brand').value = "all";
    popolaFiltri(); 
    renderizzaAuto();
});

document.querySelectorAll('.game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if(e.target.id === 'reset-filters') return; // Evita conflitti con il tasto reset
        document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        giocoAttivo = e.target.getAttribute('data-game');
        popolaFiltri(); 
        renderizzaAuto();
    });
});

function creaCard(auto) {
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
        localStorage.setItem(storageKey, e.target.checked);
        card.classList.toggle('owned', e.target.checked);
        aggiornaContatore();
    });

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
    const tutteLeAutoGioco = tutteLeAuto.filter(a => a.gioco === giocoAttivo);
    const totaleGioco = tutteLeAutoGioco.length;
    let posseduteGioco = 0;
    
    tutteLeAutoGioco.forEach(auto => {
        if (localStorage.getItem(`${auto.gioco}-${auto.id}`) === 'true') posseduteGioco++;
    });

    const percGioco = totaleGioco > 0 ? Math.round((posseduteGioco / totaleGioco) * 100) : 0;
    
    document.getElementById('progress-bar').style.width = percGioco + "%";
    
    document.getElementById('game-name-label').innerText = giocoAttivo === 'gt7' ? 'Gran Turismo 7' : 'My First Gran Turismo';
    document.getElementById('total-count').innerText = totaleGioco;
    document.getElementById('owned-count').innerText = posseduteGioco;
    document.getElementById('completion-perc').innerText = percGioco + "%";

    const detailedStats = document.getElementById('detailed-stats');
    const paeseScelto = document.getElementById('filter-country').value;
    const marcaScelta = document.getElementById('filter-brand').value;

    if (giocoAttivo === 'gt7' && (paeseScelto !== 'all' || marcaScelta !== 'all')) {
        detailedStats.style.display = "block";
        let autoFiltrateDettaglio = marcaScelta !== 'all' ? 
            tutteLeAutoGioco.filter(a => a.marca === marcaScelta) : 
            tutteLeAutoGioco.filter(a => a.paese === paeseScelto);

        let posseduteDettaglio = autoFiltrateDettaglio.filter(auto => localStorage.getItem(`${auto.gioco}-${auto.id}`) === 'true').length;
        const percDettaglio = autoFiltrateDettaglio.length > 0 ? Math.round((posseduteDettaglio / autoFiltrateDettaglio.length) * 100) : 0;

        document.getElementById('detail-label').innerText = marcaScelta !== 'all' ? marcaScelta : paeseScelto;
        document.getElementById('detail-owned').innerText = `${posseduteDettaglio} / ${autoFiltrateDettaglio.length} (${percDettaglio}%)`;
    } else {
        detailedStats.style.display = "none";
    }
}
