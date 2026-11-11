-- VA COMICS // MALAKH: D1 database "va-malakh". Run once (Cloudflare dashboard > D1 > va-malakh > Console).
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kb (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, fp TEXT NOT NULL, adult INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, fp TEXT NOT NULL, hour INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, fp, hour));
CREATE TABLE IF NOT EXISTS stats (day TEXT NOT NULL, k TEXT NOT NULL, n REAL NOT NULL DEFAULT 0, PRIMARY KEY (day, k));
INSERT OR IGNORE INTO settings (k, v) VALUES ('enabled', '0'), ('per_hour', '12'), ('per_day_visitor', '30'), ('daily_cap', '50'), ('neuron_cap', '6500');
