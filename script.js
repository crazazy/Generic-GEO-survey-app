// turn the geolocation API into a Promise because callbacks are horrible
const geo = (options) =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  );
// create a map in the map div
const map = L.map("map").setView([0, 0], 0);

//set options as per the source of
// https://paulojraposo.github.io/SomaliTreeSurvey/
// this function happens asynchronously
geo({
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
})
  // pnly the coords are useful
  .then((pos) => pos.coords)
  // this is where all the basic map manipulation happens
  .then((crd) => {
    let pos = [crd.latitude.toFixed(5), crd.longitude.toFixed(5)];
    // center the map based on where we are, with a zoom level of 13
    map.setView(pos, 12);
    // add a marker for a precise location
    L.marker(pos).addTo(map);
  })
  .catch((err) => (document.body.innerHTML += err.toString()));

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);