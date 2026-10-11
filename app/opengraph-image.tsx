import { ImageResponse } from "next/og";

// Только латиница: встроенный шрифт ImageResponse не содержит кириллицы.
export const alt = "ListCraft Global — marketplace listings for Avito, Ozon, Wildberries, eBay, Etsy and Amazon";
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
          backgroundColor: "#606c38",
          color: "#fefae0",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.85 }}>ListCraft Global</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>
          Marketplace listings from a few words about your item
        </div>
        <div style={{ fontSize: 36, marginTop: 32, opacity: 0.85 }}>Avito, Ozon, Wildberries, eBay, Etsy, Amazon</div>
      </div>
    ),
    size,
  );
}
