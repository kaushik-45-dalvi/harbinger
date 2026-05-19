# Harbinger Web Deploy

Harbinger is configured as an Expo web app. It does not need Play Store deployment for web use.

## Build

```bash
npm install
npm run build:web
```

The production files are exported to `dist/`.

## Deploy Options

### Vercel

Import the repository into Vercel. The included `vercel.json` sets:

- Build command: `npx expo export --platform web`
- Output directory: `dist`
- SPA fallback: `/index.html`

### Netlify

Import the repository into Netlify. The included `netlify.toml` sets the same build and fallback.

## Data

User data is stored locally on the user's device/browser with AsyncStorage:

- profile name
- vitals
- workouts
- records
- goals
- theme

This means data survives reloads and normal app restarts on the same device. A backend account API can be added later if you need cloud sync across multiple devices.
