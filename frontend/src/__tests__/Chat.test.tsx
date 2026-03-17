import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Chat from "../components/Chat";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Chat Component", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "This is a mock response from the server.",
      }),
    });

    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders the initial greeting message", () => {
    render(<Chat />);
    expect(
      screen.getByText(/Hello! I am the Veritas chatbot/i),
    ).toBeInTheDocument();
  });

  it("allows user to type in the input field", () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText(/Ask Veritas a question/i);
    fireEvent.change(input, {
      target: { value: "What is the capital of France?" },
    });
    expect(input).toHaveValue("What is the capital of France?");
  });

  it("submits a message and displays it in the chat", async () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText(/Ask Veritas a question/i);
    const button = screen.getByRole("button", { name: /Send message/i });

    // Type message
    fireEvent.change(input, { target: { value: "Hello world" } });

    // Submit
    fireEvent.click(button);

    // User message should appear immediately
    expect(screen.getByText("Hello world")).toBeInTheDocument();

    // Input should be cleared
    expect(input).toHaveValue("");

    // Wait for the mock response to appear
    await waitFor(() => {
      expect(
        screen.getByText("This is a mock response from the server."),
      ).toBeInTheDocument();
    });

    // fetch should have been called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/chat/query"),
      expect.any(Object),
    );
  });

  it("displays an error message when the API fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("API Error"));

    render(<Chat />);
    const input = screen.getByPlaceholderText(/Ask Veritas a question/i);
    const button = screen.getByRole("button", { name: /Send message/i });

    fireEvent.change(input, { target: { value: "Trigger error" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Sorry, I am having trouble connecting to the server/i,
        ),
      ).toBeInTheDocument();
    });
  });
});
