# Touch and devices

- To try a component as on a phone, the catalogue's Touch switch (`touch=touch` in a view: `--view "touch=touch"`)
  sends the story a finger's events and a phone's hover and pointer media; a tap on a text field focuses it and puts the
  caret there. It is a simulation: native scrolling, the
  virtual keyboard and real Safari still need a device, or `forgebook dev --touch` (Chromium's real touch).
  A story reads it as `context.globals.touch` (`"mouse"` or `"touch"`) or fixes it with
  `globals: { touch: "touch" }`. A story meant for a phone writes `parameters.touch: true` (or its meta does): the
  catalogue draws it with a finger and offers a toggle to turn that off.
- A screen meant for a phone or a tablet can be shown in a drawn device by default:
  `parameters: { device: { frame: true, model: "iphone-16" } }` (on the meta for every story; `orientation:
  "landscape"` turns it; a story in a device is touched as a phone is, unless `touch: false`). The models: `iphone-16`, `iphone-16-pro-max`, `iphone-16e`, `pixel-9`, `galaxy-s24`, `phone`
  (generic), `ipad-mini`, `ipad-pro-13`. The status bar, the camera's cut and the home indicator sit
  around it: the story is drawn inside the safe areas. A screen drawn edge to edge says `edgeToEdge: true` and pads
  itself with `var(--forgebook-safe-area-top, env(safe-area-inset-top))` (and `-bottom`, `-left`, `-right`). `get_story` returns the setting as `device`. Pictures and
  tests stay unframed unless a view names a model: `forgebook shot <id> --view "iphone-16"` (or `"dark pixel-9
  landscape"`) gives a framed picture.
