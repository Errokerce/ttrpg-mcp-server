import { describe, it, expect } from "vitest";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";

describe("Dice Engine", () => {
  it("rolls basic notation (2d6+3)", () => {
    const roll = new DiceRoll("2d6+3");
    expect(roll.total).toBeGreaterThanOrEqual(5);
    expect(roll.total).toBeLessThanOrEqual(15);
  });

  it("rolls keep highest (4d6kh3)", () => {
    const roll = new DiceRoll("4d6kh3");
    expect(roll.total).toBeGreaterThanOrEqual(3);
    expect(roll.total).toBeLessThanOrEqual(18);
  });

  it("rolls exploding dice (2d6!)", () => {
    const roll = new DiceRoll("2d6!");
    expect(roll.total).toBeGreaterThanOrEqual(2);
  });

  it("rolls success counting (8d10>=8)", () => {
    const roll = new DiceRoll("8d10>=8");
    expect(roll.total).toBeGreaterThanOrEqual(0);
    expect(roll.total).toBeLessThanOrEqual(8);
  });

  it("rolls reroll (2d6ro=1)", () => {
    const roll = new DiceRoll("2d6ro=1");
    expect(roll.total).toBeGreaterThanOrEqual(2);
  });

  it("throws on invalid notation", () => {
    expect(() => new DiceRoll("invalid")).toThrow();
  });
});
