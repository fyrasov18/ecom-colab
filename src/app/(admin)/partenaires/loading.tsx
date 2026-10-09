import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function PartenairesLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Partenaires"
        description={<Skeleton className="h-4 w-[300px]" />}
      />

      <div className="space-y-4">
        {/* Toolbar Skeleton */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2">
            <Skeleton className="h-10 w-[300px] max-w-sm" />
            <Skeleton className="h-10 w-[150px]" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>

        {/* Table Skeleton */}
        <div className="rounded-md border">
          <div className="border-b bg-muted/50 p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-[20%]" />
              <Skeleton className="h-4 w-[25%]" />
              <Skeleton className="h-4 w-[10%]" />
              <Skeleton className="h-4 w-[10%]" />
              <Skeleton className="h-4 w-[10%]" />
              <Skeleton className="h-4 w-[15%]" />
              <Skeleton className="h-4 w-[10%]" />
            </div>
          </div>
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-[20%]" /> {/* Name */}
                <Skeleton className="h-4 w-[25%]" /> {/* Email */}
                <Skeleton className="h-4 w-[10%]" /> {/* Number 1 */}
                <Skeleton className="h-4 w-[10%]" /> {/* Number 2 */}
                <Skeleton className="h-4 w-[10%]" /> {/* Number 3 */}
                <Skeleton className="h-6 w-[10%] rounded-full" /> {/* Badge */}
                <div className="flex w-[10%] justify-end">
                  <Skeleton className="h-8 w-8 rounded-md" /> {/* Action */}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
