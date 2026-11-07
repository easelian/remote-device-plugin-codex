# Remote Device Hub product artwork

The editable SVG masters are maintained in the sibling brand repository under [`products/remote-device-hub/icons/`](../../../../brand/products/remote-device-hub/icons/). EaseLian company logos live separately under `brand/company/easelian/` and identify the publisher.

The default product icon is `remote-device-hub.svg`: the Access mark combines a rounded device outline, an opening at the upper right, and a diagonal connection reaching a central hub. It uses solid blue (`#0A84FF`) on a transparent background, without a background tile or shadow. The same icon is used on light and dark surfaces. The plugin manifests use one icon for both appearances and do not require separate dark-icon fields.

| Copy | Purpose |
| --- | --- |
| `plugins/remote-device-hub/assets/icon.svg` | Universal icon in standalone and connected packages |
| `public/remote-device-hub/assets/icon.png` | Universal 256 × 256 PNG for public submission |
| `tests/fixtures/icons/*.svg` | Universal, light, and dark product SVGs used in archive checks |

Run from the brand repository to update the plugin copies:

```sh
python3 tools/export_product.py --sync-workspace ..
python3 tools/export_product.py --check-workspace ..
```

Each packaged icon must be below 10,000 bytes. Public-submission logos must be square PNGs of at least 256 × 256 pixels, and composer icons at least 48 × 48. SVG masters use a 256 × 256 viewBox and contain editable paths rather than embedded bitmaps. Test fixtures and packaged assets are copies; edit the brand masters, synchronize, update affected fixed archive hashes, and run `npm test`. Plugin packaging works without the brand checkout.
