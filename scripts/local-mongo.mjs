/**
 * Starts the throwaway in-memory MongoDB used for local development and tests.
 *
 * On Windows, mongod needs the Microsoft Visual C++ runtime. If it is not
 * installed system-wide, this looks for the same Microsoft-signed runtime
 * files that ship with Microsoft Edge and places copies next to the
 * downloaded mongod binary (in your user cache folder, nothing system-wide).
 * If that is not possible it explains how to install the runtime.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoMemoryServer } from 'mongodb-memory-server'

const RUNTIME_DLLS = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']

function findEdgeRuntimeDir() {
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles]
    .filter(Boolean)
    .map((root) => path.join(root, 'Microsoft', 'Edge', 'Application'))
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    const versions = fs.readdirSync(root).filter((name) => /^\d+\./.test(name)).sort().reverse()
    for (const version of versions) {
      const dir = path.join(root, version)
      if (RUNTIME_DLLS.every((dll) => fs.existsSync(path.join(dir, dll)))) return dir
    }
  }
  return null
}

function ensureWindowsRuntime(binaryDir) {
  if (process.platform !== 'win32') return
  const system32 = path.join(process.env.WINDIR || 'C:\\Windows', 'System32')
  const missing = RUNTIME_DLLS.filter(
    (dll) => !fs.existsSync(path.join(system32, dll)) && !fs.existsSync(path.join(binaryDir, dll))
  )
  if (missing.length === 0) return
  const source = findEdgeRuntimeDir()
  if (!source) {
    throw new Error(
      'The local test database needs the Microsoft Visual C++ runtime, which is not installed.\n' +
      'Install it once with:  winget install Microsoft.VCRedist.2015+.x64\n' +
      '(or download "vc_redist.x64.exe" from Microsoft), then run this again.'
    )
  }
  fs.mkdirSync(binaryDir, { recursive: true })
  for (const dll of missing) fs.copyFileSync(path.join(source, dll), path.join(binaryDir, dll))
}

export async function startLocalMongo(options = {}) {
  // mongodb-memory-server keeps its mongod binary in one of these two places;
  // the runtime files have to sit beside it.
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  for (const binaryDir of [
    path.join(projectRoot, 'node_modules', '.cache', 'mongodb-memory-server'),
    path.join(os.homedir(), '.cache', 'mongodb-binaries'),
  ]) {
    ensureWindowsRuntime(binaryDir)
  }
  return MongoMemoryServer.create({
    instance: options.port ? { port: options.port, ip: '127.0.0.1' } : { ip: '127.0.0.1' },
  })
}
