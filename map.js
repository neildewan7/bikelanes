import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoibmVpbGRld2FuIiwiYSI6ImNtYXFnZmltbjA5MTYyc3BwNHY5a3BvemMifQ.FGrBTZ8ry7eKGg-OshZhgA';

let stations = [];
let circles;
let radiusScale;
let tooltip;
let timeFilter = -1;

let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.on('load', async () => {
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

  const svg = d3.select('#map').append('svg');

  tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('background-color', 'white')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('font-size', '14px')
    .style('pointer-events', 'none')
    .style('box-shadow', '0 2px 5px rgba(0, 0, 0, 0.2)')
    .style('z-index', '10')
    .style('display', 'none');

  const response = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
  stations = response.data.stations;

  await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', (trip) => {
    trip.started_at = new Date(trip.started_at);
    trip.ended_at = new Date(trip.ended_at);
    const startMin = minutesSinceMidnight(trip.started_at);
    const endMin = minutesSinceMidnight(trip.ended_at);
    departuresByMinute[startMin].push(trip);
    arrivalsByMinute[endMin].push(trip);
    return trip;
  });

  radiusScale = d3.scaleSqrt().domain([0, 3000]).range([0, 16]);

  circles = svg
    .selectAll('circle')
    .data(stations, d => d.short_name)
    .enter()
    .append('circle')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8)
    .attr('pointer-events', 'auto');

  circles
    .on('mouseover', (event, d) => {
      tooltip.style('display', 'block')
        .html(`${d.totalTraffic ?? 0} trips<br>(${d.departures ?? 0} departures, ${d.arrivals ?? 0} arrivals)`);
    })
    .on('mousemove', (event) => {
      tooltip.style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY + 10}px`);
    })
    .on('mouseout', () => {
      tooltip.style('display', 'none');
    });

  updateScatterPlot(timeFilter);
  updatePositions();

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();
  const min = (minute - 60 + 1440) % 1440;
  const max = (minute + 60) % 1440;
  return (min > max)
    ? tripsByMinute.slice(min).concat(tripsByMinute.slice(0, max)).flat()
    : tripsByMinute.slice(min, max).flat();
}

function computeStationTraffic(stations, timeFilter = -1) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    v => v.length,
    d => d.start_station_id
  );
  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    v => v.length,
    d => d.end_station_id
  );
  return stations.map(station => {
    const id = station.short_name;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

function updateScatterPlot(timeFilter) {
  const updated = computeStationTraffic(stations, timeFilter);
  circles
    .data(updated, d => d.short_name)
    .attr('r', d => radiusScale(d.totalTraffic ?? 0))
    .style('--departure-ratio', d => d.totalTraffic > 0 ? stationFlow(d.departures / d.totalTraffic) : 0.5);
}

function updatePositions() {
  circles
    .attr('cx', d => map.project([+d.lon, +d.lat]).x)
    .attr('cy', d => map.project([+d.lon, +d.lat]).y);
}

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

const slider = document.getElementById('time-slider');
const selected = document.getElementById('selected-time');
const anyTime = document.getElementById('any-time');

slider.addEventListener('input', () => {
  timeFilter = Number(slider.value);
  selected.textContent = timeFilter === -1 ? '' : formatTime(timeFilter);
  anyTime.style.display = timeFilter === -1 ? 'inline' : 'none';
  updateScatterPlot(timeFilter);
});
