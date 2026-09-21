import { HeroGrocery } from '../components/HeroGrocery';
import { AisleRail } from '../components/AisleRail';
import { CategoriesSection } from '../components/CategoriesSection';
import { ReviewsSection } from '../components/ReviewsSection';
import { BranchSection } from '../components/BranchSection';
import { useLang } from '../state/app-state';

export default function Home() {
  const lang = useLang();

  /* Swap HeroGrocery for HeroStorefront to use the photographic
     storefront hero instead — the two are interchangeable. */
  return (
    <>
      <HeroGrocery key={lang} />
      <AisleRail key={`rail-${lang}`} />
      <CategoriesSection />
      <ReviewsSection />
      <BranchSection />
    </>
  );
}
