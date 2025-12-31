# Quick Testing Guide for /scan Endpoint

## What You Need to Test

The `/api/scan` endpoint requires two things from your database:

1. **Device API Key** - from `scan_devices.api_key` table
2. **Member ID** - from `members.id` table (this is the QR token)

## Quick Steps

### 1. Install Helper Tool (one-time)

```bash
npm install -D tsx
```

### 2. List Your Devices (Get API Key)

```bash
npx tsx scripts/list-devices.ts
```

This shows you:
- Device ID
- **API Key** (use in `x-api-key` header)
- Example curl command

### 3. List Your Members (Get QR Token)

```bash
npx tsx scripts/list-members.ts
```

This shows you:
- Member ID (this is the `qr_token`)
- Membership status

### 4. Test the Endpoint

Replace `YOUR_API_KEY`, `DEVICE_ID`, and `MEMBER_ID` with values from steps 2 & 3:

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "qr_token": "MEMBER_ID",
    "device_id": "DEVICE_ID"
  }'
```

## Example Response

**Success:**
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

**Failure:**
```json
{
  "allowed": false,
  "reason": "membership_expired"
}
```

## Need Test Data?

If you don't have any devices or members yet, see [TESTING.md](./TESTING.md) for full setup instructions.
