# iPhone UI and study-flow checks

Run `npm test` with Node.js 18+ for the dependency-free regression suite. It exercises the application scripts with small browser mocks and the service worker with a simulated cache. It does not replace rendering tests.

Serve the repository as a static site, for example `python3 -m http.server 8000`, then visit `/index.html`. Also test under a subdirectory such as `/drug-flashcards/`, matching GitHub Pages.

## Device checks before merging

- On a small iPhone and a larger iPhone, check portrait and landscape in Safari and after Add to Home Screen. All five bottom tabs should remain reachable with no horizontal page overflow or overlap with the home indicator.
- In Flashcard, show a long answer, scroll its content and the study page, then reach Previous, Next, and all four review ratings. In Search, tap a drug name to expand its details.
- Open Settings, focus the last input, and scroll to Save while the keyboard is visible. Check that text inputs do not trigger unwanted zoom and that manual pinch zoom is still possible.
- In Clinical Bank, open a topic, answer, move forward and back. The original selection and rationale should remain visible, with no extra score. A fresh session starts at 0%; generated previews do not alter a library-session score. Check topic search, Settings, and the generator entrance.
- Load all three pages online and allow the service worker to activate. Load a clinical question sheet successfully once, then go offline and reopen Home, Ward, and Clinical. Each URL should show its own page; the saved clinical question bank should remain usable. Uncached AI generation, remote images and new CSV downloads require connectivity.

## Validation limitations in this change

The automated regression suite passed. The available remote browser could not reach the local preview, so Safari rendering, virtual keyboard behavior and installation on a physical iPhone remain unchecked. The existing Vite production build was not run in this environment.

## Credential follow-up

The embedded provider key was removed from the current source. The repository owner should revoke/rotate that previously exposed key with its provider; deleting the default does not revoke it or remove it from Git history. Enter a replacement only in the app's Settings, never in source code or a PR comment. Existing keys saved on a device are not changed by this patch.
