# Remote Device Hub: light and dark appearances

Prepared 2026-09-29 for plugin archive 1.0.4. Public publication remains paused.

## Asset selection

- logo: remote-device-hub-theme-light-512.png. Graphite monitor/arrow and darker slate lock on transparent alpha for white/light-gray surfaces.
- logoDark: remote-device-hub-theme-dark-512.png. Reuses the inspected steel icon with light symbols on an opaque graphite backing, for dark surfaces.
- composerIcon: existing remote-device-hub-steel-256.png, a self-contained badge with stable internal contrast on light or dark pages. No unsupported composerIconDark field was invented.
- brandColor: #52677D; brandColorDark: #A5B5C5.

The local plugin-creator specification explicitly documents logoDark. The official
[submission reference](https://developers.openai.com/plugins/deploy/submission-errors)
documents separate brand colors, with minimum 2:1 contrast against white and #212121 respectively.
Current public packaging documentation lists composerIcon as a single path; no separate dark composer path was established.
This confirms the prepared configuration, not every client's rendered behavior.

The local preview follows the page's explicit theme when selected. Its System option
uses prefers-color-scheme. A page that overrides the OS appearance must use its own
theme for the logo choice; the image itself does not detect the operating system.

## Visual checks

Actual PNG assets are shown in theme-preview.html, with 16/20/24/32/48 px checks
and the identical composer icon on #FFFFFF, #F3F4F6, #212121 and #000000 backgrounds.
The in-app browser preview was inspected. Dark and light button selection showed the
corresponding visible asset; keyboard activation was used for the light button after
the browser click did not change its state. theme-preview-screenshot.png records the result.
No claim is made that ChatGPT's installed plugin has been updated or tested with 1.0.4.

## Generation and provenance

Light artwork: built-in ImageGen edit of the steel icon, followed only by sips size exports.
Dark artwork: exact reuse of the existing opaque steel icon and mechanical size exports.
Two generated transparent dark candidates had visible alpha-edge speckles and were
excluded from the package. No cleanup via image-processing scripts was performed.

### Light prompt

Use case: precise-object-edit. Image 1 is the exact existing Remote Device Hub icon to edit for LIGHT THEME. Preserve the geometry, positions, relative sizes and stroke widths of the desktop monitor, closed padlock and incoming diagonal arrow. Create a clean transparent-background production logo for white and pale-gray UI surfaces. Remove the entire dark square background, including all dark pixels inside the monitor, around the shapes, and inside the padlock shackle: these negative spaces must be actual transparent alpha, not white paint. Change monitor and arrow from silver to solid dark graphite #243240. Change the closed padlock to solid muted slate steel #52677D, sufficiently dark against white. Preserve thick filled silhouettes and the same silhouette proportions; do not add or remove elements. Flat two-color shapes, no gradients, no lighting, no texture, no shadows, no glow, no borders, no backing tile. Closed padlock has a large intact thick shackle and solid body without a keyhole. Square canvas, icon occupies same 84% extent with existing negative space. Precise antialiased edges, no white matte fringe. One icon only, no labels or presentation sheet.

### Rejected transparent dark prompt

Use case: precise-object-edit. Image 1 is the transparent LIGHT-THEME Remote Device Hub logo. Produce its exact DARK-THEME color counterpart. This is ONLY A RECOLOR: preserve every silhouette, coordinate, proportion, corner, spacing, stroke width and existing alpha transparency. Recolor the dark graphite monitor and incoming arrow to cool silver-white #E6ECF2, and recolor the darker slate closed padlock to muted light steel blue-gray #A5B5C5. The exterior, monitor interior and hole inside the lock shackle remain fully transparent. Keep same square canvas and framing. Flat solid colors, crisp antialiased edges without dark matte fringes. No backdrop, no tile, no white background, no glow, no shadow, no gradient, no texture, no new elements, no text. Both variants should read as the same identical secure remote device logo when switching a UI between white and #212121 dark backgrounds.

### Rejected cleanup attempt

Use case: precise-object-edit. Clean the supplied transparent silver Remote Device Hub logo. Keep ONLY the large monitor silhouette, the large incoming arrow, and the closed padlock. Preserve their current geometry, colors and placement. Remove ALL disconnected white flecks, dust, speckles, ragged halo fragments and stray pixels visible outside or inside the symbol. The negative space must be perfectly empty TRANSPARENT alpha, including the screen interior, around the stand and inside the lock shackle. Tight smooth antialiased edges, no edge halos. Rebuild each existing silhouette as a clean continuous flat fill if needed. Monitor and arrow #E6ECF2, lock #A5B5C5, no gradients or texture. No backdrop and no checkerboard painted in the image. One pristine production logo on actual transparent background. Do not change canvas dimensions, proportions or overall layout.
