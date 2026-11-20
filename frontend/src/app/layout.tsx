import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EVIDENT AI — Beyond Content. Into Truth.",
  description: "Evidence-centered digital investigation and media intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
