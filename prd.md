# Merchant Ops Copilot PRD

## Product Summary
Merchant Ops Copilot is a web application for merchants who need one place to manage stock, transport, and operational planning. The product combines structured operations data with an explainable AI copilot that can answer questions, surface risks, and prepare actions for approval.

The MVP is built on top of the existing stock, WMS, parcel, and settings workspace. It adds a merchant-owned AI layer, a recommendation and approval workflow, and a planning system informed by business calendar events and external context gathered through n8n.

## Problem
Merchants operate in fragmented tools and spreadsheets. Stock visibility, shipping issues, supplier lead times, and external demand signals are often handled manually. This creates a few recurring failures:

- Low stock is discovered too late.
- Shipping delays are handled reactively.
- Business absences are not reflected in planning.
- News, public holidays, supplier disruption, and seasonal demand changes are not translated into concrete actions.
- AI assistants are disconnected from the merchant's real operational data and cannot explain why they recommend something.

## Target User
- Primary user: merchant / commercant
- Company size: solo merchant to scaled operations team
- Industry scope: generic merchant profile, not limited to one vertical
- Operational responsibilities:
  - product catalog and stock
  - warehouse operations
  - parcel and transport follow-up
  - supply planning
  - day-to-day decision making

## Product Promise
One webapp to understand current operations, chat with an explainable agent, receive grounded recommendations, and approve safe actions without losing control.

## Goals
- Centralize operational visibility across stock, parcels, warehouse, and planning.
- Let the merchant chat with an AI copilot using their own API key.
- Ground every answer and recommendation in merchant-owned data.
- Show reasoning and evidence so the merchant can trust the output.
- Convert operational signals into approval-ready actions.
- Use calendar events and external context to improve planning before problems occur.

## Non-Goals
- Fully autonomous execution in v1
- Mandatory reliance on external commerce APIs during onboarding
- Vertical-specific logic hardcoded for one merchant category
- Replacing the merchant's ERP or marketplace stack in the first release

## MVP Scope
### Included
- Stock management
- Transport / parcel tracking
- Warehouse visibility
- Merchant profile and AI settings
- Copilot chat with explainable responses
- Recommendation inbox with approval and rejection
- Action history / execution log
- Calendar events and business availability planning
- External context ingestion from n8n

### Excluded
- Automatic execution without approval
- Direct purchasing integrations
- Real-time supplier negotiation workflows
- Deep vertical customizations

## Core User Journeys
1. The merchant imports or enters products, stock, and transport data.
2. The merchant opens the dashboard to monitor stock health, shipping issues, and planning signals.
3. The merchant chats with the AI copilot using a merchant-provided API key.
4. The copilot reads merchant data, explains its reasoning, and answers grounded questions.
5. The copilot produces approval-ready recommendations for restocking, stock rebalancing, transport mitigation, and planning changes.
6. The merchant approves or rejects the recommendation.
7. The system records the action outcome and keeps an execution trail.
8. Calendar events and external context create proactive planning alerts.

## Product Modules
### 1. Stock Operations
- Product catalog
- Quantity tracking
- Minimum stock thresholds
- Supplier metadata
- Restock risk detection

### 2. Transport Operations
- Parcel tracking
- Delay and exception visibility
- Shipping health signals
- Operational linkage between transport issues and stock risk

### 3. Planning and Calendar
- Merchant absence windows
- Holidays and important commercial dates
- Event-aware planning support
- Contextual recommendations based on availability and seasonality

### 4. AI Copilot
- Merchant-owned API key
- Natural-language chat
- Retrieval from merchant operational data
- Visible reasoning summary
- Evidence-backed recommendations

### 5. Approval and Execution
- Approval queue
- Reject / approve actions
- Action payload preview
- Execution history and outcomes

### 6. External Context
- n8n workflow ingestion
- News and event filtering by merchant profile
- Advisory planning signals
- Approval-ready recommendations derived from relevant events

## AI Control Model
- The merchant provides their own API key in settings.
- The agent can access only the merchant data available inside the app.
- The agent can create approval-ready recommendations.
- Execution remains approval-gated in the MVP.
- Responses must include reasoning and evidence references.

## Recommendation Scenarios
- `restock_risk`
- `transport_delay`
- `demand_event`
- `calendar_absence`
- `stock_rebalance`

## Data Model Additions
- Merchant AI settings
- Merchant profile context
- Chat sessions and messages
- Context snapshots
- Recommendations
- Approvals and rejections
- Execution runs
- Calendar events
- External context signals

## Interfaces
### Merchant Settings
- API key management
- Preferred model selection
- Merchant category and geography
- Supplier regions and names
- Seasonality tags
- Protected channels
- Watchlist keywords

### Copilot Interface
- Chat view
- Reasoning panel
- Evidence references
- Recommendation creation from chat

### Planning Interface
- Calendar events
- External signal feed
- Recommendation linkage
- Future operational risk view

### Approval Interface
- Approve / reject
- Review reasoning and impacted data
- Inspect action payload
- View execution status

## Success Metrics
- Merchant can ask questions about current operations and receive grounded responses.
- Every recommendation includes visible reasoning and expected impact.
- Approval flow prevents execution without merchant confirmation.
- Calendar and external context produce useful planning alerts.
- The app reduces time spent monitoring stock and transport manually.

## Acceptance Criteria
- Merchant can store and update their own API key.
- Merchant can chat with the copilot from the webapp.
- Copilot answers include reasoning and evidence grounded in merchant data.
- Copilot can create approval-ready recommendations.
- Merchant can approve or reject recommendations.
- Approval or rejection is recorded with timestamps.
- Execution history is visible.
- Merchant can create calendar events.
- External context signals can be ingested and shown in the planning view.
- Relevant signals can generate recommendations.

## Technical Direction
- Next.js App Router frontend and route handlers
- Prisma data model over the existing operational schema
- n8n as the external context ingestion and workflow boundary
- Approval-first execution contract so future automations can plug in without changing the user control model
