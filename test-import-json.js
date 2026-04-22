const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
// You'll need a valid token to run this locally if protect middleware is active
const TOKEN = 'YOUR_TOKEN_HERE';

async function testImport() {
  const payload = {
    rows: [
      {
        rowNumber: 2,
        row: {
          "Product Name": "Test Medicine",
          "Quantity": 10,
          "Batch Number": "BATCH001",
          "Expiry Date": "31/Dec/2026",
          "Buying Price": 50
        }
      }
    ],
    headerMapping: {
      name: "Product Name",
      stock: "Quantity",
      batch: "Batch Number",
      expiry: "Expiry Date",
      buyingPrice: "Buying Price"
    },
    fileName: "test.xlsx",
    confirm: "true"
  };

  try {
    console.log('Testing /import/preview with JSON...');
    const previewRes = await axios.post(`${BASE_URL}/import/preview`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    console.log('Preview success:', previewRes.data.success);

    const importId = previewRes.data.importId;
    console.log('Testing /import/commit with JSON...');
    const commitRes = await axios.post(`${BASE_URL}/import/commit`, {
      ...payload,
      importId
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    console.log('Commit success:', commitRes.data.success);
  } catch (err) {
    console.error('Test failed:', err.response?.data || err.message);
  }
}

// testImport();
