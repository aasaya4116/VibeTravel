# VibeTravel Mobile

Native Expo client for VibeTravel. It uses the same Supabase project as the web app and keeps the Vercel deployment as the API host.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the production Supabase URL and anonymous key.
3. Run `pnpm install` in this directory.
4. Run `pnpm start` and open the app in Expo Go or a development build.

## TestFlight setup

The provisional bundle identifier is `com.aasay.vibetravel`. Confirm it before the first Apple build; it is difficult to change after publishing.

1. Create or sign in to an Expo account.
2. Join the paid Apple Developer Program.
3. Run `pnpm dlx eas-cli login`.
4. Run `pnpm dlx eas-cli init` to attach an EAS project.
5. Add the three `EXPO_PUBLIC_*` values to the EAS production environment.
6. Run `pnpm dlx testflight` to build, sign, and upload the first internal TestFlight build.

The first signed build requires the Apple account holder to approve credentials and agreements. App Store review remains a separate manual promotion after TestFlight validation.
