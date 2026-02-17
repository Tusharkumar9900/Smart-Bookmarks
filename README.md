Smart Bookmark App built with Next.js App Router, Supabase, and Tailwind CSS.

## Features

- **Google sign-in only**: Users authenticate with Google via Supabase Auth.
- **Private bookmarks**: Each user sees only their own bookmarks.
- **Realtime updates**: Bookmark list stays in sync across tabs without refresh.
- **Basic CRUD**: Add and delete bookmarks (URL + title).

## Getting Started (Local)

1. **Install dependencies**

```bash
npm install
```

2. **Configure Supabase**

- Create a Supabase project.
- In the Supabase dashboard, create a `bookmarks` table with at least:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null`
  - `url text not null`
  - `title text not null`
  - `created_at timestamp with time zone default now()`
- Enable **Row Level Security** on `bookmarks` and add policies such as:
  - `SELECT`, `INSERT`, and `DELETE` with expression `user_id = auth.uid()`.

3. **Set environment variables**

Create a `.env` file in the project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run the development server**

```bash
npm run dev
```

Open `http://localhost:3000` with your browser, sign in with Google, and start adding bookmarks.

## Deploy on Vercel

1. Push this app to a Git repository (GitHub, GitLab, etc.).
2. Create a new Vercel project from that repository.
3. In the Vercel project settings, under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. In the Supabase dashboard, for the Google provider, add your Vercel URL
   (for example, `https://your-app.vercel.app`) as an **Allowed Redirect URL**.

After deployment, your live Vercel URL will serve the fully working Smart Bookmark App.
