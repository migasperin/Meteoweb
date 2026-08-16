// Configurazione Iniziale
const defaultLocation = [45.4064, 11.8767]; // Padova
const map = L.map('map', { zoomControl: false }).setView(defaultLocation, 7);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Mappa di base scura (CartoDB Dark Matter)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// Variabili globali per l'animazione radar
let radarLayers = [];
let timestamps = [];
let currentFrame = 0;
let animationTimer = null;
let isPlaying = true;
let dataRefreshInterval = null;

const apiEndpoint = "https://api.rainviewer.com/public/weather-maps.json";

// Elementi DOM
const timeDisplay = document.getElementById('timestamp');
const playPauseBtn = document.getElementById('play-pause-btn');
const searchBtn = document.getElementById('search-btn');
const locationInput = document.getElementById('location-input');
const refreshRateSelect = document.getElementById('refresh-rate');

// 1. Caricamento dei dati Radar
async function fetchRadarData() {
    try {
        const response = await fetch(apiEndpoint);
        const data = await response.json();
        
        // Uniamo radar passato (radar) e previsioni future (nowcast)
        timestamps = [...data.radar.past, ...data.radar.nowcast];
        
        // Pulizia layer precedenti
        radarLayers.forEach(layer => map.removeLayer(layer));
        radarLayers = [];

        // Generazione dei layer sulla mappa (invisibili di default)
        timestamps.forEach((ts) => {
            const tilePath = `${data.host}${ts.path}/256/{z}/{x}/{y}/2/1_1.png`; // 2 = Color scheme classico radar
            const layer = L.tileLayer(tilePath, {
                opacity: 0,
                zIndex: 10
            }).addTo(map);
            radarLayers.push(layer);
        });

        // Avvio animazione se ci sono dati
        if (timestamps.length > 0) {
            currentFrame = 0;
            startAnimation();
        }
    } catch (error) {
        timeDisplay.innerText = "Errore connessione radar";
        console.error("Errore fetch RainViewer:", error);
    }
}

// 2. Motore di Animazione
function showFrame(index) {
    // Nascondi tutti
    radarLayers.forEach(layer => layer.setOpacity(0));
    // Mostra corrente
    radarLayers[index].setOpacity(0.7);

    // Formatta orario
    const date = new Date(timestamps[index].time * 1000);
    const timeString = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    
    // Controlla se è una previsione (nel futuro rispetto a ora)
    const isForecast = (timestamps[index].time * 1000) > Date.now();
    
    if (isForecast) {
        timeDisplay.innerHTML = `<span class="forecast-label">Previsione: ${timeString}</span>`;
    } else {
        timeDisplay.innerText = `Radar Storico: ${timeString}`;
    }
}

function advanceFrame() {
    currentFrame = (currentFrame + 1) % timestamps.length;
    showFrame(currentFrame);
    
    // Pausa più lunga all'ultimo frame (now) prima di riniziare
    const speed = (currentFrame === timestamps.length - 1) ? 2000 : 500;
    
    if (isPlaying) {
        clearTimeout(animationTimer);
        animationTimer = setTimeout(advanceFrame, speed);
    }
}

function startAnimation() {
    isPlaying = true;
    playPauseBtn.innerText = "⏸ Pausa";
    advanceFrame();
}

function stopAnimation() {
    isPlaying = false;
    playPauseBtn.innerText = "▶️ Play";
    clearTimeout(animationTimer);
}

playPauseBtn.addEventListener('click', () => {
    if (isPlaying) stopAnimation();
    else startAnimation();
});

// 3. Gestione Ricerca Luogo (Geocoding via Nominatim/OSM)
async function searchLocation() {
    const query = locationInput.value;
    if (!query) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const results = await response.json();
        if (results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            map.flyTo([lat, lon], 9); // Zoom dinamico
        } else {
            alert("Luogo non trovato.");
        }
    } catch (error) {
        console.error("Errore ricerca:", error);
    }
}

searchBtn.addEventListener('click', searchLocation);
locationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchLocation();
});

// 4. Gestione Aggiornamento Automatico Dati
function setRefreshInterval() {
    if (dataRefreshInterval) clearInterval(dataRefreshInterval);
    const minutes = parseInt(refreshRateSelect.value, 10);
    
    dataRefreshInterval = setInterval(() => {
        console.log(`Aggiornamento dati radar (${minutes} min)...`);
        fetchRadarData();
    }, minutes * 60 * 1000);
}

refreshRateSelect.addEventListener('change', setRefreshInterval);

// Inizializzazione
fetchRadarData();
setRefreshInterval();