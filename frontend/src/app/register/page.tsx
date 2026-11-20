"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage(){
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [success,setSuccess]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setMessage(""); setBusy(true);
    const supabase=createClient();
    if(!supabase){setMessage("Supabase is not configured. Add the project URL and publishable key to frontend/.env.local, then restart the dev server.");setBusy(false);return;}
    const form=new FormData(event.currentTarget);
    const {data,error}=await supabase.auth.signUp({email:String(form.get("email")),password:String(form.get("password")),options:{data:{full_name:String(form.get("name"))}}});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    if(data.session){window.location.assign("/");return;}
    setSuccess(true);setMessage("Account created. Check your email for the verification link, then sign in.");
  }
  return <main className="login-wrap"><section className="login-card"><Link href="/" className="brand login-brand"><span className="brand-mark">E</span><span>EVIDENT<span className="brand-light"> AI</span><small>INVESTIGATION PLATFORM</small></span></Link><h1>Create your account</h1><p>Set up a workspace for evidence-backed investigations.</p><form onSubmit={submit}><label className="field-label" htmlFor="name">Full name</label><input className="text-input" id="name" name="name" autoComplete="name" placeholder="Your name" required/><label className="field-label" htmlFor="email">Email address</label><input className="text-input" id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required/><label className="field-label" htmlFor="password">Password</label><input className="text-input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} placeholder="At least 10 characters" required/><button className="button button-primary" type="submit" disabled={busy}>{busy?"Creating account…":"Create account →"}</button>{message&&<p className={success?"form-message success-message":"form-message"} role="status">{message}</p>}</form><div className="login-foot">Already have an account? <Link href="/login">Sign in</Link></div></section></main>;
}
