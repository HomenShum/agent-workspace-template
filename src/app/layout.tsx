import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { OperatorSessionProvider } from "@/components/OperatorSessionProvider";
import { Sidebar } from "@/components/Sidebar";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Agent Workspace Template",
  description: "A reusable Convex + Next.js agent workspace with durable streaming and operator rail UX.",
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
            <div className="ml-0 md:ml-[220px]">{children}</div>
          </OperatorSessionProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
