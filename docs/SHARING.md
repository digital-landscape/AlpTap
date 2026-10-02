# Results sharing and exact replays

The completed Alpine (including Western/Eastern Alps) and Worldwide recaps offer **Share results** and **Copy results** in English, German, French and Italian. Native sharing opens the device share sheet; unsupported or failed sharing falls back to copying. Cancelling the sheet does nothing. If clipboard access fails, a selectable text box remains available.

Example (the final line is a complete replay URL in the actual message):

```text
AlpTap · Alps
1000🏔️ 950🧗 760🥾
Final score: 2710 / 3000
Play these peaks 👇
https://digital-landscape.at/AlpTap/?play=…
```

Scores remain on the game's existing 0–1000 scale per round. The badges describe the score, not the peak's difficulty: 🚶 walker below 700, 🥾 hiker from 700, 🧗 climber from 900, 🏔️ summit at 1000. The message excludes summit names and guess positions.

## Replay contract

`?play=` contains a versioned, validated base64url JSON tuple. It pins the dataset version, original algorithm identifier, ordered target IDs, and (for Alpine games) region and difficulty. The original date is retained as context, but it is never used to select replacement peaks. Curated selections and previous datasets therefore replay exactly. The token does not include guesses, scores, coordinates or target names; IDs remain inspectable, as with all public game data.

The parser rejects unknown token schemas, malformed dates, duplicate IDs, unsafe dataset paths, invalid modes/regions/difficulties, oversized tokens and duplicate `play` parameters. Invalid links show an explicit error and a way to open today's game. Missing versioned data follows the existing load-error/retry path, with no silent substitution of today's selection.

Shared progress uses `alptap:replay:v1:<token>` instead of daily session keys. Reload restores the same game, including completed games after the original date. A recipient starts with no sender guesses or scores. **Play today's game** leaves the replay; the daily game remains stored separately. Changing the app's scoring curve can still change recalculated scores, as it does for existing saved daily games.

Keep old `public/data/alps-*` and `public/data/mode-*` assets in future deployments. Deleting a referenced version breaks its replay links. The current replay format covers the released Alpine and Worldwide peak games; the unreleased valley mode has no share control.

## Social preview

`public/social/alptap-preview-v1.jpg` is a tracked 1200 × 630 JPEG. The built HTML contains Open Graph image/type/dimensions/alt text and Twitter large-image-card tags. Crawlers can see these without executing JavaScript. The preview is a generic, spoiler-free mountain invitation, not a rendering of individual scores.

`SITE_URL` must be the public deployment URL **including the base path**, for example `https://digital-landscape.at/AlpTap/`. GitHub Pages supplies `steps.pages.outputs.base_url` automatically. For another host, set `SITE_URL` at build time alongside Vite's `--base`. The fallback is the documented production URL. Native and copied replay URLs use the current browser origin and Vite base path so project-path and root-domain hosting both work.

Root-only canonical and `og:url` tags are deliberately omitted: a static HTML file cannot emit the request's replay query, and substituting the homepage would discard the exact-game URL. The same preview tags are included in explorer/training HTML. Metadata follows the [Open Graph protocol](https://ogp.me/); native sharing uses the [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

After deployment, test a new replay URL in WhatsApp/Facebook and check it with Facebook's Sharing Debugger. These services must reach the public image and may cache earlier previews; this cannot be verified from localhost. For a future artwork change, use a new image filename and update `scripts/social-metadata.ts`.

## Artwork source

Created with the built-in image-generation tool, then exported as the web JPEG. Final prompt:

```text
Use case: ads-marketing
Asset type: AlpTap social link preview card for a mountain geography game, landscape 1200x630 aspect ratio.
Primary request: Create a polished, inviting editorial mountain poster. Dramatic Alpine peaks with snow ridges, forest-green valleys and a tiny warm orange map-location pin on a peak, suggesting finding mountains on a map. Premium illustrated travel poster style with subtle paper texture, refined shapes and atmospheric depth, warm sunrise, cream #f6f4e9 and deep evergreen #122f2c palette.
Composition: strong graphic hierarchy, generous safe margins, uncluttered. Large highly readable title "AlpTap" and smaller exact text "A little closer to the mountains" in the calm cream upper-left area. Below it the clear invitation "Three peaks. How close can you get?" Mountain scene fills right and lower portions. Keep all text and main peak comfortably inside central safe area for social crops. No additional text, no URL, no dates, no scores, no institutional logos, no mockup border. Output a complete finished card, approximately 1.905:1 landscape.
```

