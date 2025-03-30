// Cache for package version info
const VERSION_CACHE = {};

/**
 * Try to parse a date from a string.
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} - Parsed date object
 */
function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) {
    throw new Error(`Could not parse date '${dateStr}'. Use format YYYY-MM-DD`);
  }
  return d;
}

/**
 * Fetch package info from PyPI and get the version available on the target date
 * @param {string} packageName - Name of the package
 * @param {Date} targetDate - Target date to find the version for
 * @returns {Promise<string|null>} - Version string or null if not found
 */
async function getPackageVersionAsOfDate(packageName, targetDate) {
  const cacheKey = `${packageName}_${targetDate.toISOString().slice(0,10)}`;
  
  // Check cache first
  if (VERSION_CACHE[cacheKey]) {
    return VERSION_CACHE[cacheKey];
  }

  try {
    // Show loading status
    updateStatus(`Fetching info for ${packageName}...`);
    
    const url = `https://pypi.org/pypi/${packageName}/json`;
    const response = await fetch(url);

    if (response.status === 404) {
      updateStatus(`Package '${packageName}' not found on PyPI.`, 'error');
      return null;
    }
    
    if (!response.ok) {
      updateStatus(`Failed to fetch info for '${packageName}'. Status: ${response.status}`, 'error');
      return null;
    }

    const data = await response.json();
    const releases = data.releases;
    let latestVersion = null;
    let latestReleaseDate = null;

    // Loop over the releases to find the most recent version before the target date
    Object.keys(releases).forEach(version => {
      const releaseInfos = releases[version];
      if (!releaseInfos || releaseInfos.length === 0) return;

      releaseInfos.forEach(release => {
        try {
          // Use upload_time from PyPI response; it's in ISO format
          const releaseDate = new Date(release.upload_time);
          if (releaseDate <= targetDate) {
            if (!latestReleaseDate || releaseDate > latestReleaseDate) {
              latestReleaseDate = releaseDate;
              latestVersion = version;
            }
          }
        } catch (err) {
          console.warn(`Could not parse release date for ${packageName} ${version}. Skipping...`);
        }
      });
    });

    // Cache and return the result
    VERSION_CACHE[cacheKey] = latestVersion;
    return latestVersion;
  } catch (error) {
    updateStatus(`Error fetching info for '${packageName}': ${error.message}`, 'error');
    return null;
  }
}

/**
 * Check if a line is a package requirement
 * @param {string} line - Line from requirements.txt
 * @returns {boolean} - True if the line is a package requirement
 */
function isRequirementLine(line) {
  line = line.trim();
  return line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('git+');
}

/**
 * Parse package name from a requirement line
 * @param {string} line - Line from requirements.txt
 * @returns {string} - Extracted package name
 */
function parsePackageName(line) {
  if (line.includes('==')) {
    return line.split('==')[0].trim();
  } else if (line.includes('>=')) {
    return line.split('>=')[0].trim();
  } else if (line.includes('<=')) {
    return line.split('<=')[0].trim();
  } else if (line.includes('~=')) {
    return line.split('~=')[0].trim();
  } else if (line.includes('>')) {
    return line.split('>')[0].trim();
  } else if (line.includes('<')) {
    return line.split('<')[0].trim();
  } else if (line.includes('@')) {  // handle URL installations with @
    return line.split('@')[0].trim();
  } else {
    return line.trim();
  }
}

/**
 * Process a single package to get the version string
 * @param {string} packageName - Name of the package
 * @param {Date} targetDate - Target date to find the version for
 * @returns {Promise<string|null>} - Formatted requirement string or null
 */
async function processSinglePackage(packageName, targetDate) {
  const version = await getPackageVersionAsOfDate(packageName, targetDate);
  if (version) {
    return `${packageName}==${version}`;
  } else {
    console.warn(`No version found for ${packageName} on ${targetDate.toISOString().slice(0,10)}`);
    return null;
  }
}

/**
 * Process the full requirements text and update each package line
 * @param {string} text - Requirements text content
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Promise<string>} - Updated requirements text
 */
async function processRequirements(text, dateStr) {
  clearStatus();
  let targetDate;
  
  try {
    targetDate = parseDate(dateStr);
  } catch (error) {
    updateStatus(error.message, 'error');
    return "";
  }

  updateStatus(`Processing requirements for date: ${dateStr}...`);
  
  const lines = text.split('\n');
  const updatedRequirements = [];
  const totalLines = lines.filter(isRequirementLine).length;
  let processedCount = 0;

  // Process package lines
  for (let line of lines) {
    if (!isRequirementLine(line)) {
      // Keep comments and special lines unchanged
      updatedRequirements.push(line);
      continue;
    }
    
    const packageName = parsePackageName(line);
    if (!packageName) {
      updatedRequirements.push(line);
      continue;
    }
    
    const versionedPackage = await processSinglePackage(packageName, targetDate);
    processedCount++;
    updateStatus(`Processing packages... (${processedCount}/${totalLines})`);
    
    if (versionedPackage) {
      updatedRequirements.push(versionedPackage);
    } else {
      // If no version found, keep the original line
      updatedRequirements.push(line);
    }
  }

  updateStatus('Processing complete!', 'success');
  return updatedRequirements.join('\n');
}

/**
 * Process a single package and display the result
 * @param {string} packageName - Name of the package
 * @param {string} dateStr - Date string in YYYY-MM-DD format 
 */
async function processSinglePackageRequest(packageName, dateStr) {
  clearStatus();
  packageName = packageName.trim();
  
  if (!packageName) {
    updateStatus('Please enter a package name', 'error');
    return;
  }
  
  let targetDate;
  try {
    targetDate = parseDate(dateStr);
  } catch (error) {
    updateStatus(error.message, 'error');
    return;
  }
  
  const output = document.getElementById('output');
  output.textContent = "Processing...";
  
  const version = await getPackageVersionAsOfDate(packageName, targetDate);
  if (version) {
    output.textContent = `${packageName}==${version}`;
    updateStatus(`Found version ${version} for ${packageName} as of ${dateStr}`, 'success');
  } else {
    output.textContent = `No version found for ${packageName} as of ${dateStr}`;
    updateStatus(`No version found for ${packageName}`, 'error');
  }
}

/**
 * Update status message
 * @param {string} message - Status message to display
 * @param {string} type - Status type (error, success, or empty for info)
 */
function updateStatus(message, type = '') {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = type ? type : '';
}

/**
 * Clear status message
 */
function clearStatus() {
  const statusElement = document.getElementById('status');
  statusElement.textContent = '';
  statusElement.className = '';
}

/**
 * Initialize the application
 */
function initApp() {
  // Set default date to today
  const today = new Date();
  const dateInput = document.getElementById('date-input');
  dateInput.value = today.toISOString().slice(0, 10);
  
  // Requirements form
  const requirementsForm = document.getElementById('requirements-form');
  requirementsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const requirementsText = document.getElementById('requirements-input').value;
    const dateStr = document.getElementById('date-input').value;
    
    document.getElementById('output').textContent = "Processing...";
    document.getElementById('process-btn').disabled = true;
    
    const output = await processRequirements(requirementsText, dateStr);
    document.getElementById('output').textContent = output;
    document.getElementById('process-btn').disabled = false;
  });
  
  // Single package form
  const packageForm = document.getElementById('package-form');
  packageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const packageName = document.getElementById('package-input').value;
    const dateStr = document.getElementById('date-input').value;
    
    document.getElementById('process-btn').disabled = true;
    await processSinglePackageRequest(packageName, dateStr);
    document.getElementById('process-btn').disabled = false;
  });
  
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to current tab and content
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // Clear output and status
      document.getElementById('output').textContent = '';
      clearStatus();
    });
  });
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);