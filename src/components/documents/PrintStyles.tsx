export function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { margin: 15mm 20mm; size: A4; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
      }
      .print-only { display: none; }
    `}</style>
  );
}

export function DocHeader({ title, docNumber, date }: { title: string; docNumber?: string; date?: string }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottom: "2px solid #1e3a5f",
      paddingBottom: 12,
      marginBottom: 20,
    }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1e3a5f", letterSpacing: 1 }}>
          ARGO
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          ระบบบริหารจัดการสต็อกสินค้า
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1e3a5f" }}>
          {title}
        </div>
        {docNumber && (
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            เลขที่เอกสาร: {docNumber}
          </div>
        )}
        {date && (
          <div style={{ fontSize: 12, color: "#475569" }}>
            วันที่: {date}
          </div>
        )}
      </div>
    </div>
  );
}

export function DocTable({ headers, rows }: {
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  return (
    <table style={{
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 12,
      marginTop: 8,
    }}>
      <thead>
        <tr style={{ backgroundColor: "#f1f5f9" }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              border: "1px solid #cbd5e1",
              padding: "8px 10px",
              textAlign: i === 0 || i === headers.length - 1 ? "left" : "center",
              fontWeight: 600,
              color: "#1e293b",
              fontSize: 11,
            }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci} style={{
                border: "1px solid #e2e8f0",
                padding: "6px 10px",
                textAlign: ci === 0 ? "left" : "right",
                color: "#334155",
              }}>
                {cell ?? "-"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DocSignatures({ items }: { items: { label: string; name?: string }[] }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      marginTop: 36,
      paddingTop: 16,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ textAlign: "center", flex: 1 }}>
          <div style={{
            height: 40,
            borderBottom: "1px solid #94a3b8",
            marginBottom: 6,
            fontSize: 12,
            color: "#64748b",
          }}>
            {item.name ? `(${item.name})` : ""}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function DocFooter({ text }: { text: string }) {
  return (
    <div style={{
      marginTop: 28,
      paddingTop: 12,
      borderTop: "1px solid #e2e8f0",
      fontSize: 10,
      color: "#94a3b8",
      textAlign: "center",
    }}>
      {text}
    </div>
  );
}
