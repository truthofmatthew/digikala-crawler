const fs = require('fs');  // Import fs module
const { captureApiRequests } = require('./apiHandler');
const { saveCrawledUrls } = require('./utils');

// The target website (change to the desired base URL)
const baseUrl = 'https://digikala.com';

// Load previously crawled URLs if available
let crawledUrls = [];

try {
    const crawledData = fs.readFileSync('crawled_urls.json', 'utf8');
    if (crawledData) {
        crawledUrls = JSON.parse(crawledData);
        console.log('Loaded previous crawled URLs:', crawledUrls.length);
    } else {
        console.log('No previous crawled URLs found. Starting fresh.');
    }
} catch (err) {
    console.error('Error reading crawled URLs file:', err);
    crawledUrls = [];  // Fallback to an empty array if error occurs
}

(async () => {
    console.log('Starting the API capture...');
    await captureApiRequests(baseUrl, crawledUrls);
})();
