import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserDemos } from "@/actions/demos";
import { DemoModal } from "@/components/demos/demo-modal";
import { DemoList } from "@/components/demos/demo-list";
import { DemoProductFilter } from "@/components/demos/demo-product-filter";
import { AppHeader } from "@/components/app-header";
import { getProductById, getProducts } from "@/actions/products";

interface DemosPageProps {
  searchParams: Promise<{ productId?: string }>;
}

export default async function DemosPage({ searchParams }: DemosPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const params = await searchParams;
  const productId = params.productId;
  const demos = await getUserDemos(productId);

  // Get all products for the filter
  const allProducts = await getProducts();

  // Get product info if filtering by product
  let product = null;
  if (productId) {
    try {
      product = await getProductById(productId);
    } catch (error) {
      // Product not found or unauthorized, ignore
      console.error("Failed to fetch product:", error);
    }
  }

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Demos" }
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                  Demos
                </h1>
                <DemoProductFilter products={allProducts} selectedProductId={productId || ""} />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {product
                  ? `Demos for "${product.title || "Untitled Product"}"`
                  : "Manage your demo videos."}
              </p>
            </div>
            <DemoModal />
          </div>

          <DemoList demos={demos} />
        </div>
      </div>
    </>
  );
}
