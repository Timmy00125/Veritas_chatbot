import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SettingsForm from "../components/admin/SettingsForm";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSettings = {
  id: 1,
  system_prompt: "You are a helpful school assistant.",
  strictness: 0.6,
};

describe("SettingsForm", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Default GET /admin/settings
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSettings,
    });
  });

  it("shows loading state initially", () => {
    render(<SettingsForm />);
    const pulseEls = document.querySelectorAll(".animate-pulse");
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it("populates form fields with fetched settings", async () => {
    render(<SettingsForm />);
    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "You are a helpful school assistant.",
      );
    });
  });

  it("calls GET /admin/settings on mount", async () => {
    render(<SettingsForm />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/settings"),
    );
  });

  it("submits updated settings via PUT on save", async () => {
    // GET then PUT
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockSettings })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSettings,
          system_prompt: "Updated prompt.",
        }),
      });

    render(<SettingsForm />);
    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
        "You are a helpful school assistant.",
      ),
    );

    // Edit the prompt
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated prompt." },
    });

    // Click Save
    const saveBtn = screen.getByRole("button", { name: /Save Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/settings"),
        expect.objectContaining({ method: "PUT" }),
      ),
    );

    // Success message
    await waitFor(() =>
      expect(
        screen.getByText(/Settings saved successfully/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows error message when save fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockSettings })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    render(<SettingsForm />);
    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
        "You are a helpful school assistant.",
      ),
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Changed prompt." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Settings/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Failed to update settings/i),
      ).toBeInTheDocument(),
    );
  });
});
