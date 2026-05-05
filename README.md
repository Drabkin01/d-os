# D-OS — Digital Operating System

Personal life RPG tracker for Liam Drabkin.

## Run Locally

```bash
cd ~/Developer/personal/d-os
open index.html
```

Or with a local server (required for Google API):
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Google API Setup (10 mins — needed for Drive sync + Calendar)

### 1. Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click **New Project** → name it `D-OS Personal` → Create
3. Make sure the new project is selected in the top dropdown

### 2. Enable APIs
1. Go to **APIs & Services → Library**
2. Search and enable: **Google Drive API**
3. Search and enable: **Google Calendar API**

### 3. Create OAuth 2.0 Credentials
1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - User Type: **External**
   - App name: `D-OS`
   - Support email: your Gmail
   - Scopes: add `drive.appdata` and `calendar.readonly`
   - Test users: add your own Gmail
4. Back to Create Credentials → OAuth client ID:
   - Application type: **Web application**
   - Name: `D-OS Local`
   - Authorised JavaScript origins: `http://localhost:8080`
   - Authorised redirect URIs: `http://localhost:8080`
5. Click **Create** — copy the **Client ID**

### 4. Add Client ID to App
Open `js/google-api.js` and replace:
```js
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
```
with your actual Client ID.

### 5. Add Google Identity Script to index.html (before closing </body>)
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### 6. Test
Run `python3 -m http.server 8080`, open http://localhost:8080, tap the ⟳ sync button.

---

## Character Tier System

| Tier | Avg Level | Unlocks |
|------|-----------|---------|
| 0    | 1–4       | Bare skeleton |
| 1    | 5–9       | Basic suit + trousers |
| 2    | 10–14     | Full suit, shirt, tie |
| 3    | 15–19     | Wide-brim hat + leather gloves |
| 4    | 20–24     | Pocket square, gold cane, dress shoes |
| 5    | 25+       | Glowing blue eyes, gold trim, legendary |

Use the **Dev Panel** (bottom-right corner) to preview all tiers without grinding XP.

---

## XP Sources

| Activity | XP | Stat |
|----------|----|------|
| Log workout | 25 | Health |
| Log expense | 0 | — (tracks behaviour) |
| Add to emergency fund | 10 | Finances |
| Capture a note | 10 | Intelligence |
| Complete a book | 50 | Intelligence |
| Complete cert | 200 | Intelligence |
| Log project time | 15/hr | Work |
| Add ticket | 5 | Work |

---

## Build Phases

- [x] Phase 1 — Skeleton dashboard + character system + all 4 stat views
- [ ] Phase 2 — Workout charts, weight trend graph, grocery list
- [ ] Phase 3 — Finance insights (Caleb Hammer mode), category charts
- [ ] Phase 4 — Intelligence: book notes, topic graph, AWS study timer
- [ ] Phase 5 — Google Drive sync + Calendar integration
- [ ] Phase 6 — AI insights (Claude API per stat)
- [ ] Phase 7 — Flutter mobile app (iOS via Apple Developer account)

---

## Data Location

All data stored in `localStorage` under keys: `dos_character`, `dos_health`, `dos_finances`, `dos_intelligence`, `dos_work`.

Future: mirrors to `Google Drive/03-AI/Claude/d-os-data/*.json` once OAuth is configured.
