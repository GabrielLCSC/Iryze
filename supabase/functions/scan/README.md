# Supabase Edge Function - Scan Endpoint

This Edge Function handles QR code scans from hardware devices. It's deployed independently from the Next.js dashboard.

## Architecture

```
Hardware Client → Supabase Edge Function → PostgreSQL
                (This function)
```

## Setup

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Link to your Supabase project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Set environment variables:**
   ```bash
   # SUPABASE_URL is automatically available - no need to set it
   # Only set the service role key (without SUPABASE_ prefix)
   supabase secrets set SERVICE_ROLE_KEY=your-service-role-key
   ```

   ⚠️ **Note**: Secrets cannot start with `SUPABASE_` (reserved by Supabase).
   
   For local development, you can use `.env` file:
   ```env
   SERVICE_ROLE_KEY=your-service-role-key
   ```

## Deployment

```bash
# Deploy the function without JWT verification (we use x-api-key instead)
supabase functions deploy scan --no-verify-jwt

# Or deploy with specific project
supabase functions deploy scan --project-ref your-project-ref --no-verify-jwt
```

**Important**: Use `--no-verify-jwt` flag because we authenticate devices via `x-api-key` header, not JWT tokens.

## Usage

The function is accessible at:
```
https://your-project-ref.supabase.co/functions/v1/scan
```

Update your hardware client `.env`:
```env
API_URL=https://your-project-ref.supabase.co/functions/v1/scan
```

## Local Development

```bash
# Start local Supabase (if using local setup)
supabase start

# Serve function locally
supabase functions serve scan

# Test locally
curl -X POST http://localhost:54321/functions/v1/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-device-api-key" \
  -d '{"qr_token": "...", "device_id": "..."}'
```

## Advantages over Next.js API Route

- ✅ **Isolated**: Completely separate from dashboard
- ✅ **Edge deployment**: Low latency globally
- ✅ **Service role**: Direct database access (bypasses RLS)
- ✅ **Scalable**: Independent scaling
- ✅ **No Next.js dependency**: Can update dashboard without affecting scan logic

## Migration from Next.js

1. Deploy this Edge Function
2. Update hardware client `API_URL` to point to Edge Function
3. Optionally keep Next.js route for backward compatibility or remove it
