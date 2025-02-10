const { chromium } = require('playwright');  // Use Playwright for better simulation
const fs = require('fs');
const { saveCrawledUrls } = require('./utils');
const apiDataFile = 'api_data.json';  // Store API data in JSON format

async function captureApiRequests(baseUrl, crawledUrls) {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });  // Use Chromium for full browser simulation
    const page = await browser.newPage();

    const apiData = [];

    // Intercept network requests and log the API URLs
    page.on('response', async (response) => {
        try {
            const contentType = response.headers()['content-type'];

            // Skip preflight requests (OPTIONS method)
            if (response.request().method() === 'OPTIONS') {
                return;
            }

            // Only handle JSON responses
            if (contentType && contentType.includes('application/json')) {
                const apiUrl = response.url();
                const pageUrl = response.request().headers()['referer'];  // The page URL from which the API is found

                // Log API data with baseUrl as the current page URL
                apiData.push({
                    apiUrl: apiUrl,
                    baseUrl: pageUrl,  // Base URL is the current page URL where the API was found
                });

                // Save to JSON (Instead of CSV)
                fs.writeFileSync(apiDataFile, JSON.stringify(apiData, null, 2));
                console.log(`API Found: ${apiUrl}`);
            }
        } catch (err) {
            console.error(`Error processing response: ${response.url()}`, err);
        }
    });

    console.log('Navigating to base URL...');
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });  // Increased timeout to 60s

    // Function to crawl a page for links and APIs
    async function crawlPage(pageUrl) {
        // Skip if already crawled
        if (crawledUrls.includes(pageUrl)) {
            console.log(`Skipping already crawled URL: ${pageUrl}`);
            return;
        }

        crawledUrls.push(pageUrl);
        saveCrawledUrls(crawledUrls);  // Save crawled URLs here
        console.log('++++++++++++++++');
        console.log(`Current URL: > ${pageUrl}`);  // Printing current URL
        console.log('++++++++++++++++');

        // Navigate to the page and extract all links
        console.log(`Extracting links from: ${pageUrl}`);
        await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });  // Increased timeout to 60s

        // Find all links on the page
        const links = await page.evaluate(() => {
            const linkElements = Array.from(document.querySelectorAll('a'));
            return linkElements.map(link => link.href).filter(href => href.startsWith('http'));
        });

        console.log(`Found ${links.length} links on this page.`);

        // Filter out the already crawled URLs
        const newLinks = links.filter(link => !crawledUrls.includes(link));

        // Crawl each new link and search for APIs
        let apiCount = 0;
        for (let link of newLinks) {
            console.log(`Crawling and searching for APIs in: ${link}`);
            const linkApis = await crawlPage(link);  // Recursively crawl the new link

            // Count APIs found on this link
            apiCount += linkApis;
        }

        console.log('++++++++++++++++');
        console.log(`API Found: > ${apiCount} APIs in this page`);  // Print number of APIs found
        console.log('++++++++++++++++');
        return apiCount;
    }

    console.log('Starting the crawl process...');
    await crawlPage(baseUrl);

    console.log('Crawling and API capture complete!');
    await browser.close();
}

module.exports = { captureApiRequests };
