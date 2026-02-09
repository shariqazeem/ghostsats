"use client";

import { useState } from "react";
import { Shield, Eye } from "lucide-react";
import { motion } from "framer-motion";
import ShieldForm from "./ShieldForm";
import UnveilForm from "./UnveilForm";

type Tab = "shield" | "unveil";

export default function TabPanel() {
  const [tab, setTab] = useState<Tab>("shield");

  return (
    <div className="bg-white rounded-3xl shadow-[var(--shadow-ambient)] overflow-hidden">
      {/* Toggle Switch */}
      <div className="p-1.5 mx-6 mt-6 bg-[var(--bg-secondary)] rounded-xl flex relative">
        <motion.div
          className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-lg shadow-sm"
          animate={{ x: tab === "shield" ? 6 : "calc(100% + 6px)" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
        <button
          onClick={() => setTab("shield")}
          className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            tab === "shield" ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
          }`}
        >
          <Shield size={15} strokeWidth={1.5} />
          Shield
        </button>
        <button
          onClick={() => setTab("unveil")}
          className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            tab === "unveil" ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
          }`}
        >
          <Eye size={15} strokeWidth={1.5} />
          Unveil
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === "shield" ? <ShieldForm /> : <UnveilForm />}
      </div>
    </div>
  );
}
