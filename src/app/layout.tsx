import type { Metadata } from "next";
import { PUBLIC_ORIGIN } from "@/lib/public-metadata";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { OperatorSessionProvider } from "@/components/OperatorSessionProvider";
import { Sidebar } from "@/components/Sidebar";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ORIGIN),
  title: { default: "Agent Workspace", template: "%s | Agent Workspace" },
  description: "Browse agent harness packs, instructions, sources, and change traces for your next coding project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ConvexClientProvider>
          <OperatorSessionProvider>
            <Sidebar />
            {children}
          </OperatorSessionProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
