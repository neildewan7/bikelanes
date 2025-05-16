import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

console.log('Mapbox GL JS Loaded:', mapboxgl);

mapboxgl.accessToken = 'pk.eyJ1IjoibmVpbGRld2FuIiwiYSI6ImNtYXFnZmltbjA5MTYyc3BwNHY5a3BvemMifQ.FGrBTZ8ry7eKGg-OshZhgA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.on('load', async () => {
  // --- Boston and Cambridge Bike Lanes ---
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

  // --- Station SVG Layer ---
  const svg = d3.select('#map').append('svg');

  // --- Tooltip Div ---
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('background-color', 'white')
    .style('color', 'black')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('font-size', '14px')
    .style('pointer-events', 'none')
    .style('box-shadow', '0 2px 5px rgba(0, 0, 0, 0.2)')
    .style('z-index', '10')
    .style('display', 'none');

  let stations;
  try {
    const response = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
    stations = response.data.stations;
    console.log('Loaded stations:', stations.length);
  } catch (error) {
    console.error('Error loading station data:', error);
    return;
  }

  const trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv');

  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

  stations = stations.map((station) => {
    const id = station.short_name;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });

  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(stations, d => d.totalTraffic)])
    .range([0, 25]);

  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8)
    .attr('pointer-events', 'auto')
    .on('mouseover', function (event, d) {
      tooltip
        .style('display', 'block')
        .html(`${d.totalTraffic} trips<br>(${d.departures} departures, ${d.arrivals} arrivals)`);
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
    })
    .on('mouseout', function () {
      tooltip.style('display', 'none');
    });

  function getCoords(station) {
    const lon = +station.lon;
    const lat = +station.lat;
    if (isNaN(lon) || isNaN(lat)) {
      console.warn('Invalid coords:', station);
      return { cx: -1000, cy: -1000 };
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
