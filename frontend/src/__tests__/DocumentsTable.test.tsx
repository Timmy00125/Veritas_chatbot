import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DocumentsTable from "../components/admin/DocumentsTable";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockDocuments = [
  {
    id: 1,
    filename: "school_handbook.pdf",
    mime_type: "application/pdf",
    status: "ACTIVE",
    created_at: "2026-03-01T10:00:00Z",
    gemini_file_id: "files/abc",
    gemini_file_uri: "https://example.com/abc",
  },
];

describe("DocumentsTable", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Default: GET /documents/ returns mockDocuments
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDocuments,
    });
  });

  it("shows loading skeletons initially", () => {
    render(<DocumentsTable />);
    // Skeleton rows render animate-pulse divs before data arrives
    const pulseEls = document.querySelectorAll(".animate-pulse");
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it("renders document rows after fetching", async () => {
    render(<DocumentsTable />);
    await waitFor(() =>
      expect(screen.getAllByText("school_handbook.pdf").length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getAllByText("ACTIVE").length).toBeGreaterThan(0);
  });

  it("shows an empty state when no documents exist", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    render(<DocumentsTable />);
    await waitFor(() =>
      expect(
        screen.getAllByText(/No documents uploaded yet/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows an error state when fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<DocumentsTable />);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Could not load documents/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("calls DELETE endpoint when delete button is clicked", async () => {
    // First call: list documents; second call: delete
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockDocuments })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<DocumentsTable />);
    await waitFor(() =>
      expect(screen.getAllByText("school_handbook.pdf").length).toBeGreaterThan(
        0,
      ),
    );

    const deleteBtn = screen.getAllByRole("button", {
      name: /Delete school_handbook.pdf/i,
    })[0];
    fireEvent.click(deleteBtn);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/documents/1"),
        { method: "DELETE" },
      ),
    );
  });
});
