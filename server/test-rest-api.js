const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET = '5781d89097f5edbfd8dc858337e95b8fd852c695045d5f1dd610b8d239c52b30';
const token = jwt.sign({userId: 1, email: 'admin@test.com', role: 'HR'}, SECRET, {expiresIn: '1d'});

let staffIdToDelete = null;

function request(method, path, data) {
  return new Promise((resolve) => {
    const body = data ? JSON.stringify(data) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request(opts, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('\n=== Testing REST API Endpoints ===\n');

  try {
    // Test 1: Create staff
    console.log('Test 1: POST /api/hr/staff - Create staff record');
    let res = await request('POST', '/api/hr/staff', {
      staff_name: 'John Doe',
      email: 'john@test.com',
      phone: '12345',
      department: 'HR',
      base_salary: 5000
    });
    console.log(`✓ Status: ${res.status}`);
    console.log(`✓ Response:`, res.data);
    staffIdToDelete = res.data?.staff_id;
    console.log();

    // Test 2: GET staff by ID
    if (staffIdToDelete) {
      console.log(`Test 2: GET /api/hr/staff/${staffIdToDelete} - Retrieve staff by ID`);
      res = await request('GET', `/api/hr/staff/${staffIdToDelete}`);
      console.log(`✓ Status: ${res.status}`);
      console.log(`✓ Response:`, res.data);
      console.log();
    }

    // Test 3: PUT /staff/:id
    if (staffIdToDelete) {
      console.log(`Test 3: PUT /api/hr/staff/${staffIdToDelete} - Update staff record`);
      res = await request('PUT', `/api/hr/staff/${staffIdToDelete}`, {
        staff_name: 'Jane Doe',
        email: 'jane@test.com',
        phone: '54321'
      });
      console.log(`✓ Status: ${res.status}`);
      console.log(`✓ Response:`, res.data);
      console.log();
    }

    // Test 4: GET /staff (list all)
    console.log('Test 4: GET /api/hr/staff - List all staff');
    res = await request('GET', '/api/hr/staff');
    console.log(`✓ Status: ${res.status}`);
    console.log(`✓ Staff count:`, res.data?.length || 0);
    console.log();

    // Test 5: DELETE /staff/:id
    if (staffIdToDelete) {
      console.log(`Test 5: DELETE /api/hr/staff/${staffIdToDelete} - Delete staff record`);
      res = await request('DELETE', `/api/hr/staff/${staffIdToDelete}`);
      console.log(`✓ Status: ${res.status}`);
      console.log(`✓ Response:`, res.data);
      console.log();
    }

    // Test 6: Verify deletion
    console.log('Test 6: GET /api/hr/staff - Verify staff list after deletion');
    res = await request('GET', '/api/hr/staff');
    console.log(`✓ Status: ${res.status}`);
    console.log(`✓ Staff count after deletion:`, res.data?.length || 0);
    console.log();

    console.log('=== All tests completed! ===\n');
  } catch (err) {
    console.error('Test error:', err);
  }
}

runTests();
