import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foundry Loadout | manifest-ссылки для V13 и V14",
  description:
    "Независимый справочник проверенных manifest-ссылок для Foundry Virtual Tabletop 13 и 14.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
