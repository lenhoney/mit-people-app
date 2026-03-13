import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { ClientProvider } from "@/components/layout/client-provider";
import { getSession } from "@/lib/auth";
import { headers } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Populus",
  description: "Populus - People Management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  // Check if we're on the login page (no sidebar needed)
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isLoginPage || !session ? (
          <>{children}</>
        ) : (
          <ClientProvider>
            <Sidebar user={session} />
            <main className="ml-64 min-h-screen">
              <div className="p-8">
                {children}
              </div>
            </main>
          </ClientProvider>
        )}
      </body>
    </html>
  );
}
