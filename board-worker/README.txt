VA COMICS // Comments + Q&A // va-board (the guard Worker for comments)
- Separate Worker. Only answers /api/board/* and /foundry/api/board/*.
- Database: D1 "va-board" (table messages). AI: Workers AI binding.
- TURNSTILE_SECRET is a Secret set in the Cloudflare dashboard, never in this repo.
- Notifications: email to Aris for messages waiting for review and for reader reports (max 10 per hour),
  plus a daily summary from the nightly cron. Needs Email Routing on va-comics.com with Aris's address verified,
  and the Secret NOTIFY_TO (his address) set in the dashboard, never in this repo. Without them the board works, just silently.
- D1 also has a tiny table notify (hour, n) for the hourly mail cap.
