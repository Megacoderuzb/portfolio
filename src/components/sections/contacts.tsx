import { ArrowUpRight, BriefcaseBusiness, CodeXml, FileDown, Mail, Send } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiUrl } from "@/lib/hosts";
import { getContacts, getResume } from "@/lib/content";
import { CopyEmail } from "./copy-email";

/** "https://t.me/name" → "name" */
const handle = (url: string) => new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;

// Enter: cards rise in a staggered diagonal; icons draw themselves (.draw-icon, CSS scroll timeline).
export async function Contacts() {
  const [t, contacts, resume, format] = await Promise.all([
    getTranslations("contact"),
    getContacts(),
    getResume(),
    getFormatter(),
  ]);
  // data-track/data-channel: picked up by the click listener in <Providers> (CONTACT_CLICK)
  const links = [
    { Icon: Send, channel: "telegram", label: t("telegram"), value: `@${handle(contacts.telegram)}`, href: contacts.telegram },
    { Icon: BriefcaseBusiness, channel: "linkedin", label: t("linkedin"), value: handle(contacts.linkedin), href: contacts.linkedin },
    { Icon: CodeXml, channel: "github", label: t("github"), value: handle(contacts.github), href: contacts.github },
  ];

  return (
    <section id="contact" aria-labelledby="contact-title" className="overflow-x-clip py-section">
      <Container>
        <Reveal>
          <SectionHeading id="contact-title" eyebrow="05" title={t("title")} subtitle={t("subtitle")} />
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal as="li" preset="diagonal">
            <Card className="flex h-full flex-col gap-4 p-6">
              <Mail className="draw-icon size-7 text-violet-300" strokeWidth={1.5} aria-hidden />
              <div className="flex-1">
                <p className="text-sm text-muted">{t("email")}</p>
                <a
                  href={`mailto:${contacts.email}`}
                  data-track="CONTACT_CLICK"
                  data-channel="email"
                  className="mt-1 block font-medium break-all hover:text-violet-300"
                >
                  {contacts.email}
                </a>
              </div>
              <CopyEmail email={contacts.email} />
            </Card>
          </Reveal>
          {links.map(({ Icon, channel, label, value, href }, i) => (
            <Reveal as="li" preset="diagonal" index={i + 1} key={href}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                data-track="CONTACT_CLICK"
                data-channel={channel}
                className="block h-full rounded-(--radius-card)"
              >
                <Card interactive className="flex h-full flex-col gap-4 p-6">
                  <Icon className="draw-icon size-7 text-violet-300" strokeWidth={1.5} aria-hidden />
                  <div className="flex-1">
                    <p className="text-sm text-muted">{label}</p>
                    <p className="mt-1 font-medium break-all">{value}</p>
                  </div>
                  <ArrowUpRight className="size-5 self-end text-violet-400" aria-hidden />
                </Card>
              </a>
            </Reveal>
          ))}
        </ul>
        <Reveal index={4} className="mt-10 flex flex-wrap items-center gap-4">
          {/* file download from a route handler, not a page: plain <a> on purpose */}
          <a href={apiUrl("/api/resume")} className={buttonStyles({ size: "lg" })}>
            <FileDown className="size-5" aria-hidden />
            {t("resume")}
          </a>
          {resume && (
            <p className="text-sm text-muted">
              {t("resumeUpdated", { date: format.dateTime(resume.updatedAt, { dateStyle: "medium" }) })}
            </p>
          )}
        </Reveal>
      </Container>
    </section>
  );
}
