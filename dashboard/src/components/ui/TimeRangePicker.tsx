import type { MetricsRange } from "../../api/types";
import { timeRanges } from "../../lib/timeRanges";
import SegmentedControl from "./SegmentedControl";

/** Chart time-range selector backed by the platform's metrics ranges. */
export default function TimeRangePicker({ value, onChange, size = "sm" }: { value: MetricsRange; onChange: (value: MetricsRange) => void; size?: "sm" | "md" }) {
  return <SegmentedControl label="Time range" options={timeRanges} value={value} onChange={onChange} size={size} />;
}
