import type { Metadata } from "next";
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
  title: "agentworkspace.dev",
  description:
    "A components-style directory for natural-language agent harness packs, backed by the Agent Workspace template runtime.",
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
