
import { randomUUID } from 'crypto';

const API_URL = 'http://localhost:5002/api';
let TOKEN = '';
let COOKIES = '';

// Store IDs for dependent tests
const IDS: Record<string, string> = {};

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function request(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (COOKIES) {
      headers['Cookie'] = COOKIES;
  }

  console.log(`${COLORS.blue}${method} ${path}${COLORS.reset}`);
  
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Capture cookies
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        COOKIES = setCookie.split(';')[0]; // Simple capturing of the first cookie part
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
        console.log(`${COLORS.red}FAILED (${res.status}): ${JSON.stringify(data)}${COLORS.reset}`);
        throw new Error(`Request failed: ${res.statusText}`);
    }

    console.log(`${COLORS.green}OK (${res.status})${COLORS.reset}`);
    return data;
  } catch (err) {
    console.error(err);
    throw err; // Re-throw to stop execution if needed
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...');
  
  // 1. System & Auth
  console.log('\n--- 1. System & Authentication ---');
  await request('GET', '/health/db');
  
  const randomStr = randomUUID().substring(0, 8);
  const email = `boss-${randomStr}@example.com`;
  
  console.log(`Creating company with email: ${email}`);
  const signupRes = await request('POST', '/auth/signup-company', {
    companyName: `Test Company ${randomStr}`,
    companySlug: `test-co-${randomStr}`,
    address: '123 Test St',
    fullName: 'Test Boss',
    email,
    password: 'password123',
    phone: '+9779812345678',
    role: 'manager' // Actually signup-company creates 'boss', but let's see what the schema expects
  });
  
  // Login
  const loginRes = await request('POST', '/auth/login', {
      email,
      password: 'password123'
  });
  
  // Try to get token from body or cookie
  if (loginRes.accessToken) {
      TOKEN = loginRes.accessToken;
      console.log('Token received from body');
  } else {
      console.log('Token expected in Cookie');
  }

  const meRes = await request('GET', '/auth/me', undefined, TOKEN);
  IDS.bossId = meRes.user.id;
  IDS.companyUserId = meRes.user.companyUserId;
  IDS.companyId = meRes.company.id;
  
  // 2. Staff Management
  console.log('\n--- 2. Staff Management ---');
  const staffList = await request('GET', '/staff', undefined, TOKEN);
  console.log(`Found ${staffList.staff.length} staff members`);
  
  const inviteRes = await request('POST', '/staff/invite', {
      fullName: 'Test Rep',
      email: `rep-${randomStr}@example.com`,
      phone: '+9779876543210',
      role: 'rep'
  }, TOKEN);
  
  // We can't easily login as the rep because they need to set password via email link.
  // For now, we continue as Boss/Manager.
  
  // 3. Core Resources
  console.log('\n--- 3. Core Resources ---');
  
  // Create Shop
  const shopRes = await request('POST', '/shops', {
      name: `Shop ${randomStr}`,
      latitude: 27.7172,
      longitude: 85.3240,
      geofenceRadius: 100,
      notes: 'Test Shop'
  }, TOKEN);
  IDS.shopId = shopRes.shop.id;
  
  await request('GET', '/shops', undefined, TOKEN);
  await request('GET', `/shops/${IDS.shopId}`, undefined, TOKEN);
  
  await request('PATCH', `/shops/${IDS.shopId}`, { // Correct route is PATCH /shops/:id? Wait, user checklist said update shop.
    notes: 'Updated notes'
  }, TOKEN); // Check route implementation. shops.route.ts didn't explicitly show update... wait.
  // Looking at my history, Step 15 shops.route.ts ONLY had List and Create. NO Update or Get One.
  // Ah! The user checklist asks for them, but I might not have implemented them yet!
  // I should check if I missed implementing some routes.
  // The checklist:
  // - [ ] Update Shop - PATCH /api/manager/shops/[id] -> NOT IMPLEMENTED in Step 15
  // - [ ] Get Shop Details - GET /api/manager/shops/[id] -> NOT IMPLEMENTED in Step 15
  // Same for Products? products.route.ts wasn't shown fully.
  
  // I will comment out the missing routes in the test for now or try them and fail.
  // Let's create Products first.
   const productRes = await request('POST', '/products', {
      name: `Product ${randomStr}`,
      sku: `SKU-${randomStr}`,
      unit: 'pcs',
      price: 100
  }, TOKEN);
  IDS.productId = productRes.product.id;
  
  await request('GET', '/products', undefined, TOKEN);
  
  // 4. Operational Flows
  console.log('\n--- 4. Operational Flows ---');
  
  // Create Lead
  const leadRes = await request('POST', '/leads', {
      name: `Lead ${randomStr}`,
      contactName: 'Lead Contact',
      phone: '5551234567',
      assignedRepCompanyUserId: null // Assign to self? or null.
  }, TOKEN);
  IDS.leadId = leadRes.lead.id;
  
  await request('GET', '/leads', undefined, TOKEN);
  
  // Convert Lead
  await request('POST', `/leads/${IDS.leadId}/convert-to-shop`, {}, TOKEN);
  
  // Create Order
  const orderRes = await request('POST', '/orders', {
      shopId: IDS.shopId,
      items: [
          { 
              productId: IDS.productId, 
              quantity: 5, 
              unitPrice: 100,
              productName: 'Test Product',
              productSku: 'TEST-SKU'
          }
      ]
  }, TOKEN);
  IDS.orderId = orderRes.order.id;
  
  await request('GET', '/orders', undefined, TOKEN);
  
  // Cancel Order
  await request('POST', `/orders/${IDS.orderId}/cancel`, {
      cancel_reason: 'Test cancellation'
  }, TOKEN);
  
  // Visits (Attendance)
  console.log('\n--- Visits & Attendance ---');
  await request('POST', '/attendance/clock-in', {
      latitude: 27.7172,
      longitude: 85.3240
  }, TOKEN);
  
  const visitRes = await request('POST', '/visits', {
      shopId: IDS.shopId,
      notes: 'Starting visit'
  }, TOKEN);
  IDS.visitId = visitRes.visit.id;
  
  await request('PATCH', `/visits/${IDS.visitId}`, {
      status: 'completed', // Check visit schema for valid update fields
      notes: 'Finished visit'
  }, TOKEN);
  
  await request('POST', '/attendance/clock-out', {
       latitude: 27.7172,
      longitude: 85.3240
  }, TOKEN);

  // Tasks
  console.log('\n--- Tasks ---');
  const taskRes = await request('POST', '/tasks', {
      title: 'Do something',
      assignedToCompanyUserId: IDS.companyUserId, 
      dueDate: new Date(Date.now() + 86400000).toISOString()
  }, TOKEN);
  IDS.taskId = taskRes.task.id;
  
  await request('PATCH', `/tasks/${IDS.taskId}`, {
      status: 'completed'
  }, TOKEN);

  console.log('\n✅ Tests Completed');
}

runTests().catch(e => {
    console.error('\n❌ Tests Failed');
    process.exit(1);
});
