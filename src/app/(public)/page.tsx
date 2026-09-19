import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MotionReveal } from "@/components/motion-reveal";

const chapters = [
  {
    id: "hero",
    number: "01",
    title: "Hero",
    description:
      "Fixed member-first copy and actions with a clean branded media boundary prepared for 1–4 future CMS-managed images.",
  },
  {
    id: "quick-actions",
    number: "02",
    title: "Quick Actions",
    description:
      "Reserved for the four clear member actions defined in the master specification.",
  },
  {
    id: "trust-strip",
    number: "03",
    title: "Trust Strip",
    description:
      "A protected boundary for future Administrator-managed homepage highlights.",
  },
  {
    id: "why-swcu",
    number: "04",
    title: "Why SWCU",
    description: "Reserved for concise member benefits and accessible icon-led content.",
  },
  {
    id: "services",
    number: "05",
    title: "Services",
    description:
      "Reserved for Savings, Loans, Retirement Savings and Death Benefit service cards.",
  },
  {
    id: "loan-calculator",
    number: "06",
    title: "Loan Calculator",
    description:
      "Safe component boundary only. No formula, visible interest rate or financial calculation has been implemented.",
  },
  {
    id: "become-a-member",
    number: "07",
    title: "Become a Member",
    description: "Reserved for the simple three-step membership journey.",
  },
  {
    id: "member-app",
    number: "08",
    title: "Member App Preview",
    description:
      "A branded placeholder for the future separate Member App. No member application work exists here.",
  },
  {
    id: "help-resources",
    number: "09",
    title: "Help & Resources",
    description:
      "Reserved for forms, approved notices, common questions and compact contact guidance.",
  },
];

export default function HomePage() {
  return (
    <>
      <section
        id="hero"
        className="scroll-mt-28 overflow-hidden bg-white py-16 md:py-24"
      >
        <div className="site-container grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">Bula. Welcome to Service Worker Credit Union.</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl font-bold leading-[1.08] text-deep-navy sm:text-5xl lg:text-6xl">
              Save with confidence. Borrow with purpose. Build your future.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-charcoal/80">
              SWCU helps members build savings, access financial assistance and
              strengthen the financial wellbeing of their families.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/membership-services#membership" className="button-primary">
                Become a Member <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/member-login" className="button-secondary">
                Member Login
              </Link>
            </div>
            <a
              href="#loan-calculator"
              className="mt-5 inline-flex items-center gap-2 font-semibold text-swcu-blue"
            >
              Try our Loan Calculator <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div
            className="relative grid min-h-[22rem] place-items-center overflow-hidden rounded-[1.5rem] bg-deep-navy p-8 text-center text-white shadow-card"
            aria-label="Future CMS-managed Home Hero media slot"
          >
            <div className="absolute -right-24 -top-24 size-72 rounded-full border-[3rem] border-swcu-blue/50" />
            <div className="absolute -bottom-28 -left-28 size-72 rounded-full border-[2rem] border-swcu-red/35" />
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/65">
                Home Hero media slot
              </p>
              <p className="mt-3 font-heading text-2xl font-semibold">
                Approved member photography will be managed through the CMS and R2.
              </p>
            </div>
          </div>
        </div>
      </section>

      {chapters.slice(1).map((chapter) => (
        <section key={chapter.id} id={chapter.id} className="section-shell scroll-mt-28">
          <div className="site-container">
            <MotionReveal>
              <div className="section-placeholder">
                <div>
                  <p className="eyebrow">Home chapter {chapter.number}</p>
                  <h2>{chapter.title}</h2>
                  <p>{chapter.description}</p>
                </div>
              </div>
            </MotionReveal>
          </div>
        </section>
      ))}
    </>
  );
}