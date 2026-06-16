import { expect, test } from "bun:test"
import type { Connection } from "../collectors/connections"
import { aggregateServices, remotePort } from "./services"

function conn(overrides: Partial<Connection>): Connection {
  return {
    command: "app",
    pid: 1,
    protocol: "TCP",
    local: "192.168.1.2:50000",
    remote: "1.2.3.4:443",
    remoteDisplay: "1.2.3.4:443",
    state: "ESTABLISHED",
    ...overrides,
  }
}

test("remotePort parses IPv4 and IPv6 remotes", () => {
  expect(remotePort("1.2.3.4:443")).toBe(443)
  expect(remotePort("[2a00:1450::5]:443")).toBe(443)
  expect(remotePort("")).toBe(null)
  expect(remotePort("1.2.3.4:")).toBe(null)
})

test("maps well-known ports, distinguishing tcp/443 from udp/443", () => {
  const services = aggregateServices(
    [conn({}), conn({ protocol: "UDP", local: "192.168.1.2:50001", remote: "5.6.7.8:443" })],
    new Map(),
  )
  expect(services.map((s) => s.name).sort()).toEqual(["https", "quic"])
})

test("sums rates and counts connections per service", () => {
  const rates = new Map([
    ["192.168.1.2:50000|1.2.3.4:443", { rxRate: 100, txRate: 20 }],
    ["192.168.1.2:50001|5.6.7.8:443", { rxRate: 50, txRate: 5 }],
  ])
  const services = aggregateServices(
    [conn({}), conn({ local: "192.168.1.2:50001", remote: "5.6.7.8:443" })],
    rates,
  )
  expect(services).toHaveLength(1)
  expect(services[0]?.rate).toBe(175)
  expect(services[0]?.rxRate).toBe(150)
  expect(services[0]?.txRate).toBe(25)
  expect(services[0]?.connections).toBe(2)
})

test("unknown ports keep an empty name; busiest service sorts first", () => {
  const rates = new Map([["192.168.1.2:50001|5.6.7.8:60123", { rxRate: 900, txRate: 0 }]])
  const services = aggregateServices(
    [conn({}), conn({ local: "192.168.1.2:50001", remote: "5.6.7.8:60123" })],
    rates,
  )
  expect(services[0]?.name).toBe("")
  expect(services[0]?.port).toBe(60123)
  expect(services[1]?.name).toBe("https")
})

test("skips connections without a remote endpoint", () => {
  expect(aggregateServices([conn({ remote: "" })], new Map())).toEqual([])
})
