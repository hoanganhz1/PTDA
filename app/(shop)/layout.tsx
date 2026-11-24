import ShopHeader from "@/app/components/shop-header";
import SiteFooter from "@/app/components/site-footer";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf8]">
      <ShopHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
