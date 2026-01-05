import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserDemos } from "@/actions/demos";
import { DemoModal } from "@/components/demos/demo-modal";
import { DemoList } from "@/components/demos/demo-list";
import { DemoProductFilter } from "@/components/demos/demo-product-filter";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
    <SidebarProvider>
      <AppSidebar user={{
        name: session.user.name || "User",
        email: session.user.email || "",
        avatar: session.user.image || null,
      }} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 flex-1">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/app">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Demos</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
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
      </SidebarInset>
    </SidebarProvider>
  );
}

