import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Vappi",
  description: "Vappi, your AI pal for your own files. Upload anything, then learn it, ask it, or make something from it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-fg-body">
        <ClerkProvider
          appearance={clerkAppearance}
          signInFallbackRedirectUrl="/home"
          signUpFallbackRedirectUrl="/home"
        >
          <ToastProvider>{children}</ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}