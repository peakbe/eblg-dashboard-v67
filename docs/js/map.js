// ======================================================
// MAP — VERSION PRO+
// Initialisation Leaflet + couches globales + sonomètres
// ======================================================

import { initSonometers } from "./sonometers.js";
import { RUNWAYS } from "./runways.js";


// ------------------------------------------------------
// Logging PRO+
// ------------------------------------------------------
const IS_DEV = location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1");
const log = (...a) => IS_DEV && console.log("[MAP]", ...a);
const logErr = (...a) => console.error("[MAP ERROR]", ...a);


// ------------------------------------------------------
// 1) Paramètres carte
// ------------------------------------------------------
const MAP_CENTER = [50.64695, 5.44340];   // EBLG
const MAP_ZOOM   = 13;


// ------------------------------------------------------
// 2) Initialisation carte
// ------------------------------------------------------
export function initMap() {
    try {
        // ------------------------------
        // A) Création carte Leaflet
        // ------------------------------
        const map = L.map("map", {
            zoomControl: false,
            preferCanvas: true,
            worldCopyJump: true
        }).setView(MAP_CENTER, MAP_ZOOM);

        log("Carte créée");

        // ------------------------------
        // B) Fond de carte
        // ------------------------------
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap"
        }).addTo(map);

        log("Fond OSM chargé");

        // ------------------------------
        // C) Couches globales
        // ------------------------------
        window.runwayLayer   = L.layerGroup().addTo(map);
        window.corridorLayer = L.layerGroup().addTo(map);

        log("Couches runway/corridor initialisées");

        // ------------------------------
        // D) Sonomètres (clusters + markers)
        // ------------------------------
        initSonometers(map);
        log("Sonomètres initialisés");

        // ------------------------------
        // E) Contrôles carte
        // ------------------------------
        L.control.zoom({ position: "bottomright" }).addTo(map);

        log("Contrôles ajoutés");

        return map;

    } catch (err) {
        logErr("Erreur initMap :", err);
        throw err; // On laisse app.js gérer l’erreur
    }
}
