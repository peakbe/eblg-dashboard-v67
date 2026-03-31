// ======================================================
// CONFIGURATION
// ======================================================

const PROXY = "https://eblg-proxy.onrender.com";

const ENDPOINTS = {
    metar: `${PROXY}/metar`,
    taf: `${PROXY}/taf`,
    fids: `${PROXY}/fids`,
    notam: `${PROXY}/notam`
};

const SONOS = [
  { id:"F017", lat:50.764883, lon:5.630606 },
  { id:"F001", lat:50.737, lon:5.608833 },
  { id:"F014", lat:50.718894, lon:5.573164 },
  { id:"F015", lat:50.688839, lon:5.526217 },
  { id:"F005", lat:50.639331, lon:5.323519 },
  { id:"F003", lat:50.601167, lon:5.3814 },
  { id:"F011", lat:50.601142, lon:5.356006 },
  { id:"F008", lat:50.594878, lon:5.35895 },
  { id:"F002", lat:50.588414, lon:5.370522 },
  { id:"F007", lat:50.590756, lon:5.345225 },
  { id:"F009", lat:50.580831, lon:5.355417 },
  { id:"F004", lat:50.605414, lon:5.321406 },
  { id:"F010", lat:50.599392, lon:5.313492 },
  { id:"F013", lat:50.586914, lon:5.308678 },
  { id:"F016", lat:50.619617, lon:5.295345 },
  { id:"F006", lat:50.609594, lon:5.271403 },
  { id:"F012", lat:50.621917, lon:5.254747 }
];

let sonometers = {};   // {id, lat, lon, marker, status}
let map;               // Leaflet map
let runwayLayer = null;
let corridorLayer = null;
let corridorArrows = null;

// ======================================================
// FETCH HELPER
// ======================================================

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error("Erreur fetch :", err);
        return { fallback: true, error: err.message };
    }
}

// ======================================================
// PANEL D'ÉTAT GLOBAL
// ======================================================

function updateStatusPanel(service, data) {
    const panel = document.getElementById("status-panel");
    if (!panel) return;

    if (data.fallback) {
        panel.className = "status-fallback";
        panel.innerText = `${service} : fallback (source offline)`;
        return;
    }

    if (data.error) {
        panel.className = "status-offline";
        panel.innerText = `${service} : offline`;
        return;
    }

    panel.className = "status-ok";
    panel.innerText = `${service} : OK`;
}

// ======================================================
// RUNWAY / CROSSWIND / CORRIDORS
// ======================================================

const RUNWAYS = {
    "22": {
        heading: 220,
        start: [50.64695, 5.44340],   // seuil 22
        end:   [50.63740, 5.46010],   // seuil 04
        length_m: 3690,
        width_m: 45,
        blastPad_m: 60,
        displaced_m: 0
    },
    "04": {
        heading: 40,
        start: [50.63740, 5.46010],   // seuil 04
        end:   [50.64695, 5.44340],   // seuil 22
        length_m: 3690,
        width_m: 45,
        blastPad_m: 60,
        displaced_m: 0
    }
};

const CORRIDORS = {
    "04": [
        [50.700000, 5.300000],
        [50.670000, 5.380000],
        [50.645900, 5.443300]
    ],
    "22": [
        [50.600000, 5.600000],
        [50.620000, 5.520000],
        [50.637300, 5.463500]
    ]
};
function deg2rad(d) {
    return d * Math.PI / 180;
}

function offsetPoint(lat, lng, distance_m, bearing_deg) {
    const R = 6378137;
    const br = deg2rad(bearing_deg);
    const dR = distance_m / R;

    const lat1 = deg2rad(lat);
    const lng1 = deg2rad(lng);

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(dR) +
        Math.cos(lat1) * Math.sin(dR) * Math.cos(br)
    );

    const lng2 = lng1 + Math.atan2(
        Math.sin(br) * Math.sin(dR) * Math.cos(lat1),
        Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
    );

    return [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI];
}

function drawRunway(runway) {
    if (!runwayLayer) return;

    runwayLayer.clearLayers();

    if (runway === "UNKNOWN") return;

    const r = RUNWAYS[runway];
    if (!r) return;

    const [lat1, lng1] = r.start;
    const [lat2, lng2] = r.end;

    // vecteur piste
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;

    // vecteur perpendiculaire normalisé
    const len = Math.sqrt(dx*dx + dy*dy);
    const px = -(dy / len);
    const py = dx / len;

    // largeur piste en degrés approximatifs
    const meterToDeg = 1 / 111320;
    const halfW = (r.width_m * meterToDeg) / 2;

    // points latéraux
    const p1L = [lat1 + py * halfW, lng1 + px * halfW];
    const p1R = [lat1 - py * halfW, lng1 - px * halfW];
    const p2L = [lat2 + py * halfW, lng2 + px * halfW];
    const p2R = [lat2 - py * halfW, lng2 - px * halfW];

    // rectangle piste
    L.polygon([p1L, p1R, p2R, p2L], {
        color: "#222",
        weight: 1,
        fillColor: "#333",
        fillOpacity: 0.9
    }).addTo(runwayLayer);

    // centerline
    L.polyline([r.start, r.end], {
        color: "#fff",
        weight: 2,
        dashArray: "8,8"
    }).addTo(runwayLayer);

    // numéros de piste
    const num1 = (r.heading / 10).toFixed(0).padStart(2, "0");
    const num2 = (((r.heading + 180) % 360) / 10).toFixed(0).padStart(2, "0");

    L.marker(r.start, {
        icon: L.divIcon({
            className: "runway-number",
            html: num1
        })
    }).addTo(runwayLayer);

    L.marker(r.end, {
        icon: L.divIcon({
            className: "runway-number",
            html: num2
        })
    }).addTo(runwayLayer);

    // QFU
    const centerLat = (lat1 + lat2) / 2;
    const centerLng = (lng1 + lng2) / 2;

    L.marker([centerLat, centerLng], {
        icon: L.divIcon({
            className: "qfu-label",
            html: `QFU ${num1}/${num2}`
        })
    }).addTo(runwayLayer);
}

    // Numéros de piste
    const mid1 = offsetPoint(lat1, lng1, 150, heading);      // 150 m dans l'axe
    const mid2 = offsetPoint(lat2, lng2, -150, heading);     // 150 m dans l'axe inverse

    const num1 = (heading / 10).toFixed(0).padStart(2, "0");
    const num2 = (((heading + 180) % 360) / 10).toFixed(0).padStart(2, "0");

    L.marker(mid1, {
        icon: L.divIcon({
            className: "runway-number",
            html: num1
        })
    }).addTo(runwayLayer);

    L.marker(mid2, {
        icon: L.divIcon({
            className: "runway-number",
            html: num2
        })
    }).addTo(runwayLayer);

    // QFU sur la carte (au centre de la piste)
    const centerLat = (lat1 + lat2) / 2;
    const centerLng = (lng1 + lng2) / 2;
    const qfuText = `QFU ${num1} / ${num2} (${heading}° / ${(heading + 180) % 360}°)`;

    L.marker([centerLat, centerLng], {
        icon: L.divIcon({
            className: "qfu-label",
            html: qfuText
        })
    }).addTo(runwayLayer);
}

function drawCorridor(runway) {
    if (!corridorLayer) return;

    corridorLayer.clearLayers();

    if (runway === "UNKNOWN") return;

    const r = RUNWAYS[runway];
    if (!r) return;

    const line = L.polyline([r.start, r.end], {
        color: "orange",
        weight: 2,
        dashArray: "6,6"
    }).addTo(corridorLayer);

    if (L.polylineDecorator) {
        L.polylineDecorator(line, {
            patterns: [
                {
                    offset: "25%",
                    repeat: "50%",
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 12,
                        polygon: false,
                        pathOptions: { stroke: true, color: "orange" }
                    })
                }
            ]
        }).addTo(corridorLayer);
    }
}

function getRunwayFromWind(windDir) {
    if (!windDir) return "UNKNOWN";

    const diff22 = Math.abs(windDir - 220);
    const diff04 = Math.abs(windDir - 40);

    return diff22 < diff04 ? "22" : "04";
}

function computeCrosswind(windDir, windSpeed, runwayHeading) {
    if (!windDir || !windSpeed || !runwayHeading) {
        return { crosswind: 0, angleDiff: 0 };
    }

    const angleDiff = Math.abs(windDir - runwayHeading);
    const rad = angleDiff * Math.PI / 180;
    const crosswind = Math.round(Math.abs(windSpeed * Math.sin(rad)));

    return { crosswind, angleDiff };
}

function updateRunwayPanel(runway, windDir, windSpeed, phase) {
    const panel = document.getElementById("runway-panel");
    if (!panel) return;

    if (runway === "UNKNOWN" || !windDir || !windSpeed) {
        panel.className = "runway-unknown";
        panel.innerText = "Piste inconnue";
        return;
    }

    const r = RUNWAYS[runway];
    const info = computeCrosswind(windDir, windSpeed, r.heading);

    panel.className = runway === "22" ? "runway-22" : "runway-04";

    panel.innerText =
        `Piste ${runway} (${r.heading}°) – ` +
        `${phase === "landing" ? "Atterrissage" : "Décollage"} – ` +
        `${info.crosswind} kt crosswind (Δ${info.angleDiff}°) – ` +
        `Vent ${windDir}°/${windSpeed} kt`;
}


// ======================================================
// SONOMÈTRES
// ======================================================

// Couleur simple (ancienne logique, encore utilisée par updateSonometers)
function getSonometerColor(runway) {
    if (runway === "22") return "red";
    if (runway === "04") return "blue";
    return "gray";
}

// Création des marqueurs
function initSonometers(mapInstance) {
    SONOS.forEach(s => {

        const marker = L.circleMarker([s.lat, s.lon], {
            radius: 6,
            color: "gray",
            fillColor: "gray",
            fillOpacity: 0.9,
            weight: 1
        }).addTo(mapInstance);

        marker.bindTooltip(s.id, { permanent: false });

        sonometers[s.id] = {
            ...s,
            marker,
            status: "UNKNOWN"
        };
    });

    console.log("Sonomètres initialisés :", Object.keys(sonometers).length);
}

// Coloration simple (ancienne logique)
function updateSonometers(runway) {
    const color = getSonometerColor(runway);

    Object.values(sonometers).forEach(s => {
        s.marker.setStyle({
            color,
            fillColor: color
        });
        s.status = runway;
    });
}

// Coloration avancée (phase + piste)
function updateSonometersAdvanced(runway, phase) {
    // Tout en gris par défaut
    Object.values(sonometers).forEach(s => {
        s.marker.setStyle({ color: "gray", fillColor: "gray" });
    });

    if (runway === "UNKNOWN") return;

    let green = [];
    let red = [];

    if (runway === "22") {
        if (phase === "takeoff") {
            green = ["F002","F003","F004","F005","F006","F007","F008","F009","F010","F011","F012","F013","F016"];
        } else {
            green = ["F001","F014","F015","F017"];
        }
    }

    if (runway === "04") {
        if (phase === "takeoff") {
            green = ["F002","F003","F007","F008","F009","F011","F013"];
            red   = ["F004","F005","F006","F010","F012","F016"];
        } else {
            green = ["F014","F015"];
            red   = ["F001","F017"];
        }
    }

    green.forEach(id => {
        if (sonometers[id]) {
            sonometers[id].marker.setStyle({ color: "green", fillColor: "green" });
        }
    });

    red.forEach(id => {
        if (sonometers[id]) {
            sonometers[id].marker.setStyle({ color: "red", fillColor: "red" });
        }
    });
}

// Mise à jour du panneau dynamique (tri + stats + graphique)
function updateSonometerPanel() {
    const list = document.getElementById("sono-list");
    const stats = document.getElementById("sono-stats");
    if (!list || !stats) return;

    const all = Object.values(sonometers);

    // Détection couleur réelle
    const green = all.filter(s => s.marker.options.color === "green");
    const red   = all.filter(s => s.marker.options.color === "red");
    const gray  = all.filter(s => s.marker.options.color === "gray");

    // Compteur dynamique
    stats.innerHTML =
        `<b>${green.length}</b> verts – <b>${red.length}</b> rouges – <b>${gray.length}</b> neutres`;

    // Tri automatique : verts → rouges → gris
    const sorted = [...green, ...red, ...gray];

    // Liste
    list.innerHTML = sorted.map(s => {
        let cls = "sono-gray";
        if (s.marker.options.color === "green") cls = "sono-green";
        if (s.marker.options.color === "red") cls = "sono-red";

        return `<div class="sono-item ${cls}">
                    <span>${s.id}</span>
                </div>`;
    }).join("");

    // Mise à jour du mini‑graphique
    updateSonoChart(green.length, red.length, gray.length);
}

// Mini‑graphique (barres)
function updateSonoChart(g, r, y) {
    const canvas = document.getElementById("sono-chart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = g + r + y || 1;

    const barWidth = 60;
    const spacing = 20;
    const baseY = 55;

    const scale = 50 / total;

    ctx.fillStyle = "green";
    ctx.fillRect(10, baseY - g * scale, barWidth, g * scale);

    ctx.fillStyle = "red";
    ctx.fillRect(10 + barWidth + spacing, baseY - r * scale, barWidth, r * scale);

    ctx.fillStyle = "gray";
    ctx.fillRect(10 + 2 * (barWidth + spacing), baseY - y * scale, barWidth, y * scale);

    ctx.fillStyle = "#333";
    ctx.fillText("V", 35, baseY + 10);
    ctx.fillText("R", 35 + barWidth + spacing, baseY + 10);
    ctx.fillText("N", 35 + 2 * (barWidth + spacing), baseY + 10);
}

// ======================================================
// METAR
// ======================================================

async function loadMetar() {
    const data = await fetchJSON(ENDPOINTS.metar);
    updateMetarUI(data);
    updateStatusPanel("METAR", data);
}

function getPhase(runway, windDir) {
    if (!runway || !windDir) return "takeoff";

    if (runway === "22") {
        if (windDir >= 200 && windDir <= 260) return "landing";
        return "takeoff";
    }

    if (runway === "04") {
        if (windDir >= 20 && windDir <= 80) return "landing";
        return "takeoff";
    }

    return "takeoff";
}

function updateMetarUI(data) {
    const el = document.getElementById("metar");
    if (!el) return;

    if (!data || !data.raw) {
        el.innerText = "METAR indisponible";
        drawCorridor("UNKNOWN");
        updateRunwayPanel("UNKNOWN", null, null, null);
        updateSonometersAdvanced("UNKNOWN", "takeoff");
        updateSonometerPanel();
        return;
    }

    el.innerText = data.raw;

    const windDir = data.wind_direction?.value;
    const windSpeed = data.wind_speed?.value;

    const runway = getRunwayFromWind(windDir);
    const phase = getPhase(runway, windDir);

    updateSonometersAdvanced(runway, phase);
    updateSonometerPanel();

    updateRunwayPanel(runway, windDir, windSpeed, phase);

    drawRunway(runway);
    drawCorridor(runway);
}


// ======================================================
// TAF
// ======================================================

async function loadTaf() {
    const data = await fetchJSON(ENDPOINTS.taf);
    updateTafUI(data);
}

function updateTafUI(data) {
    const el = document.getElementById("taf");
    if (!el) return;

    if (data.fallback) {
        el.innerText = "TAF indisponible (fallback activé)";
        return;
    }

    el.innerText = data.raw || "TAF disponible";
}

// ======================================================
// FIDS (UI compacte + colorée)
// ======================================================

async function loadFids() {
    const data = await fetchJSON(ENDPOINTS.fids);
    updateFidsUI(data);
}

function updateFidsUI(data) {
    const container = document.getElementById("fids");
    if (!container) return;

    if (data.fallback) {
        container.innerHTML = `<div class="fids-row fids-unknown">FIDS indisponible</div>`;
        return;
    }

    const flights = Array.isArray(data) ? data : [];
    container.innerHTML = "";

    if (!flights.length) {
        container.innerHTML = `<div class="fids-row fids-unknown">Aucun vol disponible</div>`;
        return;
    }

    flights.forEach(flight => {
        const statusText = (flight.status || "").toLowerCase();

        let cssClass = "fids-unknown";
        if (statusText.includes("on time")) cssClass = "fids-on-time";
        if (statusText.includes("delayed")) cssClass = "fids-delayed";
        if (statusText.includes("cancel")) cssClass = "fids-cancelled";
        if (statusText.includes("board")) cssClass = "fids-boarding";

        const row = document.createElement("div");
        row.className = `fids-row ${cssClass}`;
        row.innerHTML = `
            <span>${flight.flight || "-"}</span>
            <span>${flight.destination || "-"}</span>
            <span>${flight.time || "-"}</span>
            <span>${flight.status || "-"}</span>
        `;
        container.appendChild(row);
    });
}

// ======================================================
// CARTE
// ======================================================

function initMap() {

    // Initialisation de la carte
    map = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([50.643, 5.443], 11);

    // Bouton reset carte
    const resetBtn = document.getElementById("reset-map");
    if (resetBtn) {
        resetBtn.onclick = () => {
            map.setView([50.643, 5.443], 11);
        };
    }

    // Fond de carte
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    // Couches runway + corridor
    runwayLayer = L.layerGroup().addTo(map);
    corridorLayer = L.layerGroup().addTo(map);

    // Sonomètres
    initSonometers(map);
}

document.getElementById("sono-header").onclick = () => {
    const panel = document.getElementById("sono-panel");
    const toggle = document.getElementById("sono-toggle");

    panel.classList.toggle("expanded");
    toggle.textContent = panel.classList.contains("expanded") ? "⯆" : "⯈";
};

// ======================================================
// INITIALISATION GLOBALE
// ======================================================

window.onload = () => {
    initMap();
    loadMetar();
    loadTaf();
    loadFids();
};
