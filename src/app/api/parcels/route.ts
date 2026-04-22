import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/session';
import { Prisma } from '@prisma/client';

// Common carrier tracking URLs
const CARRIER_TRACKING_URLS: Record<string, string> = {
  // French/European carriers
  'la_poste': 'https://www.laposte.fr/outils/suivre-vos-envois?code={tracking}',
  'colissimo': 'https://www.laposte.fr/outils/suivre-vos-envois?code={tracking}',
  'chronopost': 'https://www.chronopost.fr/tracking-no-sec498?liession={tracking}',
  'dhl': 'https://www.dhl.com/fr-fr/home/tracking.html?tracking-id={tracking}',
  'ups': 'https://www.ups.com/track?tracknum={tracking}',
  'fedex': 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
  'dpd': 'https://www.dpd.fr/trace/{tracking}',
  'gls': 'https://gls-group.eu/FR/fr/suivi-colis?match={tracking}',
  'mondial_relay': 'https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition={tracking}',
  'relais_colis': 'https://www.relaiscolis.com/suivi-de-colis/index.html?reference={tracking}',
  'tnt': 'https://www.tnt.com/express/fr_fr/site/outils-expedition/suivi-colis.html?searchType=con&cons={tracking}',
  'amazon': 'https://www.amazon.fr/gp/css/shiptrack/view.html/ref=pe_tracking?ie=UTF8&trackingId={tracking}',
  // Chinese carriers
  'sf_express': 'https://www.sf-express.com/we/ow/chn/en/dynamic_function/waybill/waybill_query_info?trackingNumber={tracking}',
  'ems_china': 'https://www.ems.com.cn/queryList?mailNum={tracking}',
  'china_post': 'https://track.yw56.com.cn/en/querydel?nums={tracking}',
  'yto_express': 'https://www.yto.net.cn/traceQuery.html?order_track={tracking}',
  'zto_express': 'https://www.zto.com/GuestService/Bill?txtBill={tracking}',
  'sto_express': 'https://www.sto.cn/queryRes?billno={tracking}',
  'yunda': 'https://www.yundaex.com/cn/tracking?mailNo={tracking}',
  'jd_logistics': 'https://www.jdl.com/trace?waybillCodes={tracking}',
  'cainiao': 'https://global.cainiao.com/detail.htm?mailNoList={tracking}',
  'yanwen': 'https://track.yanwen.com.cn/en/search?trackingNumbers={tracking}',
  '4px': 'https://track.4px.com/#/result/0/{tracking}',
  'best_express': 'https://www.800bestex.com/track?mailNo={tracking}',
  'other': '',
};

// GET all parcels for the user
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // incoming or outgoing
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Prisma.ParcelWhereInput = {
      user_id: userId,
    };

    if (type && (type === 'incoming' || type === 'outgoing')) {
      where.type = type;
    }

    if (status) {
      where.status = status as any;
    }

    if (search) {
      where.OR = [
        { tracking_code: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { carrier: { contains: search, mode: 'insensitive' } },
        { sender_name: { contains: search, mode: 'insensitive' } },
        { recipient_name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const parcels = await prisma.parcel.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(parcels);
  } catch (error) {
    console.error('Error fetching parcels:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des colis' },
      { status: 500 }
    );
  }
}

// POST create a new parcel
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    const data = await request.json();

    // Generate carrier URL if not provided
    let carrier_url = data.carrier_url;
    if (!carrier_url && data.carrier && data.tracking_code) {
      const carrierKey = data.carrier.toLowerCase().replace(/[\s-]/g, '_');
      const urlTemplate = CARRIER_TRACKING_URLS[carrierKey];
      if (urlTemplate) {
        carrier_url = urlTemplate.replace('{tracking}', data.tracking_code);
      }
    }

    const parcel = await prisma.parcel.create({
      data: {
        user_id: userId,
        type: data.type || 'incoming',
        status: data.status || 'pending',
        tracking_code: data.tracking_code || null,
        carrier: data.carrier || null,
        carrier_url: carrier_url || null,
        reference: data.reference || null,
        sender_name: data.sender_name || null,
        sender_address: data.sender_address || null,
        recipient_name: data.recipient_name || null,
        recipient_address: data.recipient_address || null,
        weight: data.weight ? parseFloat(data.weight) : null,
        description: data.description || null,
        notes: data.notes || null,
        estimated_date: data.estimated_date ? new Date(data.estimated_date) : null,
        shipped_at: data.shipped_at ? new Date(data.shipped_at) : null,
        delivered_at: data.delivered_at ? new Date(data.delivered_at) : null,
      },
    });

    return NextResponse.json(parcel, { status: 201 });
  } catch (error) {
    console.error('Error creating parcel:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du colis' },
      { status: 500 }
    );
  }
}

// PATCH update a parcel
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    const data = await request.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID du colis requis' }, { status: 400 });
    }

    // Check ownership
    const existing = await prisma.parcel.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    // Generate carrier URL if carrier or tracking changed
    let carrier_url = updateData.carrier_url;
    const tracking = updateData.tracking_code || existing.tracking_code;
    const carrier = updateData.carrier || existing.carrier;
    
    if (!carrier_url && carrier && tracking) {
      const carrierKey = carrier.toLowerCase().replace(/[\s-]/g, '_');
      const urlTemplate = CARRIER_TRACKING_URLS[carrierKey];
      if (urlTemplate) {
        carrier_url = urlTemplate.replace('{tracking}', tracking);
        updateData.carrier_url = carrier_url;
      }
    }

    // Handle date fields
    if (updateData.estimated_date) {
      updateData.estimated_date = new Date(updateData.estimated_date);
    }
    if (updateData.shipped_at) {
      updateData.shipped_at = new Date(updateData.shipped_at);
    }
    if (updateData.delivered_at) {
      updateData.delivered_at = new Date(updateData.delivered_at);
    }
    if (updateData.weight) {
      updateData.weight = parseFloat(updateData.weight);
    }

    // Auto-set delivered_at when status changes to delivered
    if (updateData.status === 'delivered' && !existing.delivered_at && !updateData.delivered_at) {
      updateData.delivered_at = new Date();
    }

    const parcel = await prisma.parcel.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error updating parcel:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du colis' },
      { status: 500 }
    );
  }
}

// DELETE a parcel
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID du colis requis' }, { status: 400 });
    }

    // Check ownership
    const existing = await prisma.parcel.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    await prisma.parcel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting parcel:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du colis' },
      { status: 500 }
    );
  }
}
