# Scale Space SeedBank

A public registry of *grains* — shared coordinates found in Scale Space — rendered live in the browser.

Live: https://setzstone.github.io/SeedBank/

## Layout

```
app/index.html                 page shell
app/src/main.js                seeds state from a grain, runs the frame loop
app/src/engine.js              the Scale Space Engine, lifted from the core (render + sim only)
app/src/grains/*.json          grain records (the waypoint shape the games export)
docs/index.html                built, self-contained (~870 KB)
```

The engine needs WebGPU. Chrome/Edge/Brave on Android, Safari on iOS 18+, all current desktops.

## Build

```
npm install
npm run build      # writes docs/index.html
npm run dev        # http://localhost:5173
```

Part of the [Scale Space](https://reddit.com/r/ScaleSpace) project.
Find your own grains in [Scale Space Synthesist](https://github.com/setzstone/ScaleSpaceSynth) (free) or [Cymatist](https://setzstone.itch.io/cymatist).
