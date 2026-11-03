/**
 * The home page: the navigation, the hero and the search.
 *
 * @module
 */
import { type ReactNode, Suspense } from "react";

import { Hero } from "@/components/Hero";
import { SearchBox } from "@/components/SearchBox";
import { SiteNav } from "@/components/SiteNav";

/** The home page. */
const HomePage = (): ReactNode => (
  <main className="mx-auto max-w-3xl space-y-8 p-6">
    <SiteNav />
    <Hero />
    {/* the search reads the address's search params, which a page rendered ahead of time does not have */}
    <Suspense>
      <SearchBox />
    </Suspense>
  </main>
);

export default HomePage;
