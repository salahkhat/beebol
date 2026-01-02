import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

async function login(request, { username, password }) {
  const tokenResp = await request.post(`${API_BASE}/api/v1/auth/token/`, {
    data: { username, password },
  });
  expect(tokenResp.status(), 'token endpoint should succeed').toBe(200);
  const token = await tokenResp.json();
  expect(token).toHaveProperty('access');
  return token;
}

async function registerAndLogin(request, { username, password }) {
  await request
    .post(`${API_BASE}/api/v1/auth/register/`, {
      data: { username, password },
    })
    .catch(() => {});

  return login(request, { username, password });
}

function authHeaders(access) {
  return { Authorization: `Bearer ${access}` };
}

async function pickSeedImagePath() {
  // Use a repo-committed seed image so we don't depend on image generation libs.
  const p = path.resolve('backend/seed_images/beds/pexels-pixabay-164595.jpg');
  if (!fs.existsSync(p)) {
    throw new Error(`Seed image not found: ${p}`);
  }
  return p;
}

test('my listings shows views/messages/favorites counts', async ({ page, request, baseURL }) => {
  const ts = Date.now();
  const sellerUsername = `e2e_seller_${ts}`;
  const buyerUsername = `e2e_buyer_${ts}`;
  const password = 'TestPass123!';
  const staffUsername = process.env.E2E_STAFF_USERNAME || 'e2e_staff';
  const staffPassword = process.env.E2E_STAFF_PASSWORD || 'e2e_staff_pass';

  // Create accounts + tokens
  const sellerToken = await registerAndLogin(request, { username: sellerUsername, password });
  const buyerToken = await registerAndLogin(request, { username: buyerUsername, password });
  const staffToken = await login(request, { username: staffUsername, password: staffPassword }).catch(() => null);

  if (!staffToken) {
    throw new Error(
      `Unable to authenticate staff user (${staffUsername}). ` +
        `Create it with: python backend/manage.py ensure_e2e_staff --username ${staffUsername} --password <pass> ` +
        `or set E2E_STAFF_USERNAME/E2E_STAFF_PASSWORD.`
    );
  }

  // Verify web is reachable early (better error messages in CI/local)
  const WEB_ROOT = process.env.BASE_URL || baseURL || 'http://localhost:3000';
  const webResp = await request.get(WEB_ROOT);
  if (webResp.status() >= 400) {
    throw new Error(`Web server not available at ${WEB_ROOT} (status ${webResp.status()})`);
  }

  // Look up taxonomy/location seeded by migrations
  const catsResp = await request.get(`${API_BASE}/api/v1/categories/`);
  expect(catsResp.status()).toBe(200);
  const categoriesPayload = await catsResp.json();
  const categories = asList(categoriesPayload);
  const categoryId = categories.length ? categories[0].id : null;
  expect(categoryId, 'Expected at least one seeded category').toBeTruthy();

  const govResp = await request.get(`${API_BASE}/api/v1/governorates/`);
  expect(govResp.status()).toBe(200);
  const governoratesPayload = await govResp.json();
  const governorates = asList(governoratesPayload);
  const governorateId = governorates.length ? governorates[0].id : null;
  expect(governorateId, 'Expected at least one seeded governorate').toBeTruthy();

  const citiesResp = await request.get(`${API_BASE}/api/v1/cities/?governorate=${governorateId}`);
  expect(citiesResp.status()).toBe(200);
  const citiesPayload = await citiesResp.json();
  const cities = asList(citiesPayload);
  const cityId = cities.length ? cities[0].id : null;
  expect(cityId, 'Expected at least one seeded city').toBeTruthy();

  // Create listing as draft first (publishing requires images)
  const title = `E2E Listing ${ts}`;
  const description = 'E2E listing created for verifying seller insights counts.';

  const createResp = await request.post(`${API_BASE}/api/v1/listings/`, {
    headers: authHeaders(sellerToken.access),
    data: {
      title,
      description,
      price: '10',
      currency: 'USD',
      status: 'draft',
      category: Number(categoryId),
      governorate: Number(governorateId),
      city: Number(cityId),
      neighborhood: null,
      latitude: null,
      longitude: null,
      attributes: {},
    },
  });
  expect(createResp.status()).toBe(201);
  const created = await createResp.json();
  const listingId = created.id;
  expect(listingId).toBeTruthy();

  // Upload an image (required before publishing)
  const imgPath = await pickSeedImagePath();
  const imgBuf = fs.readFileSync(imgPath);
  const uploadResp = await request.post(`${API_BASE}/api/v1/listings/${listingId}/images/`, {
    headers: authHeaders(sellerToken.access),
    multipart: {
      image: {
        name: path.basename(imgPath),
        mimeType: 'image/jpeg',
        buffer: imgBuf,
      },
      alt_text: 'E2E',
      sort_order: '0',
    },
  });
  expect(uploadResp.status(), await uploadResp.text()).toBe(201);

  // Publish after images are present
  const publishResp = await request.patch(`${API_BASE}/api/v1/listings/${listingId}/`, {
    headers: authHeaders(sellerToken.access),
    data: { status: 'published' },
  });
  expect(publishResp.status(), await publishResp.text()).toBe(200);

  // Approve via staff moderation so the listing is publicly interactable.
  const moderateResp = await request.post(`${API_BASE}/api/v1/listings/${listingId}/moderate/`, {
    headers: authHeaders(staffToken.access),
    data: { moderation_status: 'approved' },
  });
  expect(moderateResp.status(), await moderateResp.text()).toBe(200);

  // Create one favorite + one thread with 2 messages
  const favResp = await request.post(`${API_BASE}/api/v1/favorites/`, {
    headers: authHeaders(buyerToken.access),
    data: { listing_id: listingId },
  });
  expect([200, 201]).toContain(favResp.status());

  const threadResp = await request.post(`${API_BASE}/api/v1/threads/`, {
    headers: authHeaders(buyerToken.access),
    data: { listing_id: listingId },
  });
  expect([200, 201]).toContain(threadResp.status());
  const thread = await threadResp.json();
  const threadId = thread.id;
  expect(threadId).toBeTruthy();

  const msg1 = await request.post(`${API_BASE}/api/v1/threads/${threadId}/messages/`, {
    headers: authHeaders(buyerToken.access),
    data: { body: 'hello from buyer' },
  });
  expect([200, 201]).toContain(msg1.status());

  const msg2 = await request.post(`${API_BASE}/api/v1/threads/${threadId}/messages/`, {
    headers: authHeaders(sellerToken.access),
    data: { body: 'hello from seller' },
  });
  expect([200, 201]).toContain(msg2.status());

  // Increment view count as buyer (not the seller)
  const viewResp = await request.get(`${API_BASE}/api/v1/listings/${listingId}/`, {
    headers: authHeaders(buyerToken.access),
  });
  expect(viewResp.status()).toBe(200);

  // Now verify the seller sees aggregated counts in the web UI
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('beebol.access', access);
    if (refresh) localStorage.setItem('beebol.refresh', refresh);
  }, { access: sellerToken.access, refresh: sellerToken.refresh });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  await page.goto(new URL('/my', WEB_ROOT).toString(), { waitUntil: 'networkidle' });

  await expect(page.getByText(title)).toBeVisible({ timeout: 60000 });

  // Exact numbers should be stable given the setup above.
  await expect(page.getByText(/Views:\s*[1-9]\d*\s*·\s*Messages:\s*2\s*·\s*Favorites:\s*1/i)).toBeVisible({
    timeout: 60000,
  });
});
