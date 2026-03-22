/**
 * BranchDialog.tsx のカバレッジテスト
 */

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { BranchDialog } from "../components/explorer/sections/BranchDialog";

describe("BranchDialog", () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    repo: { fullName: "user/repo", private: false, defaultBranch: "main" },
    branches: ["main", "develop"],
    loading: false,
    onSelectBranch: jest.fn(),
  };

  it("renders branch list when not loading", () => {
    render(<BranchDialog {...defaultProps} />);
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("develop")).toBeTruthy();
    expect(screen.getByText("user/repo")).toBeTruthy();
  });

  it("renders loading spinner when loading", () => {
    render(<BranchDialog {...defaultProps} loading={true} branches={[]} />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("calls onSelectBranch when branch is clicked", () => {
    const onSelectBranch = jest.fn();
    render(<BranchDialog {...defaultProps} onSelectBranch={onSelectBranch} />);
    fireEvent.click(screen.getByText("develop"));
    expect(onSelectBranch).toHaveBeenCalledWith("develop");
  });

  it("shows default branch label for defaultBranch", () => {
    render(<BranchDialog {...defaultProps} />);
    expect(screen.getByText("defaultBranch")).toBeTruthy();
  });
});
