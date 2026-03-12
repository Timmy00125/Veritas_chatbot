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
      expect(screen.getByText("school_handbook.pdf")).toBeInTheDocument()
    );
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("shows an empty state when no documents exist", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    render(<DocumentsTable />);
    await waitFor(() =>
      expect(screen.getByText(/No documents uploaded yet/i)).toBeInTheDocument()
    );
  });

  it("shows an error state when fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<DocumentsTable />);
    await waitFor(() =>
      expect(
        screen.getByText(/Could not load documents/i)
      ).toBeInTheDocument()
    );
  });

  it("calls DELETE endpoint when delete button is clicked", async () => {
    // First call: list documents; second call: delete
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockDocuments })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<DocumentsTable />);
    await waitFor(() =>
      expect(screen.getByText("school_handbook.pdf")).toBeInTheDocument()
    );

    const deleteBtn = screen.getByRole("button", {
      name: /Delete school_handbook.pdf/i,
    });
    fireEvent.click(deleteBtn);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/documents/1",
        { method: "DELETE" }
      )
    );
  });
});
