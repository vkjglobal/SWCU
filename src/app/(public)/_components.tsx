"use client";

import { ChevronDown, Menu, X, Phone, Mail, MapPin, ArrowRight, UserRound, LogIn, MessageCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { FormEvent } from "react";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const links = [
    ["/", "Home"], ["/about-swcu", "About SWCU"], ["/membership-services", "Membership & Services"],
    ["/forms-resources", "Forms & Resources"], ["/contact", "Contact"],
  ];
  return <header className="sticky top-0 z-50 border-b border-deep-navy/10 bg-white/95 backdrop-blur">
    <div className="site-container flex min-h-20 min-w-0 items-center gap-2 py-2 sm:gap-4">
      <Link href="/" aria-label="SWCU home" className="shrink-0"><Image src="/brand/swcu/swcu-logo-transparent.png" alt="Service Worker Credit Union" width={150} height={105} priority className="w-[104px] sm:w-[132px]"/></Link>
      <nav className="ml-auto hidden items-center gap-1 xl:flex" aria-label="Main navigation">{links.map(([href, label]) => <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-semibold text-charcoal hover:text-swcu-blue">{label}</Link>)}</nav>
       <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 xl:ml-3"><Link href="/membership-services#membership" className="header-join button-secondary">Join SWCU</Link><Link href="/member-login" className="button-primary header-member-login whitespace-nowrap">Member Login</Link><button type="button" className="grid size-11 shrink-0 place-items-center rounded-lg border border-deep-navy/15 text-deep-navy sm:size-12 xl:hidden" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div>
    </div>
    {open && <nav id="mobile-navigation" className="site-container border-t border-deep-navy/10 py-4 xl:hidden" aria-label="Mobile navigation"><div className="grid gap-1">{links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-semibold text-charcoal">{label}</Link>)}<Link href="/membership-services#membership" onClick={() => setOpen(false)} className="mt-2 rounded-lg border border-swcu-blue px-3 py-3 font-semibold text-swcu-blue">Join SWCU</Link></div></nav>}
  </header>;
}

export function MobileQuickActions({ phone }: { phone?: string | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const onScroll = () => setVisible(window.scrollY > 420); window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); return () => window.removeEventListener("scroll", onScroll); }, []);
  if (!visible) return null;
  return <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-deep-navy/15 bg-white/95 px-2 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_25px_rgba(22,59,92,.12)] backdrop-blur md:hidden" role="navigation" aria-label="Quick actions"><Link href="/membership-services#membership" aria-label="Join Service Worker Credit Union" className="grid min-h-11 place-items-center gap-0.5 rounded-md text-center text-[0.68rem] font-bold text-swcu-blue"><UserRound size={18} aria-hidden="true"/><span>Join</span></Link><Link href="/member-login" aria-label="Sign in to Member Login" className="grid min-h-11 place-items-center gap-0.5 border-x border-deep-navy/10 text-center text-[0.68rem] font-bold text-swcu-blue"><LogIn size={18} aria-hidden="true"/><span>Login</span></Link>{phone ? <a href={`tel:${phone}`} aria-label={`Call SWCU at ${phone}`} className="grid min-h-11 place-items-center gap-0.5 rounded-md text-center text-[0.68rem] font-bold text-swcu-blue"><Phone size={18} aria-hidden="true"/><span>Call</span></a> : <Link href="/contact" aria-label="Contact Service Worker Credit Union" className="grid min-h-11 place-items-center gap-0.5 rounded-md text-center text-[0.68rem] font-bold text-swcu-blue"><MessageCircle size={18} aria-hidden="true"/><span>Contact</span></Link>}</div>;
}

export function InnerHero({ eyebrow, title, summary }: { eyebrow?: string; title: string; summary?: string }) {
  return <section className="route-placeholder"><div className="site-container">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{summary && <p className="max-w-2xl text-lg text-charcoal/75">{summary}</p>}</div></section>;
}

export function Content({ heading, body }: { heading?: string | null; body?: string | null }) {
  if (!body && !heading) return null;
  return <article className="prose prose-lg max-w-none text-charcoal/80"><h2 className="display-heading text-3xl text-deep-navy">{heading}</h2>{body?.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</article>;
}

export function AvailabilityState({ heading, children }: { heading: string; children: ReactNode }) {
  return <div className="section-placeholder min-h-0 place-items-start text-left"><div><p className="eyebrow">Information unavailable</p><h2>{heading}</h2><p>{children}</p><Link href="/contact" className="button-secondary mt-5">Contact SWCU</Link></div></div>;
}

export function AnchorNav({ items }: { items: [string, string][] }) {
  return <nav aria-label="On this page" className="sticky top-20 z-10 border-y border-deep-navy/10 bg-white/95 py-3 backdrop-blur"><div className="site-container flex gap-2 overflow-x-auto whitespace-nowrap">{items.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full border border-deep-navy/15 px-4 py-2 text-sm font-semibold text-swcu-blue">{label}</a>)}</div></nav>;
}

export function ResourceCard({ title, description, href, label = "Download" }: { title: string; description?: string | null; href?: string; label?: string }) {
  return <article className="flex min-h-44 flex-col rounded-2xl border border-deep-navy/10 bg-white p-5 shadow-[0_12px_30px_rgba(22,59,92,.06)]"><h3 className="display-heading text-xl font-semibold text-deep-navy">{title}</h3>{description && <p className="mt-2 text-sm text-charcoal/70">{description}</p>}{href && <a href={href} className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-swcu-blue">{label}<ArrowRight size={16}/></a>}</article>;
}

export function FAQList({ faqs }: { faqs: { id: string; question: string; answer: string }[] }) {
  return <div className="divide-y divide-deep-navy/10 rounded-2xl border border-deep-navy/10 bg-white">{faqs.map((faq) => <details key={faq.id} className="group p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-deep-navy [&::-webkit-details-marker]:hidden">{faq.question}<ChevronDown className="shrink-0 transition-transform group-open:rotate-180"/></summary><p className="max-w-3xl pt-4 text-charcoal/75">{faq.answer}</p></details>)}</div>;
}

export function PublicFooter({ contact, published }: { contact: { organisationName: string; streetAddress: string; postalAddress: string; telephone: string; publicEmail: string } | null; published: { privacy: boolean; terms: boolean; accessibility: boolean } }) {
  return <footer className="border-t-4 border-swcu-red bg-deep-navy pb-24 text-white md:pb-0"><div className="site-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4"><div><p className="font-heading text-xl font-bold">SWCU</p><p className="mt-3 max-w-xs text-sm text-white/75">Service Worker Credit Union. A member-owned credit union serving Fiji members.</p></div><div><p className="font-heading font-semibold">Member Services</p><div className="mt-3 grid gap-2 text-sm text-white/75"><Link href="/membership-services#membership">Membership</Link><Link href="/membership-services#savings">Savings</Link><Link href="/membership-services#loans">Loans</Link></div></div><div><p className="font-heading font-semibold">Resources</p><div className="mt-3 grid gap-2 text-sm text-white/75"><Link href="/forms-resources">Forms & Resources</Link><Link href="/about-swcu">About SWCU</Link><Link href="/contact">Contact</Link></div></div><div><p className="font-heading font-semibold">Contact</p>{contact && <div className="mt-3 grid gap-2 text-sm text-white/75"><span className="flex gap-2"><MapPin size={16}/>{contact.streetAddress}<br/>{contact.postalAddress}</span><a className="flex gap-2" href={`tel:${contact.telephone}`}><Phone size={16}/>{contact.telephone}</a><a className="flex gap-2" href={`mailto:${contact.publicEmail}`}><Mail size={16}/>{contact.publicEmail}</a></div>}</div></div><div className="border-t border-white/10"><div className="site-container py-5 text-sm text-white/75"><p className="font-heading font-semibold text-white">Important Information</p><div className="mt-4 flex flex-wrap gap-4">{published.privacy && <Link href="/privacy">Privacy</Link>}{published.terms && <Link href="/terms-of-use">Terms of Use</Link>}{published.accessibility && <Link href="/accessibility">Accessibility</Link>}<Link href="/important-information">Important Information</Link></div></div></div></footer>;
}

export function ContactForm({ subjects }: { subjects: readonly string[] }) {
  const [state, setState] = useState<"idle"|"sending"|"success"|"error">("idle"); const [message, setMessage] = useState(""); const [subject, setSubject] = useState(subjects[0] ?? "");
  const callbackRequested = subject === "Request a Call Back";
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setState("sending"); setMessage(""); const form = new FormData(event.currentTarget); const value = Object.fromEntries(form.entries()); try { const res = await fetch("/api/contact", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({...value, privacyAcknowledged: form.get("privacyAcknowledged") === "on"}) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setState("success"); setMessage(`Your enquiry has been received. Reference: ${data.reference}`); event.currentTarget.reset(); } catch (e) { setState("error"); setMessage(e instanceof Error ? e.message : "Unable to send your enquiry."); } }
  return <form onSubmit={submit} className="grid gap-5 rounded-2xl bg-soft-blue-grey p-6 md:p-8"><div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 font-semibold">Name<input required name="name" aria-required="true" className="min-h-12 rounded-xl border border-deep-navy/15 bg-white px-4" /></label><label className="grid gap-2 font-semibold">Email<input required type="email" name="email" aria-required="true" className="min-h-12 rounded-xl border border-deep-navy/15 bg-white px-4" /></label></div><label className="grid gap-2 font-semibold">Phone <span className="text-sm font-normal text-charcoal/60">{callbackRequested ? "required for a call back" : "optional"}</span><input required={callbackRequested} aria-required={callbackRequested} name="phone" className="min-h-12 rounded-xl border border-deep-navy/15 bg-white px-4" /></label><label className="grid gap-2 font-semibold">Subject<select required name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} aria-required="true" className="min-h-12 rounded-xl border border-deep-navy/15 bg-white px-4">{subjects.map(s=><option key={s}>{s}</option>)}</select></label><label className="grid gap-2 font-semibold">Message <span className="text-sm font-normal text-charcoal/60">{callbackRequested ? "optional for a call back request" : "required"}</span><textarea required={!callbackRequested} minLength={callbackRequested ? undefined : 5} aria-required={!callbackRequested} name="message" rows={5} className="rounded-xl border border-deep-navy/15 bg-white p-4"/></label><label className="flex gap-3 text-sm"><input required type="checkbox" name="privacyAcknowledged" className="mt-1 size-4"/><span>I acknowledge the published Privacy information.</span></label><input name="website" tabIndex={-1} autoComplete="off" className="hidden"/><button disabled={state==="sending"} className="button-primary w-fit">{state==="sending" ? "Sending…" : "Send enquiry"}</button>{message && <p role={state==="error"?"alert":"status"} className={state==="error"?"text-swcu-red":"text-ocean-teal"}>{message}</p>}</form>;
}