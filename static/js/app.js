// Cache for package version info
const cache = {};

// DOM elements
const input = document.getElementById('input');
const dateInput = document.getElementById('date');
const specifier = document.getElementById('specifier');
const preCheckbox = document.getElementById('pre');
const processBtn = document.getElementById('process-btn');
const todayBtn = document.getElementById('today-btn');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const output = document.getElementById('output');
const outputSummary = document.getElementById('output-summary');
const status = document.getElementById('status');
const themeToggle = document.getElementById('theme-toggle');

// Parse package name from requirement line
function parsePackageName(line) {
  const match = line.match(/^([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Check if line is a valid requirement
function isRequirement(line) {
  const trimmed = line.trim();
  return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('git+');
}

// Heuristic PEP 440 pre-release / dev-release detection
function isPrerelease(version) {
  return /(?:[._-]?(?:a|b|c|rc|alpha|beta|pre|preview|dev))\d*$/i.test(version);
}

// Fetch package version for a specific date. Skips yanked releases, and
// pre-releases unless includePre is set.
async function getVersion(packageName, targetDate, includePre) {
  const cacheKey = `${packageName}_${targetDate}_${includePre}`;
  if (cacheKey in cache) return cache[cacheKey];

  const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
  if (!response.ok) {
    cache[cacheKey] = null;
    return null;
  }

  const data = await response.json();
  let latestVersion = null;
  let latestDate = null;

  for (const [version, releases] of Object.entries(data.releases)) {
    if (!includePre && isPrerelease(version)) continue;
    for (const release of releases) {
      if (release.yanked) continue;
      const releaseDate = new Date(release.upload_time);
      if (releaseDate <= targetDate && (!latestDate || releaseDate > latestDate)) {
        latestDate = releaseDate;
        latestVersion = version;
      }
    }
  }

  cache[cacheKey] = latestVersion;
  return latestVersion;
}

// Update status message
function setStatus(message, type = '') {
  status.textContent = message;
  status.className = type;
}

// Escape text for safe insertion as HTML
function escapeHtml(text) {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// Render output lines, highlighting "not found" entries
function renderOutput(results) {
  output.innerHTML = results
    .map((line) => {
      const esc = escapeHtml(line);
      return /^#.*\(not found\)$/.test(line) ? `<span class="not-found">${esc}</span>` : esc;
    })
    .join('\n');
}

// Process all requirements
async function process() {
  const text = input.value.trim();
  const dateStr = dateInput.value;
  const spec = specifier.value;

  if (!text) {
    setStatus('Enter some packages', 'error');
    return;
  }

  if (!dateStr) {
    setStatus('Select a date', 'error');
    return;
  }

  const targetDate = new Date(dateStr + 'T23:59:59');
  const includePre = preCheckbox.checked;
  const lines = text.split('\n');
  const total = lines.filter(isRequirement).length;

  if (total === 0) {
    setStatus('No valid packages found', 'error');
    return;
  }

  processBtn.disabled = true;
  output.textContent = '';
  outputSummary.textContent = 'Output';
  setStatus(`Processing ${total} package${total > 1 ? 's' : ''}...`);

  // Process packages in parallel (batches of 5 to avoid rate limiting)
  const results = [];
  const batchSize = 5;
  let processed = 0;

  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
    const batchPromises = batch.map(async (line) => {
      if (!isRequirement(line)) return line;

      const pkg = parsePackageName(line);
      if (!pkg) return line;

      const version = await getVersion(pkg, targetDate, includePre);
      processed++;
      return version ? `${pkg}${spec}${version}` : `# ${pkg} (not found)`;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    setStatus(`Processing... (${Math.min(processed, total)}/${total})`);
  }

  renderOutput(results);

  const notFound = results.filter((r) => /^#.*\(not found\)$/.test(r)).length;
  const pinned = total - notFound;
  outputSummary.textContent = notFound
    ? `${pinned} pinned · ${notFound} not found`
    : `${pinned} pinned`;

  setStatus('Done', 'success');
  processBtn.disabled = false;

  // Save date preference
  localStorage.setItem('pip-time-machine-date', dateStr);
}

// Show toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// Copy output to clipboard
async function copyOutput() {
  const text = output.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied!');
  } catch (e) {
    console.error('Copy failed:', e);
  }
}

// Download output as a requirements file
function downloadOutput() {
  const text = output.textContent;
  if (!text) return;

  const date = dateInput.value || 'output';
  const blob = new Blob([text + '\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `requirements_${date}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// Apply and persist a theme ('light' | 'dark')
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  try {
    localStorage.setItem('pip-time-machine-theme', theme);
  } catch (e) {}
}

// Toggle between light and dark
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// Set date to today
function setToday() {
  dateInput.value = new Date().toISOString().slice(0, 10);
}

// Initialize
function init() {
  // Sync the toggle icon with the theme applied by the inline head script
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  // Restore or set default date
  const savedDate = localStorage.getItem('pip-time-machine-date');
  dateInput.value = savedDate || new Date().toISOString().slice(0, 10);

  // Event listeners
  processBtn.addEventListener('click', process);
  todayBtn.addEventListener('click', setToday);
  copyBtn.addEventListener('click', copyOutput);
  downloadBtn.addEventListener('click', downloadOutput);
  themeToggle.addEventListener('click', toggleTheme);

  // Keyboard shortcut: Ctrl+Enter to process
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      process();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
