# sample_images/

Drop your test photos here for the demo.

Suggested setup for a convincing hero demo (footwear):

- `shoe_reference_1.jpg`, `shoe_reference_2.jpg` — clean/new product photos
  (in production these come automatically from the Amazon catalog via SKU).
- `shoe_returned_1.jpg`, `shoe_returned_2.jpg` — photos of the worn/returned item
  (in production these are captured by the delivery rider on pickup).

Then in the UI:
1. Pick **Footwear / Shoes**.
2. Upload the reference photos into container 1.
3. Upload the returned photos into container 2.
4. Click **Grade it**.

Tips for testing the grade bands:
- New item vs its own reference → expect **A/B**.
- Visibly scuffed/worn item → expect **C**.
- Ripped sole / cracked screen / structural damage → expect **D**.

(No images are committed to the repo — this folder is yours to fill.)
