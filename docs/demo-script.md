# Loom Demo Script - Mirakl Connect

Target duration: 5 minutes.

## Recording Flow

| Time | Screen | Action | Voiceover |
| --- | --- | --- | --- |
| 00:00-00:25 | `/dashboard` | Start on the global dashboard. Do not open chat yet. | "Managing marketplaces is often complex. The tools are powerful, but they are usually difficult to use and not adapted to different kinds of users. With Mirakl Connect, we made a different choice: a platform that is simple, flexible, and intelligent, and that adapts to the user rather than the other way around." |
| 00:25-00:55 | `/onboarding`, then sidebar | Quickly show onboarding/profile discovery, then return to navigation. | "Everything starts with onboarding. The platform does not offer a one-size-fits-all experience. It adapts to the user's profile, whether they are a solo seller or a large brand, and configures a relevant environment automatically." |
| 00:55-01:20 | Sidebar and dashboard | Move through the menu slowly. Keep LEIA closed. | "The goal is to show only what is useful, without unnecessary complexity. Intelligence is present, but it is not intrusive. There are no pop-ups and no overwhelming assistant. AI works in the background to guide and simplify decisions." |
| 01:20-02:00 | `/dashboard` | Point to orders, revenue, stock, pending/handled decisions, and suggestions. | "Once connected, users land on a clear dashboard. Key metrics are immediately visible: orders, stock, performance, and decision signals. Each element is designed to be understood quickly, without navigating through multiple layers. Suggestions support decision-making when they are useful." |
| 02:00-02:45 | `/marketplaces/proposals` | Open Marketplaces > Opportunities. Show connected marketplaces and new proposals. | "All marketplace opportunities are centralized in one place. Users can track channels, status, potential reach, and revenue. Mirakl Connect also suggests new expansion opportunities directly, so users no longer need to search for them manually." |
| 02:45-03:30 | `/marketplaces/active-connection?partner=Darty` | Click/message Darty from proposals or open the Darty conversation. | "Integrating a new marketplace is usually long and technical. Here, it becomes simple and guided. The user can interact directly, validate the proposal, and stay supported at every step. The platform analyzes compatibility and prepares the necessary elements for integration." |
| 03:30-04:00 | `/marketplaces/active-connection` | Show active marketplace cards and Shopify connection area. | "Once connections are active, everything can be managed from one place. Performance, revenue, status, and key data are clearly displayed. Each connection becomes a simple, actionable module." |
| 04:00-04:25 | `/orders` | Show centralized order list, statuses, and filters. | "Orders are centralized regardless of the marketplace. Statuses are easy to read, filters are simple to use, and the operational experience stays smooth and efficient." |
| 04:25-04:50 | `/dashboard`, sidebar, App Store if useful | Return to the global view and briefly show customizable navigation/plugins. | "The real strength of Mirakl Connect is flexibility. A solo seller can keep a simple, streamlined interface. A large brand can unlock more advanced features. Users are not forced into a fixed tool; they build an environment that fits their needs." |
| 04:50-05:00 | `/dashboard` | End on the clean global dashboard. | "Mirakl Connect is simple to use, intelligent but discreet, and fully adaptable. It helps users manage, monitor, and grow their marketplace activity more efficiently." |

## Presenter Notes

- Keep LEIA visible but mostly closed until the Darty proposal sequence, so the "invisible AI" positioning feels true.
- Use the sidebar labels: Dashboard, Marketplaces, Opportunities, Channels, Orders, App Store, and Settings.
- If a page is still compiling during the Loom, pause briefly on the dashboard rather than narrating over a loading state.
- Avoid diving into governance, stock, radar, or calendar in this recording; those are strong features, but they distract from the Mirakl Connect platform story.

## Route Checklist

- `http://localhost:3000/dashboard`
- `http://localhost:3000/onboarding`
- `http://localhost:3000/marketplaces/proposals`
- `http://localhost:3000/marketplaces/active-connection?partner=Darty`
- `http://localhost:3000/orders`
- `http://localhost:3000/app-store`
