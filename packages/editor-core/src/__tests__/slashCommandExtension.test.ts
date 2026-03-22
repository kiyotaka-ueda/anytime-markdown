/**
 * slashCommandExtension.ts のテスト
 * SlashCommandExtension の構造と SlashCommandState 型をテスト
 */
import { SlashCommandExtension, type SlashCommandState } from "../extensions/slashCommandExtension";

describe("SlashCommandExtension", () => {
  it("has name 'slashCommand'", () => {
    expect(SlashCommandExtension.name).toBe("slashCommand");
  });

  it("defines addOptions with default onStateChange", () => {
    const config = SlashCommandExtension.config;
    expect(config.addOptions).toBeDefined();
  });

  it("defines addStorage", () => {
    expect(SlashCommandExtension.config.addStorage).toBeDefined();
  });

  it("defines addProseMirrorPlugins", () => {
    expect(SlashCommandExtension.config.addProseMirrorPlugins).toBeDefined();
  });
});

describe("SlashCommandState type", () => {
  it("can construct a valid state", () => {
    const state: SlashCommandState = {
      active: true,
      query: "head",
      from: 5,
      navigationKey: "ArrowDown",
    };
    expect(state.active).toBe(true);
    expect(state.query).toBe("head");
    expect(state.from).toBe(5);
    expect(state.navigationKey).toBe("ArrowDown");
  });

  it("accepts null navigationKey", () => {
    const state: SlashCommandState = {
      active: false,
      query: "",
      from: 0,
      navigationKey: null,
    };
    expect(state.navigationKey).toBeNull();
  });

  it("accepts all valid navigationKey values", () => {
    const keys: SlashCommandState["navigationKey"][] = ["ArrowUp", "ArrowDown", "Enter", "Escape", null];
    for (const key of keys) {
      const state: SlashCommandState = { active: true, query: "", from: 0, navigationKey: key };
      expect(state.navigationKey).toBe(key);
    }
  });
});
