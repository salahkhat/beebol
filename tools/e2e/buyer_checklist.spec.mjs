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
  let lastStatus = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const tokenResp = await request.post(`${API_BASE}/api/v1/auth/token/`, {
      data: { username, password },
    });
    lastStatus = tokenResp.status();

    if (lastStatus === 200) {
      const token = await tokenResp.json();
      expect(token).toHaveProperty('access');
      return token;
    }

    if (lastStatus === 429) {
      const delayMs = Math.min(15000, 1000 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    break;
  }

  expect(lastStatus, 'token endpoint should succeed').toBe(200);
  return null;
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
  const p = path.resolve('backend/seed_images/beds/pexels-pixabay-164595.jpg');
  if (!fs.existsSync(p)) throw new Error(`Seed image not found: ${p}`);
  return p;
}

test('buyer checklist persists on thread', async ({ page, request, baseURL }) => {
  const ts = Date.now();
  const sellerUsername = `e2e_seller_check_${ts}`;
  const buyerUsername = `e2e_buyer_check_${ts}`;
  const password = 'TestPass123!';
  const staffUsername = process.env.E2E_STAFF_USERNAME || 'e2e_staff';
  const staffPassword = process.env.E2E_STAFF_PASSWORD || 'e2e_staff_pass';

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

  const WEB_ROOT = process.env.BASE_URL || baseURL || 'http://localhost:3000';
  const webResp = await request.get(WEB_ROOT);
  if (webResp.status() >= 400) throw new Error(`Web server not available at ${WEB_ROOT} (status ${webResp.status()})`);

  const catsResp = await request.get(`${API_BASE}/api/v1/categories/`);
  expect(catsResp.status()).toBe(200);
  const categories = asList(await catsResp.json());
  const categoryId = categories.length ? categories[0].id : null;
  expect(categoryId, 'Expected at least one seeded category').toBeTruthy();

  const govResp = await request.get(`${API_BASE}/api/v1/governorates/`);
  expect(govResp.status()).toBe(200);
  const governorates = asList(await govResp.json());
  const governorateId = governorates.length ? governorates[0].id : null;
  expect(governorateId, 'Expected at least one seeded governorate').toBeTruthy();

  const citiesResp = await request.get(`${API_BASE}/api/v1/cities/?governorate=${governorateId}`);
  expect(citiesResp.status()).toBe(200);
  const cities = asList(await citiesResp.json());
  const cityId = cities.length ? cities[0].id : null;
  expect(cityId, 'Expected at least one seeded city').toBeTruthy();

  const title = `E2E Checklist Listing ${ts}`;
  const createListing = await request.post(`${API_BASE}/api/v1/listings/`, {
    headers: authHeaders(sellerToken.access),
    data: {
      title,
      description: 'E2E listing for buyer checklist test.',
      price: '55',
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
  expect(createListing.status(), await createListing.text()).toBe(201);
  const listing = await createListing.json();
  const listingId = listing?.id;
  expect(listingId).toBeTruthy();

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

  const publishResp = await request.patch(`${API_BASE}/api/v1/listings/${listingId}/`, {
    headers: authHeaders(sellerToken.access),
    data: { status: 'published' },
  });
  expect(publishResp.status(), await publishResp.text()).toBe(200);

  const moderateResp = await request.post(`${API_BASE}/api/v1/listings/${listingId}/moderate/`, {
    headers: authHeaders(staffToken.access),
    data: { moderation_status: 'approved' },
  });
  expect(moderateResp.status(), await moderateResp.text()).toBe(200);

  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('beebol.access', access);
    if (refresh) localStorage.setItem('beebol.refresh', refresh);
  }, { access: buyerToken.access, refresh: buyerToken.refresh });

  await page.goto(new URL(`/listings/${listingId}`, WEB_ROOT).toString(), { waitUntil: 'networkidle' });
  await expect(page.getByText(title)).toBeVisible({ timeout: 60000 });

  // Start a thread.
  await page.getByRole('button', { name: /Message seller|راسل البائع|Login to message|سجّل الدخول للمراسلة/i }).click();
  await expect(page).toHaveURL(/\/threads\//, { timeout: 60000 });

  // Mark checklist item as done.
  await expect(page.getByText(/Buyer checklist|قائمة المشتري/i)).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: /Done|تم/i }).first().click();

  // Reload and ensure it stays completed.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: /Completed|مكتمل/i }).first()).toBeVisible({ timeout: 60000 });
});
