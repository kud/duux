import { describe, expect, it } from "vitest"
import {
  buildCommand,
  powerCommand,
  speedCommand,
  modeCommand,
  horizontalOscillationCommand,
  verticalOscillationCommand,
  nightModeCommand,
  timerCommand,
} from "./commands.js"

describe("powerCommand", () => {
  it("encodes on as 1 and off as 0", () => {
    expect(powerCommand(true)).toBe("tune set power 1")
    expect(powerCommand(false)).toBe("tune set power 0")
  })
})

describe("speedCommand", () => {
  it("accepts the full 1-30 range", () => {
    expect(speedCommand(1)).toBe("tune set speed 1")
    expect(speedCommand(30)).toBe("tune set speed 30")
    expect(speedCommand(17)).toBe("tune set speed 17")
  })

  it("rejects speeds outside 1-30", () => {
    expect(() => speedCommand(0)).toThrow(RangeError)
    expect(() => speedCommand(31)).toThrow(RangeError)
  })

  it("rejects non-integer speeds", () => {
    expect(() => speedCommand(1.5)).toThrow(RangeError)
  })
})

describe("modeCommand", () => {
  it("maps named modes to their wire ints", () => {
    expect(modeCommand("normal")).toBe("tune set mode 0")
    expect(modeCommand("natural")).toBe("tune set mode 1")
  })
})

describe("oscillation commands", () => {
  it("builds the horosc command for horizontal oscillation", () => {
    expect(horizontalOscillationCommand(true)).toBe("tune set horosc 1")
    expect(horizontalOscillationCommand(false)).toBe("tune set horosc 0")
  })

  it("builds the verosc command for vertical oscillation", () => {
    expect(verticalOscillationCommand(true)).toBe("tune set verosc 1")
    expect(verticalOscillationCommand(false)).toBe("tune set verosc 0")
  })
})

describe("nightModeCommand", () => {
  it("encodes on/off as 1/0", () => {
    expect(nightModeCommand(true)).toBe("tune set night 1")
    expect(nightModeCommand(false)).toBe("tune set night 0")
  })
})

describe("timerCommand", () => {
  it("accepts a non-negative integer number of hours", () => {
    expect(timerCommand(0)).toBe("tune set timer 0")
    expect(timerCommand(12)).toBe("tune set timer 12")
  })

  it("rejects negative or non-integer hours", () => {
    expect(() => timerCommand(-1)).toThrow(RangeError)
    expect(() => timerCommand(1.5)).toThrow(RangeError)
  })
})

describe("buildCommand", () => {
  it("is the shared engine every named builder delegates to", () => {
    expect(buildCommand({ param: "power", value: true })).toBe(
      powerCommand(true),
    )
    expect(buildCommand({ param: "mode", value: "natural" })).toBe(
      modeCommand("natural"),
    )
  })
})
