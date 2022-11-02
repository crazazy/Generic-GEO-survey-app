// list of markers with metadata attached to it
let markers = [];

// list of the history of edited markers
let history = [];

// turn the geolocation API into a Promise because callbacks are horrible
const geo = (options) =>
      new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, options)
      );
// create a map in the map div
const map = L.map("map").setView([0, 0], 0);
// this should happen every time the map changes
document.getElementById("map").addEventListener("change", updateTable)
let polyline = null;

// function-in-a-function semantics to pass the markerId to the marker that fired the event
// leaflet doesn't really have a good way to store metadata in its map objects
// adds a marker move to the history of marker moves
const addHistory = markerId => function(event) {
    const objPos = event.target.getLatLng();
    markers[markerId].pos.unshift([objPos.lat, objPos.lng]);
    history.push(markerId);
}

//undoes a marker move
function undoHistory() {
    if (history.length > 0) {
	let undoMarker = markers[history.pop()];
	undoMarker.pos.shift();
	if (undoMarker.pos.length > 0) {
            undoMarker.marker.setLatLng(undoMarker.pos[0]);
        } else {
            map.removeLayer(undoMarker.marker)
        }
    }
    updateTable()
    createPolyline()
}

// puts a undo button in the map
class ExtraMapTools extends L.Control {
    constructor() {
        super('topright');
    }
    onAdd(map) {
        const original = document.getElementById("maptools")
        let result = original.cloneNode();
        result.innerHTML = original.innerHTML;
        result.removeAttribute("id");
        return result
    }
}

map.addControl(new ExtraMapTools())

function createPolyline() {
    if (polyline != null) {
	map.removeLayer(polyline);
    }
    const coords = markers
          .filter(x => x.pos.length > 0)
	  .map(x => x.marker.getLatLng())
	  .map(({lat, lng}) => [lat, lng])
    polyline = L.polyline(coords, {color: 'blue'}).addTo(map);
}

//creates a duplicate pop-up form, requires a markerId to be passed to it to make it unique
function createForm(markerId) {
    const original = document.getElementById("popup-form")
    const form = original.cloneNode();
    // throw the children of the original into the cloned form as well
    form.innerHTML = original.innerHTML.replace(/CHANGE_MARKER_VALUE/g, markerId.toString());
    form.setAttribute("id", form.getAttribute("id") + "-" + markerId.toString())
    // make a discernable (ish) description
    form.querySelector("label").innerHTML += (" " + markerId.toString());;
    return form;
}

// update the description in the list of markers
function updateDesc(event, markerId) {
    event.preventDefault();
    // find the description
    const descNode = event.target.form.querySelector("input[type=\"text\"]");
    const desc = descNode.value;
    markers[markerId].desc = desc
    updateTable()
}
//updates the location on the map
function updateLocation() {
    //set options as per the source of
    // https://paulojraposo.github.io/SomaliTreeSurvey/
    // this function happens asynchronously
    geo({
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    })
    // only the coords are useful
        .then((pos) => {
	    // showPosition(pos); //not neccesary
	    return pos.coords;
	})
    // this is where all the basic map manipulation happens
        .then((crd) => {
            let pos = [crd.latitude, crd.longitude];
            const markerId = markers.length;
            // a custom object containing the position and ID of a leaflet marker
            const marker = {
                markerId,
		pos: [pos],
                timestamp: Date.now(),
                marker: L.marker(pos, {title: markerId.toString(), draggable: true})
            }
            markers.push(marker)
            history.push(markerId)
            // center the map based on the current set of points we have
            map.fitBounds(markers.filter(x => x.pos.length > 0).map(x => x.pos[0]));
            // add the marker for a precise location
            marker.marker.bindPopup(createForm(markerId));
	    marker.marker.on('move', createPolyline)
	    marker.marker.on('dragend', addHistory(markerId))
       	    marker.marker.on('dragend', updateTable)
            marker.marker.addTo(map)
            localStorage.setItem('markers', JSON.stringify(markers.map(({marker, ...notMarkers}) => notMarkers)));
	    createPolyline()
            updateTable()
        })
        .catch((err) => document.body.innerHTML += err.message);
}
function exportJSON(type, shapeDesc="Undescripted") {
    switch (type) {
    case "points":
        return JSON.stringify({
            "type": "FeatureCollection",
            "features": markers.map(marker => ({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": marker.pos.map(([lat, lng]) => [lng, lat])[0]
                },
                "properties": {
                    "desc": marker.hasOwnProperty("desc")
                        ? marker.desc
                        : "Undescripted"
                }
            }))
        })
    case "line":
        return JSON.stringify({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": markers.map(marker => marker.pos.map(([lat, lng]) => [lng, lat])[0])
            },
            "properties": {
                "desc": shapeDesc
            }
        })
    case "polygon":
        return JSON.stringify({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                // wikipedia seems to imply that the last point of a polygon
                // is the same as the first point
                "coordinates": markers.concat(markers[0]).map(marker => marker.pos.map(([lat, lng]) => [lng, lat])[0])
            }
        })
    }
}
// =======================================================================
// Get Position in Latitude and Longitude and Create a Record Table

// Selecting an element
const table = document.getElementById('mytable');
// old table content for if we want to update the entire table
const emptyTableContent = table.innerHTML;

function updateTable() {
    // empty the entire table
    table.innerHTML = emptyTableContent;
    for (marker of markers.filter(marker => marker.pos.length > 0)) {
        const [lat, lng] = marker.pos[0];
        let distance = 0
        if (marker.markerId > 0) {
            const prevMarker = markers[marker.markerId - 1].marker
            distance = marker.marker.getLatLng().distanceTo(prevMarker.getLatLng());
        }
        const time = new Date(marker.timestamp);
        // done in the order of tbody#mytable
        const tableData = { point: marker.markerId + 1,
                            lat,
                            lng,
                            date: time.toDateString(),
                            time: time.toTimeString(),
                            description: marker.desc,
                            distance: distance.toPrecision(5) + ' meters'
                           }
        const tr = document.createElement('tr');
        for (datum in tableData) {
            const td = document.createElement('td');
            td.setAttribute('class', 'row-item ' + datum);
            td.innerText = tableData[datum];
            tr.append(td)
        }
        table.append(tr);
    }
}


// get the location of the user upon loading the web page (don't put a marker down yet)
geo()
    .then(pos => pos.coords)
    .then(({latitude, longitude}) => {
        map.setView([latitude, longitude], 12)
        // try to fetch markers from localStorage
        if (localStorage.getItem('markers') != null) {
            markers = JSON.parse(localStorage.getItem('markers'))
            markers = markers
                .map(({markerId, pos, timestamp, desc}) => ({
                    markerId, pos, timestamp, desc,
                    marker: pos.length == 0 ? null : (L.marker(pos[0], {title: markerId.toString(), draggable: true})
                                                      .bindPopup(createForm(markerId))
                                                      .on('move', createPolyline)
                                                      .on('dragend', addHistory(markerId))
                                                      .on('dragend', updateTable)
                                                      .addTo(map))
                }))
            createPolyline();
            updateTable();
        }
    })
// mount the updating function to the button
document.getElementById("update").addEventListener("click", updateLocation);

function clearAll() {
    if (confirm("Do you really wish to delete all geo data?")) {
        // remove markers from map
        markers
            .filter(x => x.pos.length > 0) // these markers are already gone
            .map(({marker}) => map.removeLayer(marker))
        markers = [];
        localStorage.clear();
        // update visuals as well
        createPolyline();
        updateTable();
    }
}

// get a pretty image for the map from a tile server
let tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Basemap Options
const basicMap = document.getElementById('basic-map');
const darkMap = document.getElementById('dark-map');
const imageryMap = document.getElementById('imagery-map');

const updateLayer = ({url, attr}) => function(event) {
    map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(url, {attribution: attr}).addTo(map);
    [basicMap, darkMap, imageryMap].map(el => el.classList.remove('map-selected'));
    event.currentTarget.classList.add('map-selected');
}

basicMap.addEventListener('click', updateLayer({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}))
darkMap.addEventListener('click', updateLayer({
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
}))
imageryMap.addEventListener('click', updateLayer({
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr:'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}))

// Export the markers to geoJSON
// =======================================================================
// Export the Table as a CSV File
// From https://stackoverflow.com/a/16203218
function exportTableToCSV($table, filename) {

    var $rows = $table.find('tr:has(td)'),

        // Temporary delimiter characters unlikely to be typed by keyboard
        // This is to avoid accidentally splitting the actual contents
        tmpColDelim = String.fromCharCode(11), // vertical tab character
        tmpRowDelim = String.fromCharCode(0), // null character

        // actual delimiter characters for CSV format
        colDelim = '","',
        rowDelim = '"\r\n"',

        // Grab text from table into CSV formatted string
        csv = '"' + $rows.map(function (i, row) {
            var $row = $(row),
                $cols = $row.find('td');

            return $cols.map(function (j, col) {
                var $col = $(col),
                    text = $col.text();

                return text.replace(/"/g, '""'); // escape double quotes

            }).get().join(tmpColDelim);

        }).get().join(tmpRowDelim)
            .split(tmpRowDelim).join(rowDelim)
            .split(tmpColDelim).join(colDelim) + '"';

    // Deliberate 'false', see comment below
    if (false && window.navigator.msSaveBlob) {

        var blob = new Blob([decodeURIComponent(csv)], {
            type: 'text/csv;charset=utf8'
        });

        // Crashes in IE 10, IE 11 and Microsoft Edge
        // See MS Edge Issue #10396033
        // Hence, the deliberate 'false'
        // This is here just for completeness
        // Remove the 'false' at your own risk
        window.navigator.msSaveBlob(blob, filename);

    } else if (window.Blob && window.URL) {
        // HTML5 Blob        
        var blob = new Blob([csv], {
            type: 'text/csv;charset=utf-8'
        });
        var csvUrl = URL.createObjectURL(blob);

        $(this)
            .attr({
                'download': filename,
                'href': csvUrl
            });
    } else {
        // Data URI
        var csvData = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csv);

        $(this)
            .attr({
                'download': filename,
                'href': csvData,
                'target': '_blank'
            });
    }
}

// This must be a hyperlink
$(".export").on('click', function (event) {
    // CSV
    var args = [$('#dvData>table'), 'export.csv'];

    exportTableToCSV.apply(this, args);

    // If CSV, don't do event.preventDefault() or return false
    // We actually need this to be a typical hyperlink
});

// Filters
function pointIsChecked() {
    let pointCol = document.getElementsByClassName('point');
    if (document.getElementById('check-point').checked == false) {
        for (i = 0; i < pointCol.length; i++ ) {
            pointCol[i].classList.add("hide-column");
        }
    } else {
        for (i = 0; i < pointCol.length; i++ ) {
            pointCol[i].classList.remove("hide-column");
        }
    }
}

function latIsChecked() {
    let latCol = document.getElementsByClassName('lat');
    if (document.getElementById('check-lat').checked == false) {
        for (i = 0; i < latCol.length; i++) {
            latCol[i].classList.add("hide-column");
        }
    } else {
        for (i = 0; i < latCol.length; i++) {
            latCol[i].classList.remove("hide-column");
        }
    }
}

function lngIsChecked() {
    let lngCol = document.getElementsByClassName('lng');
    if (document.getElementById('check-lng').checked == false) {
        for (i = 0; i < lngCol.length; i++) {
            lngCol[i].classList.add("hide-column");
        }
    } else {
        for (i = 0; i < lngCol.length; i++) {
            lngCol[i].classList.remove("hide-column");
        }
    }
}

function dateIsChecked() {
    let dateCol = document.getElementsByClassName('date');
    if (document.getElementById('check-date').checked == false) {
        for (i = 0; i < dateCol.length; i++) {
            dateCol[i].classList.add("hide-column");
        }
    } else {
        for (i = 0; i < dateCol.length; i++) {
            dateCol[i].classList.remove("hide-column");
        }
    }
}

function timeIsChecked() {
    let timeCol = document.getElementsByClassName('time');
    if (document.getElementById('check-time').checked == false) {
        for (i = 0; i < timeCol.length; i++ ) {
            timeCol[i].classList.add("hide-column");
        }
    } else {
        for (i = 0; i < timeCol.length; i++ ) {
            timeCol[i].classList.remove("hide-column");
        }
    }
}

function descriptionIsChecked() {
    let descriptionCol = document.getElementsByClassName('description');
    if (document.getElementById('check-description').checked == false) {
        for (i = 0; i < descriptionCol.length; i++ ) {
            descriptionCol[i].classList.add("hide-column");
        }
    } else {
        for (i = 0; i < descriptionCol.length; i++ ) {
            descriptionCol[i].classList.remove("hide-column");
        }
    }
}

function distanceIsChecked() {
    let distance = document.getElementsByClassName('distance');
    if (document.getElementById('check-distance').checked == false) {
        for (i = 0; i < distance.length; i++ ) {
            distance[i].classList.add("hide-column");
        }
    } else {
        for (i = 0; i < distance.length; i++ ) {
            distance[i].classList.remove("hide-column");
        }
    }
}
