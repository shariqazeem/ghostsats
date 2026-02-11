"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

interface PrivacyScoreProps {
  anonSet: number;
  batches: number;
  btcLinked: number;
  commitments: number;
}

function computeBreakdown(props: PrivacyScoreProps) {
  const anonPts = Math.min(props.anonSet / 20, 1) * 40;
  const batchPts = Math.min(props.batches / 10, 1) * 20;
  const btcPts = Math.min(props.btcLinked / 5, 1) * 15;
  const usagePts = Math.min(props.commitments / 20, 1) * 15 + (props.commitments > 0 ? 10 : 0);
  const rawTotal = anonPts + batchPts + btcPts + usagePts;
  const total = Math.min(Math.round(rawTotal), 100);

  return {
    total,
    items: [
      { label: "Anonymity Set", value: Math.round(anonPts), max: 40 },
      { label: "Batch Activity", value: Math.round(batchPts), max: 20 },
      { label: "BTC Binding", value: Math.round(btcPts), max: 15 },
      { label: "Protocol Usage", value: Math.round(usagePts), max: 25 },
    ],
  };
}

export default function PrivacyScore(props: PrivacyScoreProps) {
  const { total: score, items } = computeBreakdown(props);
  const color = score >= 60 ? "#10B981" : score >= 30 ? "#F59E0B" : "#EF4444";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Strong" : score >= 30 ? "Moderate" : "Building";

  // SVG arc calculation
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-1.5 mb-4">
        <ShieldCheck size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Protocol Privacy Score
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Circular Progress */}
        <div className="relative flex-shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth="6"
            />
            {/* Progress arc */}
            <motion.circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-[24px] font-[family-name:var(--font-geist-mono)] font-bold font-tabular"
              style={{ color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {score}
            </motion.span>
            <span className="text-[9px] text-[var(--text-tertiary)] font-medium uppercase tracking-wider">
              / 100
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-2">
          <div className="text-[13px] font-semibold" style={{ color }}>
            {label}
          </div>
          <div className="space-y-1.5">
            {items.map(({ label, value, max }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-tertiary)]">{label}</span>
                <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)] font-tabular">
                  {value}/{max}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
