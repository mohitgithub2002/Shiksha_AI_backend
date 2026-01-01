import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import "./admin.css";
import { AuthProvider } from "./components/AuthProvider";
import { AdminSidebar } from "./components/AdminSidebar";
import { AdminContent } from "./components/AdminContent";
import { AdminWrapper } from "./components/AdminWrapper";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ShikshaAI Admin Panel",
  description: "Admin dashboard for managing ShikshaAI schools and resources",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <AuthProvider>
        <AdminWrapper className="admin-root">
          <AdminSidebar />
          <AdminContent>{children}</AdminContent>
        </AdminWrapper>
      </AuthProvider>
    </div>
  );
}
