// ─── State ───

let stopRequested = false
let running = false
const LOG_MAX = 500

// ─── DOM refs ───

const $ = (id) => document.getElementById(id)

const btnLoad = $('btn-load')
const fileInput = $('file-input')
const btnStep = $('btn-step')
const btnRun = $('btn-run')
const btnStop = $('btn-stop')
const btnReset = $('btn-reset')
const romSelect = $('rom-select')
const statusEl = $('status')
const regGrid = $('registers-grid')
const flagsRow = $('flags-row')
const disasmContent = $('disasm-content')
const memContent = $('memory-content')
const logContent = $('log-content')
const memAddrInput = $('mem-addr')
const btnMemRefresh = $('btn-mem-refresh')
const btnLogClear = $('btn-log-clear')
const bpList = $('bp-list')
const bpAddrInput = $('bp-addr')
const btnBpSet = $('btn-bp-set')
const btnBpClear = $('btn-bp-clear')
const btnBpRemove = $('btn-bp-remove')
const btnMemGotoPC = $('btn-mem-goto-pc')

// ─── Helpers ───

function hex8(v) {
  return (v & 0xff).toString(16).toUpperCase().padStart(2, '0')
}

function hex16(v) {
  return (v & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

async function api(path, opts = {}) {
  const headers = {}
  if (opts.body && typeof opts.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(path, {
    headers,
    ...opts
  })
  return res.json()
}

function setStatus(text, color) {
  statusEl.textContent = text
  statusEl.style.color = color || '#8b949e'
}

function setRunning(r) {
  running = r
  btnRun.disabled = r
  btnStop.disabled = !r
  btnStep.disabled = r
  btnLoad.disabled = r
  btnReset.disabled = r
  romSelect.disabled = r
}

function log(text, cls = '') {
  const line = document.createElement('div')
  line.className = 'log-line' + (cls ? ' ' + cls : '')
  line.textContent = text
  logContent.appendChild(line)
  while (logContent.children.length > LOG_MAX) {
    logContent.removeChild(logContent.firstChild)
  }
  logContent.scrollTop = logContent.scrollHeight
}

// ─── Render functions ───

let prevRegs = {}
let currentBPs = []
let currentPC = 0x0000
const consoleState = { lastLen: 0 }
const bdosState = { lastLen: 0 }

function processOutput(label, cssClass, output, state) {
  if (!output || output.length <= state.lastLen) return
  const newChars = output.slice(state.lastLen)
  state.lastLen = output.length
  let buf = ''
  function flush() {
    if (buf) {
      log(`${label}: "${buf}"`, cssClass)
      buf = ''
    }
  }
  for (const ch of newChars) {
    const visible = ch >= ' ' && ch !== '\x7f'
    if (visible) {
      buf += ch
    } else {
      flush()
      log(`${label}: 0x${hex8(ch.charCodeAt(0))}`, cssClass)
    }
  }
  flush()
}

function renderState(data) {
  processOutput('CONSOLE', 'console', data.consoleOutput, consoleState)
  processOutput('BDOS', 'bdos', data.bdosOutput, bdosState)
  const r = data.registers
  const flags = data.flags
  const halted = data.halted

  // Registers
  regGrid.innerHTML = ''
  const rows = [
    { label: 'A', value: hex8(r.A), extra: '' },
    { label: 'B', value: hex8(r.B), extra: `C=${hex8(r.C)}` },
    { label: 'D', value: hex8(r.D), extra: `E=${hex8(r.E)}` },
    { label: 'H', value: hex8(r.H), extra: `L=${hex8(r.L)}` },
    { label: 'SP', value: hex16(r.stackPointer), extra: '' },
    { label: 'PC', value: hex16(r.programCounter), extra: '', pcClass: true }
  ]

  for (const row of rows) {
    const div = document.createElement('div')
    div.className = 'reg-row' + (row.pcClass ? ' pc' : '')
    const val = row.label === 'PC' ? hex16(r.programCounter) : row.value

    let changed = false
    if (prevRegs[row.label] !== undefined && prevRegs[row.label] !== val) {
      changed = true
    }
    prevRegs[row.label] = val

    div.innerHTML =
      `<span class="reg-label">${row.label}</span>` +
      `<span class="reg-value${changed ? ' changed' : ''}">${val}${row.extra ? ' ' + row.extra : ''}</span>`
    regGrid.appendChild(div)
  }

  // Flags
  flagsRow.innerHTML = ''
  const flagDefs = [
    { key: 'S', label: 'S' },
    { key: 'Z', label: 'Z' },
    { key: 'A', label: 'A' },
    { key: 'P', label: 'P' },
    { key: 'C', label: 'C' }
  ]
  for (const fd of flagDefs) {
    const span = document.createElement('span')
    span.className = 'flag-badge' + (flags[fd.key] ? ' active' : '')
    span.textContent = fd.label
    flagsRow.appendChild(span)
  }

  // Status
  if (halted) {
    setStatus('Halted', '#ffa657')
  } else if (!running) {
    setStatus('Idle')
  }

  // Cache current values
  currentPC = r.programCounter
  if (data.breakpoints) {
    currentBPs = data.breakpoints
    renderBreakpoints(currentBPs)
  }
}

function renderBreakpoints(bps) {
  if (!bps || bps.length === 0) {
    bpList.textContent = 'None'
    return
  }
  bpList.innerHTML = bps
    .map((a) => `<span class="bp-chip" data-addr="${a}">0x${hex16(a)} ×</span>`)
    .join('')
}

bpList.addEventListener('click', async (e) => {
  const chip = e.target.closest('.bp-chip')
  if (!chip) return
  const addr = parseInt(chip.dataset.addr, 10)
  const data = await api('/api/breakpoint', {
    method: 'POST',
    body: JSON.stringify({ address: addr, action: 'remove' })
  })
  currentBPs = data.breakpoints
  renderBreakpoints(currentBPs)
  await renderDisasm(currentPC)
})

async function renderDisasm(pc) {
  const data = await api(`/api/disasm?addr=${hex16(pc)}&count=24`)
  if (!data.instructions) return

  disasmContent.innerHTML = ''
  for (const insn of data.instructions) {
    const line = document.createElement('div')
    line.className = 'insn-line' + (insn.address === pc ? ' active' : '')
    line.dataset.addr = insn.address
    const arrow = insn.address === pc ? '→' : ' '
    const hexStr = insn.bytes.map((b) => hex8(b)).join(' ')
    const bpMark = currentBPs.includes(insn.address) ? '●' : ' '
    line.innerHTML =
      `<span class="insn-arrow">${arrow}</span>` +
      `<span class="insn-addr">${hex16(insn.address)}</span>` +
      `<span class="insn-bytes">${hexStr.padEnd(8)}</span>` +
      `<span class="insn-text${currentBPs.includes(insn.address) ? ' bp' : ''}">${bpMark} ${insn.disassembly}</span>`
    disasmContent.appendChild(line)
  }

  // Scroll active instruction into view
  const active = disasmContent.querySelector('.active')
  if (active) {
    active.scrollIntoView({ block: 'nearest' })
  }
}

disasmContent.addEventListener('click', async (e) => {
  const line = e.target.closest('.insn-line')
  if (!line) return
  const addr = parseInt(line.dataset.addr, 10)
  const action = currentBPs.includes(addr) ? 'remove' : 'set'
  const data = await api('/api/breakpoint', {
    method: 'POST',
    body: JSON.stringify({ address: addr, action })
  })
  currentBPs = data.breakpoints
  renderBreakpoints(currentBPs)
  renderDisasm(currentPC)
})

async function renderMemory(addr) {
  const count = 256
  const data = await api(`/api/memory?addr=${hex16(addr)}&count=${count}`)
  if (!data.bytes) return

  memContent.innerHTML = ''
  for (let row = 0; row < data.bytes.length; row += 16) {
    const rowAddr = (data.address + row) & 0xffff
    const chunk = data.bytes.slice(row, row + 16)
    const hex = chunk.map((b) => hex8(b)).join(' ')
    const ascii = chunk
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
      .join('')

    const line = document.createElement('div')
    line.className = 'mem-line'
    line.innerHTML =
      `<span class="mem-addr">${hex16(rowAddr)}</span>` +
      `<span class="mem-hex">${hex.padEnd(47)}</span>` +
      `<span class="mem-ascii">${ascii}</span>`
    memContent.appendChild(line)
  }
}

async function refreshUI(stateData) {
  if (stateData) {
    renderState(stateData)
    const pc = stateData.registers.programCounter
    await renderDisasm(pc)
    memAddrInput.value = '0x' + hex16(pc)
    await renderMemory(pc)
  } else {
    const s = await api('/api/state')
    renderState(s)
    await renderDisasm(s.registers.programCounter)
    const memAddr =
      parseInt(memAddrInput.value, 16) || s.registers.programCounter
    await renderMemory(memAddr)
  }
}

// ─── Actions ───

function setLoading(loading) {
  document.body.classList.toggle('loading', loading)
}

async function handleStep() {
  if (running) return
  try {
    const data = await api('/api/step', { method: 'POST' })
    if (data.error) {
      log(data.error, 'error')
      return
    }
    log(`${hex16(data.address)}  ${data.disassembly}  (${data.ticks}t)`, '')
    await refreshUI(data.state)
    if (data.state.halted) {
      log('CPU halted.', 'halted')
    }
  } catch (e) {
    log('Step error: ' + e.message, 'error')
  }
}

async function handleRun() {
  if (running) return
  setRunning(true)
  setLoading(true)
  stopRequested = false
  setStatus('Running...', '#58a6ff')

  const MAX_CHUNKS = 10000
  let totalInsns = 0

  for (let i = 0; i < MAX_CHUNKS; i++) {
    if (stopRequested) {
      log('Execution stopped by user.', 'error')
      break
    }

    let data
    try {
      data = await api('/api/run', {
        method: 'POST',
        body: JSON.stringify({ maxInstructions: 100000 })
      })
    } catch (e) {
      log('Run error: ' + e.message, 'error')
      break
    }

    if (data.error) {
      log(data.error, 'error')
      break
    }

    await refreshUI(data.state)
    totalInsns += data.instructionsExecuted
    setStatus(`Running... ${totalInsns.toLocaleString()} insns`, '#58a6ff')

    if (data.breakpointHit !== null) {
      log(
        `Breakpoint hit at 0x${hex16(data.breakpointHit)} (${data.instructionsExecuted} insns)`,
        'breakpoint'
      )
      break
    }

    if (data.halted) {
      log(
        `CPU halted after ${data.instructionsExecuted} instructions.`,
        'halted'
      )
      break
    }

    if (data.instructionsExecuted < 100000) {
      break
    }

    // Yield to let UI paint
    await new Promise((r) => setTimeout(r, 16))
  }

  setRunning(false)
  setLoading(false)
}

async function handleReset() {
  if (running) return
  await api('/api/reset', { method: 'POST' })
  consoleState.lastLen = 0
  bdosState.lastLen = 0
  log('CPU reset.', '')
  await refreshUI()
}

async function handleLoad(path) {
  if (running) return
  setLoading(true)
  try {
    const data = await api('/api/load', {
      method: 'POST',
      body: JSON.stringify({ path })
    })
    if (data.error) {
      log('Load error: ' + data.error, 'error')
      return
    }
    consoleState.lastLen = 0
    bdosState.lastLen = 0
    log(
      `Loaded ${path} (${data.size} bytes at 0x${hex16(data.loadAddress)})`,
      ''
    )
    await refreshUI(data.state)
  } catch (e) {
    log('Load error: ' + e.message, 'error')
  }
  setLoading(false)
}

async function handleFileUpload(file) {
  if (running) return
  setLoading(true)
  try {
    const buffer = await file.arrayBuffer()
    const res = await fetch('/api/load?addr=0x0100', {
      method: 'POST',
      body: buffer
    })
    const data = await res.json()
    if (data.error) {
      log('Upload error: ' + data.error, 'error')
      return
    }
    consoleState.lastLen = 0
    bdosState.lastLen = 0
    log(
      `Loaded ${file.name} (${data.size} bytes at 0x${hex16(data.loadAddress)})`,
      ''
    )
    await refreshUI(data.state)
  } catch (e) {
    log('Upload error: ' + e.message, 'error')
  }
  setLoading(false)
}

async function handleBreakpointSet() {
  const raw = bpAddrInput.value.trim()
  if (!raw) return
  const addr = parseInt(raw.replace(/^0x/i, ''), 16)
  if (isNaN(addr)) return
  const data = await api('/api/breakpoint', {
    method: 'POST',
    body: JSON.stringify({ address: addr, action: 'set' })
  })
  currentBPs = data.breakpoints
  renderBreakpoints(currentBPs)
  await renderDisasm(currentPC)
}

async function handleBreakpointClear() {
  const data = await api('/api/breakpoint', {
    method: 'POST',
    body: JSON.stringify({ action: 'clear' })
  })
  currentBPs = data.breakpoints
  renderBreakpoints(currentBPs)
  await renderDisasm(currentPC)
}

async function handleBreakpointRemove() {
  const raw = bpAddrInput.value.trim()
  if (!raw) return
  const addr = parseInt(raw.replace(/^0x/i, ''), 16)
  if (isNaN(addr)) return
  const data = await api('/api/breakpoint', {
    method: 'POST',
    body: JSON.stringify({ address: addr, action: 'remove' })
  })
  currentBPs = data.breakpoints
  renderBreakpoints(currentBPs)
  await renderDisasm(currentPC)
}

// ─── Event binding ───

btnStep.addEventListener('click', handleStep)

btnRun.addEventListener('click', handleRun)

btnStop.addEventListener('click', () => {
  stopRequested = true
})

btnReset.addEventListener('click', handleReset)

btnLoad.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    handleFileUpload(fileInput.files[0])
  }
  fileInput.value = ''
})

romSelect.addEventListener('change', () => {
  const val = romSelect.value
  if (val) {
    handleLoad(val)
  }
})

btnMemRefresh.addEventListener('click', async () => {
  const raw = memAddrInput.value.trim()
  const addr = parseInt(raw.replace(/^0x/i, ''), 16)
  if (!isNaN(addr)) {
    await renderMemory(addr)
  }
})

memAddrInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnMemRefresh.click()
})

btnMemGotoPC.addEventListener('click', () => {
  memAddrInput.value = '0x' + hex16(currentPC)
  renderMemory(currentPC)
})

btnLogClear.addEventListener('click', () => {
  logContent.innerHTML = ''
})

btnBpSet.addEventListener('click', handleBreakpointSet)

bpAddrInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleBreakpointSet()
})

btnBpClear.addEventListener('click', handleBreakpointClear)
btnBpRemove.addEventListener('click', handleBreakpointRemove)

// ─── Keyboard shortcuts ───

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
  switch (e.key) {
    case 's':
    case 'S':
      handleStep()
      break
    case 'r':
    case 'R':
      if (!running) handleRun()
      break
    case 'Escape':
      stopRequested = true
      break
    case 'Backspace':
      e.preventDefault()
      handleReset()
      break
  }
})

async function populateDropdown() {
  const [roms, examples] = await Promise.all([
    api('/api/roms'),
    api('/api/examples')
  ])
  if (roms.roms && roms.roms.length > 0) {
    const optgroup = document.createElement('optgroup')
    optgroup.label = '— Diagnostics —'
    for (const r of roms.roms) {
      const opt = document.createElement('option')
      opt.value = r.path
      opt.textContent = r.name
      optgroup.appendChild(opt)
    }
    romSelect.appendChild(optgroup)
  }
  if (examples.examples && examples.examples.length > 0) {
    const optgroup = document.createElement('optgroup')
    optgroup.label = '— Examples —'
    for (const ex of examples.examples) {
      const opt = document.createElement('option')
      opt.value = ex.path
      opt.textContent = ex.name
      optgroup.appendChild(opt)
    }
    romSelect.appendChild(optgroup)
  }
}

// ─── Init ───

async function init() {
  try {
    await populateDropdown()
    await refreshUI()
    log('Intel8080TS Web Debugger ready. Load a ROM or step through code.', '')
  } catch (e) {
    log('Failed to connect to debugger server: ' + e.message, 'error')
    setStatus('Disconnected', '#f85149')
  }
}

init()
