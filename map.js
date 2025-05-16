import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoibmVpbGRld2FuIiwiYSI6ImNtYXFnZmltbjA5MTYyc3BwNHY5a3BvemMifQ.FGrBTZ8ry7eKGg-OshZhgA';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.on('load', async () => {
  // --- Add Boston and Cambridge bike lanes ---
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 3,
      'line-opacity': 0.5,
    },
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 3,
      'line-opacity': 0.5,
    },
  });

  // --- Load and draw BlueBike stations using SVG + D3 ---
  const svg = d3.select('#map').select('svg');

  let stations;
  try {
    const response = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
    stations = response.data.stations;
    console.log('Loaded stations:', stations.length);
  } catch (error) {
    console.error('Error loading station data:', error);
    return;
  }

  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', 5)
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8);

  function getCoords(station) {
    const lon = +station.lon;
    const lat = +station.lat;

    if (isNaN(lon) || isNaN(lat)) {
      console.warn('Invalid station coordinates:', station);
      return { cx: -1000, cy: -1000 }; // offscreen
    }

    const { x, y } = map.project([lon, lat]);
    return { cx: x, cy: y };
  }

  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});
