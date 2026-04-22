import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type DustAgentResult = {
  alertSummary: string
  analysis: string
  proposedSolution: string
  confidence: string
}

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  )
}

function fallbackDustResult(input: {
  productName: string
  quantity: number
  threshold: number
  supplier: string | null
}): DustAgentResult {
  const severityGap = Math.max(0, input.threshold - input.quantity)
  const severity =
    severityGap >= input.threshold ? 'critical' : severityGap >= Math.ceil(input.threshold / 2) ? 'high' : 'medium'

  return {
    alertSummary: `Low stock detected for ${input.productName} (${input.quantity}/${input.threshold}).`,
    analysis:
      severity === 'critical'
        ? 'Inventory is critically below the minimum threshold and may cause stockout in the next sales cycle.'
        : 'Inventory is below the configured minimum threshold and should be replenished soon to avoid stock pressure.',
    proposedSolution: input.supplier
      ? `Create a replenishment order for supplier ${input.supplier}, add temporary safety stock, and prioritize this SKU in daily stock monitoring.`
      : 'Create a replenishment plan, validate supplier lead time, and prioritize this SKU in daily stock monitoring.',
    confidence: severity === 'critical' ? 'high' : 'medium',
  }
}

async function callDustAgent(input: {
  userId: string
  productId: string
  productName: string
  quantity: number
  threshold: number
  supplier: string | null
}): Promise<DustAgentResult> {
  const webhookUrl = process.env.DUST_AGENT_WEBHOOK_URL?.trim()
  const apiKey = process.env.DUST_AGENT_API_KEY?.trim()

  if (!webhookUrl) {
    return fallbackDustResult(input)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        event: 'low_stock_trigger',
        userId: input.userId,
        productId: input.productId,
        productName: input.productName,
        quantity: input.quantity,
        threshold: input.threshold,
        supplier: input.supplier,
        generatedAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Dust webhook failed with status ${response.status}`)
    }

    const payload = await response.json().catch(() => ({}))

    const analysis =
      typeof payload.analysis === 'string'
        ? payload.analysis
        : typeof payload.reasoning === 'string'
          ? payload.reasoning
          : typeof payload.response === 'string'
            ? payload.response
            : null

    const solution =
      typeof payload.proposedSolution === 'string'
        ? payload.proposedSolution
        : typeof payload.solution === 'string'
          ? payload.solution
          : typeof payload.recommendation === 'string'
            ? payload.recommendation
            : null

    const summary =
      typeof payload.alertSummary === 'string'
        ? payload.alertSummary
        : `Low stock detected for ${input.productName} (${input.quantity}/${input.threshold}).`

    if (!analysis || !solution) {
      return fallbackDustResult(input)
    }

    return {
      alertSummary: summary,
      analysis,
      proposedSolution: solution,
      confidence:
        typeof payload.confidence === 'string'
          ? payload.confidence
          : typeof payload.confidenceLevel === 'string'
            ? payload.confidenceLevel
            : 'medium',
    }
  } catch (error) {
    console.error('Dust agent call failed, using fallback analysis:', error)
    return fallbackDustResult(input)
  } finally {
    clearTimeout(timeout)
  }
}

export async function processPendingLowStockAlerts(userId: string, limit = 4) {
  let pendingAlerts: Array<{
    id: string
    user_id: string
    product_id: string
    quantity: number
    threshold: number
    product_name_snapshot: string | null
    product: {
      name: string
      supplier: string | null
      min_quantity: number
      quantity: number
    }
  }> = []

  try {
    pendingAlerts = await prisma.stockLowAlert.findMany({
      where: { user_id: userId, status: 'pending' },
      include: {
        product: {
          select: {
            name: true,
            supplier: true,
            min_quantity: true,
            quantity: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
      take: limit,
    })
  } catch (error) {
    if (isMissingTableError(error)) {
      return
    }
    throw error
  }

  for (const alert of pendingAlerts) {
    const claim = await prisma.stockLowAlert.updateMany({
      where: { id: alert.id, status: 'pending' },
      data: { status: 'processing' },
    })

    if (!claim.count) {
      continue
    }

    try {
      const dustResult = await callDustAgent({
        userId,
        productId: alert.product_id,
        productName: alert.product_name_snapshot || alert.product.name,
        quantity: alert.quantity,
        threshold: alert.threshold,
        supplier: alert.product.supplier,
      })

      let recommendationId: string | null = null
      try {
        const recommendation = await prisma.agentRecommendation.create({
          data: {
            user_id: userId,
            title: dustResult.alertSummary,
            scenario_type: 'restock_risk',
            reasoning_summary: dustResult.analysis,
            expected_impact: 'Reduce stockout probability and protect service levels.',
            confidence_note: dustResult.confidence,
            approval_required: true,
            source: 'dust_trigger',
            evidence_payload: [
              { label: 'Product', value: alert.product_name_snapshot || alert.product.name },
              { label: 'Quantity', value: `${alert.quantity}` },
              { label: 'Threshold', value: `${alert.threshold}` },
            ] as Prisma.InputJsonValue,
            action_payload: {
              target: 'inventory_restock_plan',
              payload: {
                productId: alert.product_id,
                productName: alert.product_name_snapshot || alert.product.name,
                quantity: alert.quantity,
                threshold: alert.threshold,
                supplier: alert.product.supplier,
                proposedSolution: dustResult.proposedSolution,
              },
            } as Prisma.InputJsonValue,
          },
        })
        recommendationId = recommendation.id
      } catch (error) {
        if (!isMissingTableError(error)) {
          throw error
        }
      }

      await prisma.stockLowAlert.update({
        where: { id: alert.id },
        data: {
          status: 'review_ready',
          dust_response: dustResult.analysis,
          proposed_solution: dustResult.proposedSolution,
          processed_at: new Date(),
          recommendation_id: recommendationId,
        },
      })
    } catch (error) {
      await prisma.stockLowAlert.update({
        where: { id: alert.id },
        data: {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Dust analysis failed',
        },
      })
    }
  }
}

export async function getRecentLowStockAlerts(userId: string, limit = 6) {
  try {
    const alerts = await prisma.stockLowAlert.findMany({
      where: {
        user_id: userId,
        status: { in: ['pending', 'processing', 'review_ready', 'failed'] },
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            quantity: true,
            min_quantity: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    })

    return alerts.map((alert) => ({
      id: alert.id,
      status: alert.status,
      quantity: alert.quantity,
      threshold: alert.threshold,
      productName: alert.product_name_snapshot || alert.product.name,
      sku: alert.product.sku,
      createdAt: alert.created_at.toISOString(),
      dustResponse: alert.dust_response,
      proposedSolution: alert.proposed_solution,
      errorMessage: alert.error_message,
    }))
  } catch (error) {
    if (isMissingTableError(error)) {
      return []
    }
    throw error
  }
}
