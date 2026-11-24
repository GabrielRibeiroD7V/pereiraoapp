import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useReturnRevision } from "./useReturnRevision";
it("agrupa retorno/online e remove listeners e timers ao desmontar", () => {
  vi.useFakeTimers();
  function Probe() {
    return <p>{useReturnRevision()}</p>;
  }
  const view = render(<Probe />);
  act(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("pageshow"));
    vi.advanceTimersByTime(151);
  });
  expect(screen.getByText("1")).toBeInTheDocument();
  view.unmount();
  act(() => {
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(151);
  });
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
