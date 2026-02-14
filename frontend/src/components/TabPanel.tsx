"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck, ChevronRight, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ShieldForm from "./ShieldForm";
import UnveilForm from "./UnveilForm";
import ComplianceTab from "./ComplianceTab";
import AgentTab from "./AgentTab";

type Step = 1 | 2 | "agent";

export default function TabPanel() {
  const [step, setStep] = useState<Step>(1);
  const [showCompliance, setShowCompliance] = useState(false);
  const searchParams = useSearchParams();

  // Auto-switch to agent tab when deep link strategy param is present
  useEffect(() => {
    if (searchParams.get("strategy")) {
      setStep("agent");
    }
  }, [searchParams]);

  function handleAccumulationComplete() {
    setStep(2);
  }

  if (showCompliance) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="p-4 sm:p-6">
          <button
            onClick={() => setShowCompliance(false)}
            className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer mb-4 flex items-center gap-1"
          >
            &larr; Back
          </button>
          <ComplianceTab />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Step Indicator */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer ${
              step === 1
                ? "bg-[var(--accent-orange)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === 1 ? "bg-white/20" : "bg-[var(--bg-tertiary)]"
            }`}>1</span>
            Allocate Capital
          </button>
          <ArrowRight size={14} strokeWidth={1.5} className="text-[var(--text-quaternary)]" />
          <button
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer ${
              step === 2
                ? "bg-[var(--accent-orange)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === 2 ? "bg-white/20" : "bg-[var(--bg-tertiary)]"
            }`}>2</span>
            Confidential Exit
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setStep("agent")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer ${
              step === "agent"
                ? "bg-purple-600 text-white"
                : "bg-purple-950/30 text-purple-400 border border-purple-800/30 hover:bg-purple-950/50"
            }`}
          >
            <Brain size={13} strokeWidth={1.5} />
            AI Strategist
          </button>
          <button
            onClick={() => setShowCompliance(true)}
            className="text-[10px] text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer flex items-center gap-1"
          >
            <ShieldCheck size={10} strokeWidth={1.5} />
            Compliance
            <ChevronRight size={10} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ShieldForm onComplete={handleAccumulationComplete} />
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <UnveilForm />
            </motion.div>
          ) : (
            <motion.div
              key="agent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AgentTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
