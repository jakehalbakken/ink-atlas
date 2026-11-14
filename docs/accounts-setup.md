# Accounts: setting up Supabase

Ink Atlas accounts run on a free Supabase project that you own. Until the two GitHub secrets below exist, the site builds exactly as before and the Sign in button stays hidden.

## Steps (about 10 minutes)

1. Go to supabase.com, sign in (Continue with GitHub is fine) and make a **New project**. Name it `ink-atlas`, pick the West US region, and let it generate a database password. The app never needs that password, so just keep it in your password manager. The free plan is enough.
2. When the project is ready, open **SQL Editor**, then **New query**. Paste the whole of `supabase/setup.sql` from this repo and press **Run**. It should end with "Success". Running it again later is safe.
3. Open **Authentication**, then **Sign In / Providers**, then **Email**. Keep Email on and turn **Confirm email** off, then Save. Supabase's built-in email sender only delivers to your own team's addresses and only a few an hour, so with confirmation on, Liv would never get her email. With it off, an account works the moment it is made.
4. Still in Authentication, open **URL Configuration**. Set **Site URL** to `https://jakehalbakken.github.io/ink-atlas/` and add the same address with `**` on the end under **Redirect URLs**.
5. Open **Project Settings**, then **API Keys** (older dashboards: **API**). You need two values: the **Project URL** (looks like `https://abcd1234.supabase.co`) and the **anon public** key (newer projects call it the **publishable** key, starting `sb_publishable_`). Never use the `service_role` or **secret** key anywhere.
6. In GitHub, open the `ink-atlas` repo, then **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Add `SUPABASE_URL` with the Project URL, then `SUPABASE_ANON_KEY` with the anon or publishable key.
7. The next deploy builds the site with accounts on.

The anon or publishable key is meant to be public: it ends up in the site's code, and the row-level security rules in `setup.sql` are what keep each person's projects private.

## Optional later: emailed codes

To offer "Email me a code" (sign in without a password, or when someone forgets theirs), connect your own email sender in **Authentication**, **Emails**, **SMTP Settings** (Resend has a free tier). Then in **Email Templates** add `{{ .Token }}` to the **Magic Link** and **Confirm signup** templates so the email carries the 6-digit code, and add a repository *variable* (not a secret) named `SUPABASE_EMAIL_CODES` with the value `1`.

Until then nobody can reset a forgotten password by themselves. You can do it for them in Supabase under **Authentication**, **Users**.

## Things to know

- Anyone who finds the site can make an account on your project. Each account only ever sees its own projects. The free plan holds 500 MB of data and 1 GB of artwork, plenty for this.
- Supabase pauses a free project after a week with no use. Opening the dashboard and pressing **Restore** brings it back; nothing is lost.
- Shared links ("Send to someone") are a frozen copy. Anyone with the link can open that copy. The link id is long and random, and copies cannot be listed.
