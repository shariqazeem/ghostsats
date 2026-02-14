import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Veil Protocol - Confidential Bitcoin Accumulation on Starknet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#FFFFFF",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "24px" }}>
          <span style={{ fontSize: "48px", fontWeight: 800, color: "#18181B", letterSpacing: "-0.02em" }}>
            Veil
          </span>
          <span style={{ fontSize: "48px", fontWeight: 800, color: "#FF5A00", letterSpacing: "-0.02em" }}>
            {" "}Protocol
          </span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: "28px", color: "#52525B", fontWeight: 500, marginBottom: "40px" }}>
          Confidential Bitcoin Accumulation on Starknet
        </div>

        {/* ZK Verified badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", borderRadius: "24px", background: "#F0FDF4", border: "1px solid #BBF7D0", marginBottom: "32px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: "14px", color: "#059669", fontWeight: 600 }}>
            ZK Proofs Verified On-Chain via Garaga
          </span>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["STARK-Verified ZK Proofs", "Batch Execution", "BTC Settlement", "Cairo-Native"].map(
            (text) => (
              <div
                key={text}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                {text}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
