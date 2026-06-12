import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDuration, truncate, debounce } from "./utils";

describe("formatDuration", () => {
  it("formats zero as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats seconds only (< 1 minute)", () => {
    expect(formatDuration(5000)).toBe("0:05");
    expect(formatDuration(59000)).toBe("0:59");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(61000)).toBe("1:01");
    expect(formatDuration(125000)).toBe("2:05");
    expect(formatDuration(599000)).toBe("9:59");
  });

  it("formats hours when >= 1 hour", () => {
    expect(formatDuration(3600000)).toBe("1:00:00");
    expect(formatDuration(3661000)).toBe("1:01:01");
    expect(formatDuration(7322000)).toBe("2:02:02");
  });

  it("pads minutes and seconds with leading zeros in h:mm:ss format", () => {
    expect(formatDuration(3605000)).toBe("1:00:05");
    expect(formatDuration(3660000)).toBe("1:01:00");
  });
});

describe("truncate", () => {
  it("returns the string unchanged when under or at limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
    expect(truncate("abcdef", 3)).toBe("abc...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the function only once after the delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("a");
    debounced("b");
    debounced("c");

    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("calls again if invoked after delay has elapsed", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced("first");
    vi.advanceTimersByTime(50);
    debounced("second");
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, "first");
    expect(fn).toHaveBeenNthCalledWith(2, "second");
  });

  it("resets the timer on each call within the delay window", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("x");
    vi.advanceTimersByTime(50);
    debounced("y");
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("y");
  });
});
