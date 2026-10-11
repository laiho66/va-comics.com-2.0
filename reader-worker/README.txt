VA COMICS // Reading Room // va-reader (the guard Worker)
- Separate Worker from the site. It only answers /api/reader/* and /foundry/api/reader/*.
- The BOOK is NOT in this folder and must NEVER go to GitHub (the repo is public).
  The book pack goes only into the PRIVATE R2 bucket "va-comics-books".
- wrangler.jsonc is filled in: KV READER_CODES id + AUD tag of the Access app "foundry" (va-comics.com/foundry*).
