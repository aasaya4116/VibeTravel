# App Store submission checklist

## Before the first TestFlight build

- [ ] Confirm the bundle identifier in `app.json`.
- [ ] Link the Expo project with `eas init`.
- [ ] Add production `EXPO_PUBLIC_*` variables in EAS.
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel for in-app account deletion.
- [ ] Add `NEXT_PUBLIC_SUPPORT_EMAIL` to Vercel and confirm that mailbox works.
- [ ] Deploy the Privacy, Terms, Support, and account-deletion API changes.
- [ ] Confirm every Supabase table has owner-scoped RLS.
- [ ] Test sign-up email links, sign-in, session persistence, sign-out, and deletion on a physical iPhone.

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

## Release assets

- [ ] Final 1024×1024 icon with no transparency.
- [ ] iPhone and iPad screenshots using fictional trip and traveler information.
- [ ] App description, subtitle, keywords, promotional text, and review notes.
- [ ] TestFlight “What to Test” notes and support contact.
