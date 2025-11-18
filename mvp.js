const map = L.map('map').setView([38.50, -122.914], 10);

// Different Basemap options to choose from 
const basemaps = {
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  "Carto Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'),
  "ESRI Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
};

L.control.layers(basemaps).addTo(map);
basemaps["ESRI Satellite"].addTo(map); // default

// Initialize sidebar
const sidebar = L.control.sidebar({
  container: 'sidebar',
  position: 'left'
}).addTo(map);

// Open home tab by default
sidebar.open('home');

// Add search control
L.Control.geocoder({
    defaultMarkGeocode: true,  // Automatically adds marker
    geocoder: L.Control.Geocoder.nominatim()  // Use OSM Nominatim
}).addTo(map);

// Store layers
let fireStationsLayer = null;
let lifeFormsLayer = null;
let slopeLayer = null;
let lifeFormsRasLayer = null;
let fireRiskIndexLayer = null;

// Define projection explicitly
proj4.defs("EPSG:4326","+proj=longlat +datum=WGS84 +no_defs");

// --- Create panes. zIndex determines what level the panes are at. ---
map.createPane('lifeFormsPane'); map.getPane('lifeFormsPane').style.zIndex = 220;
map.createPane('fireStationsPane'); map.getPane('fireStationsPane').style.zIndex = 500;
map.createPane('slopePane'); map.getPane('slopePane').style.zIndex = 210;
map.createPane('LifeFormsRasPane'); map.getPane('LifeFormsRasPane').style.zIndex = 300;
map.createPane('fireRiskIndexPane'); map.getPane('fireRiskIndexPane').style.zIndex = 400;

// --- Legend ---
const legend = L.control({ position: 'bottomleft' });
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.background = 'white';
    div.style.padding = '6px';
    div.style.borderRadius = '4px';
    div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
    return div;
};
legend.addTo(map);


// --- Fire Stations ---
fetch('Fire_Stations_(HFL).geojson')
    .then(res => res.json())
    .then(data => {
        fireStationsLayer = L.geoJSON(data, {
            pane: 'fireStationsPane',
            pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 6, fillColor: 'red', color: '#000', weight: 1, opacity: 1, fillOpacity: 0.8 }),
            onEachFeature: (f, layer) => {
                if (f.properties) {
                    const p = f.properties;
                    layer.bindPopup(`<b>${p.AgencyName}</b><br>Station: ${p.StationNum}<br>Address: ${p.Address}, ${p.City} ${p.Zipcode}<br>Phone: ${p.Phone}<br>Type: ${p.AgencyType}`);
                }
            }
        });

        // Add Fire Stations legend entry
        const legendDiv = document.querySelector('.info.legend');
        legendDiv.innerHTML += '<hr style="margin:6px 0;"><b>Fire Stations</b><br>';
        legendDiv.innerHTML += `<i style="background:red; border:1px solid #000; width:14px; height:14px; border-radius:50%; display:inline-block; margin-right:6px;"></i> Fire Station<br>`;

        updateLayerControl();
    })
    .catch(err => console.error('Error loading Fire Stations GeoJSON:', err));

    
// --- Calculated Fire Risk Index Layer ---
fetch("SonomaFL_Fire_Risk_Index_web_4326.tif")     // Forest Lifeforms
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => parseGeoraster(arrayBuffer))
    .then(georaster => {
        console.log("georaster:", georaster);
        console.log("Projection:", georaster.projection)
        window.fireRiskRaster = georaster;
        console.log('GeoRaster loaded for Geoblaze:', georaster);
  
   
    // Colour scheme for classes (lowest transparent) 
    function interpolateRiskColor(value) {
        if (value === null || isNaN(value)) return null;

        // 4 classes: Low (hidden), Moderate, High, Very High
        // Adjust min/max to your fire risk raster range
        const min = 152; 
        const max = 255;

        // Normalize
        let ratio = (value - min) / (max - min);
        ratio = Math.max(0, Math.min(1, ratio));

        // Define thresholds for the 4 classes
        const thresholds = {
            low: 0.15,       // below this → hidden
            moderate: 0.55,  // 0.30 → 0.55 → yellow
            high: 0.90       // 0.55 → 0.80 → orange
        };

        let r, g, b, a;

        if (ratio < thresholds.low) {
            // Low → hidden
            return 'rgba(0,0,0,0)';
        } else if (ratio < thresholds.moderate) {
            // Moderate → yellow
            r = 255; g = 255; b = 0; a = 0.8;  
        } else if (ratio < thresholds.high) {
            // High → orange
            r = 255; g = 165; b = 0; a = 0.6;
        } else {
            // Very High → red
            r = 255; g = 0; b = 0; a = 0.5;
        }

        return `rgba(${r},${g},${b},${a.toFixed(2)})`;
    }

        fireRiskIndexLayer = new GeoRasterLayer({
            georaster,
            pane: 'fireRiskIndexPane',
            opacity: 0.8,
            pixelValuesToColorFn: interpolateRiskColor,
            resolution: 256, // optional: helps with large rasters
            projection: "EPSG:4326"   // explicitly tell it the CRS
        });


        // Add legend entry for calculated fire risk
        const legendDiv = document.querySelector('.info.legend');
        if (legendDiv) {
            legendDiv.innerHTML += '<hr style="margin:6px 0;"><b>Calculated Fire Risk Index</b><br>';
            legendDiv.innerHTML += `
                <i style="background:rgb(255,255,0); width:18px; height:18px; display:inline-block; margin-right:6px;"></i> Moderate<br>
                <i style="background:rgb(255,128,0); width:18px; height:18px; display:inline-block; margin-right:6px;"></i> High<br>
                <i style="background:rgb(200,0,0); width:18px; height:18px; display:inline-block; margin-right:6px;"></i> Very High<br>
            `;
        }

        // update layer control
        updateLayerControl();

        fireRiskIndexLayer.addTo(map);
    })
    .catch(err => console.error("Error loading calculated Fire Risk Index GeoTIFF:", err));


// --- County Boundary Layer ---
fetch('County_Boundary.geojson')
    .then(res => res.json())
    .then(data => {
        const countyLayer = L.geoJSON(data, {
            style: {
                color: 'black',    
                weight: 0.5,
                fillOpacity: 0        // transparent fill
            },

        }).addTo(map);
    })
    .catch(err => console.error('Error loading county boundary GeoJSON:', err));


// --- Layer Control  ---
// Update layer control function
function updateLayerControl() {
    if (map.layerControl) map.removeControl(map.layerControl);

const overlayMaps = {};
    if (lifeFormsLayer) overlayMaps["Life Forms"] = lifeFormsLayer;
    if (fireStationsLayer) overlayMaps["Fire Stations"] = fireStationsLayer;
    if (slopeLayer) overlayMaps["Slope"] = slopeLayer;
    if (lifeFormsRasLayer) overlayMaps["Life Forms Ras"] = lifeFormsRasLayer;
    if (fireRiskIndexLayer) overlayMaps["Fire Risk Index"] = fireRiskIndexLayer;

map.layerControl = L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);
    }
