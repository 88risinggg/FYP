const http = require('http');
const jwt = require('jsonwebtoken');
const { app, staffProfiles } = require('./test-standalone');

const SECRET = '5781d89097f5edbfd8dc858337e95b8fd852c695045d5f1dd610b8d239c52b30';
const token = jwt.sign({userId: 1, email: 'admin@test.com', role: 'HR'}, SECRET, {expiresIn: '1d'});

function request(method, path, data) {
  return new Promise((resolve) => {
    const body = data ? JSON.stringify(data) : null;
    const opts = {
      hostname: 'localhost',
      port: 6001,
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

async function test() {
  console.log('\n=== Testing Standalone REST API ===\n');

  try {
    // Create
    let res = await request('POST', '/staff', {
      staff_name: 'John Doe',
      email: 'john@test.com',
      phone: '12345',
      department: 'HR',
      base_salary: 5000
    });
    console.log('POST /staff:', res.status, res.data);
    const staffId = res.data?.staff_id;

    // GET by ID
    if (staffId) {
      res = await request('GET', `/staff/${staffId}`);
      console.log(`GET /staff/${staffId}:`, res.status, res.data);
    }

    // PUT
    if (staffId) {
      res = await request('PUT', `/staff/${staffId}`, {
        staff_name: 'Jane Doe',
        email: 'jane@test.com'
      });
      console.log(`PUT /staff/${staffId}:`, res.status, res.data);
    }

    // GET list
    res = await request('GET', '/staff');
    console.log('GET /staff:', res.status, 'Count:', res.data?.length);

    // DELETE
    if (staffId) {
      res = await request('DELETE', `/staff/${staffId}`);
      console.log(`DELETE /staff/${staffId}:`, res.status, res.data.message);
    }

    console.log('\nTest complete!\n');
  } catch (err) {
    console.error('Error:', err);
  }
}

test().then(() => process.exit(0));
