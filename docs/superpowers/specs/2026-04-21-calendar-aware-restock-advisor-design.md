# Historical Spec - Calendar-Aware Restock Advisor

This English archive summarizes the original calendar-aware restock advisor design. The detailed pre-cleanup working spec remains available in git history.

## Persona

Jean-Charles runs Nordika Studio, a European furniture merchant selling through multiple marketplaces. He needs the business to keep operating while he is away.

## Problem

The calendar used to store business events without turning those events into operational decisions. The advisor closes that loop:

```text
calendar event -> stock analysis -> supplier lead-time check -> actionable recommendation
```

## Design Position

- Produce one consolidated recommendation for a leave period.
- Use deterministic SQL and TypeScript math for risk detection.
- Use optional LLM enrichment only for concise explanation and prioritization.
- Keep the merchant in control through explicit approval.
- Keep all costs and recovery values in EUR.

## Data Flow

```text
User creates CalendarEvent kind=leave
  -> optional n8n webhook
  -> POST /api/agent/calendar-advisor
  -> src/lib/calendar-restock.ts projection
  -> optional src/lib/calendar-restock-llm.ts enrichment
  -> agent_recommendations
  -> /actions inbox
```

## Recommendation Payload

The recommendation stores:

- Leave event ID and date range.
- Affected SKU list.
- Current stock.
- Projected stock.
- Recommended quantity.
- Supplier lead time.
- Estimated EUR cost.
- Reasoning summary.

## UX

The Actions page should show:

- A pending recommendation card.
- A detail view with the SKU table.
- Select-all and per-line selection.
- Approve, reject, and partial approval paths.
- Clear status after approval.

## Demo

1. Open Dashboard.
2. Create a leave event in Calendar.
3. Open Actions.
4. Review the consolidated restock plan.
5. Exclude one SKU.
6. Approve the selection.
7. Show the approved status.

## Scale Notes

- Risk detection is O(n) over SKUs and recent orders.
- LLM enrichment should process only the risky SKU subset.
- n8n can batch large merchant accounts if needed.
- The inbox should keep one recommendation per calendar event to avoid alert overload.
