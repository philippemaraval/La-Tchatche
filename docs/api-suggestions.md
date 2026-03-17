# API Suggestions (Edge)

Endpoint Cloudflare Pages Function:

- `POST /api/suggestions`
- `OPTIONS /api/suggestions` (preflight CORS)

## Requete

Headers:

- `Content-Type: application/json`

Body JSON:

```json
{
  "name": "string (requis)",
  "email": "string (optionnel)",
  "category": "string (requis)",
  "location": "string (requis)",
  "pitch": "string (requis)"
}
```

Regles:

- champs requis: `name`, `category`, `location`, `pitch`
- normalisation: trim + reduction des espaces multiples
- limitation de longueur:
  - `name`: 120
  - `email`: 254
  - `category`: 80
  - `location`: 180
  - `pitch`: 2000
- `email` valide si present (regex basique)

## Reponses

Succes `201`:

```json
{
  "ok": true,
  "data": {
    "id": "sugg_xxx",
    "createdAt": "2026-03-17T14:55:00.000Z"
  },
  "storage": {
    "mode": "d1|kv|memory",
    "warning": "string|null"
  }
}
```

Erreurs:

- `400` `invalid_json`
- `403` `forbidden_origin`
- `405` `method_not_allowed`
- `422` `validation_error` (+ `details`)

## CORS

- origine autorisee: meme origine uniquement (`Origin` == origine de la requete)
- headers:
  - `Access-Control-Allow-Origin`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`

## Stockage (cascade)

1. D1 via binding `env.DB` (table `suggestions` attendue)
2. KV via binding `env.SUGGESTIONS_KV`
3. Memoire process (fallback de secours)

Limites fallback memoire:

- volatile (perte possible au redemarrage/isolation)
- non partage entre instances edge
- capacite locale limitee (buffer interne 500 items)
