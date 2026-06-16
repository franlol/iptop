import { describe, expect, test } from "bun:test"
import { splitHostPort } from "./dns"

describe("splitHostPort", () => {
  test("ipv4 with port", () => {
    expect(splitHostPort("192.0.2.1:443")).toEqual({ ip: "192.0.2.1", port: "443" })
  })
  test("ipv6 with brackets", () => {
    expect(splitHostPort("[fe80::1]:5353")).toEqual({ ip: "fe80::1", port: "5353" })
  })
  test("no port", () => {
    expect(splitHostPort("192.0.2.1")).toEqual({ ip: "192.0.2.1", port: "" })
  })
  test("wildcard", () => {
    expect(splitHostPort("*:5353")).toEqual({ ip: "*", port: "5353" })
  })
})
