"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CopyEmail({ email }: { email: string }) {
  const t = useTranslations();
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      toast(t("contact.copied"), "success");
    } catch {
      toast(t("common.error"), "error"); // clipboard blocked (insecure context / permissions)
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={copy}
      data-track="CONTACT_CLICK"
      data-channel="email"
      className="self-start"
    >
      <Copy className="size-4" aria-hidden />
      {t("contact.copy")}
    </Button>
  );
}
