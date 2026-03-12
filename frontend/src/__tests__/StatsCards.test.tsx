import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StatsCards from "../components/admin/StatsCards";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("StatsCards", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ total_questions: 42 }),
    });
  });

  it("shows loading skeletons initially", () => {
    render(<StatsCards />);
    const pulseEls = document.querySelectorAll(".animate-pulse");
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it("renders the total questions value", async () => {
    render(<StatsCards />);
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("Total Questions")).toBeInTheDocument();
  });

  it("renders 0 questions when backend reports 0", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_questions: 0 }),
    });
    render(<StatsCards />);
    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
  });

  it("shows an error state when fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<StatsCards />);
    await waitFor(() =>
      expect(
        screen.getByText(/Could not load statistics/i)
      ).toBeInTheDocument()
    );
  });

  it("calls the correct stats endpoint", async () => {
    render(<StatsCards />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/admin/stats");
  });
});
