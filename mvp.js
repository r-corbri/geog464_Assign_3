const map = L.map('map').setView([38.50, -122.914], 10);

// Different Basemap options to choose from 
const basemaps = {
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  "Carto Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'),
  "ESRI Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
};

// Make georaster accessible everywhere
let georasterGlobal;

L.control.layers(basemaps).addTo(map);
basemaps["ESRI Satellite"].addTo(map); // default

// Initialize sidebar
const sidebar = L.control.sidebar({
  container: 'sidebar',
  position: 'left'
}).addTo(map);

// Open home tab by default
sidebar.open('home');

// Add address search control API
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
let histFirePerimeterLayer = null;

// Define projection explicitly
proj4.defs("EPSG:4326","+proj=longlat +datum=WGS84 +no_defs");

// --- Create panes. zIndex determines what level the panes are at. ---
map.createPane('lifeFormsPane'); map.getPane('lifeFormsPane').style.zIndex = 220;
map.createPane('fireStationsPane'); map.getPane('fireStationsPane').style.zIndex = 500;
map.createPane('slopePane'); map.getPane('slopePane').style.zIndex = 210;
map.createPane('LifeFormsRasPane'); map.getPane('LifeFormsRasPane').style.zIndex = 300;
map.createPane('fireRiskIndexPane'); map.getPane('fireRiskIndexPane').style.zIndex = 400;
map.createPane('histFirePerimeterPane'); map.getPane('histFirePerimeterPane').style.zIndex = 450;

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

// --- LifeForms ---
// New clipped worked and verticies were simplified -- still needs to be rasterized for calc
/* fetch('../mvp_proj_data/LifeForms_Subset.geojson')
    .then(res => res.json())
    .then(data => {
        const lifeFormColors = {    // --- Add in remaining lifeform feilds ---
            "Native Forest": "#fb6a2cff",
            "Urban Window": "#bdbdbdff", 
            "Non-native Forest & Woodland": "#ffee00ff",
            "Vineyard": "#ff9d00ff", 
            "Vineyard Replant": "#ff9d00ff",
            "Non-Native Forest": "#fb2c2cff",
            "Shrub": "#fb6a2cff", 
            "Non-Native Shrub": "#fb2c2cff", 
            "Herbaceous": "#7CFC00"
        };

        lifeFormsLayer = L.geoJSON(data, {      // --- Lifeform polygon symbology: polygon border, pop-ups, and how polygons without classification appear (currently as transparant)
            pane: 'lifeFormsPane',
            style: f => ({
                color: '#706969ff', weight: 1, fillOpacity: 0.2,
                fillColor: lifeFormColors[f.properties.LIFEFORM] || 'rgba(0,0,0,0)'
            }),
            onEachFeature: (f, layer) => {
                if (f.properties) {
                    let popup = '<b>Feature Info</b><br>';
                    for (const key in f.properties) popup += `<b>${key}:</b> ${f.properties[key]}<br>`;
                    layer.bindPopup(popup);
                }
            }
        });

        // LifeForms legend entry
        const legendDiv = document.querySelector('.info.legend');
        legendDiv.innerHTML += '<b>LifeForm Types</b><br>';
        for (const type in lifeFormColors) {
            const color = lifeFormColors[type];
            legendDiv.innerHTML += `<i style="background:${color}; width:18px; height:18px; display:inline-block; margin-right:6px;"></i>${type}<br>`;
        }

        // lifeform layer control
        updateLayerControl();
    })
    .catch(err => console.error('Error loading LifeForms GeoJSON:', err)); */

// --- Fire Stations ---
fetch('../mvp_proj_data/Fire_Stations_(HFL).geojson')
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


// --- Slope Layer --- Turning this off cause it's messing with the risk layer.
/*fetch("../mvp_proj_data/Sonoma_Slope_4326.tif")
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => parseGeoraster(arrayBuffer))
    .then(georaster => {

        const min = georaster.mins[0];
        const max = georaster.maxs[0];

        // linear interpolation function for slope symbology
        function interpolateColor(value, min, max, colorLow, colorHigh) {
            const ratio = (value - min) / (max - min);
            const r = Math.round(colorLow[0] + ratio * (colorHigh[0] - colorLow[0]));
            const g = Math.round(colorLow[1] + ratio * (colorHigh[1] - colorLow[1]));
            const b = Math.round(colorLow[2] + ratio * (colorHigh[2] - colorLow[2]));
            return `rgb(${r},${g},${b})`;
        }

        const colorLow = [255, 255, 178]; // low slope = yellow
        const colorHigh = [189, 0, 38];   // high slope = red

        slopeLayer = new GeoRasterLayer({ 
            georaster, 
            pane: 'slopePane', 
            opacity: 0.7, 
            pixelValuesToColorFn: value => { 
                if (value === null) return null; 
                return interpolateColor(value, min, max, colorLow, colorHigh);
            }
        });

        map.fitBounds(slopeLayer.getBounds());

        // Add slope to legend
        const legendDiv = document.querySelector('.info.legend');
        if (legendDiv) {
            legendDiv.innerHTML += '<hr style="margin:6px 0;"><b>Slope (°)</b><br>';
            legendDiv.innerHTML += `
                <i style="background:rgb(${colorLow.join(',')}); width:18px; height:18px; display:inline-block; margin-right:6px;"></i> Low<br>
                <i style="background:rgb(${colorHigh.join(',')}); width:18px; height:18px; display:inline-block; margin-right:6px;"></i> High<br>
            `;
        }
        updateLayerControl();
    })
    .catch(err => console.error("Error loading slope GeoTIFF:", err)); */

// --- Rasterized Green Valley Lifeforms (with fire risk for each lifeform type, no slope calc) ---
/*fetch("../mvp_proj_data/GvLifeform_rasterized.tif")  // path to your fire risk raster
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => parseGeoraster(arrayBuffer))
    .then(georaster => {

        const min = 0; // your fire risk raster values: 0,1,2
        const max = 2;

        // Define a simple color ramp for 0/1/2 risk
        const riskColors = [
            [200, 200, 200], // 0 = low risk, gray
            [255, 165, 0],   // 1 = moderate risk, orange
            [255, 0, 0]      // 2 = high risk, red
        ];

        function interpolateColor(value) {
            if (value === null) return null;
            // Since values are discrete 0,1,2, just index into riskColors
            const idx = Math.round(value);
            const c = riskColors[idx];
            return `rgb(${c[0]},${c[1]},${c[2]})`;
        }

        lifeFormsRasLayer = new GeoRasterLayer({
            georaster,
            pane: 'LifeFormsRasPane', 
            opacity: 0.6,
            pixelValuesToColorFn: interpolateColor
        });


        // Fit map bounds to the fire risk layer if desired
        // map.fitBounds(fireRiskLayer.getBounds());

        // Add Life Forms Ras legend
        const legendDiv = document.querySelector('.info.legend');
        if (legendDiv) {
            legendDiv.innerHTML += '<hr style="margin:6px 0;"><b>Fire Risk</b><br>';
            const labels = ["Low", "Moderate", "High"];
            for (let i = 0; i <= 2; i++) {
                const c = riskColors[i];
                legendDiv.innerHTML += `<i style="background:rgb(${c.join(',')}); width:18px; height:18px; display:inline-block; margin-right:6px;"></i> ${labels[i]}<br>`;
            }
        }

        // Optionally add to layer control
        // if (map.layerControlAdded) {
        //    map.layerControl.addOverlay(fireRiskLayer, "Fire Risk");
        //}
        
        updateLayerControl();
    })
    .catch(err => console.error("Error loading Life Forms Ras GeoTIFF:", err)); */

 
// --- Calculated Fire Risk Index Layer ---
fetch("../mvp_proj_data/SonomaFL_Fire_Risk_Index_web_4326.tif")     // Forest Lifeforms
//fetch("../mvp_proj_data/Sonoma_Fire_Risk_Index_web_4326.tif")    // General Lifeforms (kinda looks better)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => parseGeoraster(arrayBuffer))
    .then(georaster => {
        console.log("georaster:", georaster);
        console.log("Projection:", georaster.projection)
        window.fireRiskRaster = georaster;
        console.log('GeoRaster loaded for Geoblaze:', georaster);

        georasterGlobal = georaster;   // <--- IMPORTANT
        console.log('Set global', georasterGlobal);
   
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
            opacity: 0.7,
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

        // fireRiskIndexLayer.addTo(map);
    })
    .catch(err => console.error("Error loading calculated Fire Risk Index GeoTIFF:", err));


// --- County Boundary Layer ---
fetch('../mvp_proj_data/County_Boundary.geojson')
    .then(res => res.json())
    .then(data => {
        const countyLayer = L.geoJSON(data, {
            style: {
                color: 'black',    
                weight: 0.8,
                fillOpacity: 0        // transparent fill
            },

        }).addTo(map);
    })
    .catch(err => console.error('Error loading county boundary GeoJSON:', err));

// --- Historic Fire Perimeter Boundary Layer ---
fetch('../mvp_proj_data/GeoProcessing_overflow/Sonoma_Fire_Perimeters.geojson')
    .then(res => res.json())
    .then(data => {
        histFirePerimeterLayer = L.geoJSON(data, {
            pane: 'histFirePerimeterPane',
            onEachFeature: (feature, layer) => {
                layer.on("click", function (e) {
                // Only fire if this layer is active
                if (!activeLayers.has("Historic Fire Perimeters")) return;
                    let popup = "<b>Historical Fire:</b><br>";
                    if (feature.properties) {
                        for (const key in feature.properties) {
                            popup += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                        }
                    }
                    layer.bindPopup(popup).openPopup();
                });
            },
            style: {
                color: 'red',    
                weight: 0.5,
                fillOpacity: 0.5 
            },
        })

        // --- legend entry ---
        const legendDiv = document.querySelector('.info.legend');
        if (legendDiv) {
            legendDiv.innerHTML += `
                <i style=" background: red; width: 18px; height: 18px; display: inline-block;
                margin-right: 6px; border: 1px solid #660000; opacity: 0.5;
                "></i> Historical Fire Perimeters<br>
            `;
        }
        // update layer control
        updateLayerControl();
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
    if (histFirePerimeterLayer) overlayMaps["Historic Fire Perimeters"] = histFirePerimeterLayer;

map.layerControl = L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);
    }

// This tracks which layers are toggled on and off to avoid pop up conflicts
let activeLayers = new Set();

map.on("overlayadd", function (e) {
    activeLayers.add(e.name);
});

map.on("overlayremove", function (e) {
    activeLayers.delete(e.name);
});


// Function that classifies the raw raster calcuation that was converted to a scale of 0-255 (for grey
// scale display, even though that was not used in the end), into my four classes so that click function
// declared below displays the class name instead of a raw pixel value. 
function classifyFireRisk(value) {
    if (value === null || isNaN(value)) return "No Data";

    // Raw pixel values from your 0–255 fire_risk_scaled raster
    
    if (value < 172) {
        return "Low";
    } else if (value < 205) {
        return "Moderate";
    } else if (value < 237) {
        return "High";
    } else {
        return "Very High";
    }
}

// --- CLICK HANDLER FOR POPUP ---
map.on("click", function (e) {

    // Only run this popup if the Fire Risk Index layer is ON
    if (!activeLayers.has("Fire Risk Index")) return;

    // If a vector layer popup is about to open, DO NOT show raster popup
    if (e.originalEvent._stopped) return;

    const latlng = e.latlng;

    const georaster = georasterGlobal;   // <--- IMPORTANT

    // Convert click to raster row/column
    const pixel = geoblaze.identify(georaster, [latlng.lng, latlng.lat]);

    console.log("Pixel value:", pixel);

    // Handle no-data or outside raster area
    if (!pixel || pixel.length === 0 || pixel[0] === undefined) {
        L.popup()
            .setLatLng(latlng)
            .setContent("No data here")
            .openOn(map);
        return;
    }

    // Convert raw pixel → fire risk class
    const rawValue = pixel[0];
    const riskClass = classifyFireRisk(rawValue);

    // Show popup
    L.popup()
        .setLatLng(latlng)
        .setContent(`<b>Fire Risk:</b> ${riskClass}`)
        .openOn(map);
});

fetch("../mvp_proj_data/SonomaFL_Fire_Risk_Index_web_4326.tif")
  .then(r => r.arrayBuffer())
  .then(buf => parseGeoraster(buf))
  .then(georaster => {
      const values = georaster.values[0]; // first band
      const sample = values.slice(0, 10).map(row => row.slice(0, 10));
  });

