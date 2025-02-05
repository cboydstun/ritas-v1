import ThemeWrapper from "@/components/ThemeWrapper";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeWrapper>{children}</ThemeWrapper>;
}
