import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { SourceModeEditor } from "../components/SourceModeEditor";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("../useEditorSettings", () => ({
  useEditorSettingsContext: () => ({
    fontSize: 14,
    lineHeight: 1.6,
  }),
}));

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createDefaultProps(overrides: Partial<Parameters<typeof SourceModeEditor>[0]> = {}) {
  return {
    sourceText: "",
    onSourceChange: jest.fn(),
    editorHeight: 600,
    ariaLabel: "source editor",
    ...overrides,
  };
}

describe("SourceModeEditor", () => {
  test("空テキストでクラッシュせずレンダリングされる", () => {
    const props = createDefaultProps();
    const { container } = renderWithTheme(<SourceModeEditor {...props} />);
    expect(container.firstChild).toBeTruthy();
  });

  test("textareaにsourceTextが表示される", () => {
    const text = "# Hello\n\nWorld";
    const props = createDefaultProps({ sourceText: text });
    renderWithTheme(<SourceModeEditor {...props} />);
    const textarea = screen.getByRole("textbox");
    expect((textarea as HTMLTextAreaElement).value).toBe(text);
  });

  test("親PaperにmaxHeightとoverflow:autoが設定されている（スクロール管理）", () => {
    const props = createDefaultProps({ editorHeight: 600 });
    const { container } = renderWithTheme(<SourceModeEditor {...props} />);
    const paper = container.firstChild as HTMLElement;
    const style = window.getComputedStyle(paper);
    expect(style.overflow).toBe("auto");
    expect(style.maxHeight).toBe("600px");
  });

  test("テキスト変更時にonSourceChangeが呼ばれる", () => {
    const onSourceChange = jest.fn();
    const props = createDefaultProps({ onSourceChange });
    renderWithTheme(<SourceModeEditor {...props} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "new text" } });
    expect(onSourceChange).toHaveBeenCalledWith("new text");
  });

  test("行番号が正しく表示される", () => {
    const text = "line1\nline2\nline3";
    const props = createDefaultProps({ sourceText: text });
    const { container } = renderWithTheme(<SourceModeEditor {...props} />);
    const lineNumbers = container.querySelector("pre");
    expect(lineNumbers).toBeTruthy();
    expect(lineNumbers!.textContent).toBe("1\n2\n3");
  });
});
