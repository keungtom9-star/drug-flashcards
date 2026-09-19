/* Shared browser helpers. No credentials or study data leave this device. */
(function () {
    function readStoredJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            if (value === null || typeof value !== typeof fallback) return fallback;
            if (Array.isArray(value) !== Array.isArray(fallback)) return fallback;
            return value;
        } catch (_) {
            // A damaged record must not prevent the rest of the app from starting.
            return fallback;
        }
    }

    function updateViewport() {
        const viewport = window.visualViewport;
        // Keep native pinch zoom working; only resize for browser chrome/keyboard changes.
        if (viewport && viewport.scale !== 1) return;
        const height = viewport ? viewport.height : window.innerHeight;
        const top = viewport ? viewport.offsetTop : 0;
        document.documentElement.style.setProperty('--app-height', `${height}px`);
        document.documentElement.style.setProperty('--viewport-top', `${top}px`);
    }

    window.DrugTutorUI = { readStoredJSON };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
})();
