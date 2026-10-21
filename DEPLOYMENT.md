# Flowsy deployment and Android APK

This project is prepared for a free Render API, a free Neon PostgreSQL database, and an installable Android APK with Expo EAS.

## 1. Deploy the API and database

The Render Blueprint is in `render.yaml`. It creates a Frankfurt free API service, asks you to provide `DATABASE_URL`, generates strong JWT secrets, applies Prisma migrations before starting the API, and checks `/api/v1/health`.

Use Neon Free for PostgreSQL. Render's free Postgres expires after 30 days, so this setup keeps the database on Neon instead. Neon currently includes 1 GB storage and 100 compute-hours per project each month. Its free compute scales to zero when idle, so the first database request after a while can take longer. Render's free API also spins down after 15 minutes without requests and can take about a minute to wake. This is a no-card setup for personal testing, with cold starts and free-tier limits.

1. Create a Neon project on its Free plan and choose a region near Frankfurt if available.
2. In Neon **Connect**, choose the pooled connection and copy its connection string. Keep it private; it contains the database password.
3. In Render, choose **New → Blueprint**, connect this repository, and select its `render.yaml`.
4. When Render asks for `DATABASE_URL`, paste the Neon pooled connection string. Let Render generate both JWT secrets; do not use local `.env` values.
5. Wait for the deploy to finish. Check `https://flowsy-api.onrender.com/api/v1/health` and `/api/docs`.

If Render assigns a different public hostname, update `CORS_ORIGIN` in Render and the API URL in `mobile/eas.json` to match it. Never share the Neon URL in chat or commit it to GitHub.

The production database starts empty. Do not run the development demo seed against it; users can register in the app and receive their normal starter data.

## 2. Build an installable APK

The `preview` EAS profile produces an internal Android APK and points it at the hosted API. The app name and Android package identifier are set to Flowsy values.

From PowerShell:

```powershell
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

EAS will ask to link this app to an Expo project and configure Android signing the first time. After the cloud build finishes, open the build URL on your Android phone and install the APK. Android may ask you to allow installs from the browser used to download it.

For later builds, use the same build command. EAS stores the signing credentials for this Expo project so installed updates keep the same app identity.

## 3. Local development

The production API URL is set only in the EAS profiles. Local Expo development continues to use the existing LAN/emulator URL fallback unless `EXPO_PUBLIC_API_URL` is set in `mobile/.env`.
