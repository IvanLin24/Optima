# Optima public site

Standalone, bank-quality product site: /site/ served from the current Python server. Working application remains at /#offers.

Run: py -3 run_local.py, then open http://127.0.0.1:4173/site/. The top header and main CTAs link to the existing working demo.

Files:
- dist/site/index.html: page structure, original SVG art direction.
- dist/site/site.css: self-contained responsive styles, Golos Text.
- dist/site/site.js: menu controls and live pricing (imports ../js/data.js and ../js/domain.js).
- dist/site/mark.svg: independent product mark.

No external CDN, fonts or analytics. Prices and supplier data are fictional. This is a VTB hackathon concept, not an official bank site.

The GitHub Actions workflow Optima public site verifies JS syntax and captures desktop and mobile screenshots via Chromium after each edit.
