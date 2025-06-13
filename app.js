document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const presentationContainer = document.getElementById('presentation-container');
    const urlParams = new URLSearchParams(window.location.search);
    const sheetIdFromUrl = urlParams.get('sheetID') || localStorage.getItem('sanitizedId');
    const pollInterval = 15 * 60 * 1000; // 15 minutes

    let currentDeviceUrl = null;
    let presentationIframe = null;
    let pollTimeoutId = null;
    let deviceId = null;
    let csvFilePath = null;

    /**
     * Generates or retrieves a 10-digit numeric ID prefixed with "GIPS" and stores it in localStorage.
     */
    function getOrCreateGUID() {
        let storedDeviceId = localStorage.getItem('deviceId');
        const prefix = "GIPS";

        if (!storedDeviceId) {
            const digits = '0123456789';
            let numericPart = '';
            for (let i = 0; i < 10; i++) {
                numericPart += digits.charAt(Math.floor(Math.random() * digits.length));
            }
            storedDeviceId = prefix + numericPart;
            localStorage.setItem('deviceId', storedDeviceId);
            console.log('New deviceId generated and stored:', storedDeviceId);
        } else {
            console.log('Retrieved existing deviceId from localStorage:', storedDeviceId);
        }

        return storedDeviceId;
    }

    /**
     * Validates and constructs a CSV URL from the given Google Sheet ID.
     */
    function getCsvUrlFromSheetId(sheetId) {
        console.log(`Attempting to load Sheet ID from URL: ${sheetId}`);

        if (!sheetId || typeof sheetId !== 'string' || sheetId.trim() === '') {
            console.error("Invalid input: Sheet ID must be a non-empty string.");
            return null;
        }

        const sanitizedId = sheetId.trim();
        const validIdRegex = /^[a-zA-Z0-9-_]+$/;

        if (!validIdRegex.test(sanitizedId)) {
            console.error("Invalid Sheet ID format.");
            return null;
        }
        localStorage.setItem('sanitizedId', sanitizedId);
        const baseUrl = 'https://docs.google.com/spreadsheets/d/e/';
        const urlSuffix = '/pub?gid=0&single=true&output=csv';
        return `${baseUrl}${sanitizedId}${urlSuffix}`;
    }

    /**
     * Fetches and parses CSV data into a map of deviceId → presentationUrl.
     */
    async function fetchCsvData() {
        try {
            console.log(`Attempting to fetchCsvDatafrom URL: ${csvFilePath}`);
            const response = await fetch(csvFilePath);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const text = await response.text();
            return parseCsv(text);
        } catch (error) {
            console.error('Error fetching CSV:', error);
            loadingScreen.innerHTML = `<p>Error fetching device list.</p><p>${error.message}</p>`;
            return null;
        }
    }

    /**
     * Parses CSV text into an object mapping device IDs to presentation URLs.
     */
    function parseCsv(csvText) {
        console.log(`Attempting to parse csvText.`);
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = {};

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length === headers.length) {
                const deviceId = values[headers.indexOf('device_id')];
                const presentationUrl = values[headers.indexOf('presentation_url')];
                data[deviceId] = presentationUrl;
            }
        }

        return data;
    }

    /**
     * Loads and displays the presentation associated with the current device.
     */
    async function loadPresentation() {
        loadingScreen.style.display = 'block';
        presentationContainer.style.display = 'none';

        const currentGuid = getOrCreateGUID();
        if (currentGuid !== deviceId) {
            console.warn(`Device ID changed from ${deviceId} to ${currentGuid}`);
            deviceId = currentGuid;
            loadingScreen.innerHTML = `<p>Device ID updated. Reloading...</p><div class="spinner"></div>`;
        }

        const deviceMap = await fetchCsvData();
        if (!deviceMap) return;

        const newDeviceUrl = deviceMap[deviceId];
        if (!newDeviceUrl) {
            loadingScreen.innerHTML = `<p>No presentation URL found for device ID: "${deviceId}".</p>`;
            return;
        }

        if (newDeviceUrl === currentDeviceUrl && presentationIframe) {
            console.log('URL unchanged. Keeping current presentation.');
            loadingScreen.style.display = 'none';
            presentationContainer.style.display = 'block';
            return;
        }

        currentDeviceUrl = newDeviceUrl;
        console.log(`Loading presentation for device ${deviceId}: ${newDeviceUrl}`);

        if (presentationIframe) {
            presentationContainer.removeChild(presentationIframe);
        }

        presentationIframe = document.createElement('iframe');
        presentationIframe.src = currentDeviceUrl;
        presentationIframe.frameBorder = 0;
        presentationIframe.allowFullscreen = true;
        //presentationIframe.allowAutoplay = true;
        //presentationIframe.allowLoop = true;
        presentationIframe.onload = () => {
            loadingScreen.style.display = 'none';
            presentationContainer.style.display = 'block';
            console.log('Presentation loaded.');
        };
        presentationIframe.onerror = (e) => {
            console.error('Error loading presentation:', e);
            loadingScreen.innerHTML = `<p>Error loading presentation.</p>`;
        };

        presentationContainer.appendChild(presentationIframe);
    }

    /**
     * Polls for updates to the presentation URL at a regular interval.
     */
    function startPolling() {
        if (pollTimeoutId) clearTimeout(pollTimeoutId);
        pollTimeoutId = setTimeout(async () => {
            console.log('Polling for updates...');
            await loadPresentation();
            startPolling();
        }, pollInterval);
    }

    // --- INITIALIZATION SEQUENCE ---
    loadingScreen.innerHTML = `<p>Identifying device...</p><div class="spinner"></div>`;
    deviceId = getOrCreateGUID();

    if (!deviceId) {
        loadingScreen.innerHTML = `<p>Error: Could not generate or retrieve device ID.</p>`;
        return;
    }

    loadingScreen.innerHTML = `<p>Device identified: ${deviceId}. Loading content...</p><div class="spinner"></div>`;

    if (!sheetIdFromUrl) {
        console.error("Missing 'sheetID' in URL.");
        loadingScreen.innerHTML = `<p>Error: 'sheetID' parameter is required in the URL. ${sheetIdFromUrl} </p>`;
        return;
    }

    csvFilePath = getCsvUrlFromSheetId(sheetIdFromUrl);
    if (!csvFilePath) {
        loadingScreen.innerHTML = `<p>Error: Invalid or malformed Sheet ID.</p>`;
        return;
    }

    console.log('CSV URL:', csvFilePath);

    // Load the presentation and start polling
    await loadPresentation();
    startPolling();
});
