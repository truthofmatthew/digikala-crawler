const express = require('express');
const { chromium } = require('playwright');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Smooth scroll function
async function smoothScroll(page) {
  await page.evaluate(() => {
    let scrollHeight = document.documentElement.scrollHeight;
    let currentScroll = window.scrollY;
    let distance = scrollHeight - currentScroll;
    let interval = 20;
    let step = Math.min(distance / 100, 10);
    let count = 0;
    const scrollInterval = setInterval(() => {
      window.scrollBy(0, step);
      currentScroll += step;
      count++;
      if (currentScroll >= scrollHeight) {
        clearInterval(scrollInterval);
      }
    }, interval);
  });
  await page.waitForTimeout(5000); // sleep for 5 seconds
}

// Fetch product count
async function fetchProductCount(page) {
  try {
    const productCount = await page.evaluate(() => {
      function convertPersianToEnglish(persian) {
        const persianNumbers = '۰۱۲۳۴۵۶۷۸۹';
        const englishNumbers = '0123456789';
        let map = new Map();
        for (let i = 0; i < persianNumbers.length; i++) {
          map.set(persianNumbers[i], englishNumbers[i]);
        }
        return persian.split('').map(char => map.get(char) || char).join('');
      }

      const productCountText = document.querySelector(".text-neutral-500.whitespace-nowrap.text-body-2.ellispis-1.xl\\:flex.items-center.gap-2");
      if (productCountText) {
        const persianCount = productCountText.textContent.trim().split(' ')[0];
        const englishCount = convertPersianToEnglish(persianCount);
        return parseInt(englishCount, 10);
      } else {
        console.log('Product count element not found');
        return 0;
      }
    });
    return productCount;
  } catch (e) {
    console.error(`Error fetching product count: ${e}`);
    return 0;
  }
}

// Fetch product info
async function fetchProductInfo(page) {
  const productInfo = await page.evaluate(() => {
    const products = document.querySelectorAll("[class*='product-list_ProductList__item__']");
    const result = [];
    products.forEach((p, i) => {
      const linkElem = p.querySelector("a");
      const link = linkElem ? linkElem.href : "";
      const nameElem = p.querySelector("h3");
      const name = nameElem ? nameElem.textContent.trim() : "";
      const priceElem = p.querySelector("span[data-testid='price-final']");
      const price = priceElem ? priceElem.textContent.trim() : "";
      let imgElem = p.querySelector("picture source[type='image/webp']");
      if (!imgElem) imgElem = p.querySelector("picture img");
      const img = imgElem ? (imgElem.src || imgElem.getAttribute("srcset")) : "";
      result.push({ index: i + 1, name, link, price, image: img });
    });
    return result;
  });
  return productInfo;
}

// API endpoint to fetch product data for a given URL
app.post('/fetch-products', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForSelector("[class*='product-list_ProductList__item__']", { timeout: 10000 });

    // Smooth scroll
    await smoothScroll(page);

    const totalProducts = await fetchProductCount(page);
    console.log(`Total products: ${totalProducts}`);

    // Fetch product info
    let productInfo = await fetchProductInfo(page);

    // Ensure product info matches total products
    while (productInfo.length !== totalProducts || productInfo.some(p => !p.name || !p.price || !p.image)) {
      console.warn("Mismatch in product data. Retrying scroll...");
      await smoothScroll(page);
      productInfo = await fetchProductInfo(page);
    }

    await browser.close();

    // Return product info as JSON response
    res.json({ totalProducts, products: productInfo });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product data' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
