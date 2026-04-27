let enabled = false;
let styleEl = null;
let ytInterval = null;
let ytObserver = null;
let preAdPlaybackRate = 1;

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
  if (ytObserver) { ytObserver.disconnect(); ytObserver = null; }
}

function injectCSS() {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.textContent = AD_CSS;
  (document.head || document.documentElement).appendChild(styleEl);
}

function startYouTubeSkip() {
  if (ytInterval) return;

  // MutationObserver fires the moment YouTube adds/removes the ad-showing class,
  // giving near-instant reaction without waiting for the next poll cycle.
  ytObserver = new MutationObserver(handleYouTubeAd);
  ytObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  // Polling as a safety net (catches cases the observer misses).
  ytInterval = setInterval(handleYouTubeAd, 50);
}

function handleYouTubeAd() {
  // Priority 1: click skip button the instant it appears.
  const skipBtn = document.querySelector(
    '.ytp-skip-ad-button, .ytp-ad-skip-button-container button, .ytp-ad-skip-button'
  );
  if (skipBtn) {
    skipBtn.click();
    return;
  }

  const video = document.querySelector('video');
  const adPlaying = !!document.querySelector('.ad-showing');

  if (adPlaying && video) {
    // Save the user's normal playback rate the first time we detect an ad.
    if (video.playbackRate !== 16) {
      preAdPlaybackRate = video.playbackRate || 1;
    }
    // Fast-forward through the ad at 16x — works even when seeking is blocked.
    video.playbackRate = 16;
    // Also try seeking to the end; if YouTube allows it the ad ends immediately.
    if (video.duration && !isNaN(video.duration) && video.duration > 0) {
      video.currentTime = video.duration;
    }
  } else if (!adPlaying && video && video.playbackRate === 16) {
    // Ad finished — restore the user's original playback speed.
    video.playbackRate = preAdPlaybackRate;
  }
}
