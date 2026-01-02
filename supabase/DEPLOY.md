# Guide de Déploiement - Supabase Edge Function

## Prérequis

1. **Installer Supabase CLI:**
   ```bash
   npm install -g supabase
   # ou
   brew install supabase/tap/supabase
   ```

2. **Se connecter à Supabase:**
   ```bash
   supabase login
   ```

3. **Lier votre projet:**
   ```bash
   supabase link --project-ref your-project-ref
   ```
   
   Pour trouver votre `project-ref`:
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet
   - L'URL sera: `https://supabase.com/dashboard/project/xxxxx`
   - Le `xxxxx` est votre `project-ref`

## Configuration des Secrets

⚠️ **Important**: Les secrets ne peuvent PAS commencer par `SUPABASE_` (réservé par Supabase).

Les Edge Functions ont automatiquement accès à:
- `SUPABASE_URL` - Disponible automatiquement ✅
- `SUPABASE_ANON_KEY` - Disponible automatiquement ✅

Vous devez définir manuellement:
```bash
# Définir le service role key (sans préfixe SUPABASE_)
supabase secrets set SERVICE_ROLE_KEY=your-service-role-key
```

**Où trouver la valeur:**
- Dashboard Supabase → Settings → API → `service_role` key (⚠️ gardez-la secrète!)

**Note**: `SUPABASE_URL` est automatiquement disponible, pas besoin de le définir.

## Déploiement

### Déployer la fonction `scan`:

**Option 1: Utiliser le flag (recommandé)**
```bash
# Depuis la racine du projet
cd /path/to/qr-check

# Déployer sans vérification JWT (on utilise x-api-key à la place)
supabase functions deploy scan --no-verify-jwt
```

**Option 2: Utiliser config.toml**
Le fichier `supabase/config.toml` contient déjà la configuration `verify_jwt = false`.
Dans ce cas, vous pouvez simplement déployer:
```bash
supabase functions deploy scan
```

**Important**: Le flag `--no-verify-jwt` ou la config `verify_jwt = false` désactive la vérification JWT par défaut de Supabase, car nous utilisons notre propre authentification via le header `x-api-key`.

**Ce que fait cette commande:**
- ✅ Compile le code TypeScript/Deno
- ✅ Upload le code vers Supabase
- ✅ Configure les secrets (variables d'environnement)
- ✅ Active la fonction sur l'edge

### Vérifier le déploiement:

```bash
# Lister les fonctions déployées
supabase functions list

# Voir les logs
supabase functions logs scan
```

## URL de la fonction déployée

Après le déploiement, votre fonction sera accessible à:

```
https://your-project-ref.supabase.co/functions/v1/scan
```

## Mettre à jour le Hardware Client

Une fois déployé, mettez à jour `hardware-client/.env`:

```env
API_URL=https://your-project-ref.supabase.co/functions/v1/scan
```

## Test Local (Optionnel)

Avant de déployer, vous pouvez tester localement:

```bash
# Démarrer Supabase localement (si vous avez un setup local)
supabase start

# Servir la fonction localement (sans JWT)
supabase functions serve scan --no-verify-jwt

# Tester (pas besoin de header Authorization)
curl -X POST http://localhost:54321/functions/v1/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-device-api-key" \
  -d '{"qr_token": "...", "device_id": "..."}'
```

## Tester la fonction déployée

Voir le guide complet: [TEST.md](./TEST.md)

**Test rapide avec curl:**
```bash
curl -X POST https://votre-project-ref.supabase.co/functions/v1/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: votre-device-api-key" \
  -d '{
    "qr_token": "member-uuid-ici",
    "device_id": "device-uuid-ici"
  }'
```

**Accès via navigateur:**
⚠️ Si vous accédez à l'URL dans un navigateur, vous obtiendrez une erreur 401 "Missing authorization header". C'est normal - la fonction nécessite:
- Un header `x-api-key` avec votre device API key
- Une requête POST avec le body JSON

Pour tester, utilisez plutôt:
- curl (voir ci-dessus)
- Postman
- Le hardware client (voir [TEST.md](./TEST.md))

## Commandes Utiles

```bash
# Déployer une fonction spécifique
supabase functions deploy scan

# Déployer toutes les fonctions
supabase functions deploy

# Voir les logs en temps réel
supabase functions logs scan --follow

# Supprimer une fonction
supabase functions delete scan

# Voir les secrets configurés
supabase secrets list
```

## Dépannage

**Erreur: "Not logged in"**
```bash
supabase login
```

**Erreur: "Project not linked"**
```bash
supabase link --project-ref your-project-ref
```

**Erreur: "Function not found"**
- Vérifiez que le dossier `supabase/functions/scan/` existe
- Vérifiez que `index.ts` existe dans ce dossier

**Erreur: "Environment variables not set"**
```bash
# Seul SERVICE_ROLE_KEY doit être défini (SUPABASE_URL est automatique)
supabase secrets set SERVICE_ROLE_KEY=your-service-role-key
```
