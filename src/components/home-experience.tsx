"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Calculator, ChevronDown,
  FileText, HeartHandshake, Landmark, Mail, MapPin,
  Phone, PiggyBank, ShieldCheck, UserRound, WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface HeroSlide { id: string; src?: string; alt: string; }
export interface HomeHighlight { value: string; label: string; }
export interface HomeService { title: string; description: string; icon?: string; href?: string; }
export interface FormDocument { title: string; href?: string; }
export interface NewsNotice { title: string; date: string; href?: string; }
export interface FAQ { question: string; answer: string; }
export interface ContactSettings {
  organisationName: string; streetAddress: string; postalAddress: string; telephone: string; publicEmail: string;
}
export interface HomeExperienceProps {
  heroSlides?: HeroSlide[]; highlights?: HomeHighlight[]; services?: HomeService[];
  forms?: FormDocument[]; news?: NewsNotice[]; faqs?: FAQ[]; contact?: ContactSettings;
}


function Reveal({ children, className = "", immediate = false }: { children: React.ReactNode; className?: string; immediate?: boolean }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={immediate ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: reduce ? 0 : .55, ease: "easeOut" }}>{children}</motion.div>;
}
function Icon({ name }: { name?: string }) {
  const props = { size: 24, strokeWidth: 1.8, "aria-hidden": true as const };
  if (name === "wallet") return <WalletCards {...props} />;
  if (name === "landmark") return <Landmark {...props} />;
  if (name === "heart") return <HeartHandshake {...props} />;
  return <PiggyBank {...props} />;
}

export function HomeExperience({ heroSlides = [], highlights = [], services = [], forms = [], news = [], faqs = [], contact }: HomeExperienceProps) {
  const reduce = useReducedMotion();
  const slides = heroSlides.slice(0, 4);
  const [slide, setSlide] = useState(0);
  const [faq, setFaq] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("");
  const [frequency, setFrequency] = useState("Salary / pay period");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualPauseUntil = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const next = useCallback(() => setSlide((s) => (s + 1) % Math.max(slides.length, 1)), [slides.length]);
  const markManualSlide = useCallback((nextSlide: number) => {
    manualPauseUntil.current = Date.now() + 14000;
    setSlide(nextSlide);
  }, []);
  useEffect(() => {
    if (reduce || slides.length < 2) return;
    timer.current = setTimeout(next, Math.max(7000, manualPauseUntil.current - Date.now()));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [next, slide, reduce, slides.length]);
  const serviceIcons = useMemo(() => services, [services]);
  const membershipForm = forms.find((form) => form.href && /membership/i.test(form.title));

  return (
    <div className="overflow-hidden bg-white">
      <section id="hero" className="home-noise relative bg-soft-blue-grey">
        <div className="site-container grid min-h-[640px] items-center gap-10 py-12 md:py-20 lg:grid-cols-[.92fr_1.08fr] lg:py-24">
          <Reveal immediate className="relative z-10">
            <p className="section-kicker">Bula. Welcome to Service Worker Credit Union.</p>
            <h1 className="display-heading mt-5 max-w-3xl text-[clamp(2.7rem,6.2vw,5.7rem)] font-bold leading-[1.04] text-deep-navy">Save with confidence. Borrow with purpose. Build your future.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-charcoal/80">SWCU helps members build savings, access financial assistance and strengthen the financial wellbeing of their families.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/membership-services#membership" className="home-link button-primary">Become a Member <ArrowRight size={17} /></Link>
              <Link href="/member-login" className="home-link button-secondary">Member Login</Link>
            </div>
            <a href="#loan-calculator" className="mt-6 inline-flex items-center gap-2 font-semibold text-swcu-blue">Try our Loan Calculator <ArrowDownRight size={17} /></a>
          </Reveal>
          <div className="relative min-h-[390px] overflow-hidden rounded-[2rem] bg-deep-navy shadow-[0_24px_60px_rgba(22,59,92,.2)] lg:min-h-[500px]" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStartX.current === null) return; const delta = event.changedTouches[0]?.clientX - touchStartX.current; if (Math.abs(delta) > 42 && slides.length > 1) markManualSlide((slide + (delta < 0 ? 1 : -1) + slides.length) % slides.length); touchStartX.current = null; }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(22,136,135,.55),transparent_32%),linear-gradient(135deg,#163b5c,#176db3)]" />
            <div className="absolute -right-16 -top-16 size-64 rounded-full border-[2rem] border-white/10" /><div className="absolute -bottom-24 -left-16 size-72 rounded-full border-[2.2rem] border-swcu-red/30" />
            {slides.length > 0 ? slides.map((item, i) => <motion.img key={item.id} src={item.src} alt={item.alt} className="absolute inset-0 size-full object-cover" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: i === slide ? 1 : 0 }} transition={{ duration: reduce ? 0 : .8 }} />) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-deep-navy/80 to-transparent p-6 pt-28 text-white">
              <div className="flex items-end justify-between gap-4"><p className="max-w-sm text-sm font-medium text-white/80">{slides.length ? slides[slide]?.alt : "A member-owned future, built together."}</p>
                {slides.length > 1 && <div className="flex gap-2">{slides.map((s, i) => <button key={s.id} aria-label={`Show hero slide ${i + 1}`} aria-pressed={i === slide} onClick={() => markManualSlide(i)} className={`size-2.5 rounded-full ${i === slide ? "bg-white" : "bg-white/40"}`} />)}</div>}</div>
              {slides.length > 1 && <div className="mt-4 flex gap-2"><button aria-label="Previous slide" onClick={() => markManualSlide((slide - 1 + slides.length) % slides.length)} className="grid size-10 place-items-center rounded-full border border-white/30 bg-white/10"><ArrowLeft size={16} /></button><button aria-label="Next slide" onClick={() => markManualSlide((slide + 1) % slides.length)} className="grid size-10 place-items-center rounded-full border border-white/30 bg-white/10"><ArrowRight size={16} /></button></div>}
            </div>
          </div>
        </div>
      </section>

      <section id="quick-actions" className="relative z-10 -mt-1 bg-transparent pb-4 md:-mt-14">
        <div className="site-container grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Join SWCU", UserRound, "/membership-services#membership"], ["Loan Calculator", Calculator, "#loan-calculator"], ["Forms & Downloads", FileText, "/forms-resources"], ["Contact SWCU", Phone, "/contact"]].map(([label, Ico, href]) => <Link key={label as string} href={href as string} className="home-link flex min-h-[92px] items-center gap-4 rounded-2xl border border-deep-navy/10 bg-white p-5 shadow-[0_15px_35px_rgba(22,59,92,.12)]"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-soft-blue-grey text-swcu-blue"><Ico size={21} /></span><span className="font-semibold text-deep-navy">{label as string}</span><ArrowRight className="ml-auto text-swcu-blue" size={17} /></Link>)}
        </div>
      </section>

      <section id="trust-strip" className="border-y border-deep-navy/10 bg-white"><div className="site-container grid divide-y divide-deep-navy/10 py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">{highlights.length > 0 ? highlights.slice(0, 3).map((h) => <Reveal key={h.value} className="flex items-baseline gap-3 px-4 py-5 first:pl-0"><strong className="display-heading text-2xl text-deep-navy md:text-3xl">{h.value}</strong><span className="text-sm font-medium text-charcoal/65">{h.label}</span></Reveal>) : <div className="col-span-full flex items-center gap-3 py-5 text-sm text-charcoal/65"><span className="size-2 rounded-full bg-swcu-blue" />Homepage highlights will appear here when approved.</div>}</div></section>

      <section id="why-swcu" className="bg-soft-blue-grey py-20 md:py-28"><div className="site-container grid gap-12 lg:grid-cols-[1.1fr_.9fr]"><Reveal><p className="section-kicker">Why members choose SWCU</p><h2 className="display-heading mt-4 max-w-xl text-4xl font-bold leading-tight text-deep-navy md:text-5xl">A Credit Union Built Around Its Members</h2><div className="story-line mt-7" /><p className="mt-7 max-w-lg text-lg text-charcoal/75">We are here to help ordinary working people take practical steps toward a stronger financial future.</p><div className="mt-9 flex items-center gap-3 text-sm font-bold text-swcu-blue"><BadgeCheck size={20} /> Member-owned, member-focused</div></Reveal><div className="grid gap-3 sm:grid-cols-2">{["Build Your Savings", "Access Member Loans", "Member Protection", "Personal Member Service"].map((item, i) => <Reveal key={item} className={`flex min-h-[142px] flex-col justify-between border-l-4 p-5 ${i === 0 ? "border-swcu-red bg-white" : "border-swcu-blue/25 bg-white/60"}`}><span className="text-sm font-bold text-swcu-blue">0{i + 1}</span><h3 className="display-heading text-xl font-semibold text-deep-navy">{item}</h3></Reveal>)}</div></div></section>

      <section id="services" className="bg-white py-20 md:py-28"><div className="site-container"><Reveal><p className="section-kicker">What we offer</p><h2 className="display-heading mt-4 max-w-2xl text-4xl font-bold text-deep-navy md:text-5xl">Services for Every Stage of Membership</h2></Reveal>{serviceIcons.length > 0 ? <div className="service-scroller mt-12 flex snap-x gap-4 overflow-x-auto pb-5 md:grid md:grid-cols-4 md:overflow-visible">{serviceIcons.map((service, i) => <Reveal key={service.title} className="min-w-[82vw] snap-start sm:min-w-[340px] md:min-w-0"><Link href={service.href || "#services"} className="home-link group flex min-h-[280px] flex-col justify-between rounded-2xl border border-deep-navy/10 bg-soft-blue-grey p-6"><span className={`grid size-14 place-items-center rounded-full ${i % 2 ? "bg-swcu-blue text-white" : "bg-white text-ocean-teal"}`}><Icon name={service.icon} /></span><div><h3 className="display-heading text-2xl font-semibold text-deep-navy">{service.title}</h3><p className="mt-3 text-charcoal/70">{service.description}</p></div><span className="flex items-center gap-2 text-sm font-bold text-swcu-blue">Explore <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span></Link></Reveal>)}</div> : <div className="mt-12 border-l-4 border-swcu-blue/30 bg-soft-blue-grey p-6 text-charcoal/70">Services will appear here as they are approved and published.</div>}</div></section>

      <section id="loan-calculator" className="bg-deep-navy py-20 text-white md:py-28"><div className="site-container grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center"><Reveal><p className="section-kicker text-white/60">A simple starting point</p><h2 className="display-heading mt-4 text-4xl font-bold md:text-5xl">Plan your next step with clarity.</h2><p className="mt-6 max-w-md text-lg leading-8 text-white/70">Use this simple tool to prepare your questions for SWCU. A repayment calculation will become available once it has been configured and approved.</p><div className="mt-8 flex gap-3 text-sm text-white/65"><ShieldCheck size={20} className="shrink-0 text-ocean-teal" /> No invented rates or figures. Just a clear, honest starting point.</div></Reveal><Reveal className="rounded-[1.5rem] bg-white p-6 text-charcoal shadow-[0_24px_50px_rgba(0,0,0,.16)] md:p-8"><div className="flex items-center justify-between"><div><p className="section-kicker">Loan calculator</p><h3 className="display-heading mt-2 text-2xl font-semibold text-deep-navy">Your estimate</h3></div><Calculator className="text-swcu-blue" /></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Loan Amount<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Enter amount" className="min-h-12 rounded-xl border border-deep-navy/15 px-4 outline-none focus:border-swcu-blue" /></label><label className="grid gap-2 text-sm font-semibold">Loan Term<input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Enter months" className="min-h-12 rounded-xl border border-deep-navy/15 px-4 outline-none focus:border-swcu-blue" /></label></div><label className="mt-5 grid gap-2 text-sm font-semibold">Repayment Frequency / salary/pay period<select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="min-h-12 rounded-xl border border-deep-navy/15 bg-white px-4"><option>Salary / pay period</option><option>Weekly</option><option>Fortnightly</option><option>Monthly</option></select></label><div className="mt-7 rounded-xl bg-soft-blue-grey p-5"><p className="text-sm font-semibold text-charcoal/65">Estimated Repayment</p><p className="mt-2 font-heading text-2xl font-bold text-deep-navy">Calculation coming soon</p><p className="mt-2 text-sm leading-6 text-charcoal/70">Repayment figures are estimates only. Actual terms and loan approval are subject to SWCU requirements and approval.</p></div><button type="button" disabled className="mt-5 min-h-12 w-full cursor-not-allowed rounded-xl bg-deep-navy/10 font-bold text-deep-navy/45">Calculate when configured</button></Reveal></div></section>

      <section id="become-a-member" className="bg-soft-blue-grey py-20 md:py-28"><div className="site-container"><Reveal><p className="section-kicker">A simple journey</p><h2 className="display-heading mt-4 text-4xl font-bold text-deep-navy md:text-5xl">Become a Member</h2></Reveal><div className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-0">{[["01", "Check Your Eligibility"], ["02", "Complete Your Application"], ["03", "Start Saving"]].map(([number, title], i) => <Reveal key={number} className="relative flex gap-5 md:block md:pr-10"><div className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full bg-swcu-blue font-heading font-bold text-white ring-8 ring-soft-blue-grey">{number}</div><div className="pt-1 md:mt-7"><h3 className="display-heading text-xl font-semibold text-deep-navy">{title}</h3><p className="mt-2 text-charcoal/65">{i === 0 ? "Learn more about joining SWCU." : i === 1 ? "Take the next step with the right information." : "Begin your journey with a member-owned credit union."}</p></div>{i < 2 && <span className="absolute left-7 top-14 h-[calc(100%+2rem)] w-px bg-swcu-blue/25 md:left-7 md:top-7 md:h-px md:w-[calc(100%-1rem)]" />}</Reveal>)}</div><div className="mt-12 flex flex-wrap gap-3"><Link href="/membership-services#membership" className="button-primary">Membership Details <ArrowRight size={17} /></Link>{membershipForm && <a href={membershipForm.href} className="button-secondary">Download Membership Form <FileText size={17} /></a>}</div></div></section>

      <section id="member-app" className="app-grid relative overflow-hidden bg-deep-navy py-20 text-white md:py-28"><div className="absolute -right-48 top-10 size-[30rem] rounded-full border border-white/10" /><div className="site-container grid items-center gap-14 lg:grid-cols-[1fr_.9fr]"><Reveal><p className="section-kicker text-white/60">Coming soon</p><h2 className="display-heading mt-4 max-w-xl text-5xl font-bold leading-tight">Your SWCU. Wherever You Are.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-white/70">A future digital member experience designed to make it easier to stay connected with SWCU.</p><div className="mt-8 flex flex-wrap gap-3">{["Balances", "Loans", "Transactions", "Statements", "Forms & Requests", "Member Notices"].map((x) => <span key={x} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">{x}</span>)}</div><button type="button" className="button-secondary mt-10 border-white/30 bg-white/10 text-white hover:bg-white/15">Member App — Coming Soon</button></Reveal><Reveal className="flex justify-center lg:justify-end"><div className="relative w-[min(78vw,300px)] rotate-2 rounded-[2.7rem] border-[7px] border-charcoal bg-charcoal p-2 shadow-[0_28px_70px_rgba(0,0,0,.35)]"><div className="overflow-hidden rounded-[2rem] bg-soft-blue-grey text-charcoal"><div className="bg-swcu-blue px-5 pb-8 pt-7 text-white"><p className="text-xs font-semibold text-white/70">SWCU MEMBER APP</p><p className="mt-3 font-heading text-2xl font-bold">Welcome back</p><div className="mt-5 rounded-xl bg-white/15 p-4"><p className="text-xs text-white/70">Your member home</p><p className="mt-1 text-sm font-semibold">Your details, in one place</p></div></div><div className="grid grid-cols-2 gap-3 p-4">{["Balances", "Loans", "Transactions", "Statements"].map((x) => <div key={x} className="rounded-xl bg-white p-3 text-xs font-semibold shadow-sm">{x}<span className="mt-3 block h-2 w-10 rounded bg-swcu-blue/20" /></div>)}</div></div></div></Reveal></div></section>

      <section id="help-resources" className="bg-white py-20 md:py-28"><div className="site-container grid gap-14 lg:grid-cols-[.9fr_1.1fr]"><Reveal><p className="section-kicker">Useful to have nearby</p><h2 className="display-heading mt-4 text-4xl font-bold text-deep-navy md:text-5xl">Help & Resources</h2><div className="mt-10 border-t border-deep-navy/10">{forms.slice(0, 6).map((form) => <div key={form.title} className="flex items-center justify-between border-b border-deep-navy/10 py-5"><span className="flex items-center gap-3 font-semibold text-deep-navy"><FileText size={19} className="text-swcu-blue" />{form.title}</span>{form.href && <a href={form.href} className="text-sm font-bold text-swcu-blue">Download</a>}</div>)}{!forms.length && <p className="py-5 text-charcoal/65">Approved forms and documents will appear here when available.</p>}</div>{news.slice(0, 3).length > 0 && <div className="mt-12"><p className="section-kicker">Latest from SWCU</p>{news.slice(0, 3).map((item) => <Link key={item.title} href={item.href || "#help-resources"} className="mt-4 block border-b border-deep-navy/10 pb-4"><span className="text-xs font-bold text-swcu-red">{item.date}</span><span className="mt-1 block font-semibold text-deep-navy">{item.title}</span></Link>)}</div>}</Reveal><Reveal><div className="rounded-2xl bg-soft-blue-grey p-6 md:p-8"><p className="section-kicker">Common questions</p><div className="mt-5 divide-y divide-deep-navy/10">{faqs.map((item, i) => <div key={item.question}><button type="button" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)} className="flex min-h-16 w-full items-center justify-between gap-4 text-left font-semibold text-deep-navy">{item.question}<ChevronDown size={19} className={`shrink-0 transition-transform ${faq === i ? "rotate-180" : ""}`} /></button><AnimatePresence initial={false}>{faq === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }} className="overflow-hidden"><p className="pb-5 pr-8 text-charcoal/70">{item.answer}</p></motion.div>}</AnimatePresence></div>)}{!faqs.length && <p className="py-4 text-charcoal/65">Frequently asked questions will appear here as they are approved.</p>}</div></div>{contact && <div className="mt-5 grid gap-4 rounded-2xl bg-deep-navy p-6 text-white md:grid-cols-[1fr_auto] md:items-center"><div><p className="section-kicker text-white/60">Contact SWCU</p><h3 className="display-heading mt-2 text-2xl font-semibold">{contact.organisationName}</h3><p className="mt-2 text-sm leading-6 text-white/70"><MapPin size={14} className="mr-1 inline" />{contact.streetAddress}<br />{contact.postalAddress}</p></div><div className="text-sm text-white/80"><a className="flex items-center gap-2" href={`tel:${contact.telephone}` }><Phone size={15} />{contact.telephone}</a><a className="mt-2 flex items-center gap-2" href={`mailto:${contact.publicEmail}`}><Mail size={15} />{contact.publicEmail}</a></div></div>}</Reveal></div></section>
    </div>
  );
}