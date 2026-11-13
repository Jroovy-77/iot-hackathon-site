# Protomaps Leaflet 5.0.0

Official browser distribution from https://registry.npmjs.org/protomaps-leaflet/-/protomaps-leaflet-5.0.0.tgz (`dist/protomaps-leaflet.js`). Vendored unmodified for offline station use. BSD-3-Clause license included in LICENSE.

Documentation: https://docs.protomaps.com/pmtiles/leaflet and https://github.com/protomaps/protomaps-leaflet

This library is in maintenance mode. This existing dashboard depends heavily on Leaflet; use is limited to the non-interactive basemap canvas layer. Rescue markers, selection, keyboard controls and touch gestures remain Leaflet UI. For a future new map implementation, evaluate the officially recommended MapLibre renderer.

FloodLink's adapter sets local Anuphan/system font families, checks decoded Protomaps layer IDs, surfaces local read failures, and uses only same-station archive URLs. Actual downloaded Protomaps basemap 4.15.2 (20261026 build) was verified with Thai labels, roads, buildings and water offline. Map data attribution remains displayed in the map control.
