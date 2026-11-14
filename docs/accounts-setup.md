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

## Update: working on a project together (2026-11-14)

The invite links, live shared projects, answers on the tattoo and pinned comments need four more things on the server. One step:

1. In Supabase open **SQL Editor**, then **New query**. Paste the whole of `supabase/setup.sql` from this repo (the newest version) and press **Run**. It should end with "Success".

That is all. It keeps everything already in the account and only adds what is new: who has joined which project, the invite links, and a shared artwork folder per project. Running it again is safe. Until it has been run, Invite someone says it could not reach the account and nothing else changes.

## Optional: forgot password and emailed codes

To let people reset a forgotten password themselves ("Forgot your password? Email me a code"), Supabase needs your own email sender, because its built-in one only delivers to your own address. The free way that needs no website of your own is your Gmail:

1. In your Google account, turn on **2-Step Verification** if it is not on, then search the account settings for **App passwords** and make one called `Ink Atlas`. Google shows a 16-letter password once. Keep it in your password manager; you only paste it into Supabase.
2. In Supabase open **Authentication**, then **Emails**, then **SMTP Settings**, and switch on **Enable custom SMTP**. Sender email: your Gmail address. Sender name: `Ink Atlas`. Host: `smtp.gmail.com`. Port: `465`. Username: your Gmail address. Password: the app password. Save.
3. Still in **Emails**, open **Templates**. In **Magic Link** and in **Confirm signup**, add a line such as `Your Ink Atlas code: {{ .Token }}` to the message and save each. That puts the 6-digit code in the email.
4. In GitHub, open the repo, **Settings**, **Secrets and variables**, **Actions**, the **Variables** tab, **New repository variable**: name `SUPABASE_EMAIL_CODES`, value `1`.
5. The next deploy shows "Forgot your password?" and "Sign up with an emailed code instead".

The emails come from your Gmail address. If you own a website domain, Resend (free tier) can send from it instead: verify the domain there, then use host `smtp.resend.com`, port `465`, username `resend` and a Resend API key as the password in step 2.

Until this is set up, you can reset someone's password for them in Supabase under **Authentication**, **Users**.

## Things to know

- Anyone who finds the site can make an account on your project. Each account only ever sees its own projects, plus projects someone invited it into.
- An invite link is for one person and works for 14 days. Whoever opens it first while signed in joins that one project; nobody else can use it after that. People who join can change the tattoos but cannot rename, remove or share the project, and they never see the owner's other projects. Taking someone off (or them leaving) also stops their old link working. The free plan holds 500 MB of data and 1 GB of artwork, plenty for this.
- Supabase pauses a free project after a week with no use. Opening the dashboard and pressing **Restore** brings it back; nothing is lost.
- Shared links ("Send to someone") are a frozen copy. Anyone with the link can open that copy. The link id is long and random, and copies cannot be listed.
