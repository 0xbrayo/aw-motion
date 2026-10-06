# aw-motion

Promo videos for [ActivityWatch](https://activitywatch.net), made as canvas pages rendered frame by frame with
headless Chrome and muxed with ffmpeg. The music is synthesized in Node.

## Videos

| Script | Page | Output |
|---|---|---|
| `npm run promo` | `index.html` | `activitywatch-promo.mp4`: short logo/feature promo |
| `npm run day` | `day.html` | `activitywatch-day.mp4`: one day with ActivityWatch (illustrated, not real UI) |
| `npm run real` / `npm run real-dark` | `real.html` / `real-dark.html` | ~49s tour of the real web UI, light / dark |
| `npm run tour` | `tour.html` | ~2:54 tour: a live recording of the real web UI |

Each script builds the soundtrack (`*-music.js` → `.wav`) and then renders. Rendered `.mp4`/`.wav` files are not committed.

## Layout

- `shared.js`: canvas, palette, easing, text and logo helpers shared by every page.
- `render.js`: drives a page's `render(t)` across several headless Chrome tabs and pipes frames to ffmpeg.
  `--stills 1,4.5` writes single frames to `stills/` instead.
- `synth.js`: the small synth/mixer the `*-music.js` scores are written with.
- `demo-data.js`: seeds an aw-server with three weeks of fictional activity for host `macbook`.
- `capture-webui.js`: screenshots of the real aw-webui (into `webui/` and `webui-dark/`), used by `real.js`.
- `capture-tour.js`: records aw-webui as a 30 fps "screen recording" (into `tour/`), used by `tour.js`.
  It installs a virtual clock in the page so aw-webui's own animations advance exactly one frame per capture,
  logs the cursor per frame, and reads the numbers shown in the captions from the page itself.
- `aw-media/`: submodule of [ActivityWatch/media](https://github.com/ActivityWatch/media) (logos and artwork).

## Capturing the real UI

Every UI shown in `real.*` and `tour.*` is a capture of [aw-webui](https://github.com/ActivityWatch/aw-webui)
running against fictional demo data. To re-capture:

1. Build aw-webui (upstream `master`) and serve it from a separate, throwaway aw-server on port 5699:
   ```sh
   git clone --recursive https://github.com/ActivityWatch/aw-webui && (cd aw-webui && npm ci && npm run build)
   aw-server --testing --port 5699 --dbpath /tmp/aw-demo/demo.db --webpath aw-webui/dist --no-legacy-import
   ```
2. Seed it and capture:
   ```sh
   node demo-data.js                     # fixed dates around Fri 2026-09-25
   node capture-webui.js [--dark]        # stills for real.html / real-dark.html
   npm run tour:capture                  # the tour recording (~8 min, ~180 MB in tour/)
   ```

`capture-tour.js` resets the demo server's settings before and after recording, and edits a category on camera.
Only `/api/0/info` is rewritten, so the footer shows the demo hostname.

## Requirements

- Node 22+, then `npm install`
- Google Chrome at `/Applications/Google Chrome.app` (macOS path, used by `render.js` and the capture scripts)
