# App Store submission checklist

## Before the first TestFlight build

- [ ] Confirm the bundle identifier in `app.json`.
- [x] Link the Expo project with `eas init`.
- [x] Add production `EXPO_PUBLIC_*` variables in EAS.
- [x] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel for in-app account deletion.
- [x] Add the same tested mailbox as `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel and `EXPO_PUBLIC_SUPPORT_EMAIL` in the EAS production environment.
- [x] Add `vibetravel://reset-password` to Supabase Auth's allowed redirect URLs.
- [x] Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel.
- [ ] Verify protected APIs return `429` when their quota is exhausted.
- [x] Deploy the Privacy, Terms, Support, and account-deletion API changes.
- [x] Apply `scripts/013_harden_rls_policies.sql`, then run `scripts/verify_rls.sql` successfully against production Supabase.
- [ ] Test sign-up email links, password recovery, sign-in, session persistence, sign-out, cache erasure, and deletion on a physical iPhone.

## App Review information

- [ ] Provide a fully populated demo account with at least one generated trip.
- [ ] Keep the Vercel and Supabase backends available throughout review.
- [ ] Explain that VibeTravel is an adult-facing family trip planner, not a Kids Category app.
- [ ] Explain native utility: offline trip snapshots, Trip Mode, Apple Maps handoff, deep links, and iOS sharing.
- [ ] Complete the updated age-rating questionnaire.
- [ ] Add support URL: `/support`.
- [ ] Add privacy URL: `/privacy`.

## App Privacy answers to verify

VibeTravel may collect data linked to the user: email address, display name, family/traveler preferences, trip plans, saved places, app interactions, support messages, and AI chat content. It does not use this information for third-party advertising or cross-app tracking. Verify every integrated provider before answering App Store Connect's privacy questionnaire.

- [ ] Keep nonessential analytics, advertising pixels, and session replay disabled for launch. If introduced later, add an Accept/Reject preference layer before loading them.

## Release assets

- [x] Final 1024×1024 icon with no transparency.
- [ ] iPhone and iPad screenshots using fictional trip and traveler information.
- [x] App description, subtitle, keywords, promotional text, and review notes.
- [ ] TestFlight “What to Test” notes and support contact.
- [ ] Confirm the Explore tab loads destination imagery and Family Vibe reasons.
- [ ] Search a destination, save three verified places, and generate an itinerary natively.
- [ ] Confirm destination and attraction images fail gracefully on a slow connection.
