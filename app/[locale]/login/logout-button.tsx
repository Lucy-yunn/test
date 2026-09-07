"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { logoutAction } from "./actions";

export function LogoutButton() {
  const t = useTranslations("Auth");
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => logoutAction())}
      disabled={pending}
      className="text-sm underline disabled:opacity-50"
    >
      {t("logout")}
    </button>
  );
}
