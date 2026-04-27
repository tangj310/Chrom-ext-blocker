let enabled = false;
let styleEl = null;
let ytInterval = null;

const AD_CSS = `
  ins.adsbygoogle,
  [id^="google_ads_"],
  [id*="-ad-"],
  [class*="adsbygoogle"],
  [class*="ad-banner"],
  [class*="ad-slot"],
  [class*="ad-wrapper"],
  [class*="advertisement"],
  [data-ad-unit],
  [data-advertisement],
  [data-sponsored="true"],
  .sponsored-content,
  .banner-ad,
  iframe[src*="doubleclick.net"],
  iframe[src*="googlesyndication.com"],
  iframe[src*="googleadservices.com"],
  [id*="taboola"], [class*="taboola"],
  [id*="outbrain"], [class*="outbrain"],
  [id*="criteo"],  [class*="criteo"] {
    display: none !important;
    visibility: hidden !important;
  }

  /* YouTube ads */
  ytd-ad-slot-renderer,
  .ytd-ad-slot-renderer,
  ytd-promoted-sparkles-web-renderer,
  ytd-promoted-video-renderer,
  ytd-search-pyv-renderer,
  ytd-display-ad-renderer,
  #masthead-ad,
  #player-ads,
  .ytp-ad-overlay-container,
  .ytp-ad-text-overlay,
  .ytp-ad-progress-list,
  .ytp-ad-player-overlay-layout__close-button,
  .video-ads.ytp-ad-module {
    display: none !important;
  }
`;

chrome.storage.local.get(['categories'], ({ categories = {} }) => {
  enabled = !!categories.ads;
  if (enabled) apply();
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.categories) return;
  const next = !!changes.categories.newValue?.ads;
  if (next === enabled) return;
  enabled = next;
  enabled ? apply() : remove();
});

function apply() {
  injectCSS();
  if (location.hostname.includes('youtube.com')) startYouTubeSkip();
}

function remove() {
  if (styleEl) { styleEl.remove(); styleEl = null; }
  if (ytInterval) { clearInterval(ytInterval); ytInterval = null; }
}

function injectCSS() {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.textContent = AD_CSS;
  (document.head || document.documentElement).appendChild(styleEl);
}

function startYouTubeSkip() {
  if (ytInterval) return;
  ytInterval = setInterval(() => {
    // Click the skip button if it's available
    const skipBtn = document.querySelector(
      '.ytp-skip-ad-button, .ytp-ad-skip-button-container button, .ytp-ad-skip-button'
    );
    if (skipBtn) {
      skipBtn.click();
      return;
    }

    // If an ad is actively playing and no skip button, seek past it
    if (document.querySelector('.ad-showing')) {
      const video = document.querySelector('video');
      if (video && video.duration && !isNaN(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
      }
    }
  }, 50);
}
