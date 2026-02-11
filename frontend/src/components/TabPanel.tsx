"use client";

import { useState } from "react";
import { Shield, Eye, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import ShieldForm from "./ShieldForm";
import UnveilForm from "./UnveilForm";
import ComplianceTab from "./ComplianceTab";

type Tab = "shield" | "unveil" | "comply";

const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
  { id: "shield", label: "Shield", icon: Shield },
  { id: "unveil", label: "Unveil", icon: Eye },
  { id: "comply", label: "Comply", icon: ShieldCheck },
];

export default function TabPanel() {
  const [tab, setTab] = useState<Tab>("shield");

  const activeIndex = tabs.findIndex((t) => t.id === tab);

  return (
    <div className="glass-card overflow-hidden">
      {/* Toggle Switch */}
      <div className="p-1.5 mx-4 sm:mx-6 mt-4 sm:mt-6 bg-[var(--bg-secondary)] rounded-xl flex relative">
        <motion.div
          className="absolute top-1.5 bottom-1.5 bg-[var(--bg-tertiary)] rounded-lg shadow-[var(--shadow-sm)]"
          animate={{
            left: `calc(${activeIndex} * 33.333% + 6px)`,
            width: "calc(33.333% - 8px)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] sm:text-[13px] font-semibold transition-colors cursor-pointer ${
              tab === id ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
            }`}
          >
            <Icon size={13} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {tab === "shield" ? <ShieldForm /> : tab === "unveil" ? <UnveilForm /> : <ComplianceTab />}
      </div>
    </div>
  );
}
