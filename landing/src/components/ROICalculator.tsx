import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, Clock, DollarSign } from "lucide-react";

const WORDS_PER_MINUTE_TYPING = 40;
const WORDS_PER_MINUTE_DICTATION = 130;
const ACCURACY_GAIN_MINUTES_PER_HOUR = 8; // time saved on corrections

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="text-sm font-semibold text-white tabular-nums">{format(value)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-marcoreid-600 transition-all"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-marcoreid-500 shadow-lg transition-all pointer-events-none"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
    </div>
  );
}

function fmt$(n: number) {
  return n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${Math.round(n).toLocaleString()}`;
}

function fmtH(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ROICalculator() {
  const [rate, setRate] = useState(350); // $/hour
  const [hoursPerDay, setHoursPerDay] = useState(4); // hours dictating/writing
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [wordsPerSession, setWordsPerSession] = useState(500);

  // Minutes per session: typing vs dictation
  const typingMinutes = (wordsPerSession / WORDS_PER_MINUTE_TYPING);
  const dictationMinutes = (wordsPerSession / WORDS_PER_MINUTE_DICTATION);
  const savedPerSession = typingMinutes - dictationMinutes + ACCURACY_GAIN_MINUTES_PER_HOUR * (dictationMinutes / 60);

  // Sessions per day (approx)
  const sessionsPerDay = (hoursPerDay * 60) / typingMinutes;
  const savedMinutesPerDay = savedPerSession * sessionsPerDay;
  const savedMinutesPerYear = savedMinutesPerDay * daysPerWeek * 50; // 50 weeks
  const savedHoursPerYear = savedMinutesPerYear / 60;
  const savedBillablePerYear = savedHoursPerYear * rate;
  const voxlenCostPerYear = 199 * 12 / 12 * 12; // pro plan ~$199/mo annually = $2388 — actually let's use real pricing
  const roiMultiple = Math.round(savedBillablePerYear / 288); // $288/yr pro plan

  return (
    <section id="roi-calculator" className="py-24 px-6 bg-[#0c0c0f]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
            <Calculator className="h-3 w-3" />
            ROI Calculator
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            How much billable time
            <br />
            <span className="gradient-text">will you recover?</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Voxlen users dictate 3× faster than typing. See what that's worth for your practice.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Inputs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl bg-[#111114] border border-white/10 p-6 space-y-6"
          >
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Your practice</h3>
            <Slider
              label="Billing rate"
              value={rate}
              min={100}
              max={1500}
              step={25}
              format={(v) => `$${v}/hr`}
              onChange={setRate}
            />
            <Slider
              label="Hours writing/dictating per day"
              value={hoursPerDay}
              min={0.5}
              max={10}
              step={0.5}
              format={(v) => `${v}h`}
              onChange={setHoursPerDay}
            />
            <Slider
              label="Working days per week"
              value={daysPerWeek}
              min={1}
              max={7}
              step={1}
              format={(v) => `${v} days`}
              onChange={setDaysPerWeek}
            />
            <Slider
              label="Avg words per document/memo"
              value={wordsPerSession}
              min={50}
              max={3000}
              step={50}
              format={(v) => `${v.toLocaleString()} words`}
              onChange={setWordsPerSession}
            />

            <div className="pt-2 border-t border-white/5 text-xs text-zinc-600 space-y-0.5">
              <div>Typing speed assumption: {WORDS_PER_MINUTE_TYPING} wpm</div>
              <div>Dictation speed assumption: {WORDS_PER_MINUTE_DICTATION} wpm</div>
              <div>+ {ACCURACY_GAIN_MINUTES_PER_HOUR} min/hr saved on corrections</div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {/* Primary result */}
            <div className="rounded-2xl bg-gradient-to-br from-marcoreid-600/20 to-marcoreid-900/10 border border-marcoreid-500/30 p-6 text-center">
              <div className="text-xs font-mono text-marcoreid-400 uppercase tracking-wider mb-2">Billable time recovered / year</div>
              <div className="text-6xl font-black text-white tabular-nums mb-1">
                {fmt$(savedBillablePerYear)}
              </div>
              <div className="text-sm text-zinc-400">
                {fmtH(savedMinutesPerYear)} freed up annually
              </div>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: Clock,
                  label: "Saved per day",
                  value: fmtH(savedMinutesPerDay),
                  color: "text-blue-400",
                  bg: "bg-blue-500/10 border-blue-500/20",
                },
                {
                  icon: TrendingUp,
                  label: "ROI vs cost",
                  value: `${roiMultiple}×`,
                  color: "text-emerald-400",
                  bg: "bg-emerald-500/10 border-emerald-500/20",
                },
                {
                  icon: DollarSign,
                  label: "Per week",
                  value: fmt$(savedBillablePerYear / 50),
                  color: "text-amber-400",
                  bg: "bg-amber-500/10 border-amber-500/20",
                },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
                  <Icon className={`h-4 w-4 ${color} mx-auto mb-1.5`} />
                  <div className={`text-lg font-black tabular-nums ${color}`}>{value}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Cost comparison */}
            <div className="rounded-xl bg-[#111114] border border-white/10 p-4 space-y-2.5">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Cost vs return</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Voxlen Pro (annual)</span>
                <span className="text-white font-semibold">$288 / yr</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Billable time recovered</span>
                <span className="text-emerald-400 font-semibold">{fmt$(savedBillablePerYear)} / yr</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-white">Net gain</span>
                <span className="text-emerald-400">{fmt$(savedBillablePerYear - 288)} / yr</span>
              </div>
            </div>

            <a
              href="#download"
              className="block w-full h-12 rounded-xl bg-marcoreid-600 text-white font-semibold text-center flex items-center justify-center gap-2 hover:bg-marcoreid-700 transition-all shadow-lg shadow-marcoreid-600/25 hover:scale-[1.01]"
            >
              Start recovering billable time →
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
