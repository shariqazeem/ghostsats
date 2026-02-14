"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Shield, Unlock, Brain } from "lucide-react";
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <button
            onClick={() => setShowCompliance(false)}
            className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer mb-4 flex items-center gap-1"
          >
            &larr; Back
          </button>
          <ComplianceTab />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab Bar */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center gap-3">
          {/* Segmented Control */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl flex-1">
            <button
              onClick={() => setStep(1)}
              className={`flex-1 py-2.5 text-sm text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                step === 1
                  ? "bg-[#FF5A00] text-white rounded-lg font-semibold"
                  : "text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
              }`}
            >
              <Shield size={14} strokeWidth={1.5} />
              Shield
            </button>
            <button
              onClick={() => setStep(2)}
              className={`flex-1 py-2.5 text-sm text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                step === 2
                  ? "bg-[#FF5A00] text-white rounded-lg font-semibold"
                  : "text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
              }`}
            >
              <Unlock size={14} strokeWidth={1.5} />
              Unveil
            </button>
            <button
              onClick={() => setStep("agent")}
              className={`flex-1 py-2.5 text-sm text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                step === "agent"
                  ? "bg-[#FF5A00] text-white rounded-lg font-semibold"
                  : "text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
              }`}
            >
              <Brain size={14} strokeWidth={1.5} />
              Strategist
            </button>
          </div>

          {/* Compliance icon button */}
          <button
            onClick={() => setShowCompliance(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
            title="Compliance"
          >
            <ShieldCheck size={18} strokeWidth={1.5} />
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
