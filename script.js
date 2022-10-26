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
let polyline = null;

// function-in-a-function semantics to pass the markerId to the marker that fired the event
// leaflet doesn't really have a good way to store metadata in its map objects
// adds a marker move to the history of marker moves
const addHistory = markerId => function(event) {
    const objPos = event.target._latlng;
    markers[markerId].pos.unshift([objPos.lat, objPos.lng]);
    history.push(markerId);
}

//undoes a marker move
function undoHistory() {
    if (history.length > 0) {
	let undoMarker = markers[history.pop()];
	undoMarker.pos.shift();
	undoMarker.marker.setLatLng(undoMarker.pos[0]);
    }
}

function createPolyline() {
    if (polyline != null) {
	map.removeLayer(polyline);
    }
    const coords = markers
	  .map(x => x.marker._latlng)
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
	    showPosition(pos);
	    return pos.coords;
	})
    // this is where all the basic map manipulation happens
        .then((crd) => {
            let pos = [crd.latitude.toFixed(5), crd.longitude.toFixed(5)];
            const markerId = markers.length;
            // a custom object containing the position and ID of a leaflet marker
            const marker = {
                markerId,
		pos: [pos],
                marker: L.marker(pos, {title: markerId.toString(), draggable: true})
            }
            markers.push(marker)
            // center the map based on where we are, with a zoom level of 13
            map.setView(pos, 12);
            // add the marker for a precise location
            marker.marker.bindPopup(createForm(markerId));
	    marker.marker.on('move', createPolyline)
	    marker.marker.on('dragend', addHistory(markerId))
            marker.marker.addTo(map)
	    createPolyline()
        })
        .catch((err) => document.body.innerHTML += err.message);
}
// get the location of the user upon loading the web page
updateLocation();
// mount the updating function to the button
document.getElementById("update").addEventListener("click", updateLocation);

// get a pretty image for the map from a tile server
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


// Export the markers to geoJSON
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

// Show position and adding it to the table (sorry for not using "for")
function showPosition(position) {
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

    const newRow = document.createElement('tr');
    table.append(newRow);

    const td0 = document.createElement('td');
    td0.innerText = position.coords.latitude;
    td0.setAttribute('class', 'row-item');
    newRow.append(td0);

    const td1 = document.createElement('td');
    td1.innerText = position.coords.longitude;
    td1.setAttribute('class', 'row-item');
    newRow.append(td1);

    const td2 = document.createElement('td');
    td2.innerText = date;
    td2.setAttribute('class', 'row-item');
    newRow.append(td2);

    const td3 = document.createElement('td');
    td3.innerText = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();;
    td3.setAttribute('class', 'row-item');
    newRow.append(td3);
}


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
