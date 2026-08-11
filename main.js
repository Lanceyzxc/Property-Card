const departments = [
  { name: "GASS", color: "#9a0603" },
  { name: "COTT", color: "#8c52ff" },
  { name: "CFAST", color: "#38b6ff" },
  { name: "CCMS", color: "#737373" },
  { name: "COED", color: "#004aad" },
  { name: "IABD", color: "#ff751f" },
  { name: "CBPA", color: "#faf901" },
  { name: "CANR", color: "#499632" },
  { name: "COENG", color: "#ffde59" },
  { name: "CAS", color: "#ff3131" }
];

// Map to your default layout (1st row left GASS, right COTT, etc.)
const defaultLayout = [
  "#9a0603", "#8c52ff", // Row 1
  "#38b6ff", "#737373", // Row 2
  "#004aad", "#ff751f", // Row 3
  "#faf901", "#499632", // Row 4
  "#ffde59", "#ff3131"  // Row 5
];

let totalCardCount = 0;
let uniqueCardId = 0;
let allCards = [];

function generateOptions(selectedColor) {
  let optionsHtml = '';
  departments.forEach(dept => {
    const isSelected = dept.color === selectedColor ? 'selected' : '';
    optionsHtml += `<option value="${dept.color}" ${isSelected}>${dept.name}</option>`;
  });
  return optionsHtml;
}

function addNewCards() {
  const qty = parseInt(document.getElementById('add-qty').value) || 1;
  const color = document.getElementById('add-dept-select').value;
  for(let i = 0; i < qty; i++) {
    createSingleCard(color);
  }
  applyFilter();
  refreshDashboardSummary();
  closeAddPanel();
}

function toggleAddPanel() {
  const panel = document.getElementById('add-panel');
  if (!panel) return;
  panel.classList.toggle('open');
}

function closeAddPanel() {
  const panel = document.getElementById('add-panel');
  if (!panel) return;
  panel.classList.remove('open');
}

function addCards(amount) {
  for (let i = 0; i < amount; i++) {
    let defaultColor = (uniqueCardId < 10) ? defaultLayout[uniqueCardId] : departments[0].color;
    createSingleCard(defaultColor);
  }
}

function createSingleCard(initColor) {
  const container = document.getElementById('pages-container');
  let pages = container.querySelectorAll('.page-wrapper');
  let lastPageGrid = null;

  if (pages.length === 0 || pages[pages.length - 1].querySelector('.cards-grid').children.length >= 10) {
    const newPage = document.createElement('div');
    newPage.className = 'page-wrapper';
    const newGrid = document.createElement('div');
    newGrid.className = 'cards-grid';
    newPage.appendChild(newGrid);
    container.appendChild(newPage);
    lastPageGrid = newGrid;
  } else {
    lastPageGrid = pages[pages.length - 1].querySelector('.cards-grid');
  }

  const currentIndex = uniqueCardId++;
  totalCardCount++;
  
  // Using a fallback mechanism for the logo image to prevent broken links in preview
  const cardHtml = `
    <div class="card-ui-wrapper" id="card-wrapper-${currentIndex}">
      <div class="card-header-control">
        <select class="neu-select dept-select" style="flex-grow: 1;" onchange="updateCardColor(this, ${currentIndex})">
          ${generateOptions(initColor)}
        </select>
        <button class="neu-btn danger" style="padding: 8px; width: auto; margin-left: 10px; flex-shrink: 0;" onclick="deleteCard(this)" title="Delete Card">🗑️</button>
      </div>
      <div class="label-container">
        <div class="top-white-space"></div>
        <div class="color-banner" id="banner-${currentIndex}" style="background-color: ${initColor}">
          <h1>UCN PROPERTY TAG</h1>
        </div>
        <div class="logo-shield"></div>
        <div class="form-section">
          <div class="form-row"><label>ICS/PAR No.:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Property No.:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Date Aquired:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Acquisition Cost:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Fund:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>End-User/Location:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Requested by:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Supplier:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>P.O/J.O/Contract Ref:</label><textarea class="underline-input auto-resize" rows="1"></textarea></div>
          <div class="form-row"><label>Item Description:</label><textarea class="underline-input auto-resize" rows="1"></textarea></div>
        </div>
      </div>
    </div>
  `;

  lastPageGrid.insertAdjacentHTML('beforeend', cardHtml);
  const newCard = lastPageGrid.lastElementChild;
  allCards.push(newCard);
  // Attach auto-resize behavior to any textarea inside the new card
  const textareas = newCard.querySelectorAll('textarea.auto-resize');
  textareas.forEach((ta) => {
    // helper to enforce max two visual rows by trimming overflowing content
    const adjust = (el) => {
      el.style.height = 'auto';
      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize) || 18;
      const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.2;
      const padding = parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0) + 4;
      const maxH = (lineHeight * 2) + padding;

      // shrink visually to fit within two lines
      let desired = Math.min(el.scrollHeight, maxH);
      el.style.height = desired + 'px';
      el.style.overflowY = 'hidden';

      // If content still overflows (wrapped long single line or many words), trim by words
      if (el.scrollHeight > maxH) {
        let text = el.value || '';
        // Remove trailing whitespace first
        text = text.replace(/\s+$/,'');
        // Iteratively remove last words until it fits or empty
        while (text.length > 0) {
          // Remove last word or character group
          text = text.replace(/\s*\S+$/,'');
          el.value = text.trim();
          el.style.height = 'auto';
          if (el.scrollHeight <= maxH) break;
        }
        // Append ellipsis if something was trimmed
        if (text.length > 0 && (text !== (el.value || ''))) {
          el.value = (el.value || '').trim() + '\u2026';
        }
        el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
      }

      // Reduce font slightly when content wraps to second line for better fit
      if (el.scrollHeight > lineHeight + padding) {
        el.style.fontSize = Math.max(14, fontSize - 2) + 'px';
      } else {
        el.style.fontSize = fontSize + 'px';
      }
    };

    ta.addEventListener('input', () => adjust(ta));
    ta.addEventListener('paste', () => setTimeout(() => adjust(ta), 40));
    // Prevent creating more than one explicit newline (limit to 2 lines)
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const lines = (ta.value || '').split('\n');
        if (lines.length >= 2) {
          ev.preventDefault();
          // let adjust handle trimming/ellipsis
          setTimeout(() => adjust(ta), 0);
        }
      }
    });

    // initial adjust
    adjust(ta);
  });
}

function deleteCard(btnElement) {
  const cardWrapper = btnElement.closest('.card-ui-wrapper');
  allCards = allCards.filter(card => card !== cardWrapper);
  cardWrapper.remove();
  totalCardCount--;
  reorganizePages();
  refreshDashboardSummary();
}

// Reflow cards into pages. If `cardsList` is provided, that list/order is used.
function reorganizePages(cardsList) {
  const container = document.getElementById('pages-container');
  const cardsToRender = Array.isArray(cardsList) ? cardsList : allCards;

  // Clear the container
  container.innerHTML = '';

  // Put them back in perfect groups of 10
  let currentGrid = null;
  cardsToRender.forEach((card, index) => {
    if (index % 10 === 0) {
      const newPage = document.createElement('div');
      newPage.className = 'page-wrapper';
      currentGrid = document.createElement('div');
      currentGrid.className = 'cards-grid';
      newPage.appendChild(currentGrid);
      container.appendChild(newPage);
    }
    currentGrid.appendChild(card); // This moves the card without losing typed text
  });
}

function updateCardColor(selectElement, index) {
  const banner = document.getElementById(`banner-${index}`);
  banner.style.backgroundColor = selectElement.value;
}

// Initialize layout on load with exactly 10 cards (1 page)
window.onload = function() {
  addCards(10);
  buildFilterOptions();
  // Wire up filter UI
  const filterSelect = document.getElementById('filter-dept');
  const searchInput = document.getElementById('search-query');
  const addPanel = document.getElementById('add-panel');
  const addFab = document.getElementById('add-fab');
  document.getElementById('reset-filter').addEventListener('click', () => {
    filterSelect.value = 'ALL';
    searchInput.value = '';
    applyFilter();
  });
  filterSelect.addEventListener('change', () => { applyFilter(); refreshDashboardSummary(); });
  searchInput.addEventListener('input', () => { applyFilter(); refreshDashboardSummary(); });

  // Close add panel when user clicks outside of it
  document.addEventListener('click', (e) => {
    if (!addPanel || !addFab) return;
    const clickedInsidePanel = addPanel.contains(e.target);
    const clickedFab = addFab.contains(e.target);
    if (!clickedInsidePanel && !clickedFab) {
      closeAddPanel();
    }
  });

  // Keyboard navigation for inputs (Enter / Arrow keys)
  setupKeyboardNavigation();
  refreshDashboardSummary();
};

function refreshDashboardSummary() {
  const totalCards = allCards.length;
  const visibleCards = document.querySelectorAll('.card-ui-wrapper').length;
  const uniqueDepartments = new Set();
  allCards.forEach(card => {
    const select = card.querySelector('.dept-select');
    if (select) uniqueDepartments.add(select.options[select.selectedIndex]?.text.trim() || '');
  });

  document.getElementById('summary-total-cards').innerText = totalCards;
  document.getElementById('summary-visible-cards').innerText = visibleCards;
  document.getElementById('summary-departments').innerText = uniqueDepartments.size;
}

// --- EXCEL PROCESSING LOGIC ---
function processExcel() {
  const fileInput = document.getElementById('excel-file');
  const statusText = document.getElementById('upload-status');
  const file = fileInput.files[0];
  
  if (!file) {
    statusText.style.color = "#9a0603";
    statusText.innerText = "Please select an Excel file first.";
    setTimeout(() => statusText.innerText = "", 3000);
    return;
  }

  statusText.style.color = "#004aad";
  statusText.innerText = "Processing Data...";

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // UPDATE: Nilagyan natin ng {range: 4} para i-skip ang unang 4 rows (Titles/Headings). 
      // Magsisimula siyang magbasa ng exact table headers sa Row 5.
      // ADDED: raw: false para eksaktong text ng Date ang basahin, hindi serial number.
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {range: 4, defval: "", raw: false});
      
      if(jsonData.length > 0) {
        // BAGO: Burahin muna ang mga naka-display na cards at i-reset ang bilang bago ilagay ang Excel data
        document.getElementById('pages-container').innerHTML = '';
        totalCardCount = 0;
        uniqueCardId = 0;
        allCards = [];

        const generatedCount = populateFromExcel(jsonData);
        refreshDashboardSummary();
        if (generatedCount > 0) {
          statusText.style.color = "#499632";
          statusText.innerText = `Success! Generated ${generatedCount} cards.`;
        } else {
          statusText.style.color = "#9a0603";
          statusText.innerText = "No cards generated: only Expendable items were found.";
        }
        fileInput.value = ""; // Clear input after reading
      } else {
        statusText.style.color = "#9a0603";
        statusText.innerText = "Excel file is empty or headers not found on Row 5.";
      }
    } catch(err) {
      statusText.style.color = "#9a0603";
      statusText.innerText = "Error reading Excel file.";
      console.error(err);
    }
    setTimeout(() => statusText.innerText = "", 6000);
  };
  reader.readAsArrayBuffer(file);
}

// BAGO: Smart function para hanapin ang header kahit may extra spaces o line break sa Excel
function getExcelValue(row, targetHeader) {
  // Tatanggalin natin ang lahat ng spaces at line breaks, tapos gagawing small letters
  const target = targetHeader.toLowerCase().replace(/[\s\r\n]+/g, '');
  
  for (let key in row) {
    const currentKey = key.toLowerCase().replace(/[\s\r\n]+/g, '');
    // Kung nag-match na sila kahit walang spaces, kunin ang value
    if (currentKey === target) {
      return row[key];
    }
  }
  return '';
}

// BAGO: Helper function para i-format ang "n/a" para maging malaking "N/A" imbes na mablangko
function formatValue(val) {
  if (val === undefined || val === null || val === '') return '';
  let str = val.toString().trim();
  if (str.toLowerCase() === 'n/a') return 'N/A';
  return str;
}

function populateFromExcel(dataRows) {
  let generatedCount = 0;

  dataRows.forEach(row => {
    const classification = formatValue(getExcelValue(row, 'Inventory/Property Classification'));
    const normalizedClassification = classification.toLowerCase().replace(/[\s\u00A0]+/g, ' ').trim();
    const shouldGenerate = normalizedClassification.includes('semi') || normalizedClassification.includes('non');

    if (!classification || !shouldGenerate) {
      return; // skip Expendable or undefined classification rows
    }

    // 1. Check if the row has a "Department" header to set the exact color
    let matchedColor = departments[0].color; // Default fallback color (GASS)
    let rowDept = getExcelValue(row, 'Department');
    
    if (rowDept) {
       const cleanDept = rowDept.toString().trim().toUpperCase();
       
       // BAGO: Hahanapin kung 'kasama' o bahagi ng text ang pangalan ng Department 
       // kahit may mga dugtong pa ito (e.g., "CFAST-Extension" -> mababasa ang "CFAST")
       const foundDept = departments.find(d => cleanDept.includes(d.name));
       if (foundDept) {
         matchedColor = foundDept.color;
       }
    }

    // 2. Create a new card
    createSingleCard(matchedColor);
    generatedCount++;
    
    // 3. Target the newly created card
    const cards = document.querySelectorAll('.card-ui-wrapper');
    const newCard = cards[cards.length - 1];
    const inputs = newCard.querySelectorAll('.underline-input');
    
    // 4. Map the EXACT Excel cell data gamit ang bago nating Smart Reader (getExcelValue) at formatValue
    
    // Line 1: ICS/PAR No.
    let ics = formatValue(getExcelValue(row, 'ICS No. (If Applicable)'));
    let par = formatValue(getExcelValue(row, 'PAR No.(If Applicable)'));
    let icsParVal = '';
    
    if (ics && ics !== 'N/A') {
        icsParVal = ics; // Kung may totoong number ang ICS
    } else if (par && par !== 'N/A') {
        icsParVal = par; // Kung may totoong number ang PAR
    } else if (ics === 'N/A' || par === 'N/A') {
        icsParVal = 'N/A'; // Kung parehong N/A o kung isa sa kanila ay N/A at blangko ang isa
    }
    inputs[0].value = icsParVal;
    
    // Line 2: Property No.
    inputs[1].value = formatValue(getExcelValue(row, 'Property No./Item No.'));
    
    // Line 3: Description 
    inputs[2].value = formatValue(getExcelValue(row, 'Items Description'));
    // If this is a textarea with auto-resize, trigger its adjust (if attached)
    if (inputs[2] && inputs[2].tagName === 'TEXTAREA') {
      // trigger input event to let attached listener resize
      const ev = new Event('input', { bubbles: true });
      inputs[2].dispatchEvent(ev);
    }
    
    // Line 4: Requested by -> (End User)
    inputs[3].value = formatValue(getExcelValue(row, 'End User'));
    
    // Line 5: End-User/Location -> (Department)
    inputs[4].value = formatValue(getExcelValue(row, 'Department'));
    
    // Line 6: Supplier
    inputs[5].value = formatValue(getExcelValue(row, 'Supplier'));
    
    // Line 7: Fund
    inputs[6].value = formatValue(getExcelValue(row, 'Fund'));
    
    // Line 8: Date Delivered / Acquired -> (Date Delivered)
    inputs[7].value = formatValue(getExcelValue(row, 'Date Delivered'));
    
    // Line 9: Cost -> (Unit Cost)
    let cost = getExcelValue(row, 'Unit Cost');
    let costStr = cost !== undefined && cost !== null ? cost.toString().trim() : '';
    
    if (costStr.toLowerCase() === 'n/a') {
        inputs[8].value = 'N/A';
    } else {
        // Mas pinatibay na cleaner para sa numbers/currency mula sa Excel
        let cleanCost = costStr.replace(/[^0-9.-]+/g, ''); 
        if(!isNaN(cleanCost) && cleanCost !== "") {
            inputs[8].value = Number(cleanCost).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
        } else {
            inputs[8].value = formatValue(cost); // Fallback kung text
        }
    }
    
    // Line 10: Reference
    inputs[9].value = formatValue(getExcelValue(row, 'Reference'));
  });

  // Refresh department filter options after import
  buildFilterOptions();
  applyFilter();
  return generatedCount;
}

// Build department options for the filter select
function buildFilterOptions() {
  const filter = document.getElementById('filter-dept');
  if (!filter) return;
  // Preserve selected value
  const prev = filter.value || 'ALL';
  filter.innerHTML = '<option value="ALL">All Departments</option>';
  departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.name;
    filter.appendChild(opt);
  });
  if ([...filter.options].some(o => o.value === prev)) filter.value = prev; else filter.value = 'ALL';
}

// Apply department filter based on sidebar control
function applyFilter() {
  const filterVal = document.getElementById('filter-dept').value;
  const searchVal = document.getElementById('search-query').value.trim().toLowerCase();

  // Always start from the full collection of cards so repeated filtering works.
  let cards = [...allCards];

  // Filter by department if requested
  if (filterVal && filterVal !== 'ALL') {
    cards = cards.filter(card => {
      const deptSelect = card.querySelector('.dept-select');
      let deptName = '';
      if (deptSelect) {
        const idx = deptSelect.selectedIndex;
        deptName = idx >= 0 ? deptSelect.options[idx].text.trim() : '';
      }
      if (!deptName) {
        const inputs = card.querySelectorAll('.underline-input');
        deptName = inputs[4] ? inputs[4].value.trim() : '';
      }
      return deptName === filterVal;
    });
  }

  // Keyword search across department and card input fields
  if (searchVal) {
    cards = cards.filter(card => {
      const deptSelect = card.querySelector('.dept-select');
      const deptName = deptSelect && deptSelect.selectedIndex >= 0
        ? deptSelect.options[deptSelect.selectedIndex].text.trim()
        : '';

      const fields = Array.from(card.querySelectorAll('.underline-input'));
      const joinedFields = fields.map(field => (field.value || '').trim()).join(' ');
      const searchableText = `${deptName} ${joinedFields}`.toLowerCase();

      return searchableText.includes(searchVal);
    });
  }

  // Reflow only the resulting cards (this preserves their state)
  reorganizePages(cards);
}

// Keyboard navigation: move focus between `.underline-input` fields
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    const active = document.activeElement;
    if (!active || !active.classList) return;
    if (!active.classList.contains('underline-input')) return;
    // If the active element is a textarea (Item Description), do not hijack Enter/Arrow keys
    if (active.tagName === 'TEXTAREA') return;

    const inputs = Array.from(document.querySelectorAll('.underline-input'));
    const idx = inputs.indexOf(active);
    if (idx === -1) return;

    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = inputs[idx + 1];
      if (next) next.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = inputs[idx - 1];
      if (prev) prev.focus();
    }
  });
}
