# Host Flowsy on Vercel and Neon

This setup uses Vercel Hobby for the NestJS API and the Neon database already created from the Vercel Marketplace. Vercel recognizes this repository's `src/main.ts` NestJS entry point. Production deployments generate Prisma Client, build the API, and apply checked-in Prisma migrations. Preview builds do not run migrations.

## 1. Import the GitHub repository into Vercel

1. In Vercel, choose **Add New → Project** and import `ziadayman00/flowsy-finance-tracker-app`.
2. Keep the project **Root Directory** at `.` (repository root). The backend `package.json` and `src/main.ts` are there; `mobile/` is only the Expo client.
3. Let Vercel detect NestJS. If it does not fill in the build command, set it to `pnpm vercel-build`. Leave Output Directory unset.
4. Create the project under your Hobby workspace and deploy after configuring its environment variables below.

## 2. Connect the Neon database

In the Neon Marketplace integration, choose **Connect to Project**, select the Vercel project you just imported, and enable the Production environment. The integration adds its pooled `DATABASE_URL` to that project. Keep the URL in Vercel environment variables; never put it in GitHub or share it in chat.

The app requires these Vercel environment variables in Production:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Added by the Neon integration (pooled connection) |
| `JWT_ACCESS_SECRET` | A private random value of at least 16 characters |
| `JWT_REFRESH_SECRET` | A different private random value of at least 16 characters |
| `CORS_ORIGIN` | Your Vercel API origin, e.g. `https://your-project.vercel.app` (no trailing slash) |

You can make two random secrets in PowerShell with `-join ((1..48 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))`. Run it separately for each JWT variable and paste the results directly into Vercel. Do not commit these values.

The API allows native mobile requests without an Origin header. `CORS_ORIGIN` is still required by the existing production configuration, so use the API's Vercel origin. Add any browser frontend origin later if one is introduced.

## 3. Deploy and check the API

Redeploy the project after the environment variables are saved. The production build applies the existing Prisma migrations. When it succeeds, open:

- `https://your-project.vercel.app/api/v1/health`
- `https://your-project.vercel.app/api/docs`

The production database starts empty. Do not run the development demo seed against it; users can register in the app and receive their normal starter data.

Vercel Hobby includes a free Functions allowance and pauses workloads after included limits are reached. Neon Free also has monthly storage and compute limits; both services may have cold starts after inactivity. See the current limits linked below.

## 4. Point the Android build at Vercel

Replace `REPLACE-WITH-VERCEL-DOMAIN` in both `EXPO_PUBLIC_API_URL` entries in `mobile/eas.json` with the Vercel project's actual hostname (omit `https://` in the placeholder portion). For example, if the API is `https://flowsy-api-abc.vercel.app`, the value should be `https://flowsy-api-abc.vercel.app/api/v1`.

Then, from PowerShell:

```powershell
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

EAS will ask to link this app to an Expo project and configure Android signing the first time. When the build finishes, open its URL on your Android phone and install the APK. Android may ask you to allow installs from the browser used to download it.

## References

- [Vercel NestJS deployment](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Hobby plan limits](https://vercel.com/docs/plans/hobby)
- [Neon free plan](https://neon.com/pricing)
