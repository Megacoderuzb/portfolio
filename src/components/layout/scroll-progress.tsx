/** Reading progress bar driven by a CSS scroll timeline (.scroll-progress in globals.css); hidden where unsupported. */
export function ScrollProgress() {
  return (
    <div
      aria-hidden
      className="scroll-progress fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-linear-to-r from-violet-600 to-violet-400"
    />
  );
}
