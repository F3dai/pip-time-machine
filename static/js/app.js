// Cache for package version info
const cache = {};

// DOM elements
const input = document.getElementById('input');
const dateInput = document.getElementById('date');
const specifier = document.getElementById('specifier');
const processBtn = document.getElementById('process-btn');
const todayBtn = document.getElementById('today-btn');
const copyBtn = document.getElementById('copy-btn');
const output = document.getElementById('output');
const status = document.getElementById('status');

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

// Fetch package version for a specific date
async function getVersion(packageName, targetDate) {
  const cacheKey = `${packageName}_${targetDate}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
  if (!response.ok) return null;

  const data = await response.json();
  let latestVersion = null;
  let latestDate = null;

  for (const [version, releases] of Object.entries(data.releases)) {
    for (const release of releases) {
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
  const lines = text.split('\n');
  const requirements = lines.filter(isRequirement);

  if (requirements.length === 0) {
    setStatus('No valid packages found', 'error');
    return;
  }

  processBtn.disabled = true;
  output.textContent = '';
  setStatus(`Processing ${requirements.length} package${requirements.length > 1 ? 's' : ''}...`);

  // Process packages in parallel (batches of 5 to avoid rate limiting)
  const results = [];
  const batchSize = 5;

  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
    const batchPromises = batch.map(async (line) => {
      if (!isRequirement(line)) return line;

      const pkg = parsePackageName(line);
      if (!pkg) return line;

      const version = await getVersion(pkg, targetDate);
      return version ? `${pkg}${spec}${version}` : `# ${pkg} (not found)`;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    const processed = Math.min(i + batchSize, requirements.length);
    setStatus(`Processing... (${processed}/${requirements.length})`);
  }

  output.textContent = results.join('\n');
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

// Set date to today
function setToday() {
  dateInput.value = new Date().toISOString().slice(0, 10);
}

// Initialize
function init() {
  // Restore or set default date
  const savedDate = localStorage.getItem('pip-time-machine-date');
  dateInput.value = savedDate || new Date().toISOString().slice(0, 10);

  // Event listeners
  processBtn.addEventListener('click', process);
  todayBtn.addEventListener('click', setToday);
  copyBtn.addEventListener('click', copyOutput);

  // Keyboard shortcut: Ctrl+Enter to process
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      process();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
