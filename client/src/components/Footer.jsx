import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#09090b] w-full py-12 px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-gutter border-t border-white/5 z-10 relative mt-auto text-left">
      <div className="flex items-center gap-4">
        <span className="font-headline-md text-headline-md font-bold text-white">IntervFlow</span>
        <span className="text-on-surface-variant text-xs border-l border-white/10 pl-4">© 2026 IntervFlow. Precision engineered for high-stakes technical leadership.</span>
      </div>
      <div className="flex flex-wrap gap-6 font-label-sm text-label-sm text-on-surface-variant md:pr-24">
        <Link className="hover:text-primary transition-colors text-on-surface-variant" to="/">Product</Link>
        <Link className="hover:text-primary transition-colors text-on-surface-variant" to="/#pricing">Pricing</Link>
        <Link className="hover:text-primary transition-colors text-on-surface-variant" to="/contact">Company</Link>
        <Link className="hover:text-primary transition-colors text-on-surface-variant" to="/contact">Terms</Link>
        <Link className="hover:text-primary transition-colors text-on-surface-variant" to="/contact">Privacy</Link>
      </div>
    </footer>
  );
}
