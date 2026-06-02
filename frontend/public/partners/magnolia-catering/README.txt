MAGNOLIA CATERING SERVICE — PHOTO DROP FOLDER
==============================================

Photos for the brand page go here.

Expected files (drop when Sandip sends):
  logo.png            — Brand logo (will replace the saffron text card in hero)
  diamond-fish-fry.jpg
  mutton.jpg
  kebab.jpg

When photos arrive:
1. Open https://squoosh.app — drag the photo in
2. MozJPEG, quality 75, target 150–300 KB (logo: keep PNG if transparent, max ~500 KB)
3. Save with the exact filename above
4. Drop into this folder
5. Commit: git add . && git commit -m "Magnolia: brand assets" && git push

Until photos arrive, the dish cards display saffron gradient + emoji fallback,
and the hero shows a stylized "MAGNOLIA catering" text card.

Once Magnolia provides their actual logo, swap the hero-art block in
magnolia-catering.html the same way curry-katha.html was updated:
  <div class="logo-real"><img src="/partners/magnolia-catering/logo.png" ... /></div>
