const fs = require('fs');

function saveCrawledUrls(crawledUrls) {
    fs.writeFileSync('crawled_urls.json', JSON.stringify(crawledUrls, null, 2));
    console.log('Crawled URLs saved.');
}

module.exports = { saveCrawledUrls };
