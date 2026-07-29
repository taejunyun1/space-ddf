#!/usr/bin/env node

const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const host = '127.0.0.1'
const port = Number(process.env.SMOKE_PORT || 4173)
const baseUrl = process.env.SMOKE_BASE_URL || `http://${host}:${port}`
const routes = ['/', '/rental', '/shows/jihye/', '/projects/artwall/']
const protectedRoutes = ['/admin']
const expectedStops = new WeakSet()

async function main() {
  const startedPreview = process.env.SMOKE_BASE_URL ? null : startPreview()
  let chrome = null
  let client = null

  try {
    await waitForHttp(baseUrl, 30000)

    chrome = await startChrome()
    client = await openCdpPage(chrome.debugPort)

    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Log.enable')
    await client.send('Network.enable')

    for (const route of routes) {
      const result = await smokeRoute(client, new URL(route, baseUrl).href)
      console.log(`OK ${route} - ${result.title}`)
    }

    for (const route of protectedRoutes) {
      const result = await smokeProtectedRoute(new URL(route, baseUrl).href)
      console.log(`OK protected ${route} - ${result.status}`)
    }
  } finally {
    if (client) client.close()
    if (chrome) await stopProcess(chrome.process)
    if (chrome?.userDataDir) removeDirectory(chrome.userDataDir)
    if (startedPreview) await stopProcess(startedPreview)
  }
}

async function smokeProtectedRoute(url) {
  const response = await fetch(url, { redirect: 'manual' })
  const status = response.status
  const location = response.headers.get('location') || ''

  if (status === 200) {
    return { status }
  }

  throw new Error(`Expected protected admin route at ${url}, got HTTP ${status} ${location}`)
}

function startPreview() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(npmCommand, ['run', 'preview', '--', '--port', String(port)], {
    cwd: root,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', data => process.stdout.write(data))
  child.stderr.on('data', data => process.stderr.write(data))

  child.on('exit', code => {
    if (expectedStops.has(child)) return

    if (code !== null && code !== 0) {
      console.error(`Preview server exited with status ${code}.`)
    }
  })

  return child
}

async function startChrome() {
  const chromePath = findChrome()
  const debugPort = Number(process.env.SMOKE_CHROME_DEBUG_PORT || 9223)
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'space-ddf-chrome-'))
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--no-default-browser-check',
    '--no-first-run',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ]
  const child = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'ignore'] })

  await waitForHttp(`http://${host}:${debugPort}/json/version`, 30000)

  return { process: child, debugPort, userDataDir }
}

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  for (const command of ['google-chrome', 'chromium', 'chromium-browser', 'msedge']) {
    const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {
      encoding: 'utf8',
    })

    if (result.status === 0) {
      return result.stdout.trim().split(/\r?\n/)[0]
    }
  }

  throw new Error('Chrome or Chromium was not found. Set CHROME_PATH to run smoke tests.')
}

async function openCdpPage(debugPort) {
  const target = await fetchJson(`http://${host}:${debugPort}/json/new?about:blank`, {
    method: 'PUT',
  })

  return createCdpClient(target.webSocketDebuggerUrl)
}

function createCdpClient(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketUrl)
    const callbacks = new Map()
    const listeners = new Set()
    let id = 0

    ws.onopen = () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id

          return new Promise((resolveCommand, rejectCommand) => {
            callbacks.set(messageId, { resolve: resolveCommand, reject: rejectCommand })
            ws.send(JSON.stringify({ id: messageId, method, params }))
          })
        },
        onEvent(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        close() {
          ws.close()
        },
      })
    }

    ws.onerror = error => {
      reject(error.error || error)
    }

    ws.onmessage = event => {
      const message = JSON.parse(event.data)

      if (message.id) {
        const callback = callbacks.get(message.id)
        callbacks.delete(message.id)

        if (!callback) return
        if (message.error) callback.reject(new Error(message.error.message))
        else callback.resolve(message.result)
        return
      }

      for (const listener of listeners) {
        listener(message)
      }
    }
  })
}

async function smokeRoute(client, url) {
  const errors = []
  const resourceErrors = []
  const detach = client.onEvent(message => {
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails
      errors.push(details.exception?.description || details.text || 'Runtime exception')
    }

    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(message.params.type)) {
      errors.push(message.params.args.map(arg => arg.description || arg.value || arg.type).join(' '))
    }

    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      errors.push(message.params.entry.text)
    }

    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      resourceErrors.push({
        status: message.params.response.status,
        url: message.params.response.url,
      })
    }
  })

  try {
    const loaded = waitForCdpEvent(client, 'Page.loadEventFired', 15000)
    await client.send('Page.navigate', { url })
    await loaded
    await delay(800)

    const evaluation = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const app = document.querySelector('#app')
        return {
          title: document.title,
          href: location.href,
          appChildren: app ? app.children.length : 0,
          h1: document.querySelector('h1')?.textContent?.trim() || '',
          bodyTextLength: document.body.innerText.trim().length,
          images: document.images.length
        }
      })()`,
      returnByValue: true,
      awaitPromise: true,
    })

    if (evaluation.exceptionDetails) {
      throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text)
    }

    const result = evaluation.result.value

    if (!result.appChildren || result.bodyTextLength < 20) {
      throw new Error(`App did not render enough content at ${url}: ${JSON.stringify(result)}`)
    }

    const actionableResourceErrors = resourceErrors.filter(error => !isIgnoredResourceError(error.url))
    const actionableErrors = errors.filter(error => {
      if (/favicon/i.test(error)) return false

      if (/Failed to load resource/i.test(error) && resourceErrors.some(item => isIgnoredResourceError(item.url))) {
        return false
      }

      return true
    })

    if (actionableErrors.length || actionableResourceErrors.length) {
      const details = [
        ...actionableErrors,
        ...actionableResourceErrors.map(error => `${error.status} ${error.url}`),
      ]

      throw new Error(`Console/runtime errors at ${url}:\n${details.join('\n')}`)
    }

    return result
  } finally {
    detach()
  }
}

function isIgnoredResourceError(url) {
  return /\/favicon\.ico(?:$|\?)/i.test(url) || /\/cdn-cgi\/rum(?:$|\?)/i.test(url)
}

function waitForCdpEvent(client, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      detach()
      reject(new Error(`Timed out waiting for ${method}`))
    }, timeoutMs)
    const detach = client.onEvent(message => {
      if (message.method !== method) return

      clearTimeout(timer)
      detach()
      resolve(message.params)
    })
  })
}

function waitForHttp(url, timeoutMs) {
  const started = Date.now()
  const client = getHttpClient(url)

  return new Promise((resolve, reject) => {
    const attempt = () => {
      client.get(url, response => {
        response.resume()
        resolve()
      }).on('error', error => {
        if (Date.now() - started > timeoutMs) {
          reject(error)
          return
        }

        setTimeout(attempt, 250)
      })
    }

    attempt()
  })
}

function getHttpClient(url) {
  const protocol = new URL(url).protocol

  if (protocol === 'https:') return https
  if (protocol === 'http:') return http

  throw new Error(`Unsupported protocol for smoke URL: ${protocol}`)
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

function stopProcess(child) {
  if (!child || child.killed) return

  return new Promise(resolve => {
    expectedStops.add(child)

    const timer = setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
      resolve()
    }, 1500)

    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })

    child.kill('SIGTERM')
  })
}

function removeDirectory(directory) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(directory, { recursive: true, force: true })
      return
    } catch (error) {
      if (attempt === 4) throw error
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
