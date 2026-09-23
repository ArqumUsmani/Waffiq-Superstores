import { HeroScene } from '../components/HeroScene';
import { CategoriesSection } from '../components/CategoriesSection';
import { ReviewsSection } from '../components/ReviewsSection';
import { BranchSection } from '../components/BranchSection';
import { useLang } from '../state/app-state';

export default function Home() {
  const lang = useLang();

  /* Swap HeroScene for Hero to use the static storefront hero instead. */
  return (
    <>
      <HeroScene key={lang} />
      <CategoriesSection />
      <ReviewsSection />
      <BranchSection />
    </>
  );
}
