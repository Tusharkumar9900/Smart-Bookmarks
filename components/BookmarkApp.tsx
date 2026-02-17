"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LogOut, Plus, Trash2 } from "lucide-react";


import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Bookmark = {
  id: string;
  user_id: string;
  url: string;
  title: string;
  created_at: string;
};

export function BookmarkApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Auth: load user and listen for changes (Google OAuth only)
  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      setLoadingUser(true);
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (authError) console.error("Auth error", authError);
      setUser(currentUser ?? null);
      setLoadingUser(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Load bookmarks from DB + 4. Realtime: subscribe so other tabs update
  useEffect(() => {
    if (!user) {
      setBookmarks([]);
      return;
    }
    

    let isMounted = true;

    async function loadBookmarks() {
      setLoadingBookmarks(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;
      if (fetchError) {
        console.error("Fetch bookmarks error", fetchError);
        setError("Failed to load bookmarks.");
      } else if (data) {
        setBookmarks(data as Bookmark[]);
      }
      setLoadingBookmarks(false);
    }

    loadBookmarks();

    const channel = supabase
      .channel(`bookmarks:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setBookmarks((current) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Bookmark;
              if (current.some((b) => b.id === row.id)) return current;
              return [row, ...current].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              );
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as Bookmark;
              return current.filter((b) => b.id !== row.id);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Bookmark;
              return current
                .map((b) => (b.id === row.id ? row : b))
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function handleSignInWithGoogle() {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (authError) {
      console.error("Sign in error", authError);
      setError("Could not sign in with Google. Try again.");
    }
  }

  async function handleSignOut() {
    setError(null);
    await supabase.auth.signOut();
  }

  // async function handleAddBookmark(e: React.FormEvent) {
  //   e.preventDefault();
  //   if (!user) return;
  //   if (!url.trim()) {
  //     setError("Please enter a URL.");
  //     return;
  //   }

  //   setSubmitting(true);
  //   setError(null);

  //   const { error: insertError } = await supabase.from("bookmarks").insert({
  //     user_id: user.id,
  //     url: url.trim(),
  //     title: title.trim() || url.trim(),
  //   });

  //   if (insertError) {
  //     console.error("Insert error", insertError);
  //     setError("Could not add bookmark. Try again.");
  //   } else {
  //     setUrl("");
  //     setTitle("");
  //   }
  //   setSubmitting(false);
  // }

  async function handleAddBookmark(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
  
    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }
  
    setSubmitting(true);
    setError(null);
  
    // 🔥 Create temporary optimistic bookmark
    const tempBookmark: Bookmark = {
      id: crypto.randomUUID(),
      user_id: user.id,
      url: url.trim(),
      title: title.trim() || url.trim(),
      created_at: new Date().toISOString(),
    };
  
    // ⚡ Instantly update UI
    setBookmarks((current) => [tempBookmark, ...current]);
  
    setUrl("");
    setTitle("");
  
    const { error: insertError } = await supabase
      .from("bookmarks")
      .insert({
        user_id: user.id,
        url: tempBookmark.url,
        title: tempBookmark.title,
      });
  
    if (insertError) {
      console.error("Insert error", insertError);
      setError("Could not add bookmark.");
      
      // ❌ Rollback if DB fails
      setBookmarks((current) =>
        current.filter((b) => b.id !== tempBookmark.id)
      );
    }
  
    setSubmitting(false);
  }
  

  // async function handleDeleteBookmark(id: string) {
  //   setError(null);
  //   const { error: deleteError } = await supabase
  //     .from("bookmarks")
  //     .delete()
  //     .eq("id", id);
  //   if (deleteError) {
  //     console.error("Delete error", deleteError);
  //     setError("Could not delete bookmark. Try again.");
  //   }
  // }

  async function handleDeleteBookmark(id: string) {
    setError(null);
  
    // 🔥 Store current state for rollback
    const previousBookmarks = bookmarks;
  
    // ⚡ Instantly remove from UI
    setBookmarks((current) => current.filter((b) => b.id !== id));
  
    const { error: deleteError } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);
  
    if (deleteError) {
      console.error("Delete error", deleteError);
      setError("Could not delete bookmark.");
  
      // ❌ Rollback if delete fails
      setBookmarks(previousBookmarks);
    }
  }
  

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <p className="text-sm text-slate-300">Loading...</p>
      </div>
    );
  }

  // if (!user) {
  //   return (
  //     <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
  //       <Card className="w-full max-w-md border border-white/10 bg-card/90 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl">
  //         <CardHeader className="pb-4">
  //           <CardTitle className="text-xl font-semibold text-slate-50">
  //             Smart Bookmark App
  //           </CardTitle>
  //           <CardDescription className="text-base text-slate-200">
  //             Sign in with Google to save and manage your bookmarks. Your list
  //             is private and syncs in real time across tabs.
  //           </CardDescription>
  //         </CardHeader>
  //         <CardContent>
  //           {error ? (
  //             <p className="mb-4 text-sm text-destructive">{error}</p>
  //           ) : null}
  //           <Button
  //             type="button"
  //             onClick={handleSignInWithGoogle}
  //             className="w-full bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
  //           >
  //             Continue with Google
  //           </Button>
  //         </CardContent>
  //       </Card>
  //     </div>
  //   );
  // }

  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6">
        
        {/* Background glow */}
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
  
        <div className="relative grid w-full max-w-5xl gap-10 md:grid-cols-2 items-center">
          
          {/* Left Side */}
          <div className="space-y-6 text-slate-100">
            <h1 className="text-4xl font-bold leading-tight">
              Save, Organize & Access  
              <span className="text-emerald-400"> Your Bookmarks</span>
            </h1>
            <p className="text-slate-300 text-lg">
              A simple and private bookmark manager with real-time sync.
              Access your saved links anywhere.
            </p>
  
            <div className="flex gap-4 text-sm text-slate-400">
              <span>✔ Google Secure Login</span>
              <span>✔ Real-time Sync</span>
              <span>✔ Private Data</span>
            </div>
          </div>
  
          {/* Right Side Login Card */}
          {/* <Card className="border border-white/10 bg-card/90 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xl text-slate-50">
                Get Started
              </CardTitle>
              <CardDescription className="text-slate-300">
                Sign in with Google to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 text-sm text-destructive">{error}</p>
              )}
              <Button
                type="button"
                onClick={handleSignInWithGoogle}
                className="w-full bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
              >
                Continue with Google
              </Button>
            </CardContent>
          </Card> */
          
          <Card className="relative border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-emerald-500/20 rounded-2xl overflow-hidden">

  {/* Glow Border Effect */}
  <div className="absolute inset-0 rounded-2xl border border-emerald-500/20 pointer-events-none" />

  <CardHeader className="space-y-3">
    <CardTitle className="text-2xl font-semibold text-white">
      Get Started
    </CardTitle>
    <CardDescription className="text-slate-400 text-sm">
      Sign in securely with Google and start managing your bookmarks.
    </CardDescription>
  </CardHeader>

  <CardContent className="space-y-6">
    {error && (
      <p className="text-sm text-red-400">{error}</p>
    )}

    <Button
      type="button"
      onClick={handleSignInWithGoogle}
      className="group relative w-full overflow-hidden rounded-xl bg-emerald-500 py-6 text-lg font-medium text-emerald-950 shadow-lg shadow-emerald-500/40 transition-all duration-300 hover:bg-emerald-400 hover:scale-[1.02]"
    >
      <span className="relative z-10">
        Continue with Google
      </span>

      {/* Animated shine effect */}
      <span className="absolute left-0 top-0 h-full w-full translate-x-[-100%] bg-white/20 blur-xl transition-transform duration-700 group-hover:translate-x-[100%]" />
    </Button>

    <p className="text-center text-xs text-slate-500">
      We don’t store your passwords. Authentication handled by Google.
    </p>
  </CardContent>
</Card>

          }
        </div>
      </div>
    );
  }
  

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-foreground">
      <Card className="w-full max-w-3xl border border-white/10 bg-card/90 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-xl font-semibold text-slate-50">
              Smart Bookmark App
            </CardTitle>
            <CardDescription className="text-base text-slate-200">
              Save links you care about. Your bookmarks are private and update
              in real time across tabs.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="shrink-0 gap-2 border-white/20 text-slate-200 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <form
            onSubmit={handleAddBookmark}
            className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-slate-900/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.9)] sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-100">
                  Link address
                </p>
                <Input
                  type="url"
                  required
                  placeholder="https://your-awesome-link.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-xs text-slate-300">
                  Paste the full URL of the page you want to save.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-100">Title</p>
                <Input
                  type="text"
                  placeholder="Optional friendly name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="mt-3 w-full bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 sm:mt-0 sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add bookmark
            </Button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-medium text-slate-100">
              <span>Saved bookmarks</span>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                {loadingBookmarks ? "…" : `${bookmarks.length} saved`}
              </span>
            </div>

            {bookmarks.length === 0 && !loadingBookmarks ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center text-sm text-slate-200">
                <p className="max-w-sm">
                  You don&apos;t have any bookmarks yet. Add your first link
                  using the form above.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-black/30">
                {bookmarks.map((bookmark) => (
                  <li
                    key={bookmark.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div className="min-w-0 space-y-1">
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {bookmark.title || bookmark.url}
                      </a>
                      <p className="truncate text-xs text-slate-400">
                        {bookmark.url}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteBookmark(bookmark.id)}
                      aria-label="Delete bookmark"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
