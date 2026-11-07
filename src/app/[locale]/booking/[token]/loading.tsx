import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Shown while the manage-booking page loads (same width as the real card: no layout shift).
export default function Loading() {
  return (
    <Container className="max-w-2xl py-32">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="mt-6 h-5 w-full" />
      <Skeleton className="mt-3 h-5 w-5/6" />
      <Skeleton className="mt-8 h-40 w-full rounded-(--radius-card)" />
    </Container>
  );
}
