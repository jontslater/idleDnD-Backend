import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data...\n');
    
    const response = await fetch(`${API_URL}/api/test/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log(`   Deleted ${result.deleted} test documents`);
      console.log(`   Message: ${result.message}\n`);
    } else {
      console.error('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error.message);
    console.error('   Make sure the backend server is running on port 3001\n');
  }
}

cleanupTestData();
