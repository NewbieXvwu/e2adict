// scripts/download-tracker.mjs
import fs from 'fs/promises';
import path from 'path';

const OFFICIAL_URL = 'https://cloud.umami.is/script.js';
const OUTPUT_DIR = 'public';
const OUTPUT_FILENAME = 'umami.js';
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILENAME);

async function downloadTracker() {
  try {
    console.log(`Downloading Umami tracker from ${OFFICIAL_URL}...`);
    
    const response = await fetch(OFFICIAL_URL, {
        headers: { 'User-Agent': 'Node.js Downloader' }
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    const scriptContent = await response.text();

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(OUTPUT_PATH, scriptContent, 'utf-8');

    console.log(`✅ Tracker successfully downloaded to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('❌ Error downloading tracker:', error.message);
  }
}

downloadTracker();