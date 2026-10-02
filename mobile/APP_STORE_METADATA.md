# VibeTravel App Store metadata

## Listing

- **App name:** VibeTravel
- **Primary category:** Travel
- **Secondary category:** Lifestyle
- **Subtitle:** Family trips, made for you
- **Support URL:** https://vibe-travel-six.vercel.app/support
- **Privacy policy URL:** https://vibe-travel-six.vercel.app/privacy
- **Terms URL:** https://vibe-travel-six.vercel.app/terms

## Promotional text

Turn your family's interests, pace, and practical needs into a trip plan that feels personal—and keep it close at hand while you travel.

## Description

VibeTravel helps families plan trips around the way they actually like to travel.

Create your Family Vibe with the interests, pace, food preferences, and practical needs that matter to your crew. VibeTravel uses that context to organize destinations and itineraries that feel more personal than a generic list of attractions.

PLAN AROUND YOUR FAMILY

Keep your family's travel style and preferred pace at the center of the plan. See why itinerary stops fit your crew and spot days that may feel too busy.

KEEP EVERY DAY ORGANIZED

Open a trip to view each day's schedule, stop details, dates, and family-fit notes in one place. Recently opened trips remain available when your connection is unreliable.

USE TRIP MODE ON THE GO

Move through the day one stop at a time. Open directions in Maps, mark stops complete, or skip something when plans change.

SHARE THE PLAN

Send a private trip link to family members without exposing account details, readiness information, costs, or private booking information.

VibeTravel is designed for adults planning family travel. Recommendations, schedules, prices, opening hours, weather, and accessibility information can change; verify important details directly with the venue or provider.

## Keywords

family travel,trip planner,itinerary,vacation,kids,travel planning,offline,places

## TestFlight: What to Test

Please focus on the complete trip-day experience:

1. Sign in or create an account and confirm the session persists after relaunching the app.
2. Create a trip and confirm it appears on Today and Trips.
3. Open a planned trip, switch between itinerary days, and review family-fit notes.
4. Start Trip Mode, open directions, then mark a stop complete or skipped.
5. Open a trip while online, disable the network, relaunch the app, and confirm the recently opened trip remains available.
6. Share a trip and confirm the private link opens only the intended itinerary information.
7. Review Privacy, Terms, and Support from Profile.
8. Test account deletion only with a disposable test account.

When reporting an issue, include the device model, iOS version, trip name, the action taken, and the result you expected. Never include passwords or booking confirmation codes.

## App Review notes

VibeTravel is an adult-facing family trip planner and is not intended for the Kids Category. Adults may enter limited family information, such as children's first names, ages, dietary needs, sensory needs, and mobility notes, to personalize recommendations.

The app shares its Supabase account and trip data with the VibeTravel web planner. Native users can browse destinations, search verified places, save them to trips, generate personalized itineraries, use offline trip snapshots and Trip Mode, open Maps directions, share plans, and manage their account. A small number of profile-management actions may open the production web experience.

Use the review account below. It contains a populated Family Vibe and at least one multi-day trip with a generated itinerary.

- **Review email:** [ADD REVIEW ACCOUNT EMAIL]
- **Review password:** [ADD REVIEW ACCOUNT PASSWORD IN APP STORE CONNECT ONLY]
- **Sample trip:** [ADD SAMPLE TRIP NAME]

Account deletion is available in **Profile → Delete account**. This permanently removes the user's account and associated VibeTravel data.

## Screenshot plan

Use fictional traveler and trip information in every screenshot.

1. **Today:** upcoming-trip hero with readiness progress.
2. **Family fit:** personalized travel-style chips and a concise reason a stop fits.
3. **Itinerary:** one day with three or four stops and family-fit signals.
4. **Trip Mode:** the current stop with Directions, Skip, and Complete actions.
5. **Offline access:** a cached trip with the offline banner visible.
6. **Trips:** upcoming and active trips in a clean list.

## Before submission

- Replace the review-account placeholders in App Store Connect; do not commit credentials here.
- Configure and test a public support mailbox, then set `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel.
- Verify the live Supabase project has RLS enabled and owner-scoped policies on every user-data table.
- Complete the App Privacy questionnaire against every production provider and SDK.
- Capture final iPhone and iPad screenshots from the signed build.
