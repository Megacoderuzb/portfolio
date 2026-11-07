// Motion's DOM animation features (~30 KB), kept in their own module so <LazyMotion> can load them on demand
// instead of shipping them in the first-load JS of a section far below the fold.
export { domAnimation as default } from "motion/react";
