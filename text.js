const puppeteer = require('puppeteer');
const mysql = require('mysql');

// MySQL connection configuration
const db_conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "daraz_aff", // Replace with your actual database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


db_conn.connect(function (err) {
    if (err) throw err;
    console.log("Connected to MySQL!");
});


function justNumber(str) {
    var num = str.replace(/[^0-9]/g, '');
    return parseFloat(num, 10);
}

async function waitForPageLoad(page, timeout = 90000) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout waiting for page load after ${timeout} ms`)), timeout);
    });

    const domContentLoadedPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout });

    await Promise.race([timeoutPromise, domContentLoadedPromise]);
}


async function scrapeData(url) {

    console.log('=========== scraping start =========');

    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',  // Update with your Chrome path
        headless: 'new',
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');

    //await waitForPageLoad(page);
    // await page.goto(url);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); // Increase timeout to 60 seconds


    // Wait for the relevant content to load (adjust the selector as needed)
    await page.waitForSelector('.gallery-preview-panel__image');
    //const productImage = await page.$eval('.gallery-preview-panel__image', img => img.getAttribute('src'));
    //await page.waitForSelector('.pdp-mod-product-badge-title', title => title.innerText);
    const img2 = await page.$eval('.item-gallery__thumbnail-image', img => img.getAttribute('src'));
    const productImage = img2.replace('100x100', '750x750');

    const productTitle = await page.$eval('.pdp-mod-product-badge-title', title => title.innerText);
    const price = justNumber(await page.$eval('.pdp-price', price => price.innerText));
    const oldPrice = justNumber(await page.$eval('.pdp-price_type_deleted', oldPrice => oldPrice.innerText));
    const discount = justNumber(await page.$eval('.pdp-product-price__discount', discount => discount.innerText));
    const desc = await page.$eval('.pdp-product-highlights', desc => desc.innerText);

    //const rating_score = await page.$eval('.score', rating_score => rating_score.innerText);
    //const total_reviews = (justNumber(await page.$eval('.rate-num', total_reviews => total_reviews.innerText)));

    // Print the extracted information
    console.log('Print the extracted information')
    console.log('Product Image:', productImage);
    console.log('Product Title:', productTitle);
    console.log('Price:', price);
    console.log('Old Price:', oldPrice);
    console.log('Discount:', discount);
    console.log('Description:', desc);


    console.log('=========== scraping done =========');
    //await browser.close();
    return { productImage, productTitle, price, oldPrice, discount, desc };

}

// async function getDataFromDB() {
//     try {
//         const products = await new Promise((resolve, reject) => {
//             db_conn.query('SELECT * FROM products limit 2', function (err, products, fields) {
//                 if (err) throw (err);
//                 console.log(products.product_id);
//                 return products;
//             });

//             db_conn.end();

//         });
//     }
//     catch (error) {
//         console.error(error);
//     }
// }

// Wrap your code in an async function
async function fetchDataAndUpdate() {
    try {
        const products = await new Promise((resolve, reject) => {
            db_conn.query('SELECT * FROM products limit 3', function (err, products, fields) {
                if (err) reject(err);
                // console.log(products.product_id);
                else resolve(products);
                return products;
            });

            // db_conn.end();

        });

        console.log('=========== rcv data from DB =========');
        console.log(products);
        console.log('=========== data from DB =========');
        const len = products.length;

        console.log("length: " + len);

        for (let i = 0; i < len; i++) {
            const product = products[i];

            console.log('i: ' + (i + 1));
            console.log('id : ' + product.product_id + 'Link: ' + product.product_link);

            const result = await scrapeData(product.product_link);
            let update_price = result.price;
            let update_discount = result.discount;
            let update_regular_price = result.oldPrice;

            sql = "UPDATE products SET product_title = ?, product_desc =?, offer_price = ?, discount = ?, regular_price = ?, product_image_url = ? WHERE product_id = ?";
            const values = [
                result.productTitle,
                result.desc,
                update_price,
                update_discount,
                update_regular_price,
                result.productImage,
                product.product_id,
            ];
            console.log(sql);

            db_conn.query(sql, values, function (err, res) {
                if (err) throw err;
                if (res == true) {
                    console.log("Data inserted into MySQL!");
                }
                // console.log(res);
            });
        }
        db_conn.end();

        // Release the connection back to the pool

    } catch (error) {
        console.error(error);
    }

    console.log('====fetchDataAndUpdate done====');

}

// Call the async function
fetchDataAndUpdate();



console.log('All done');