const { chromium } = require('playwright');

async function fetchDynamicMenuLinks(url) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the page
    await page.goto(url, { timeout: 60000, waitUntil: 'load' });
    await page.waitForTimeout(2000); // Wait for the page to settle

    // A helper function to extract visible links
    const extractVisibleLinks = async () => {
      return await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors
          .filter(a => {
            const rect = a.getBoundingClientRect();
            const style = window.getComputedStyle(a);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          })
          .map(a => a.href);
      });
    };

    // Capture the baseline links (without hovering any menus)
    const baselineLinks = await extractVisibleLinks();
    const collectedLinks = new Set(baselineLinks);

    // Use a heuristic selector to find potential menu elements
    const menuSelector = '[id*="menu"], [class*="menu"], [data-cro-id*="menu"]';
    const menuElements = await page.$$(menuSelector);
    console.log(`Found ${menuElements.length} potential menu elements.`);

    // For each menu, hover over it and extract any newly visible links
    for (let i = 0; i < menuElements.length; i++) {
      try {
        const element = menuElements[i];

        // Scroll the menu element into view
        await element.scrollIntoViewIfNeeded();
        // Hover over the menu element
        await element.hover();
        // Wait a bit for dynamic content to appear
        await page.waitForTimeout(1000);

        // Capture any additional visible links after hover
        const linksAfterHover = await extractVisibleLinks();
        console.log(`After hovering menu item ${i}, found ${linksAfterHover.length} links.`);
        linksAfterHover.forEach(link => collectedLinks.add(link));

        // Handle nested menu items, by making sure all inner links are shown too
        const nestedMenus = await element.$$('ul, .submenu');
        for (let nested of nestedMenus) {
          await nested.hover();
          await page.waitForTimeout(500); // Short wait to allow new links to show
          const nestedLinks = await extractVisibleLinks();
          nestedLinks.forEach(link => collectedLinks.add(link));
        }

      } catch (error) {
        console.error(`Error while processing menu candidate ${i}:`, error);
      }
    }

    // Log all collected links
    console.log('Collected links:');
    console.log([...collectedLinks]);

  } catch (error) {
    console.error('Error fetching the page:', error);
  } finally {
    await browser.close();
  }
}

const url = 'https://www.digikala.com'; // Replace with your target URL if needed.
fetchDynamicMenuLinks(url);

//
//const { chromium } = require('playwright');
//const fs = require('fs');
//
//async function hoverAndSaveLinks(url) {
//  // Launch the browser; set headless: false for debugging.
//  const browser = await chromium.launch({ headless: false });
//  const page = await browser.newPage();
//
//  // File where links will be saved
//  const fileName = 'collectedLinks.json';
//
//  // A Set to keep track of unique links.
//  const collectedLinks = new Set();
//
//  // Utility: Save the current set of links to a JSON file.
//  function saveLinks() {
//    fs.writeFileSync(fileName, JSON.stringify([...collectedLinks], null, 2));
//  }
//
//  // Utility: Extract visible links on the page.
//  async function getVisibleLinks() {
//    return await page.evaluate(() => {
//      const anchors = Array.from(document.querySelectorAll('a'));
//      return anchors
//        .filter(a => {
//          const rect = a.getBoundingClientRect();
//          // Consider only elements with non-zero dimensions and a valid href.
//          return rect.width > 0 && rect.height > 0 && a.href;
//        })
//        .map(a => a.href);
//    });
//  }
//
//  try {
//    // Go to the page and let it settle.
//    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
//    await page.waitForTimeout(2000);
//
//    // Extract baseline visible links and save them.
//    const baselineLinks = await getVisibleLinks();
//    baselineLinks.forEach(link => collectedLinks.add(link));
//    saveLinks();
//    console.log(`Baseline links: ${baselineLinks.length}`);
//
//    // Select all elements under <body>.
//    const allElements = await page.$$('body *');
//    console.log(`Found ${allElements.length} elements to hover over.`);
//
//    // Iterate over each element.
//    for (let i = 0; i < allElements.length; i++) {
//      try {
//        // Check if element is visible (has a bounding box).
//        const box = await allElements[i].boundingBox();
//        if (!box) continue;
//
//        // Scroll the element into view.
//        await allElements[i].scrollIntoViewIfNeeded();
//
//        // Hover over the element with a reduced timeout (fast hover).
//        await allElements[i].hover({ timeout: 500 });
//
//        // Wait a very short time for any dynamic content to appear.
//        await page.waitForTimeout(100);
//
//        // Extract the links visible after the hover.
//        const newLinks = await getVisibleLinks();
//        let addedCount = 0;
//        newLinks.forEach(link => {
//          if (!collectedLinks.has(link)) {
//            collectedLinks.add(link);
//            addedCount++;
//          }
//        });
//
//        // If new links were found, immediately save them.
//        if (addedCount > 0) {
//          console.log(`Element ${i} added ${addedCount} new links; Total now: ${collectedLinks.size}`);
//          saveLinks();
//        }
//      } catch (hoverError) {
//        // Log the error and continue with the next element.
//        console.error(`Error processing element index ${i}: ${hoverError.message}`);
//      }
//    }
//
//    console.log(`Finished. Total collected links: ${collectedLinks.size}`);
//  } catch (error) {
//    console.error('Error during processing:', error);
//  } finally {
//    await browser.close();
//  }
//}
//
//const targetURL = 'https://www.digikala.com'; // Replace with your target URL.
//hoverAndSaveLinks(targetURL);
