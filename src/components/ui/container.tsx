import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("mx-auto w-full max-w-[1200px] px-6", className)} {...props} />;
}
