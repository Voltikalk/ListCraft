import { ImageResponse } from "next/og";

// Только латиница: встроенный шрифт ImageResponse не содержит кириллицы.
export const alt = "ListCraft Global — English marketplace listings from a Russian description";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#4f46e5",
          color: "white",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.85 }}>ListCraft Global</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>
          English listings for eBay, Etsy and Amazon
        </div>
        <div style={{ fontSize: 36, marginTop: 32, opacity: 0.85 }}>Describe your item in Russian — get the listing in English</div>
      </div>
    ),
    size,
  );
}
