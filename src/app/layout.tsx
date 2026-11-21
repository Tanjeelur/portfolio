import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { profile } from "@/data/resume";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${profile.name} — ${profile.role}`,
  description: profile.tagline,
  openGraph: {
    title: `${profile.name} — ${profile.role}`,
    description: profile.tagline,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Marks JS as available so reveal animations can hide content until animated */}
        <script
          dangerouslySetInnerHTML={{
            // `js`: enables reveal animations. `booted`: skip the boot intro on repeat visits / reduced motion.
            __html:
              "var d=document.documentElement;d.classList.add('js');try{if(sessionStorage.getItem('booted')||matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('booted')}catch(e){}",
          }}
        />
      </head>
      <body className={`${display.variable} ${code.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
