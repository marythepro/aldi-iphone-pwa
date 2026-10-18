# ALDI Shopping List

Live app: https://marythepro.github.io/aldi-iphone-pwa/

A static, installable shopping list for Windows computers and phones. It starts with the same 101 original products (157 total quantity, including the original checkmarks). Existing saved lists take priority over that starter list.

## Windows: Chrome or Edge

1. Connect to the internet and open the live app in Chrome or Edge.
2. Use it in the browser, or choose **Install / help** for installation instructions. A native **Install ALDI List** button appears when the browser offers installation.
3. Chrome: use the address-bar install icon, or **⋮ → Cast, save, and share → Install page as app**.
4. Edge: use the address-bar install icon, or **… → More tools → Apps → Install this site as an app**. Some Edge versions show **Apps** directly in the menu.

Installation is optional. The desktop layout places search, filters and the Add item form beside the list. Resizing the window or zooming switches to the compact layout when needed.

## iPhone

Open the live app in Safari, then use Safari’s **Share → Add to Home Screen → Add**. The compact layout retains touch controls and bottom navigation. Open **Add item** to enter a name and quantity.

## Shopping and keyboard controls

- Search; filter by All, To shop or Checked.
- Check off items and change quantities from 1 to 9999.
- Add your own items; Remove items and use persistent Undo to restore them, even after a reload. Repeated Undo restores earlier removals.
- Copy or Share the unchecked list. Open a product link or an ALDI search. Print the unchecked list using the browser.
- Use Tab/Shift+Tab to move, Space to check a box, and Enter to activate buttons. A skip link jumps to the list. Previous and Next item move focus through the visible items.

## Saved data and offline use

The list is saved in this browser on this device. Phone and computer edits do **not** sync. Chrome and Edge also keep separate lists; return using the same browser and profile. Clearing website data removes that browser’s saved list.

After a successful first online load and offline-cache setup, the list works offline. Product links need the internet. An offline computer must reconnect before it can load this update for the first time.

The desktop update preserves the `aldi-pwa-items-v1` storage key and array format, IDs, quantities, checkmarks, custom products and removal history. It does not replace saved data with the starter list. The v4 service worker precaches the complete updated shell before activation, uses a scope-specific cache, and retains the small v3 cache for older open clients. It never clears localStorage or unrelated caches.

## Development and deployment

No build step or paid service is required. Serve this folder over localhost for testing (for example, `python3 -m http.server 8000`); service workers require localhost or HTTPS. GitHub Pages serves the public repository’s existing site. Keep the manifest start URL, scope and icons stable to preserve the installed app’s identity.

Install guidance references: [Chrome Help](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DDesktop) and [Microsoft Edge Support](https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge).
