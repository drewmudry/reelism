import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserDemos } from "@/actions/demos";
import { DemoModal } from "@/components/demos/demo-modal";
import { DemoList } from "@/components/demos/demo-list";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";

export default async function DemosPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const demos = await getUserDemos();

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
              <p className="text-muted-foreground">Manage your demo videos.</p>
            </div>
            <DemoModal />
          </div>

          <DemoList demos={demos} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

