# iPhone UI and search-flow checks

Run `npm test` with Node.js 18+ for the dependency-free regression suite. It exercises the application scripts with small browser mocks and the service worker with a simulated cache. It does not replace rendering tests.

Serve the repository as a static site, for example `python3 -m http.server 8000`, then visit `/index.html`. Also test under a subdirectory such as `/drug-flashcards/`, matching GitHub Pages.

## Device checks before merging

- On a small iPhone and a larger iPhone, check portrait and landscape in Safari and after Add to Home Screen. All four navigation tabs should remain reachable with no horizontal page overflow or overlap with the home indicator.
- In Search, focus the empty input with the keyboard visible. The API reminder, history, system browser and bottom tabs should move out of the way. Type a generic name, brand, drug class or condition and confirm results stay visible; the top Back button should clear the search and restore the normal screen. Also check multi-word and mixed-case queries, browse by system, expand a drug result, and load more than 30 matches.
- Submit several searches, return to the empty search screen, and confirm recent searches are de-duplicated, tappable and persist after a reload.
- Expand and collapse results, switch all four tabs, and open/close each modal. Confirm the spring transitions are smooth, controls stay readable, and Reduce Motion disables decorative movement.
- Open Google and Drugs.com from a drug result. Each should load the intended external result instead of showing an empty in-app browser sheet, and returning to the app should preserve the search.
- With the active provider's API key empty, confirm local search still works and the Add API key action opens Settings at the correct field. Save and clear a key, confirming the reminder updates immediately.
- Search for a drug missing locally but present in the latest Google Sheet; it should appear in an editable review form without calling AI or adding anything. Edit a field, tap Add to this device, and confirm the edited version becomes searchable.
- Search for a drug absent from both local data and Google Sheet. AI should return an editable review form without automatically adding or writing anything. Edit the name, indication and side effects, then choose Add to this device or Add to Google Sheet + device; confirm only that explicit action saves the edited values.
- Confirm Side Effects contains useful adverse effects and never shows `Not specified`, `Not listed`, `Unknown` or `N/A`; blank / placeholder side effects must block Add. Tap 廣東話解釋 and confirm the final answer uses short, readable Traditional Chinese Cantonese sections; English is limited to necessary drug names and medical terms.
- Open Settings, focus the last input, and scroll to Save while the keyboard is visible. Check that text inputs do not trigger unwanted zoom and that manual pinch zoom is still possible.
- In Clinical Bank, open a topic, answer, move forward and back. The original selection and rationale should remain visible, with no extra score. A fresh session starts at 0%; generated previews do not alter a library-session score. Check topic search, Settings, and the generator entrance.
- In Ward, open Imaging and search `KUB`, `CT brain`, `droppler`, `EF` and `contrast`. Check the category chips, clear button, single-result auto-expand, card transitions and all official reference links. Confirm the warning remains visible and card content does not overflow on the narrowest supported iPhone.
- Load all three pages online and allow the service worker to activate. Load a clinical question sheet successfully once, then go offline and reopen Home, Ward, and Clinical. Each URL should show its own page; the saved clinical question bank should remain usable. Uncached AI generation, remote images and new CSV downloads require connectivity.

## Validation limitations in this change

The automated regression suite passed. The available remote browser could not reach the local preview, so Safari rendering, virtual keyboard behavior and installation on a physical iPhone remain unchecked. The existing Vite production build was not run in this environment.

## Credential follow-up

The embedded provider key was removed from the current source. The repository owner should revoke/rotate that previously exposed key with its provider; deleting the default does not revoke it or remove it from Git history. Enter a replacement only in the app's Settings, never in source code or a PR comment. Existing keys saved on a device are not changed by this patch.
