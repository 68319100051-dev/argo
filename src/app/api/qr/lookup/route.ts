import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseQrPayload } from "@/lib/qr/generator";
import type { Lot } from "@/lib/supabase/types";

async function lookupQrData(data: string) {
  const supabase = await createClient();

  let productId: string;
  let lotId: string | undefined;
  let lot: Lot | undefined;

  const parsed = parseQrPayload(data);
  if (parsed) {
    productId = parsed.productId;
    lotId = parsed.lotId;
  } else {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data)) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { data: foundLot } = await supabase
      .from("lots")
      .select("*")
      .eq("id", data)
      .maybeSingle();

    if (foundLot) {
      lot = foundLot;
      productId = foundLot.product_id;
      lotId = foundLot.id;
    } else {
      productId = data;
    }
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (lotId && !lot) {
    const { data: foundLot } = await supabase
      .from("lots")
      .select("*")
      .eq("id", lotId)
      .maybeSingle();
    lot = foundLot ?? undefined;
  }

  let quantity: number;
  let location: string | null = null;
  let expiryDate: string | null = null;
  let stockedInAt: string | null = null;
  let lotNumber: string | null = null;

  if (product.tracking_mode === "per_lot") {
    if (!lot) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    quantity = lot.quantity;
    location = lot.location;
    expiryDate = lot.expiry_date;
    lotNumber = lot.lot_number;
  } else {
    if (lot) {
      location = lot.location;
      expiryDate = lot.expiry_date;
      lotNumber = lot.lot_number;
    }

    const movementTypes: ("stock_in" | "stock_out" | "cycle_count_adjust" | "return" | "adjustment")[] = [
      "stock_in",
      "stock_out",
      "cycle_count_adjust",
      "return",
      "adjustment",
    ];

    let query = supabase
      .from("stock_movements")
      .select("quantity_change")
      .eq("product_id", productId)
      .in("movement_type", movementTypes);

    if (lotId) {
      query = query.eq("lot_id", lotId);
    }

    const { data: movements } = await query;

    quantity = movements?.reduce((sum, m) => sum + (m.quantity_change ?? 0), 0) ?? 0;
  }

  const { data: latestIn } = await supabase
    .from("stock_movements")
    .select("created_at")
    .eq("product_id", productId)
    .eq("movement_type", "stock_in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  stockedInAt = latestIn?.created_at ?? null;

  return NextResponse.json({
    productId: product.id,
    lotId: lot?.id ?? null,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    quantity,
    location,
    expiryDate,
    lotNumber,
    stockedInAt,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { data } = body;

    if (!data || typeof data !== "string") {
      return NextResponse.json({ error: "No QR data provided" }, { status: 400 });
    }

    return await lookupQrData(data);
  } catch (error) {
    console.error("QR lookup POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const data = searchParams.get("q");

    if (!data) {
      return NextResponse.json({ error: "No QR data provided" }, { status: 400 });
    }

    return await lookupQrData(data);
  } catch (error) {
    console.error("QR lookup GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
