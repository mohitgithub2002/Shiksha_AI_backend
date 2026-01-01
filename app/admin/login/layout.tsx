import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "../../globals.css";
import "./login.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Admin Login - ShikshaAI",
  description: "Sign in to ShikshaAI Admin Panel",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`login-root ${outfit.variable}`}>
      {children}
    </div>
  );
}

