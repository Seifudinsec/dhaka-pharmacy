// Test script to verify return system functionality
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testReturnSystem() {
  try {
    console.log('Testing Return System...');
    
    // Step 1: Login to get token
    console.log('\n1. Testing login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful, token obtained');
    console.log('Login response structure:', JSON.stringify(loginResponse.data, null, 2));
    
    // Step 2: Get existing sales
    console.log('\n2. Fetching sales...');
    const salesResponse = await axios.get(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const sales = salesResponse.data.data;
    console.log(`Found ${sales.length} sales`);
    
    if (sales.length === 0) {
      console.log('No sales found to test returns');
      return;
    }
    
    // Step 3: Test return on first sale
    const testSale = sales[0];
    console.log(`\n3. Testing return on sale: ${testSale._id}`);
    console.log(`Sale items: ${testSale.items.length}`);
    console.log(`Sale status: ${testSale.status}`);
    console.log(`Sale total: ${testSale.total}`);
    
    // Step 4: Create a return
    if (testSale.status !== 'fully_refunded' && testSale.items.length > 0) {
      const returnItem = testSale.items[0];
      console.log(`\n4. Creating return for item: ${returnItem.medicineName}`);
      
      const returnPayload = {
        originalSaleId: testSale._id,
        items: [{
          medicineId: returnItem.medicine._id || returnItem.medicine,
          quantity: Math.min(1, returnItem.quantity) // Return 1 item or max available
        }],
        reason: 'Test return - system verification'
      };
      
      console.log('Return payload:', JSON.stringify(returnPayload, null, 2));
      
      try {
        const returnResponse = await axios.post(`${API_BASE}/returns`, returnPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('\n5. Return successful!');
        console.log('Return response:', JSON.stringify(returnResponse.data, null, 2));
        
        // Step 5: Verify sale status updated
        console.log('\n6. Verifying sale status update...');
        const updatedSaleResponse = await axios.get(`${API_BASE}/sales`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const updatedSale = updatedSaleResponse.data.data.find(s => s._id === testSale._id);
        console.log(`Updated sale status: ${updatedSale.status}`);
        
        // Step 6: Check medicine stock
        console.log('\n7. Checking medicine stock...');
        const medicinesResponse = await axios.get(`${API_BASE}/medicines`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const medicine = medicinesResponse.data.data.find(m => 
          m._id === (returnItem.medicine._id || returnItem.medicine)
        );
        
        if (medicine) {
          console.log(`Medicine: ${medicine.name}, Stock: ${medicine.stock}`);
        }
        
        console.log('\n=== Return System Test Complete ===');
        
      } catch (returnError) {
        console.log('\n4. Return failed with error:');
        console.log('Error status:', returnError.response?.status);
        console.log('Error data:', returnError.response?.data);
        console.log('Error message:', returnError.message);
      }
    } else {
      console.log('Sale is fully refunded or has no items - cannot test return');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Run the test
testReturnSystem();
