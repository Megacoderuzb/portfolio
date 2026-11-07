/** Fixed decorative layers: drifting violet orbs, faint grid, film grain. Styles in globals.css. */
export function Background() {
  return (
    <div aria-hidden className="site-bg">
      <div className="site-bg-orb a" />
      <div className="site-bg-orb b" />
      <div className="site-bg-grid" />
      <div className="site-bg-grain" />
    </div>
  );
}
