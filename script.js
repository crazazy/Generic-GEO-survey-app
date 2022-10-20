// turn the geolocation API into a Promise because callbacks are horrible
let markers = [];
const geo = (options) =>
      new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, options)
      );
// create a map in the map div
const map = L.map("map").setView([0, 0], 0);

//creates a duplicate pop-up form, requires a markerId to be passed to it to make it unique
function createForm(markerId) {
    const original = document.getElementById("popup-form")
    const form = original.cloneNode();
    // throw the children of the original into the cloned form as well
    form.innerHTML = original.innerHTML;
    form.setAttribute("id", form.getAttribute("id") + "-" + markerId.toString())
    console.log(form);
    // make a discernable (ish) description
    form.querySelector("label").innerHTML += (" " + markerId.toString());
    form.querySelector("input[name=\"markerId\"]").setAttribute("value", markerId.toString());
    return form;
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
        .then((pos) => pos.coords)
    // this is where all the basic map manipulation happens
        .then((crd) => {
            let pos = [crd.latitude.toFixed(5), crd.longitude.toFixed(5)];
            const markerId = markers.length;
            // a custom object containing the position and ID of a leaflet marker
            const marker = {
                pos, markerId,
                marker: L.marker(pos, {title: markerId.toString(), draggable: true})
            }
            markers.push(marker)
            // center the map based on where we are, with a zoom level of 13
            map.setView(pos, 12);
            // add the marker for a precise location
            marker.marker.bindPopup(createForm(markerId));
            marker.marker.addTo(map)
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
