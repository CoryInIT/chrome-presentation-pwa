document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const presentationContainer = document.getElementById('presentation-container');
    const csvFilePath = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkKbtwiNOFHMbqsNqOiDJK379_JN9NQC5ESSR6YCRA4szW159p5JT_SJp2DFaMNVei9GIanhlo2nSi/pub?gid=0&single=true&output=csv'; // Path to your CSV file
    const pollInterval = 15 * 60 * 1000; // 15 minutes in milliseconds

    let currentDeviceUrl = null;
    let presentationIframe = null;
    let pollTimeoutId = null;
    let deviceId = null; // Will store the GUID
/* 
    // --- Function to generate or retrieve a 10-digit numeric ID with "GIPS" prefix ---
    function getOrCreateGUID() {
        let storedDeviceId = localStorage.getItem('deviceId');
        const prefix = "GIPS";

        if (!storedDeviceId) {
            // Generate a random 10-digit numeric string
            const digits = '0123456789';
            let numericPart = '';
            for (let i = 0; i < 10; i++) {
                numericPart += digits.charAt(Math.floor(Math.random() * digits.length));
            }
            storedDeviceId = prefix + numericPart;
            localStorage.setItem('deviceId', storedDeviceId);
            console.log('New deviceId (GIPS + Numeric ID) generated and stored:', storedDeviceId);
        } else {
            console.log('Existing deviceId (GIPS + Numeric ID) retrieved from localStorage:', storedDeviceId);
        }
        return storedDeviceId;
    }

    async function getDeviceIdWithFallback() {
        return new Promise((resolve) => {
            // Check if the Chrome enterprise API is available
            if (chrome?.enterprise?.deviceAttributes?.getDeviceSerialNumber) {
                chrome.enterprise.deviceAttributes.getDeviceSerialNumber((serialNumber) => {
                    if (chrome.runtime.lastError || !serialNumber) {
                        console.warn("Could not retrieve serial number:", chrome.runtime.lastError);
                        resolve(getOrCreateGUID()); // Fall back
                    } else {
                        const deviceId = serialNumber;
                        localStorage.setItem('deviceId', deviceId);
                        console.log("Using ChromeOS serial number:", deviceId);
                        resolve(deviceId);
                    }
                });
            } else {
                console.warn("chrome.enterprise.deviceAttributes API not available.");
                resolve(getOrCreateGUID()); // Fall back
            }
        });
    }
*/
    async function resolveDeviceId() {
        let cachedDeviceId = localStorage.getItem('deviceId');
        const prefix = "GIPS";

        // Try to replace a generated ID with the actual serial number
        if (!cachedDeviceId || cachedDeviceId.startsWith(prefix)) {
            return new Promise((resolve) => {
                if (chrome?.enterprise?.deviceAttributes?.getDeviceSerialNumber) {
                    chrome.enterprise.deviceAttributes.getDeviceSerialNumber((serialNumber) => {
                        if (chrome.runtime.lastError || !serialNumber) {
                            console.warn("Could not retrieve serial number:", chrome.runtime.lastError || "No serial number returned.");

                            // Use existing cached ID if available
                            if (cachedDeviceId) {
                                console.log("Using existing cached deviceId:", cachedDeviceId);
                                resolve(cachedDeviceId);
                            } else {
                                // Generate new one
                                const newId = generateNewGuid(prefix);
                                localStorage.setItem('deviceId', newId);
                                console.log("Generated and cached new deviceId:", newId);
                                resolve(newId);
                            }
                        } else {
                            const serialDeviceId = serialNumber;
                            localStorage.setItem('deviceId', serialDeviceId);
                            console.log("Using and caching serial-based deviceId:", serialDeviceId);
                            resolve(serialDeviceId);
                        }
                    });
                } else {
                    console.warn("Chrome enterprise deviceAttributes API is not available.");
                    if (cachedDeviceId) {
                        console.log("Using existing cached deviceId:", cachedDeviceId);
                        resolve(cachedDeviceId);
                    } else {
                        const newId = generateNewGuid(prefix);
                        localStorage.setItem('deviceId', newId);
                        console.log("Generated and cached new deviceId:", newId);
                        resolve(newId);
                    }
                }
            });
        } else {
            console.log("Using persistent non-GIPS deviceId:", cachedDeviceId);
            return cachedDeviceId;
        }
    }

    // Helper function to generate a new 10-digit numeric GUID
    function generateNewGuid(prefix = "GIPS") {
        const digits = '0123456789';
        let numericPart = '';
        for (let i = 0; i < 10; i++) {
            numericPart += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        return prefix + numericPart;
    }


    // --- 1. Device Identification (using GUID) ---
    loadingScreen.innerHTML = `<p>Identifying device...</p><div class="spinner"></div>`;
    //deviceId = getOrCreateGUID(); // Get or create the GUID from local storage
    deviceId = await resolveDeviceId();

    if (!deviceId) {
        loadingScreen.innerHTML = `<p>Error: Could not determine or generate device ID.</p>`;
        return; // Stop execution if device ID cannot be determined
    }

    console.log(`Identified Device ID (GUID): ${deviceId}`);
    loadingScreen.innerHTML = `<p>Identified device: ${deviceId}. Loading content...</p><div class="spinner"></div>`;


    // --- 2. CSV Fetching and Parsing ---
    async function fetchCsvData() {
        try {
            const response = await fetch(csvFilePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            return parseCsv(text);
        } catch (error) {
            console.error('Error fetching CSV:', error);
            loadingScreen.innerHTML = `<p>Error fetching device list. Please check network or file path.</p><p>${error.message}</p>`;
            return null;
        }
    }

    function parseCsv(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        const data = {};
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            if (values.length === headers.length) {
                const deviceId = values[headers.indexOf('device_id')];
                const presentationUrl = values[headers.indexOf('presentation_url')];
                data[deviceId] = presentationUrl;
            }
        }
        return data;
    }

    // --- 3. URL Matching and Display ---
    async function loadPresentation() {
        // Ensure loading screen is visible while fetching/processing
        loadingScreen.style.display = 'block';
        presentationContainer.style.display = 'none';

        // Re-get GUID just in case (though localStorage is persistent)
        const currentGuid = resolveDeviceId();
        if (currentGuid !== deviceId) {
            console.warn(`Device ID (GUID) changed from ${deviceId} to ${currentGuid}. This shouldn't happen with localStorage.`);
            deviceId = currentGuid; // Update device ID
            loadingScreen.innerHTML = `<p>Device ID updated to ${deviceId}. Reloading content...</p><div class="spinner"></div>`;
        }

        const deviceMap = await fetchCsvData();
        if (!deviceMap) {
            return; // Error already displayed by fetchCsvData
        }

        const newDeviceUrl = deviceMap[deviceId];

        if (!newDeviceUrl) {
            loadingScreen.innerHTML = `<p>Error: No presentation URL found for device ID (GUID) "${deviceId}". Please check your CSV file and ensure this GUID is mapped.</p>`;
            return;
        }

        if (newDeviceUrl === currentDeviceUrl && presentationIframe) {
            console.log('URL has not changed. Keeping current presentation.');
            loadingScreen.style.display = 'none';
            presentationContainer.style.display = 'block';
            return;
        }

        console.log(`Loading new URL for device ${deviceId}: ${newDeviceUrl}`);
        currentDeviceUrl = newDeviceUrl;

        // Clear existing iframe if it exists
        if (presentationIframe) {
            presentationContainer.removeChild(presentationIframe);
        }

        // Create and append new iframe
        presentationIframe = document.createElement('iframe');
        presentationIframe.src = currentDeviceUrl;
        presentationIframe.frameBorder = 0;
        presentationIframe.mozallowfullscreen = true;
        presentationIframe.webkitallowfullscreen = true;
        presentationIframe.allowFullscreen = true;
        
        presentationIframe.onload = () => {
            console.log('Presentation loaded.');
            loadingScreen.style.display = 'none';
            presentationContainer.style.display = 'block';
        };
        presentationIframe.onerror = (e) => {
            console.error('Error loading iframe:', e);
            loadingScreen.innerHTML = `<p>Error loading presentation: ${e.message || 'Unknown error'}. Check URL or network.</p>`;
        };

        presentationContainer.appendChild(presentationIframe);
    }

    // --- 4. Monitoring URL for Changes ---
    function startPolling() {
        if (pollTimeoutId) {
            clearTimeout(pollTimeoutId); // Clear any existing poll
        }
        pollTimeoutId = setTimeout(async () => {
            console.log('Polling for URL change...');
            await loadPresentation(); // Re-load to check for updates
            startPolling(); // Schedule next poll
        }, pollInterval);
    }

    // Initial load and start polling
    await loadPresentation();
    startPolling();
});
