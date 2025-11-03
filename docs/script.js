const adContainer = document.getElementById('ad-container');
const contentVideo = document.getElementById('content');
const logEntries = document.getElementById('log-entries');
const adTagUrls = [
  { adTagUrl: 'https://vast-tags.com/tag/15_etsy', isVpaid: false },
  { adTagUrl: 'https://vast-tags.com/tag/15_garden_of_life', isVpaid: false },
  { adTagUrl: 'https://vast-tags.com/tag/15_squarespace', isVpaid: false },
  { adTagUrl: 'https://vast-tags.com/tag/15_hulu', isVpaid: true },
  { adTagUrl: 'https://vast-tags.com/tag/15_honda', isVpaid: true },
  { adTagUrl: 'https://vast-tags.com/tag/15_vital_protein', isVpaid: true },
];

function logAd(adUrl, isVpaid) {
  const adName = adUrl.split('/').pop().replace('_', ' ').replace(/\d+/g, '').trim();
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  logEntry.innerHTML = `
    <div class="ad-name">${adName}</div>
    <div class="vpaid-badge ${isVpaid ? 'vpaid' : 'non-vpaid'}">
      ${isVpaid ? 'VPAID' : 'Non-VPAID'}
    </div>
  `;
  logEntries.appendChild(logEntry);
}

function logAdFailure(adUrl, isVpaid, errorCode, errorMessage) {
  const adName = adUrl.split('/').pop().replace('_', ' ').replace(/\d+/g, '').trim();
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry log-entry-failed';
  logEntry.innerHTML = `
    <div class="ad-name">${adName} <span class="failure-indicator">❌ FAILED</span></div>
    <div class="vpaid-badge ${isVpaid ? 'vpaid' : 'non-vpaid'}">
      ${isVpaid ? 'VPAID' : 'Non-VPAID'}
    </div>
    <div class="error-details">
      <div class="error-code">Status Code: ${errorCode || 'Unknown'}</div>
      <div class="error-message">Reason: ${errorMessage || 'No error message available'}</div>
    </div>
  `;
  logEntries.appendChild(logEntry);
}

let currentAdIndex = 0;
let adsManager = null;
let vpaidFilter = 'both'; // 'both', 'vpaid', or 'nonvpaid'
let isPaused = false;
let isMuted = true; // Start muted

const adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, contentVideo);
const adsLoader = new google.ima.AdsLoader(adDisplayContainer);

function matchesFilter(ad) {
  if (vpaidFilter === 'both') return true;
  if (vpaidFilter === 'vpaid') return ad.isVpaid;
  if (vpaidFilter === 'nonvpaid') return !ad.isVpaid;
  return true;
}

function findNextMatchingAd(startIndex) {
  if (adTagUrls.length === 0) return -1;

  let checked = 0;
  let index = startIndex;

  // Check up to all ads to avoid infinite loops
  while (checked < adTagUrls.length) {
    if (matchesFilter(adTagUrls[index])) {
      return index;
    }
    index = (index + 1) % adTagUrls.length;
    checked++;
  }

  // No matching ads found
  return -1;
}

function playNextAd() {
  if (adTagUrls.length === 0) return;

  // Find next ad that matches the filter
  const nextMatchingIndex = findNextMatchingAd(currentAdIndex);
  if (nextMatchingIndex === -1) {
    console.log('No ads match the current filter');
    return;
  }

  currentAdIndex = nextMatchingIndex;
  const currentAd = adTagUrls[currentAdIndex];
  logAd(currentAd.adTagUrl, currentAd.isVpaid);

  const req = new google.ima.AdsRequest();
  req.adTagUrl = currentAd.adTagUrl;
  req.linearAdSlotWidth = adContainer.clientWidth;
  req.linearAdSlotHeight = adContainer.clientHeight;
  adsLoader.requestAds(req);
}

function checkAndSkipCurrentAdIfNeeded() {
  if (!adsManager) return;

  const currentAd = adTagUrls[currentAdIndex];
  if (!matchesFilter(currentAd)) {
    // Current ad doesn't match filter, skip it
    skipToNextAd();
  }
}

function skipToNextAd() {
  if (adsManager) {
    try {
      adsManager.destroy();
    } catch (e) {
      console.error('Error destroying ads manager:', e);
    }
    adsManager = null;
  }
  // Move to next ad index first, then find next matching one
  currentAdIndex = (currentAdIndex + 1) % adTagUrls.length;
  playNextAd();
}

const skipButton = document.getElementById('skip-button');
skipButton.addEventListener('click', skipToNextAd);

const playPauseButton = document.getElementById('play-pause-button');
playPauseButton.addEventListener('click', () => {
  if (!adsManager) return;

  try {
    if (isPaused) {
      adsManager.resume();
      playPauseButton.textContent = '⏸';
      isPaused = false;
    } else {
      adsManager.pause();
      playPauseButton.textContent = '▶';
      isPaused = true;
    }
  } catch (e) {
    console.error('Error toggling play/pause:', e);
  }
});

const muteButton = document.getElementById('mute-button');
muteButton.addEventListener('click', () => {
  if (!adsManager) return;

  try {
    if (isMuted) {
      adsManager.setVolume(1);
      muteButton.textContent = '🔊';
      isMuted = false;
    } else {
      adsManager.setVolume(0);
      muteButton.textContent = '🔇';
      isMuted = true;
    }
  } catch (e) {
    console.error('Error toggling mute:', e);
  }
});

const vpaidFilterSelect = document.getElementById('vpaid-filter');
vpaidFilterSelect.addEventListener('change', (e) => {
  vpaidFilter = e.target.value;
  // If filter changes during playback, check if current ad matches
  checkAndSkipCurrentAdIfNeeded();
});

adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e) => {
  adsManager = e.getAdsManager(contentVideo);
  adsManager.init(adContainer.clientWidth, adContainer.clientHeight, google.ima.ViewMode.NORMAL);
  adsManager.setVolume(isMuted ? 0 : 1); // respect mute state

  // Reset play/pause state when new ad loads
  isPaused = false;
  playPauseButton.textContent = '⏸';

  adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, () => {
    currentAdIndex = (currentAdIndex + 1) % adTagUrls.length;
    playNextAd();
  });

  adsManager.addEventListener(google.ima.AdEvent.Type.ERROR, (e) => {
    const currentAd = adTagUrls[currentAdIndex];
    let errorCode = 'Unknown';
    let errorMessage = 'No error message available';
    
    // Try multiple ways to get error information from the event
    if (e.getError) {
      const error = e.getError();
      if (error) {
        errorCode = error.getErrorCode ? error.getErrorCode() : errorCode;
        errorMessage = error.getMessage ? error.getMessage() : errorMessage;
      }
    } else if (e.error) {
      const error = e.error;
      errorCode = error.getErrorCode ? error.getErrorCode() : (error.code || error.codeNumber || errorCode);
      errorMessage = error.getMessage ? error.getMessage() : (error.message || errorMessage);
    } else if (e.type === google.ima.AdEvent.Type.ERROR) {
      // Check if error info is directly on the event
      if (e.errorCode !== undefined) errorCode = e.errorCode;
      if (e.errorMessage !== undefined) errorMessage = e.errorMessage;
    }
    
    logAdFailure(currentAd.adTagUrl, currentAd.isVpaid, errorCode, errorMessage);
    currentAdIndex = (currentAdIndex + 1) % adTagUrls.length;
    playNextAd();
  });

  adsManager.start();
});

adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, (e) => {
  const error = e.getError();
  const currentAd = adTagUrls[currentAdIndex];
  const errorCode = error.getErrorCode ? error.getErrorCode() : 'Unknown';
  const errorMessage = error.getMessage ? error.getMessage() : 'No error message available';
  
  logAdFailure(currentAd.adTagUrl, currentAd.isVpaid, errorCode, errorMessage);
  console.error(error);
  currentAdIndex = (currentAdIndex + 1) % adTagUrls.length;
  playNextAd();
});

// Initialize and request first ad
adDisplayContainer.initialize();
playNextAd();
