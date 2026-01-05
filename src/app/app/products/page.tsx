import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AddProductModal } from "@/components/product/add-product-modal";
import { ProductList } from "@/components/product/product-list";
import { AppHeader } from "@/components/app-header";

export default async function ProductsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Products" }
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Products
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your products for use in carousels, avatars, and UGC
              </p>
            </div>
            <AddProductModal />
          </div>
          <ProductList />
        </div>
      </div>
    </>
  );
}
