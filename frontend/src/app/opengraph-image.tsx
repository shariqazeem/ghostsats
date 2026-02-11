import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GhostSats - Bitcoin's Privacy Layer on Starknet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090B",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Gradient glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,90,0,0.2) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "24px" }}>
          <span style={{ fontSize: "48px", fontWeight: 800, color: "#FAFAFA", letterSpacing: "-0.02em" }}>
            Ghost
          </span>
          <span style={{ fontSize: "48px", fontWeight: 800, color: "#FF5A00", letterSpacing: "-0.02em" }}>
            Sats
          </span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: "28px", color: "#A1A1AA", fontWeight: 500, marginBottom: "40px" }}>
          Bitcoin&apos;s Privacy Layer on Starknet
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["Pedersen Commitments", "Merkle Proofs", "Gasless Withdrawals", "BTC Identity"].map(
            (text) => (
              <div
                key={text}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#A1A1AA",
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
