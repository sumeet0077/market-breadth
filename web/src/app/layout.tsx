import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://quantbreadth.com"),
  title: "QuantBreadth™ | Institutional Market Breadth & Regime Terminal",
  description: "Quantitative Market Breadth, Macro Regimes, and Theme Leadership Intelligence across NSE Stocks (2014–2026).",
  icons: {
    icon: "/quantbreadth_logo.jpg",
    apple: "/quantbreadth_logo.jpg",
  },
  openGraph: {
    title: "QuantBreadth™ | Institutional Market Breadth Terminal",
    description: "Quantitative Market Breadth, Macro Regimes, and Theme Leadership Intelligence across NSE Stocks (2014–2026).",
    images: ["/quantbreadth_logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#070b14] text-slate-50 font-sans min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
