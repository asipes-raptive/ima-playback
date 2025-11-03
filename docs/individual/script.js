const adContainer = document.getElementById('ad-container');
const contentVideo = document.getElementById('content');
const logEntries = document.getElementById('log-entries');
const adTagUrls = [
  { adTagUrl: 'https://vast-tags.com/tag/15_honda', isVpaid: true },
  { adTagUrl: 'https://vast-tags.com/tag/15_west_elm', isVpaid: true },
  { adTagUrl: 'https://vast-tags.com/tag/15_hulu', isVpaid: true },
  { adTagUrl: 'https://vast-tags.com/tag/15_etsy', isVpaid: false },
  { adTagUrl: 'https://vast-tags.com/tag/15_garden_of_life', isVpaid: false },
  { adTagUrl: 'https://vast-tags.com/tag/15_squarespace', isVpaid: false },
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

let adsManager = null;
let isPaused = false;
let isMuted = true; // Start muted
let startTimeout = null;
let completionTimeout = null;
let progressMonitorInterval = null;
let lastProgressTime = null;
let adStarted = false;
let adCompleted = false;
let selectedAdIndex = null;

const adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, contentVideo);
const adsLoader = new google.ima.AdsLoader(adDisplayContainer);

function clearAllTimeouts() {
  if (startTimeout) {
    clearTimeout(startTimeout);
    startTimeout = null;
  }
  if (completionTimeout) {
    clearTimeout(completionTimeout);
    completionTimeout = null;
  }
  if (progressMonitorInterval) {
    clearInterval(progressMonitorInterval);
    progressMonitorInterval = null;
  }
  lastProgressTime = null;
  adStarted = false;
  adCompleted = false;
}

function handleAdTimeout(reason) {
  if (adCompleted) return; // Already handled

  console.warn(`Ad timeout: ${reason}`);
  const currentAd = adTagUrls[selectedAdIndex];
  logAdFailure(currentAd.adTagUrl, currentAd.isVpaid, 'TIMEOUT', `Ad ${reason}`);

  clearAllTimeouts();
  cleanup();
}

function cleanup() {
  if (adsManager) {
    try {
      adsManager.destroy();
    } catch (e) {
      console.error('Error destroying ads manager:', e);
    }
    adsManager = null;
  }
  clearAllTimeouts();
}

function playSelectedAd() {
  if (selectedAdIndex === null || selectedAdIndex < 0 || selectedAdIndex >= adTagUrls.length) {
    console.log('No ad selected');
    return;
  }

  // Cleanup any existing ad
  cleanup();

  const currentAd = adTagUrls[selectedAdIndex];
  logAd(currentAd.adTagUrl, currentAd.isVpaid);

  // Set a timeout for ads that never load (longer for VPAID)
  const loadTimeout = currentAd.isVpaid ? 15000 : 10000; // 15s for VPAID, 10s for non-VPAID
  startTimeout = setTimeout(() => {
    handleAdTimeout('failed to load');
  }, loadTimeout);

  const req = new google.ima.AdsRequest();
  req.adTagUrl = currentAd.adTagUrl;
  req.linearAdSlotWidth = adContainer.clientWidth;
  req.linearAdSlotHeight = adContainer.clientHeight;
  adsLoader.requestAds(req);
}

const playButton = document.getElementById('play-button');
playButton.addEventListener('click', () => {
  const adSelector = document.getElementById('ad-selector');
  const selectedValue = adSelector.value;
  if (selectedValue === '') {
    alert('Please select an ad to play');
    return;
  }
  selectedAdIndex = parseInt(selectedValue, 10);
  playSelectedAd();
});

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

adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e) => {
  // Clear the load timeout since ad loaded
  if (startTimeout) {
    clearTimeout(startTimeout);
    startTimeout = null;
  }

  adsManager = e.getAdsManager(contentVideo);
  adsManager.init(adContainer.clientWidth, adContainer.clientHeight, google.ima.ViewMode.NORMAL);
  adsManager.setVolume(isMuted ? 0 : 1); // respect mute state

  // Reset play/pause state when new ad loads
  isPaused = false;
  playPauseButton.textContent = '⏸';

  const currentAd = adTagUrls[selectedAdIndex];

  // Set timeout for ads that never start (longer for VPAID)
  const startTimeoutDuration = currentAd.isVpaid ? 10000 : 8000; // 10s for VPAID, 8s for non-VPAID
  startTimeout = setTimeout(() => {
    if (!adStarted) {
      handleAdTimeout('failed to start');
    }
  }, startTimeoutDuration);

  // Set timeout for ads that never complete (with reasonable max duration)
  const maxAdDuration = 60000; // 60 seconds max
  completionTimeout = setTimeout(() => {
    if (!adCompleted) {
      handleAdTimeout('exceeded maximum duration');
    }
  }, maxAdDuration);

  // Track progress to detect stuck ads
  lastProgressTime = Date.now();
  progressMonitorInterval = setInterval(() => {
    const now = Date.now();
    // If ad started but hasn't made progress in 15 seconds, consider it stuck
    if (adStarted && !adCompleted && now - lastProgressTime > 15000) {
      handleAdTimeout('appears to be stuck');
    }
  }, 5000); // Check every 5 seconds

  // Listen for LOADED event
  adsManager.addEventListener(google.ima.AdEvent.Type.LOADED, () => {
    console.log('Ad loaded');
  });

  // Listen for STARTED event - critical for VPAID ads
  adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => {
    console.log('Ad started');
    adStarted = true;
    if (startTimeout) {
      clearTimeout(startTimeout);
      startTimeout = null;
    }
    lastProgressTime = Date.now();
  });

  // Listen for PROGRESS events to track that ad is making progress
  adsManager.addEventListener(google.ima.AdEvent.Type.PROGRESS, () => {
    lastProgressTime = Date.now();
  });

  // Listen for FIRST_QUARTILE, MIDPOINT, THIRD_QUARTILE as progress indicators
  adsManager.addEventListener(google.ima.AdEvent.Type.FIRST_QUARTILE, () => {
    lastProgressTime = Date.now();
  });
  adsManager.addEventListener(google.ima.AdEvent.Type.MIDPOINT, () => {
    lastProgressTime = Date.now();
  });
  adsManager.addEventListener(google.ima.AdEvent.Type.THIRD_QUARTILE, () => {
    lastProgressTime = Date.now();
  });

  // Listen for COMPLETE event
  adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, () => {
    if (adCompleted) return; // Already handled

    console.log('Ad completed');
    adCompleted = true;
    clearAllTimeouts();
    cleanup();
  });

  // Listen for SKIPPED event (some ads can be skipped)
  adsManager.addEventListener(google.ima.AdEvent.Type.SKIPPED, () => {
    console.log('Ad skipped');
    adCompleted = true;
    clearAllTimeouts();
    cleanup();
  });

  // Listen for ERROR event
  adsManager.addEventListener(google.ima.AdEvent.Type.ERROR, (e) => {
    if (adCompleted) return; // Already handled

    const currentAd = adTagUrls[selectedAdIndex];
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
      errorCode = error.getErrorCode ? error.getErrorCode() : error.code || error.codeNumber || errorCode;
      errorMessage = error.getMessage ? error.getMessage() : error.message || errorMessage;
    } else if (e.type === google.ima.AdEvent.Type.ERROR) {
      // Check if error info is directly on the event
      if (e.errorCode !== undefined) errorCode = e.errorCode;
      if (e.errorMessage !== undefined) errorMessage = e.errorMessage;
    }

    logAdFailure(currentAd.adTagUrl, currentAd.isVpaid, errorCode, errorMessage);
    adCompleted = true;
    clearAllTimeouts();
    cleanup();
  });

  // Start the ad
  try {
    adsManager.start();
  } catch (error) {
    console.error('Error starting ad:', error);
    handleAdTimeout('failed to start (exception)');
  }
});

adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, (e) => {
  if (adCompleted) return; // Already handled

  const error = e.getError();
  const currentAd = adTagUrls[selectedAdIndex];
  const errorCode = error.getErrorCode ? error.getErrorCode() : 'Unknown';
  const errorMessage = error.getMessage ? error.getMessage() : 'No error message available';

  logAdFailure(currentAd.adTagUrl, currentAd.isVpaid, errorCode, errorMessage);
  console.error(error);
  adCompleted = true;
  clearAllTimeouts();
  cleanup();
});

// Initialize
adDisplayContainer.initialize();

