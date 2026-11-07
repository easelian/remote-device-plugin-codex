# Remote Device Hub product artwork

The editable SVG master is maintained in the sibling brand repository at [`products/remote-device-hub/icons/remote-device-hub.svg`](../../../../brand/products/remote-device-hub/icons/remote-device-hub.svg). EaseLian company logos live separately under `brand/company/easelian/` and identify the publisher.

The product icon is the Access mark: a rounded device outline with an opening at the upper right and a diagonal connection reaching a central hub. It uses solid blue (`#0A84FF`) on a transparent background, without a background tile or shadow. The same icon is used on light and dark surfaces.

The canonical plugin copy is `plugins/remote-device-hub/assets/icon.png`, a 256 × 256 export of that SVG. Local development and public ZIPs use the same file; there is no separately maintained public icon.

Run from the brand repository to synchronize or check workspace copies:

```sh
python3 tools/export_product.py --sync-workspace ..
python3 tools/export_product.py --check-workspace ..
```

The synchronization command updates the named consumers in the workspace, including other plugins and the Server if present. Use the check command for read-only verification. After changing this plugin's copy, regenerate its development output and ZIPs and run `npm test`.

The under-10,000-byte limit is a project constraint. OpenAI also supports other image formats; this project uses PNG consistently. Ordinary plugin builds use the bundled image and do not require Inkscape or a sibling brand checkout.
