/**
 * global-error.tsx のカバレッジテスト
 */

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import GlobalError from "../app/global-error";

describe("GlobalError", () => {
  afterEach(() => {
    // cookie をクリア
    Object.defineProperty(document, "cookie", { value: "", writable: true });
  });

  it("renders English heading and button by default", () => {
    const reset = jest.fn();
    render(<GlobalError error={new Error("test")} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("renders Japanese heading when locale cookie is ja", () => {
    Object.defineProperty(document, "cookie", {
      value: "NEXT_LOCALE=ja",
      writable: true,
    });
    const reset = jest.fn();
    render(<GlobalError error={new Error("test")} reset={reset} />);
    expect(screen.getByText("エラーが発生しました")).toBeTruthy();
    expect(screen.getByText("もう一度試す")).toBeTruthy();
  });

  it("calls reset when button is clicked", () => {
    const reset = jest.fn();
    render(<GlobalError error={new Error("test")} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
