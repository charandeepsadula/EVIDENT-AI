"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage(){
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 const isSupabaseConfigured = Boolean(
   process.env.NEXT_PUBLIC_SUPABASE_URL &&
   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 );
 const local = !isSupabaseConfigured || process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === "true";

 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setMessage("");setBusy(true);
  if(local){
   const target=new URLSearchParams(window.location.search).get("next");router.replace(target?.startsWith("/")&&!target.startsWith("//")?target:"/");return;
  }
  const supabase=createClient();if(!supabase){setMessage("Supabase is not configured. Local workspace mode is available.");setBusy(false);return;}
  const form=new FormData(event.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:String(form.get("email")),password:String(form.get("password"))});setBusy(false);
  if(error){setMessage(error.message);return;}const target=new URLSearchParams(window.location.search).get("next");router.replace(target?.startsWith("/")&&!target.startsWith("//")?target:"/");router.refresh();
 }
 return <main className="login-wrap"><section className="login-card"><Link href="/" className="brand login-brand"><span className="brand-mark">E</span><span>EVIDENT<span className="brand-light"> AI</span><small>INVESTIGATION PLATFORM</small></span></Link><h1>{local?"Open workspace":"Welcome back"}</h1><p>{local?"Local workspace is ready. Supabase authentication is optional.":"Sign in to your investigation workspace."}</p>
 {local?<form onSubmit={submit}><div className="form-safety"><span>i</span><p>Local workspace mode is active with SQLite storage. Investigations and evidence are saved locally.</p></div><button className="button button-primary" type="submit" disabled={busy}>{busy?"Opening…":"Open workspace →"}</button>{message&&<p className="form-message" role="status">{message}</p>}</form>:<form onSubmit={submit}><label className="field-label" htmlFor="email">Email address</label><input className="text-input" id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required/><label className="field-label" htmlFor="password">Password</label><input className="text-input" id="password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required/><button className="button button-primary" type="submit" disabled={busy}>{busy?"Signing in…":"Sign in →"}</button>{message&&<p className="form-message" role="status">{message}</p>}</form>}
 <div className="login-foot">{local?"Supabase authentication is optional. Add credentials if multi-user accounts are desired.":<>New to EVIDENT AI? <Link href="/register">Create an account</Link></>}</div></section></main>;
}
