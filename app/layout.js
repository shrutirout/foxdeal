import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "FoxDeal - Smart Price Tracker",
  description: "Track product prices across e-commerce sites and get instant alerts when prices drop. Save money effortlessly with FoxDeal.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
