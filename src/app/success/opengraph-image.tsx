import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SATX Ritas Rental Order Confirmation";
export const size = {
  width: 1200,
  height: 630,
};

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 48,
        background: "linear-gradient(to bottom right, #f0f9ff, #e0f2fe)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          borderRadius: 24,
          padding: 48,
          boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)",
          width: "90%",
          height: "80%",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: "bold",
            background: "linear-gradient(to right, #10b981, #0ea5e9)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 24,
          }}
        >
          Order Confirmed!
        </div>
        <div
          style={{
            fontSize: 36,
            color: "#334155",
            textAlign: "center",
            marginBottom: 48,
          }}
        >
          Thank you for choosing SATX Ritas Rentals
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f0fdf4",
            borderRadius: 12,
            padding: "12px 24px",
          }}
        >
          <div style={{ fontSize: 24, color: "#047857" }}>
            Your frozen drink machine rental is confirmed
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
