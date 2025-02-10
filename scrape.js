const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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

async function scrollBackAndRetry(page) {
  await page.evaluate(() => {
    window.scrollBy(0, -500);
  });
  await page.waitForTimeout(2000); // sleep for 2 seconds
  await smoothScroll(page);
}

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

function saveToHTML(products) {
  let htmlContent = `
    <html>
    <head>
        <style>
            table {
                width: 100%;
                border-collapse: collapse;
            }
            table, th, td {
                border: 1px solid black;
            }
            th, td {
                padding: 10px;
                text-align: left;
            }
        </style>
    </head>
    <body>
        <h2>Product List</h2>
        <table>
            <tr>
                <th>Product Link</th>
                <th>Product Name</th>
                <th>Price</th>
                <th>Image</th>
            </tr>`;
  
  products.forEach(product => {
    htmlContent += `
      <tr>
          <td><a href="${product.link}" target="_blank">${product.name}</a></td>
          <td>${product.name}</td>
          <td>${product.price}</td>
          <td><img src="${product.image}" width="100"></td>
      </tr>`;
  });

  htmlContent += `
        </table>
    </body>
    </html>`;

  fs.writeFileSync(path.join(__dirname, 'product_list.html'), htmlContent, 'utf-8');
  console.log("HTML file saved as 'product_list.html'.");
}

async function main() {
  const url = 'https://www.digikala.com/product-list/plp_247422593/';

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
    await scrollBackAndRetry(page);
    productInfo = await fetchProductInfo(page);
  }

  saveToHTML(productInfo);

  // Print fetched product info
  productInfo.forEach(product => {
    console.log(`${'-'.repeat(50)}`);
    console.log(`Product ${product.index}:`);
    console.log(`  Name: ${product.name}`);
    console.log(`  Price: ${product.price}`);
    console.log(`  Image: ${product.image}`);
    console.log(`  Link: ${product.link}`);
    console.log(`${'-'.repeat(50)}\n`);
  });

  await browser.close();
}

main().catch(console.error);
