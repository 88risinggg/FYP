const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({userId: 1, email: 'admin@test.com', role: 'HR'}, 'your-secret-key-change-this', {expiresIn: '1d'});

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/hr${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('Testing REST API endpoints...\n');

  try {
    // Test 1: Create a staff record
    console.log('1. POST /staff - Create staff record');
    const createRes = await makeRequest('POST', '/staff', {
      staff_name: 'John Doe',
      email: 'john@test.com',
      phone: '12345',
      department: 'HR',
      base_salary: 5000
    });
    console.log(`Status: ${createRes.status}`, createRes.data, '\n');
    const staffId = createRes.data?.staff_id;

    if (!staffId) {
      console.log('Failed to create staff, stopping tests');
      return;
    }

    // Test 2: Get staff by ID
    console.log(`2. GET /staff/${staffId} - Retrieve staff by ID`);
    const getRes = await makeRequest('GET', `/${staffId}`);
    console.log(`Status: ${getRes.status}`, getRes.data, '\n');

    // Test 3: Update staff with PUT
    console.log(`3. PUT /staff/${staffId} - Update staff record`);
    const updateRes = await makeRequest('PUT', `/${staffId}`, {
      staff_name: 'Jane Doe',
      email: 'jane@test.com',
      phone: '54321'
    });
    console.log(`Status: ${updateRes.status}`, updateRes.data, '\n');

    // Test 4: Get all staff
    console.log('4. GET /staff - Retrieve all staff');
    const listRes = await makeRequest('GET', '/staff');
    console.log(`Status: ${listRes.status}, Count: ${listRes.data?.length || 0}\n`);

    // Test 5: Delete staff with DELETE
    console.log(`5. DELETE /staff/${staffId} - Delete staff record`);
    const deleteRes = await makeRequest('DELETE', `/${staffId}`);
    console.log(`Status: ${deleteRes.status}`, deleteRes.data, '\n');

    // Test 6: Verify deletion
    console.log('6. GET /staff - Verify staff list after deletion');
    const finalRes = await makeRequest('GET', '/staff');
    console.log(`Status: ${finalRes.status}, Count: ${finalRes.data?.length || 0}\n`);

    console.log('All tests completed!');
  } catch (err) {
    console.error('Test error:', err.message);
  }
}

test();
