"use client";

import { useMessages, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

export function Demos() {
  const t = useTranslations();
  const messages = useMessages();
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setDialog(true)}>
          {t("manage.cancel")}
        </Button>
        <Button variant="secondary" onClick={() => setDrawer(true)}>
          {t("projects.details")}
        </Button>
        <Button variant="secondary" onClick={() => toast(t("contact.copied"), "success")}>
          {t("contact.copy")}
        </Button>
        <Button variant="secondary" onClick={() => toast(t("booking.errors.slotTaken"), "error")}>
          {t("booking.submit")}
        </Button>
      </div>

      <Dialog open={dialog} onClose={() => setDialog(false)} title={t("manage.confirmCancel")}>
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDialog(false)}>
            {t("common.back")}
          </Button>
          <Button onClick={() => setDialog(false)}>{t("manage.cancel")}</Button>
        </div>
      </Dialog>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={t("projects.highlights")}>
        <p className="text-muted">{t("about.text")}</p>
      </Drawer>

      <Tabs
        label={t("nav.language")}
        tabs={[
          { id: "uz", label: "UZ", content: <p>{t("hero.subtitle")}</p> },
          { id: "ru", label: "RU", content: <p>{t("about.facts.education")}</p> },
          { id: "en", label: "EN", content: <p>{t("about.facts.languages")}</p> },
        ]}
      />

      <form className="grid max-w-xl gap-5" onSubmit={(e) => e.preventDefault()}>
        <Field label={t("booking.fields.name")} required>
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label={t("booking.fields.email")} hint={t("booking.fields.emailHint")} error={t("booking.errors.email")} required>
          <Input name="email" type="email" required defaultValue="ali@" />
        </Field>
        <Field label={t("booking.purpose.title")}>
          <Select name="purpose" defaultValue="JOB_OFFER">
            {Object.entries(messages.booking.purpose.options).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("booking.fields.note")}>
          <Textarea name="note" placeholder={t("booking.fields.notePlaceholder")} />
        </Field>
      </form>
    </div>
  );
}
