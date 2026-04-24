# Calendar

The calendar centralizes events that can affect operations, stock, logistics, marketing, or commercial posture.

## Purpose

The feature tracks:

- public holidays
- commercial periods
- sensitive logistics windows
- user leave and vacation periods
- internal events
- events created manually from the UI

## Entry Points

Navigation entries:

- Sidebar: Calendar
- URL: `/calendar`
- API: `/api/calendar-events`

## Data Model

Table used:

`public.calendar_events`

Important columns:

- `id`
- `user_id`
- `title`
- `start_at`
- `end_at`
- `kind`
- `impact`
- `zone`
- `notes`
- `locked`
- `created_at`
- `updated_at`

Dates are stored as Supabase timestamps:

- `start_at`: event start
- `end_at`: event end
- `created_at`: creation timestamp
- `updated_at`: last update timestamp

For all-day events, the API stores `12:00` as a technical value to avoid timezone date shifts. In the UI, those events still render as all-day events.

## API

List events:

`GET /api/calendar-events`

Create an event:

`POST /api/calendar-events`

Update an event:

`PATCH /api/calendar-events/[id]`

Delete an event:

`DELETE /api/calendar-events/[id]`

The API uses:

- `getCurrentUserId()` to isolate user data
- Zod input validation
- Prisma parameterized SQL queries against `public.calendar_events`

The API intentionally uses `prisma.$queryRaw` and `prisma.$executeRaw` instead of the typed `prisma.calendarEvent` delegate. This avoids requiring every teammate to regenerate the Prisma client immediately after pulling a calendar-only change.

## Event Types

Supported event kinds:

- `holiday`
- `commerce`
- `logistics`
- `leave`
- `internal`

Supported impact levels:

- `low`
- `medium`
- `high`
- `critical`

## Seeded Events

If the Supabase table is empty for the current user, the client seeds initial demo events.

Seeded coverage includes:

- France 2026 public holidays
- Black Friday
- Cyber Monday
- Chinese New Year
- Ramadan and Eid al-Fitr
- Mother's Day and Father's Day
- Back to School
- summer sales
- Christmas and post-Christmas returns

These events support demo scenarios where Leia anticipates commercial, stock, transport, and support impacts.

## UI Behavior

The UI supports:

- selecting a day
- double-clicking a day to prefill event creation
- creating an event
- editing the selected event
- deleting an event
- moving an event with drag and drop
- showing multi-day events on each affected day
- visually filtering event type through color

Every persistent user action writes immediately to the database:

- creation: `POST`
- edit: `PATCH`
- drag and drop move: `PATCH`
- deletion: `DELETE`

If an API call fails, the UI shows an error and attempts to return optimistic changes to the previous state.

## Display Rules

The requested UI date display is:

`31/12/2026`

Dates sent to the API use the same technical format before the API converts them to Supabase timestamps.

## Leia Integration

The calendar acts as a context layer for Leia.

Potential agent use cases:

- read upcoming events
- detect risky logistics periods
- connect loss spikes to Black Friday or Christmas
- anticipate supplier disruption around Chinese New Year
- propose stock or transport adjustments based on events
- create operational events automatically

## Safety Notes

- Do not modify existing seed event IDs without a reason.
- Do not delete `calendar_events` during database push operations.
- Locked events (`locked = true`) are reference events, but agents can still read them.
- The calendar table is shared in Supabase: local UI changes write to the real database.
- The calendar no longer depends on an external calendar package. It is custom React/CSS to avoid adding another package requirement.

## Quick Verification

1. Open `/calendar`.
2. Create an event.
3. Confirm it appears in Supabase table `calendar_events`.
4. Move it with drag and drop.
5. Confirm `start_at` and `end_at` change in the database.
