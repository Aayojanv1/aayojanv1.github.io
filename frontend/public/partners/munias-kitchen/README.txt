MUNIA'S KITCHEN — PHOTO DROP FOLDER
====================================

Photos for the brand page go here. The HTML at /partners/munias-kitchen.html
expects these exact filenames. Until each file exists, the card falls back to
a saffron-gradient card with a food emoji (no broken-image icons).

Expected filenames (case-sensitive):
  doi-ilish.jpg
  mutton-galouti.jpg
  mutton-biryani.jpg
  crab-wonton.jpg
  kochu-pata-chingri.jpg

WORKFLOW WHEN A NEW BATCH ARRIVES ON WHATSAPP:
1. Open https://squoosh.app — drag the photo in
2. Pick MozJPEG, quality 75. Watch the right panel — target ~150-300 KB
3. "Save" with the exact filename above
4. Drop into this folder
5. Commit & push:
     git add frontend/public/partners/munias-kitchen/*.jpg
     git commit -m "Munia's Kitchen: add real food photos"
     git push origin master   (or staging)
6. ~3 minutes after build: photos live at aayojan.online

PHOTO RULES OF THUMB:
- 4:3 aspect crop. Phones shoot 4:3 by default — perfect.
- Plate it like Instagram — top-down or 45 degree, natural light.
- 1200 x 900 pixels is enough. Bigger gets compressed away anyway.
- File size 150-300 KB. Above 500 KB hurts mobile load times.

TO ADD A NEW DISH BEYOND THE CURRENT 5:
1. Add a new <div class="dish-card"> block in munias-kitchen.html
   (copy any existing one as template)
2. Save the photo here with a kebab-case name
3. Reference it in the new card's <img src=...>
