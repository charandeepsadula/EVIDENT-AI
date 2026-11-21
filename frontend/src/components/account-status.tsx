"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
const isLocalWorkspace = !isSupabaseConfigured || process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === "true";

export function AccountStatus(){
  const [email,setEmail]=useState<string|null>(isLocalWorkspace ? "Local workspace" : null);
  const [ready,setReady]=useState(isLocalWorkspace);
  useEffect(()=>{
    if(isLocalWorkspace)return;
    const supabase=createClient();
    if(!supabase){setReady(true);return;}
    void supabase.auth.getUser().then(({data})=>{setEmail(data.user?.email??null);setReady(true);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setEmail(session?.user.email??null);setReady(true);});
    return ()=>subscription.unsubscribe();
  },[]);
  async function signOut(){if(isLocalWorkspace){window.location.assign("/login");return;}const supabase=createClient();if(supabase){await supabase.auth.signOut();window.location.assign("/login");}}
  if(!ready||!email)return <Link href="/login" className="user-card"><span className="user-avatar">G</span><span><b>Guest account</b><small>Sign in to save investigations</small></span><span className="select-caret">↗</span></Link>;
  return <div className="user-card"><span className="user-avatar">{email[0]?.toUpperCase()}</span><span className="account-identity"><b>{email}</b><small>{isLocalWorkspace ? "SQLite Vault" : "Signed in"}</small></span>{isLocalWorkspace ? null : <button className="signout-button" onClick={signOut} type="button">Sign out</button>}</div>;
}
