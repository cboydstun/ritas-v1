import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ThemeWrapper from "@/components/ThemeWrapper";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className="flex flex-col min-h-screen bg-white dark:bg-charcoal dark:text-white">
        <ThemeWrapper>
          <Navigation />
          <main className="flex-grow">{children}</main>
          <Footer />
        </ThemeWrapper>
      </body>
    </html>
  );
}
