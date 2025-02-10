const { chromium } = require('playwright');
const fs = require('fs');

async function fetchDynamicMenuLinks(url) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the page
    await page.goto(url, { timeout: 60000, waitUntil: 'load' });
    await page.waitForTimeout(2000); // Wait for the page to settle

    // A helper function to extract visible links and their titles
    const extractVisibleLinksWithTitles = async () => {
      return await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors
          .filter(a => {
            const rect = a.getBoundingClientRect();
            const style = window.getComputedStyle(a);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          })
          .map(a => ({
            url: a.href,
            title: a.querySelector('p') ? a.querySelector('p').textContent : a.textContent.trim(),
          }));
      });
    };

    // Initialize the collected data
    const collectedData = {};

    // Target specific menu item based on your provided HTML
    const menuSelector = 'span[data-cro-id="header-main-menu"]';
    const menuElement = await page.$(menuSelector);

    if (menuElement) {
      console.log("Found the main menu item, hovering over it...");

      // Scroll the menu into view
      await menuElement.scrollIntoViewIfNeeded();
      // Hover over the main menu item to show submenus
      await menuElement.hover();
      await page.waitForTimeout(1000); // Wait for submenus to appear

      // Find all the subcategory elements in the menu
      const subCategorySelector = 'a[data-cro-id="header-main-menu-categories"]'; // Subcategory selector
      const subCategories = await page.$$(subCategorySelector);

      for (let subCategory of subCategories) {
        const categoryTitle = await subCategory.evaluate(el => el.querySelector('p').textContent.trim());

        // Hover over the subcategory
        await subCategory.scrollIntoViewIfNeeded();
        await subCategory.hover();
        await page.waitForTimeout(500); // Short wait to allow new links to show

        // Extract links and titles after hovering over the subcategory
        const links = await extractVisibleLinksWithTitles();

        // Store the data in the desired format
        collectedData[categoryTitle] = links.map(link => ({
          url: link.url,
          title: link.title,
        }));
      }

    } else {
      console.log("Main menu item not found");
    }

    // Save the collected data into a JSON file
    fs.writeFileSync('collectedLinks.json', JSON.stringify(collectedData, null, 2));

    console.log("Links have been saved to 'collectedLinks.json'");

  } catch (error) {
    console.error('Error fetching the page:', error);
  } finally {
    await browser.close();
  }
}

const url = 'https://www.digikala.com'; // Replace with your target URL if needed.
fetchDynamicMenuLinks(url);
