# Human-Agent UX Framing

## Objective

Describe how the merchant interacts with LEIA and the operational agents: what is visible, interruptible, configurable, and reversible.

## Principle

LEIA proposes, the human decides. The product keeps the merchant in control by making reasoning, source data, and outcomes visible before decisions are approved.

## Visible Reasoning

Every recommendation appears in a dedicated Actions center with:

- A concise reasoning summary.
- The expected impact if the merchant approves.
- Source data such as the analyzed period, risky SKUs, sales velocity, lead time, and cost.

When LEIA runs a tool from chat, the action is shown in the conversation with a visible result.

## Decision States

- `Pending`: the merchant needs to review the recommendation.
- `Approved`: execution starts only after validation.
- `Rejected`: the merchant declined the recommendation.
- `Queued`: the action waits because founder state or governance requires it.
- `Observed`: the system logged the signal but did not create an actionable decision.

## Granular Approval

The merchant should be able to approve a subset of SKUs or lines, adjust quantities, and reject the rest. Cost and item counts update as selections change.

## Reversibility

Decision buttons appear as balanced choices. Reversible actions should include clear undo or override text. Overrides are stored for auditability.

## Governance

The governance model includes autonomy mode, founder state, safety fuses, and plugin visibility. The default posture is conservative: observe or ask before acting unless a reversible action is explicitly configured for automation.

## Calendar As Control Surface

The merchant influences LEIA by enriching the operational calendar with leave, holidays, and commercial events. The calendar advisor uses those inputs to anticipate restock and exposure decisions.

## Summary

| Dimension | Product Rule |
| --- | --- |
| Visibility | Show reasoning, data sources, confidence, and impact |
| Interruptibility | Require explicit validation when risk is meaningful |
| Configurability | Expose autonomy, founder state, plugins, and calendar controls |
| Control | LEIA informs and prepares; the merchant remains accountable |
