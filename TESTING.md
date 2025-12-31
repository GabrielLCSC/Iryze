# Testing the /scan Endpoint

This guide explains how to test the `/api/scan` endpoint with real data.

## What is `YOUR_DEVICE_API_KEY`?

The `YOUR_DEVICE_API_KEY` is the `api_key` field from the `scan_devices` table in your database. Each scan device has a unique API key that authenticates it when making scan requests.

**To get your API key:**
1. Query your database: `SELECT id, api_key FROM scan_devices;`
2. Or use the helper script: `npx tsx scripts/list-devices.ts`
3. Or use Prisma Studio: `npx prisma studio`

## Quick Start - Helper Scripts

We've created helper scripts to make testing easier:

```bash
# List all scan devices and their API keys
npx tsx scripts/list-devices.ts

# List all members (to get member IDs for qr_token)
npx tsx scripts/list-members.ts

# Create test data (requires existing users in auth.users)
npx tsx scripts/test-scan.ts
```

## Prerequisites

Before testing, you need to set up test data in your database. The scan endpoint requires:

1. **A gym owner** (user in `auth.users` + entry in `gym_owners`)
2. **A gym** (linked to the owner)
3. **A gym area** (linked to the gym)
4. **A scan device** (with an `api_key` - this is YOUR_DEVICE_API_KEY)
5. **A member** (user in `auth.users` + entry in `members`)
6. **An active membership** (valid date range)

## Step-by-Step Testing Guide

### Step 1: Check Existing Data

First, see what devices and members you already have:

```bash
# List devices (shows API keys)
npx tsx scripts/list-devices.ts

# List members (shows member IDs)
npx tsx scripts/list-members.ts
```

If you have existing data, you can use those values directly. If not, continue to Step 2.

### Step 2: Create Test Data (if needed)

If you don't have test data yet, you can:

**Option A: Use the test script** (recommended for quick testing)
```bash
npx tsx scripts/test-scan.ts
```

**Note**: The script will create most of the data, but you'll need to create users in `auth.users` first (via Supabase Auth) and update the user IDs in the script.

**Option B: Manual setup** (see "Manual Setup" section below)

## Manual Setup (Alternative)

If you prefer to set up data manually or via SQL:

### Step 1: Create Users (via Supabase Auth)

Create two users in your Supabase Auth:
- One for the gym owner
- One for the member

Save their user IDs (UUIDs).

### Step 2: Create Database Records

Using Prisma Studio, Supabase Dashboard, or SQL:

1. **Gym Owner**
   ```sql
   INSERT INTO public.gym_owners (id) 
   VALUES ('your-owner-user-id-here');
   ```

2. **Gym**
   ```sql
   INSERT INTO public.gyms (id, owner_id, name, address)
   VALUES (
     gen_random_uuid(),
     'your-owner-user-id-here',
     'Test Gym',
     '123 Test Street'
   );
   ```

3. **Gym Area**
   ```sql
   INSERT INTO public.gym_areas (id, gym_id, name)
   VALUES (
     gen_random_uuid(),
     'your-gym-id-here',
     'Main Entrance'
   );
   ```

4. **Scan Device** (⚠️ **Save the api_key!**)
   ```sql
   INSERT INTO public.scan_devices (id, gym_area_id, name, api_key)
   VALUES (
     gen_random_uuid(),
     'your-gym-area-id-here',
     'Test Scanner',
     'test_api_key_' || substr(md5(random()::text), 0, 20)
   )
   RETURNING id, api_key;
   ```

5. **Member** (member.id must match the user.id from auth.users)
   ```sql
   INSERT INTO public.members (id, gym_id, first_name, last_name)
   VALUES (
     'your-member-user-id-here',
     'your-gym-id-here',
     'Alex',
     'Martin'
   );
   ```

6. **Active Membership**
   ```sql
   INSERT INTO public.memberships (id, member_id, start_date, end_date, type)
   VALUES (
     gen_random_uuid(),
     'your-member-user-id-here',
     CURRENT_DATE,
     CURRENT_DATE + INTERVAL '1 month',
     'mensuel'
   );
   ```

### Step 3: Get Your API Key and Device ID

**Easiest way:**
```bash
npx tsx scripts/list-devices.ts
```

This will show you all devices with their:
- `ID` → use as `device_id` in the request
- `API Key` → use in the `x-api-key` header
- Example curl command ready to use

**Or query directly:**
```sql
SELECT id, api_key, name 
FROM public.scan_devices;
```

**Save both the `id` (device_id) and `api_key`** - you'll need them for testing!

## Testing the Endpoint

### Test 1: Successful Scan (Member with Active Membership)

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_DEVICE_API_KEY_HERE" \
  -d '{
    "qr_token": "MEMBER_UUID_HERE",
    "device_id": "DEVICE_UUID_HERE"
  }'
```

**Expected Response (200 OK):**
```json
{
  "allowed": true,
  "member": {
    "first_name": "Alex",
    "last_name": "Martin"
  },
  "membership": {
    "type": "mensuel",
    "end_date": "2025-02-15"
  }
}
```

### Test 2: Failed Scan (Missing API Key)

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "MEMBER_UUID_HERE",
    "device_id": "DEVICE_UUID_HERE"
  }'
```

**Expected Response (401 Unauthorized):**
```json
{
  "allowed": false,
  "reason": "unauthorized_device"
}
```

### Test 3: Failed Scan (Invalid API Key)

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: invalid_key" \
  -d '{
    "qr_token": "MEMBER_UUID_HERE",
    "device_id": "DEVICE_UUID_HERE"
  }'
```

**Expected Response (401 Unauthorized):**
```json
{
  "allowed": false,
  "reason": "invalid_device"
}
```

### Test 4: Failed Scan (Member Not Found)

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_DEVICE_API_KEY_HERE" \
  -d '{
    "qr_token": "00000000-0000-0000-0000-000000000000",
    "device_id": "DEVICE_UUID_HERE"
  }'
```

**Expected Response (200 OK):**
```json
{
  "allowed": false,
  "reason": "member_not_found"
}
```

### Test 5: Failed Scan (Expired Membership)

To test this, either:
- Create a membership with `end_date` in the past, OR
- Temporarily modify an existing membership's `end_date` to yesterday

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_DEVICE_API_KEY_HERE" \
  -d '{
    "qr_token": "MEMBER_UUID_WITH_EXPIRED_MEMBERSHIP",
    "device_id": "DEVICE_UUID_HERE"
  }'
```

**Expected Response (200 OK):**
```json
{
  "allowed": false,
  "reason": "membership_expired"
}
```

## Using Postman

1. **Method**: POST
2. **URL**: `http://localhost:3000/api/scan`
3. **Headers**:
   - `Content-Type: application/json`
   - `x-api-key: YOUR_DEVICE_API_KEY_HERE`
4. **Body** (raw JSON):
   ```json
   {
     "qr_token": "MEMBER_UUID_HERE",
     "device_id": "DEVICE_UUID_HERE"
   }
   ```

## Verification

After each scan (successful or failed), check the `scans` table:

```sql
SELECT * FROM public.scans 
ORDER BY scan_time DESC 
LIMIT 10;
```

You should see:
- `status`: "allowed" or "denied"
- `reason`: null (for allowed) or reason string (for denied)
- `member_id`: the member's UUID (if member was found)
- `device_id`: the device UUID
- `scan_time`: timestamp of the scan

Also check that `scan_devices.last_seen_at` is updated after each scan.

## Troubleshooting

### "unauthorized_device"
- Make sure the `x-api-key` header is present
- Check that the API key exists in `scan_devices.api_key`

### "invalid_device"
- The API key doesn't match any device in the database
- Verify the API key in `scan_devices` table

### "device_mismatch"
- The `device_id` in the request body doesn't match the device authenticated by the API key
- Make sure you're using the correct `device_id` that corresponds to the `api_key`

### "member_not_found"
- The `qr_token` (member ID) doesn't exist in the `members` table
- Verify the member exists: `SELECT * FROM public.members WHERE id = 'your-qr-token'`

### "membership_expired"
- The member exists but has no active membership
- Check memberships: `SELECT * FROM public.memberships WHERE member_id = 'member-id'`
- Verify date range: `start_date <= today AND end_date >= today`
