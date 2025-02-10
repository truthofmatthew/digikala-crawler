const puppeteer = require('puppeteer');
const fs = require('fs');
const fastcsv = require('fast-csv');
const cliProgress = require('cli-progress');
const path = require('path');

// The target website (change to the desired base URL)
const baseUrl = 'https://digikala.com';

// Path to store the crawled URLs (for progress tracking)
const crawledUrlsFile = 'crawled_urls.json';
const apiDataFile = 'api_data.csv';

// Load previously crawled URLs if available
let crawledUrls = [];
try {
    if (fs.existsSync(crawledUrlsFile) && fs.readFileSync(crawledUrlsFile, 'utf8')) {
        crawledUrls = JSON.parse(fs.readFileSync(crawledUrlsFile));
        console.log('Loaded previous crawled URLs:', crawledUrls.length);
    } else {
        console.log('No previous crawled URLs found. Starting fresh.');
    }
} catch (err) {
    console.error('Error reading crawled URLs file:', err);
    crawledUrls = [];
}

// Function to save crawled URLs
function saveCrawledUrls() {
    fs.writeFileSync(crawledUrlsFile, JSON.stringify(crawledUrls, null, 2));
    console.log('Crawled URLs saved.');
}

// Function to capture API requests and save to CSV
async function captureApiRequests() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const apiData = [];

    // Intercept network requests and log the API URLs
    page.on('response', async (response) => {
        try {
            const contentType = response.headers()['content-type'];

            // Only handle JSON responses
            if (contentType && contentType.includes('application/json')) {
                const url = response.url();

                // Save only the API URL (no other data)
                apiData.push({ url: url });

                // Save to CSV immediately (API URLs only)
                const ws = fs.createWriteStream(apiDataFile, { flags: 'a', encoding: 'utf8' });
                const csvStream = fastcsv.format({ headers: !fs.existsSync(apiDataFile), quote: '"' });
                csvStream.pipe(ws);
                csvStream.write({ url: url });
                csvStream.end();
                console.log(`API Found: ${url}`);
            }
        } catch (err) {
            console.error(`Error processing response: ${response.url()}`, err);
        }
    });

    console.log('Navigating to base URL...');
    // Navigate to the base URL
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    // Function to crawl a page for links and APIs
    async function crawlPage(pageUrl) {
        // Skip if already crawled
        if (crawledUrls.includes(pageUrl)) {
            console.log(`Skipping already crawled URL: ${pageUrl}`);
            return;
        }

        crawledUrls.push(pageUrl);
        saveCrawledUrls();
        console.log(`Crawled URL: ${pageUrl}`);

        // Navigate to the page and extract all links
        console.log(`Extracting links from: ${pageUrl}`);
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

        // Find all links on the page
        const links = await page.evaluate(() => {
            const linkElements = Array.from(document.querySelectorAll('a'));
            return linkElements.map(link => link.href).filter(href => href.startsWith('http'));
        });

        console.log(`Found ${links.length} links on this page.`);

        // Filter out the already crawled URLs
        const newLinks = links.filter(link => !crawledUrls.includes(link));

        // Crawl each new link and search for APIs
        for (let link of newLinks) {
            console.log(`Crawling and searching for APIs in: ${link}`);
            await crawlPage(link); // Recursively crawl the new link
        }
    }

    // Start crawling from the base URL
    console.log('Starting the crawl process...');
    await crawlPage(baseUrl);

    // Add a progress bar
    const bar = new cliProgress.SingleBar({
        format: 'Progress | {bar} | {percentage}% | Crawled: {crawledUrlsLength}/{totalUrlsLength}',
        barCompleteChar: '█',
        barIncompleteChar: '░',
    }, cliProgress.Presets.shades_classic);

    console.log('Initializing progress bar...');
    // Update the progress bar
    bar.start(crawledUrls.length, crawledUrls.length);

    // Wait for the page to fully load before ending
    console.log('Waiting for page to finish loading...');
    await page.waitForFunction('document.readyState === "complete"'); // Ensure page is fully loaded

    // Stop the progress bar when done
    bar.stop();

    console.log('Crawling and API capture complete!');
    await browser.close();
}

// Run the function
captureApiRequests().catch(error => {
    console.error('Error capturing API requests:', error);
});
