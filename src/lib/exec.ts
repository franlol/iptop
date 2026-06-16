export async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" })
  return await new Response(proc.stdout).text()
}

export function readText(path: string): Promise<string> {
  return Bun.file(path).text()
}
