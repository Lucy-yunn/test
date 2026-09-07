"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { FunnelTree } from "@/lib/services/catalogue";

type Panel = "make" | "model" | "generation" | "part" | null;

export function FunnelBar({
  tree,
  initialCategory,
}: {
  tree: FunnelTree;
  initialCategory?: string;
}) {
  const t = useTranslations("Home");
  const router = useRouter();

  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [generation, setGeneration] = useState<string | "all" | null>(null);
  const [category, setCategory] = useState<string | null>(initialCategory ?? null);
  const [panel, setPanel] = useState<Panel>(null);

  const makeObj = tree.makes.find((m) => m.slug === make);
  const modelObj = makeObj?.modelGroups.find((g) => g.slug === model);
  const genObj = modelObj?.generations.find((g) => g.slug === generation);
  const catName = tree.categoryGroups
    .flatMap((g) => g.categories)
    .find((c) => c.slug === category)?.name;

  function pickMake(slug: string) {
    setMake(slug);
    setModel(null);
    setGeneration(null);
    setPanel("model");
  }
  function pickModel(slug: string) {
    setModel(slug);
    setGeneration(null);
    setPanel("generation");
  }
  function pickGeneration(slug: string | "all") {
    setGeneration(slug);
    setPanel("part");
  }
  function pickCategory(slug: string) {
    setCategory(slug);
    setPanel(null);
  }

  function search() {
    if (!make) return setPanel("make");
    if (!model) return setPanel("model");
    const q = new URLSearchParams({ make, model });
    if (generation && generation !== "all") q.set("generation", generation);
    if (category) q.set("category", category);
    router.push(`/browse?${q.toString()}`);
  }

  return (
    <div className="relative">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">
        {t("funnelHeading")}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Slot n={1} label={t("make")} value={makeObj?.name} open={panel === "make"} onClick={() => setPanel(panel === "make" ? null : "make")} />
        <Slot n={2} label={t("model")} value={modelObj?.name} disabled={!make} open={panel === "model"} onClick={() => make && setPanel(panel === "model" ? null : "model")} />
        <Slot n={3} label={t("generation")} value={genObj?.label ?? (generation === "all" ? "All years" : undefined)} hint={t("optional")} disabled={!model} open={panel === "generation"} onClick={() => model && setPanel(panel === "generation" ? null : "generation")} />
        <Slot n={4} label={t("part")} value={catName} disabled={!make} open={panel === "part"} onClick={() => make && setPanel(panel === "part" ? null : "part")} />
        <button
          onClick={search}
          className="rounded bg-amber-400 px-6 py-3 font-semibold text-purple-900 hover:bg-amber-300"
        >
          {t("search")}
        </button>
      </div>

      {panel ? (
        <div className="absolute left-0 right-0 z-10 mt-2 max-h-96 overflow-auto rounded border border-zinc-200 bg-white p-4 text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {panel === "make" && (
            <PanelList items={tree.makes.map((m) => ({ key: m.slug, label: m.name }))} onPick={pickMake} />
          )}
          {panel === "model" && makeObj && (
            <PanelList items={makeObj.modelGroups.map((g) => ({ key: g.slug, label: g.name }))} onPick={pickModel} />
          )}
          {panel === "generation" && modelObj && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => pickGeneration("all")}
                className="rounded border border-dashed border-zinc-300 p-2 text-left text-sm dark:border-zinc-600"
              >
                I&rsquo;m not sure — search every {modelObj.name} generation
              </button>
              {modelObj.generations.map((g) => (
                <button
                  key={g.slug}
                  onClick={() => pickGeneration(g.slug)}
                  className="rounded border border-zinc-200 p-2 text-left text-sm hover:border-purple-400 dark:border-zinc-700"
                >
                  <span className="font-medium">{g.label}</span>
                  <span className="block text-xs text-zinc-500">
                    {g.productionStart ?? "?"}–{g.productionEnd ?? "now"}
                    {g.chassisCodes.length ? ` · ${g.chassisCodes.join(", ")}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {panel === "part" && (
            <div className="flex flex-col gap-3">
              {tree.categoryGroups.map((grp) => (
                <div key={grp.groupSlug}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{grp.group}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {grp.categories.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => pickCategory(c.slug)}
                        className="rounded border border-zinc-200 px-2 py-1 text-sm hover:border-purple-400 dark:border-zinc-700"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Slot({
  n,
  label,
  value,
  hint,
  disabled,
  open,
  onClick,
}: {
  n: number;
  label: string;
  value?: string;
  hint?: string;
  disabled?: boolean;
  open?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded border-2 bg-white px-4 py-2 text-left text-zinc-900 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-100 ${open ? "border-amber-400" : "border-transparent"}`}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {n}. {label}
      </span>
      <span className="block truncate">{value ?? hint ?? "Choose"}</span>
    </button>
  );
}

function PanelList({
  items,
  onPick,
}: {
  items: { key: string; label: string }[];
  onPick: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onPick(it.key)}
          className="rounded border border-zinc-200 px-3 py-1 text-sm hover:border-purple-400 dark:border-zinc-700"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
