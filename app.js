// Configurazione Iniziale
const defaultLocation = [46.0160, 11.9080]; // Feltre
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
let locationMarker = null;

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
        
        // Estraiamo solo i primi 3 frame del nowcast (3 x 10 min = 30 minuti)
        const thirtyMinForecast = data.radar.nowcast.slice(0, 3);
        
        // Uniamo radar passato e previsioni future limitate alla mezz'ora
        timestamps = [...data.radar.past, ...thirtyMinForecast];
        
        // Pulizia layer precedenti
        radarLayers.forEach(layer => map.removeLayer(layer));
        radarLayers = [];

        // Generazione dei layer sulla mappa
        timestamps.forEach((ts) => {
            // Aumentata risoluzione a 512px e cambiato schema colori (6 = NEXRAD) per maggiore precisione visiva
            const tilePath = `${data.host}${ts.path}/512/{z}/{x}/{y}/6/1_1.png`;
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
    radarLayers.forEach(layer => layer.setOpacity(0));
    radarLayers[index].setOpacity(0.7);

    const date = new Date(timestamps[index].time * 1000);
    const timeString = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    
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
            
            map.flyTo([lat, lon], 10);
            
            // Rimuovi il marker precedente se esiste
            if (locationMarker) {
                map.removeLayer(locationMarker);
            }
            
            // Aggiungi un nuovo pin sulla mappa
            locationMarker = L.marker([lat, lon]).addTo(map);
            locationMarker.bindPopup(`<b>${results[0].display_name.split(',')[0]}</b>`).openPopup();
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
