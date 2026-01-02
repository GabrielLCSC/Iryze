# Tester l'Edge Function déployée

## Prérequis

Avant de tester, vous devez avoir:
1. ✅ Fonction déployée: `supabase functions deploy scan --no-verify-jwt`
2. ✅ Device API key et Device ID (depuis votre base de données)
3. ✅ Member ID (QR token) à tester

Pour obtenir ces valeurs:
```bash
# Depuis le projet principal
npx tsx scripts/list-devices.ts
npx tsx scripts/list-members.ts
```

## URL de votre fonction

Votre fonction est accessible à:
```
https://votre-project-ref.supabase.co/functions/v1/scan
```

Remplacez `votre-project-ref` par votre vrai project ref (visible dans l'URL de votre dashboard Supabase).

## Test avec curl

### Test 1: Scan réussi (membre avec membership active)

```bash
curl -X POST https://votre-project-ref.supabase.co/functions/v1/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: votre-device-api-key" \
  -d '{
    "qr_token": "member-uuid-ici",
    "device_id": "device-uuid-ici"
  }'
```

**Réponse attendue (200 OK):**
```json
{
  "allowed": true,
  "member": {
    "first_name": "Alice",
    "last_name": "Martin"
  },
  "membership": {
    "type": "annuel",
    "end_date": "2025-12-30"
  }
}
```

### Test 2: Scan refusé (membership expirée)

```bash
curl -X POST https://votre-project-ref.supabase.co/functions/v1/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: votre-device-api-key" \
  -d '{
    "qr_token": "member-avec-membership-expiree",
    "device_id": "device-uuid-ici"
  }'
```

**Réponse attendue (200 OK):**
```json
{
  "allowed": false,
  "reason": "membership_expired"
}
```

### Test 3: Erreur - API key manquante

```bash
curl -X POST https://votre-project-ref.supabase.co/functions/v1/scan \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "member-uuid-ici",
    "device_id": "device-uuid-ici"
  }'
```

**Réponse attendue (401 Unauthorized):**
```json
{
  "allowed": false,
  "reason": "unauthorized_device"
}
```

### Test 4: Erreur - Membre non trouvé

```bash
curl -X POST https://votre-project-ref.supabase.co/functions/v1/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: votre-device-api-key" \
  -d '{
    "qr_token": "00000000-0000-0000-0000-000000000000",
    "device_id": "device-uuid-ici"
  }'
```

**Réponse attendue (200 OK):**
```json
{
  "allowed": false,
  "reason": "member_not_found"
}
```

## Test avec le Hardware Client

Mettez à jour `hardware-client/.env`:

```env
API_URL=https://votre-project-ref.supabase.co/functions/v1/scan
DEVICE_API_KEY=votre-device-api-key
DEVICE_ID=votre-device-id
```

Puis testez:
```bash
cd hardware-client
npm run scan <member-id>
```

## Test avec Postman

1. **Method**: POST
2. **URL**: `https://votre-project-ref.supabase.co/functions/v1/scan`
3. **Headers**:
   - `Content-Type: application/json`
   - `x-api-key: votre-device-api-key`
4. **Body** (raw JSON):
   ```json
   {
     "qr_token": "member-uuid-ici",
     "device_id": "device-uuid-ici"
   }
   ```

## Vérifier les logs

Pour voir les logs de votre fonction en temps réel:

```bash
supabase functions logs scan --follow
```

Ou voir les logs récents:
```bash
supabase functions logs scan
```

## Script de test rapide

Créez un fichier `test-edge-function.sh`:

```bash
#!/bin/bash

# Configuration
PROJECT_REF="votre-project-ref"
API_KEY="votre-device-api-key"
DEVICE_ID="votre-device-id"
MEMBER_ID="member-uuid-ici"

# Test
curl -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/scan" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"qr_token\": \"${MEMBER_ID}\",
    \"device_id\": \"${DEVICE_ID}\"
  }" | jq

# jq formate le JSON (installez-le avec: brew install jq)
```

Rendez-le exécutable:
```bash
chmod +x test-edge-function.sh
./test-edge-function.sh
```

## Vérifier dans la base de données

Après chaque scan, vérifiez que l'événement est bien enregistré:

```sql
-- Voir les derniers scans
SELECT * FROM scans 
ORDER BY scan_time DESC 
LIMIT 10;

-- Voir les scans autorisés
SELECT * FROM scans 
WHERE status = 'allowed'
ORDER BY scan_time DESC;

-- Voir les scans refusés
SELECT * FROM scans 
WHERE status = 'denied'
ORDER BY scan_time DESC;
```

## Dépannage

**Erreur 401 "Missing authorization header"**
- ✅ Normal si vous accédez via navigateur (GET)
- ✅ Utilisez POST avec curl/Postman/hardware client

**Erreur 401 "unauthorized_device"**
- Vérifiez que le header `x-api-key` est présent
- Vérifiez que l'API key existe dans `scan_devices.api_key`

**Erreur 403 "device_mismatch"**
- Vérifiez que `device_id` dans le body correspond au device authentifié par `x-api-key`

**Erreur 500 "internal_error"**
- Vérifiez les logs: `supabase functions logs scan`
- Vérifiez que `SERVICE_ROLE_KEY` est bien configuré: `supabase secrets list`
