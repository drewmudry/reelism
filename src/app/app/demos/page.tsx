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
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { getProductById } from "@/actions/products";

interface DemosPageProps {
  searchParams: Promise<{ productId?: string }>;
}

export default async function DemosPage({ searchParams }: DemosPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const params = await searchParams;
  const productId = params.productId;
  const demos = await getUserDemos(productId);
  
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
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Demos</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        
        <div className="p-4 pt-0 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Demos</h1>
              <p className="text-muted-foreground">
                {product
                  ? `Demos for "${product.title || "Untitled Product"}"`
                  : "Manage your demo videos."}
              </p>
            </div>
            <DemoModal />
          </div>

          <div className="flex items-center justify-between">
            <DemoProductFilter />
          </div>

          <DemoList demos={demos} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

