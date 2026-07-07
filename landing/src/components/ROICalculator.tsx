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
        <span className="font-sans text-sm text-ink-soft">{label}</span>
        <span className="font-mono text-sm font-semibold text-ink tabular-nums">{format(value)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-rule/60 border-b border-rule">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brass transition-all motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full bg-transparent focus:outline-none"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-brass shadow-[0_1px_3px_rgba(29,26,21,0.15)] transition-all motion-reduce:transition-none pointer-events-none"
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
  const sessionsPerDay = typingMinutes > 0 ? (hoursPerDay * 60) / typingMinutes : 0;
  const savedMinutesPerDay = savedPerSession * sessionsPerDay;
  const savedMinutesPerYear = savedMinutesPerDay * daysPerWeek * 50; // 50 weeks
  const savedHoursPerYear = savedMinutesPerYear / 60;
  const savedBillablePerYear = savedHoursPerYear * rate;
  const voxlenCostPerYear = 29 * 12; // Pro plan: $29/mo billed monthly
  const roiMultiple = isFinite(savedBillablePerYear / voxlenCostPerYear)
    ? Math.round(savedBillablePerYear / voxlenCostPerYear)
    : 0;

  return (
    <section id="roi-calculator" className="py-24 px-6 bg-paper-deep">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 uppercase tracking-[0.18em] text-[11px] font-sans font-semibold text-brass mb-4">
            <Calculator className="h-3 w-3" aria-hidden="true" />
            Billable-Time Ledger
          </div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight text-ink mb-4">
            How much billable time
            <br />
            <span className="italic">will you recover?</span>
          </h2>
          <p className="font-sans text-ink-soft text-lg max-w-xl mx-auto">
            Voxlen users dictate 3× faster than typing. See what that's worth for your practice.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Inputs — timesheet */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-md bg-white border border-rule shadow-[0_1px_3px_rgba(29,26,21,0.06)] p-6 space-y-6"
          >
            <h3 className="uppercase tracking-[0.18em] text-[11px] font-sans font-semibold text-brass">Your practice</h3>
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

            <div className="pt-2 border-t border-rule text-xs font-mono text-ink-soft space-y-0.5">
              <div>Typing speed assumption: {WORDS_PER_MINUTE_TYPING} wpm</div>
              <div>Dictation speed assumption: {WORDS_PER_MINUTE_DICTATION} wpm</div>
              <div>+ {ACCURACY_GAIN_MINUTES_PER_HOUR} min/hr saved on corrections</div>
            </div>
          </motion.div>

          {/* Results — ledger */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {/* Primary result */}
            <div className="rounded-md bg-white border border-rule shadow-[0_1px_3px_rgba(29,26,21,0.06)] p-6 text-center">
              <div className="uppercase tracking-[0.18em] text-[11px] font-sans font-semibold text-brass mb-2">Billable time recovered / year</div>
              <div className="font-mono text-6xl text-ink tabular-nums mb-1">
                {fmt$(savedBillablePerYear)}
              </div>
              <div className="font-sans text-sm text-ink-soft">
                <span className="font-mono">{fmtH(savedMinutesPerYear)}</span> freed up annually
              </div>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: Clock,
                  label: "Saved per day",
                  value: fmtH(savedMinutesPerDay),
                },
                {
                  icon: TrendingUp,
                  label: "ROI vs cost",
                  value: `${roiMultiple}×`,
                },
                {
                  icon: DollarSign,
                  label: "Per week",
                  value: fmt$(savedBillablePerYear / 50),
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-md bg-white border border-rule shadow-[0_1px_3px_rgba(29,26,21,0.06)] p-3 text-center">
                  <Icon className="h-4 w-4 text-brass mx-auto mb-1.5" aria-hidden="true" />
                  <div className="font-mono text-lg text-ink tabular-nums">{value}</div>
                  <div className="text-[10px] font-sans text-ink-soft mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Cost comparison — ledger rows */}
            <div className="rounded-md bg-white border border-rule shadow-[0_1px_3px_rgba(29,26,21,0.06)] p-4 space-y-2.5">
              <div className="uppercase tracking-[0.18em] text-[11px] font-sans font-semibold text-brass">Cost vs return</div>
              <div className="flex items-center justify-between text-sm border-b border-rule pb-2">
                <span className="font-sans text-ink-soft">Voxlen Pro (annual)</span>
                <span className="font-mono text-ink tabular-nums">{fmt$(voxlenCostPerYear)} / yr</span>
              </div>
              <div className="flex items-center justify-between text-sm border-b border-rule pb-2">
                <span className="font-sans text-ink-soft">Billable time recovered</span>
                <span className="font-mono text-ink tabular-nums">{fmt$(savedBillablePerYear)} / yr</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold pt-0.5">
                <span className="font-serif text-ink">Net gain</span>
                <span className="font-mono text-brass tabular-nums">{fmt$(savedBillablePerYear - voxlenCostPerYear)} / yr</span>
              </div>
            </div>

            <a
              href="#download"
              className="block w-full h-12 rounded-md bg-brass text-paper font-sans font-semibold text-center flex items-center justify-center gap-2 hover:bg-brass-deep transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-paper-deep"
            >
              Start recovering billable time →
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
