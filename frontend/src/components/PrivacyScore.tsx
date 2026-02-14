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
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        <ShieldCheck size={12} strokeWidth={1.5} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-500">
          Privacy Score
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        {/* Circular Progress */}
        <div className="relative flex-shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#F3F4F6"
              strokeWidth="6"
            />
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
              className="text-2xl font-[family-name:var(--font-geist-mono)] font-bold font-tabular"
              style={{ color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {score}
            </motion.span>
            <span className="text-[10px] text-gray-400 font-medium">/ 100</span>
          </div>
        </div>

        {/* Label + Breakdown */}
        <div className="w-full space-y-2">
          <div className="text-sm font-semibold text-center" style={{ color }}>
            {label}
          </div>
          <div className="space-y-1">
            {items.map(({ label, value, max }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-xs font-[family-name:var(--font-geist-mono)] text-gray-600 font-tabular">
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
