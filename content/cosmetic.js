let enabled = false;
let styleEl = null;
let ytInterval = null;
let ytObserver = null;
let preAdPlaybackRate = 1;
let preAdMuted = false;
let debounceTimer = null;

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
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
}

function injectCSS() {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.textContent = AD_CSS;
  (document.head || document.documentElement).appendChild(styleEl);
}

function startYouTubeSkip() {
  if (ytInterval) return;

  // Debounced observer so bursts of DOM changes don't trigger dozens of
  // simultaneous handleYouTubeAd calls, which could conflict with each other.
  ytObserver = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleYouTubeAd, 30);
  });
  ytObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  // Polling backup.
  ytInterval = setInterval(handleYouTubeAd, 50);
}

function handleYouTubeAd() {
  // Priority 1: click the skip button the instant it appears.
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
    // First frame of ad: save the user's normal state.
    if (video.playbackRate !== 16) {
      preAdPlaybackRate = video.playbackRate || 1;
      preAdMuted = video.muted;
      video.muted = true; // silence the fast-forwarded ad audio
    }
    // Fast-forward at 16x — plays buffered content without causing black screens.
    // Deliberately NOT seeking to video.duration: seeking an unbuffered position
    // is what causes the black screen / stuck state.
    video.playbackRate = 16;

    // If the video got stuck/paused during the ad, resume it.
    if (video.paused) video.play().catch(() => {});

  } else if (!adPlaying && video && video.playbackRate === 16) {
    // Ad ended — restore the user's original playback state.
    video.playbackRate = preAdPlaybackRate;
    video.muted = preAdMuted;
  }
}
