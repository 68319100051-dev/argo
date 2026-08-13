import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TableName = "products" | "lots" | "stock_movements" | "purchase_orders";

export function useRealtime<T extends Record<string, unknown>>(
  table: TableName,
  filter?: string
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      let query = supabase.from(table).select("*");
      if (filter) query = query.or(filter);
      const { data } = await query;
      setData((data ?? []) as T[]);
      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT") {
            setData((prev) => [...prev, payload.new as T]);
          } else if (payload.eventType === "UPDATE") {
            setData((prev) =>
              prev.map((item) =>
                (item as unknown as Record<string, unknown>).id === payload.new.id
                  ? (payload.new as T)
                  : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Record<string, unknown>;
            setData((prev) =>
              prev.filter(
                (item) => (item as unknown as Record<string, unknown>).id !== old.id
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);

  return { data, loading };
}
