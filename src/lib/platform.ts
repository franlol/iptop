// The single place that knows operating systems exist. Each collector's
// contract file picks its implementation here; adding an OS means adding a
// key to Impls and following the compiler errors.
interface Impls<T> {
  darwin: T
  linux: T
}

export function byPlatform<T>(impls: Impls<T>): T {
  const impl = impls[process.platform as keyof Impls<T>]
  if (!impl) throw new Error(`iptop: unsupported platform "${process.platform}" (supported: macOS, Linux)`)
  return impl
}
