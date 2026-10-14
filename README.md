# Prayer Map (Peta Sholat)

*Bahasa Indonesia: [README-id.md](README-id.md)*

An interactive map showing **prayer-time lines** (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) sweeping across the surface of the Earth. Each line connects every point that is entering that prayer time *at the same instant*. The areas between the lines are colored by the prayer time currently in effect there.

## Running

No build step. Open `index.html` in a browser, or run:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Structure

- `js/astro.js` — sun position, hour angle of each prayer event, zones, and per-point timetables. Also usable from Node (`require('./js/astro.js')`).
- `js/i18n.js` — UI translations (Bahasa Indonesia & English). Text in the HTML is marked with `data-i18n`; dynamic text uses `I18n.t()`.
- `js/app.js` — globe/flat-map rendering (D3 + canvas), time animation, and interaction.
- `vendor/` — D3 7.9.0, topojson-client 3.1.0, and the `world-atlas` 110m world map.

## How it works

Prayer times are determined by the sun's local hour angle: `LHA = GHA(t) + longitude`. For each latitude, the app computes the hour angle `H` at which the event happens (for example, the sun at −20° for Fajr under the Kemenag method). At instant `t`, the line lies at `longitude = H − GHA(t)`. At high latitudes some events do not happen (for example, the sun never sinks to −18°), so the line stops there.

## High latitudes

At high latitudes some events do not occur (twilight never disappears, or the sun does not rise or set). The "High latitudes" option in the panel offers:

- **Show as is** (default): zones whose start or end does not occur are hatched, and line ends are marked with a round dot.
- **Aqrab al-bilad**: missing times are taken from latitude 45° in the same hemisphere. During polar night or polar day, all times are taken from 45°.
- **Middle of the night / one-seventh of the night / angle-based**: only fill in Isha and Fajr, and require the sun to rise and set.

Lines produced by a rule are drawn as faint dashed lines, and the point timetable marks those times with `*`.
