document.addEventListener('DOMContentLoaded', () => {
  let allCourses = {};
  let confirmedRoutines = [];
  let lastSuggestions = [];
  let lastSuggestionsPage = 1;
  let courseSugIndex = -1;
  let lastScrollY = 0;
function resetCourseActive() {
  courseSugIndex = -1;
  Array.from(searchSuggestions.querySelectorAll('.suggestion-item'))
    .forEach(el => el.classList.remove('active'));
}
function setCourseActive(idx) {
  const items = Array.from(searchSuggestions.querySelectorAll('.suggestion-item'));
  if (!items.length) return;
  idx = Math.max(0, Math.min(idx, items.length - 1));
  items.forEach(el => el.classList.remove('active'));
  items[idx].classList.add('active');
  courseSugIndex = idx;
  items[idx].scrollIntoView({ block: 'nearest' });
}
  let selectedCourses = new Set();
  const coursePrefs = {}; 

  const themeToggleBtn = document.getElementById('theme-toggle');
  const courseSearchInput = document.getElementById('course-search');
  const addCourseBtn = document.getElementById('add-course-btn');
  const selectedCoursesList = document.getElementById('selected-courses-list');
  const coursePrefsContainer = document.getElementById('course-preferences');
  const ignoreDaysContainer = document.getElementById('ignore-days');
  const ignoreTimeBlocksContainer = document.getElementById('ignore-time-blocks');
  const minDaysRange = document.getElementById('min-days');
  const maxDaysRange = document.getElementById('max-days');
  const minDaysVal = document.getElementById('min-days-val');
  const maxDaysVal = document.getElementById('max-days-val');
  const maxCoursesPerDayRange = document.getElementById('max-courses-per-day');
  const maxCoursesPerDayVal = document.getElementById('max-courses-per-day-val');
  const generateBtn = document.getElementById('generate-btn');
  const suggestionsContainer = document.getElementById('suggestions-container');
  const finalRoutineContainer = document.getElementById('final-routine-container');
  const downloadBtn = document.getElementById('downloadTable');
  const loadingIndicator = document.getElementById('loading');
  const searchSuggestions = document.getElementById('search-suggestions');
  const comboCount = document.getElementById('combination-count');
  const applyTheme = (theme) => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
      themeToggleBtn.textContent = '🌙';
    } else {
      document.body.classList.remove('light-mode');
      themeToggleBtn.textContent = '☀️';
    }
  };
  const toggleTheme = () => {
    const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    const next = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
  };
  const initializeTheme = () => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  };
  async function initialize() {
    initializeTheme();
    syncRangeDisplays();
    try {
      loadingIndicator.classList.remove('hidden');
      const response = await fetch('https://usis-cdn.eniamza.com/connect.json');
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const scheduleData = await response.json();
      processScheduleData(scheduleData);
      loadingIndicator.classList.add('hidden');
    } catch (error) {
      loadingIndicator.innerText = "Failed to load course data. Please try refreshing.";
      console.error("Failed to fetch schedule data:", error);
    }
  }

  function processScheduleData(data) {
  data.forEach((sectionData, index) => {
    const scheduleString = `${sectionData.preRegSchedule || ''} ${sectionData.preRegLabSchedule || ''}`;
    const times = parseScheduleString(scheduleString);
    let facs = [];
    if (Array.isArray(sectionData.faculties) && sectionData.faculties.length) {
      facs = sectionData.faculties.map(String);
    } else if (sectionData.faculties) {
      facs = [String(sectionData.faculties)];
    }
    if (!facs.length) facs = ['TBA'];
    const ss = sectionData.sectionSchedule || {};
    const midDetail   = ss.midExamDetail   || formatExamDetail(ss.midExamDate, ss.midExamStartTime, ss.midExamEndTime);
    const finalDetail = ss.finalExamDetail || formatExamDetail(ss.finalExamDate, ss.finalExamStartTime, ss.finalExamEndTime);
    const section = {
      id: index,
      courseCode: sectionData.courseCode,
      sectionName: sectionData.sectionName,
      faculty: facs,
      times,
      capacity: sectionData.capacity,
      consumedSeat: sectionData.consumedSeat,
      rawSchedule: (sectionData.preRegSchedule || '').replace(/\n/g, ' '),
      examMid:  midDetail || null,
      examFinal: finalDetail || null
    };

    if (!allCourses[section.courseCode]) allCourses[section.courseCode] = [];
    allCourses[section.courseCode].push(section);
  });
}
  function addCourse(courseCode) {
    const code = (courseCode || '').toUpperCase().trim();
    if (code && allCourses[code] && !selectedCourses.has(code)) {
      selectedCourses.add(code);
      if (!coursePrefs[code]) coursePrefs[code] = { faculties: new Set(), sections: new Set() };
      renderSelectedCourses();
      renderCoursePrefs();
      adjustMaxCoursesPerDay();
    } else if (selectedCourses.has(code)) {
      alert("Course already added.");
    } else {
      alert("Course not found or invalid.");
    }
  }

  function renderSelectedCourses() {
    selectedCoursesList.innerHTML = '';
    selectedCourses.forEach(code => {
      const li = document.createElement('li');
      li.className = 'selected-course-item';
      li.textContent = code;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-course-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => {
        selectedCourses.delete(code);
        delete coursePrefs[code];
        renderSelectedCourses();
        renderCoursePrefs();
        adjustMaxCoursesPerDay();
      };
      li.appendChild(removeBtn);
      selectedCoursesList.appendChild(li);
    });
  }
  function computeAvailableFaculties(code) {
    const facs = (allCourses[code] || [])
      .map(s => (s.faculty && s.faculty.length ? s.faculty : ['TBA']))
      .flat();
    return Array.from(new Set(facs));
  }

  function computeAvailableSections(code) {
    const secs = (allCourses[code] || []).map(s => String(s.sectionName).toUpperCase());
    return Array.from(new Set(secs));
  }

  function getSectionObj(code, sec) {
    const SEC = String(sec).toUpperCase();
    return (allCourses[code] || []).find(s => String(s.sectionName).toUpperCase() === SEC) || null;
  }
  function facultiesForSection(code, sec) {
    const obj = getSectionObj(code, sec);
    if (!obj) return [];
    const facs = (obj.faculty && obj.faculty.length) ? obj.faculty : ['TBA'];
    return Array.from(new Set(facs));
  }
  function sectionsForFaculty(code, fac) {
    const secs = (allCourses[code] || [])
      .filter(s => {
        const facs = s.faculty && s.faculty.length ? s.faculty : ['TBA'];
        return facs.includes(String(fac));
      })
      .map(s => String(s.sectionName).toUpperCase());
    return Array.from(new Set(secs));
  }
  function openDatalist(inputEl){
    if (!inputEl) return;
    try {
      inputEl.focus();
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    } catch(e){ /* ignore */ }
  }
  function addSectionPref(code, sec, opts = { cascade: true }) {
    const SEC = String(sec || '').toUpperCase().trim();
    if (!SEC) return;
    if (!(allCourses[code] || []).some(s => String(s.sectionName).toUpperCase() === SEC)) return;
    coursePrefs[code].sections.add(SEC);
    if (opts.cascade) {
      facultiesForSection(code, SEC).forEach(f => coursePrefs[code].faculties.add(f));
    }
    paintTokensAndLists(code);
    hideBothMiniSuggests(code); 
  }

  function addFacultyPref(code, fac, opts = { cascade: true }) {
    const FAC = String(fac || '').trim();
    if (!FAC) return;
    const secs = sectionsForFaculty(code, FAC);
    if (!secs.length) return; 
    coursePrefs[code].faculties.add(FAC);
    if (opts.cascade) {
      secs.forEach(sec => coursePrefs[code].sections.add(sec));
    }
    paintTokensAndLists(code);
    hideBothMiniSuggests(code); 
  }

  function cleanupFaculties(code) {
    const represented = new Set();
    Array.from(coursePrefs[code].sections).forEach(sec => {
      facultiesForSection(code, sec).forEach(f => represented.add(f));
    });
    Array.from(coursePrefs[code].faculties).forEach(f => {
      if (!represented.has(f)) coursePrefs[code].faculties.delete(f);
    });
  }

function renderCoursePrefs() {
  coursePrefsContainer.innerHTML = '';
  selectedCourses.forEach(code => {
    coursePrefs[code] = coursePrefs[code] || { faculties: new Set(), sections: new Set() };
    const card = document.createElement('div');
    card.className = 'course-card';
    card.id = `card-${code}`;

    card.innerHTML = `
      <h4>${code}</h4>

      <div class="option-note">Faculty (optional): add preferred teacher(s). Leave empty to allow any.</div>
      <div class="inline-add fac-wrap" style="position:relative;">
        <input id="inp-fac-${code}" placeholder="Type or pick a faculty" autocomplete="off">
        <button id="btn-add-fac-${code}">Add Faculty</button>
        <div class="mini-suggest hidden" id="sg-fac-${code}"></div>
      </div>
      <div class="token-list" id="tokens-fac-${code}"></div>

      <div class="option-note" style="margin-top:.75rem;">Section (optional): add preferred section(s). Leave empty to allow any.</div>
      <div class="inline-add sec-wrap" style="position:relative;">
        <input id="inp-sec-${code}" placeholder="Type or pick a section" autocomplete="off">
        <button id="btn-add-sec-${code}">Add Section</button>
        <div class="mini-suggest hidden" id="sg-sec-${code}"></div>
      </div>
      <div class="token-list" id="tokens-sec-${code}"></div>
    `;

    coursePrefsContainer.appendChild(card);
  document.getElementById(`btn-add-fac-${code}`).onclick = () => {
  const el = document.getElementById(`inp-fac-${code}`);
  const val = (el.value || '').trim();
  if (!val) return;
  addFacultyPref(code, val, { cascade: true });
  el.value = '';
  hideBothMiniSuggests(code);  
};
    document.getElementById(`btn-add-sec-${code}`).onclick = () => {
  const el = document.getElementById(`inp-sec-${code}`);
  const val = (el.value || '').trim();
  if (!val) return;
  addSectionPref(code, val, { cascade: true });
  el.value = '';
  hideBothMiniSuggests(code);  
};
    const facInp = document.getElementById(`inp-fac-${code}`);
    const secInp = document.getElementById(`inp-sec-${code}`);
    facInp.addEventListener('input', () => { 
      const pos = facInp.selectionStart;
      facInp.value = facInp.value.toUpperCase();  
      facInp.setSelectionRange(pos, pos);
      paintListsOnly(code, 'fac');
      showMiniSuggest('fac', code);
    });
    secInp.addEventListener('input', () => {
      paintListsOnly(code, 'sec');
      showMiniSuggest('sec', code);
    });
    facInp.addEventListener('focus', () => {
      paintListsOnly(code);
      showMiniSuggest('fac', code);  
});
secInp.addEventListener('focus', () => {
  paintListsOnly(code);
  showMiniSuggest('sec', code);   
});
facInp.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById(`btn-add-fac-${code}`).click();
  }
});
secInp.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById(`btn-add-sec-${code}`).click();
  }
});
facInp.addEventListener('keydown', (e) => {
  const box = document.getElementById(`sg-fac-${code}`);
  if (!box || box.classList.contains('hidden')) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(box, +1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(box, -1); }
  else if (e.key === 'Enter') { e.preventDefault(); (getActiveIndex(box) >= 0) ? clickActive(box) : document.getElementById(`btn-add-fac-${code}`).click(); }
  else if (e.key === 'Escape') { hideBothMiniSuggests(code); }
});

secInp.addEventListener('keydown', (e) => {
  const box = document.getElementById(`sg-sec-${code}`);
  if (!box || box.classList.contains('hidden')) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(box, +1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(box, -1); }
  else if (e.key === 'Enter') { e.preventDefault(); (getActiveIndex(box) >= 0) ? clickActive(box) : document.getElementById(`btn-add-sec-${code}`).click(); }
  else if (e.key === 'Escape') { hideBothMiniSuggests(code); }
});
    paintTokensAndLists(code);
  });
}

  function paintTokensAndLists(code) {
    const facWrap = document.getElementById(`tokens-fac-${code}`);
    const secWrap = document.getElementById(`tokens-sec-${code}`);
    facWrap.innerHTML = '';
    secWrap.innerHTML = '';

    Array.from(coursePrefs[code].faculties).forEach(name => {
      const t = document.createElement('span');
      t.className = 'token';
      t.innerHTML = `${escapeHtml(name)} <button title="Remove">&times;</button>`;
      t.querySelector('button').onclick = () => {
        coursePrefs[code].faculties.delete(name);
        sectionsForFaculty(code, name).forEach(sec => coursePrefs[code].sections.delete(sec));
        paintTokensAndLists(code);
      };
      facWrap.appendChild(t);
    });
    Array.from(coursePrefs[code].sections).forEach(sec => {
      const t = document.createElement('span');
      t.className = 'token';
      t.innerHTML = `${escapeHtml(sec)} <button title="Remove">&times;</button>`;
      t.querySelector('button').onclick = () => {
        coursePrefs[code].sections.delete(sec);
        cleanupFaculties(code);
        paintTokensAndLists(code);
      };
      secWrap.appendChild(t);
    });
    paintListsOnly(code);
  }

function paintListsOnly(code, kind) {
  let facs = computeAvailableFaculties(code);
  let secs = computeAvailableSections(code);

  const chosenFacs = new Set(coursePrefs[code].faculties);
  const chosenSecs = new Set(Array.from(coursePrefs[code].sections).map(x => String(x).toUpperCase()));

  facs = facs.filter(x => !chosenFacs.has(String(x)));
  secs = secs.filter(x => !chosenSecs.has(String(x).toUpperCase()));
  secs.sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ''), 10);
    const nb = parseInt(b.replace(/\D/g, ''), 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  if (kind === 'fac') {
    renderMiniSuggestions('fac', code, facs);
  } else if (kind === 'sec') {
    renderMiniSuggestions('sec', code, secs);
  } else {
    renderMiniSuggestions('fac', code, facs);
    renderMiniSuggestions('sec', code, secs);
  }
}
function setActiveIndex(box, idx) {
  const items = Array.from(box.querySelectorAll('.mini-suggest-item'));
  if (!items.length) return;
  idx = Math.max(0, Math.min(idx, items.length - 1));
  items.forEach(el => el.classList.remove('active'));
  items[idx].classList.add('active');
  box.dataset.activeIndex = String(idx);
  items[idx].scrollIntoView({ block: 'nearest' });
}
function getActiveIndex(box) {
  const n = parseInt(box.dataset.activeIndex ?? '-1', 10);
  return isNaN(n) ? -1 : n;
}
function moveActive(box, dir) {
  const items = Array.from(box.querySelectorAll('.mini-suggest-item'));
  if (!items.length) return;
  const cur = getActiveIndex(box);
  const next = cur < 0 ? (dir > 0 ? 0 : items.length - 1) : cur + dir;
  setActiveIndex(box, (next + items.length) % items.length);
}
function clickActive(box) {
  const items = Array.from(box.querySelectorAll('.mini-suggest-item'));
  const i = getActiveIndex(box);
  if (i >= 0 && items[i]) items[i].click();
}
function renderMiniSuggestions(kind, code, items) {
  const boxId = kind === 'fac' ? `sg-fac-${code}` : `sg-sec-${code}`;
  const inpId = kind === 'fac' ? `inp-fac-${code}` : `inp-sec-${code}`;
  const box = document.getElementById(boxId);
  const input = document.getElementById(inpId);
  if (!box || !input) return;

  const q = (input.value || '').toUpperCase().trim();
  let filtered = items;
  if (q) filtered = items.filter(x => String(x).toUpperCase().includes(q));

  if (!filtered.length) {
    box.innerHTML = '';
    box.classList.add('hidden');
    box.classList.remove('active');
    box.dataset.activeIndex = '-1';
    return;
  }
  box.innerHTML = filtered.map(v =>
    `<div class="mini-suggest-item" data-v="${String(v).replace(/"/g,'&quot;')}">${v}</div>`
  ).join('');
  const shouldShow = (document.activeElement === input) || (q.length > 0);
  box.querySelectorAll('.mini-suggest-item').forEach(el => {
    el.onclick = () => {
      const val = el.getAttribute('data-v');
      if (kind === 'fac') addFacultyPref(code, val, { cascade: true });
      else addSectionPref(code, val, { cascade: true });
      input.value = '';
      hideBothMiniSuggests(code);
      input.focus();
    };
  });

  if (shouldShow) {
    showMiniSuggest(kind, code);
    setActiveIndex(box, 0);
  } else {
    box.classList.add('hidden');
    box.classList.remove('active');
    box.dataset.activeIndex = '-1';
  }
}

function showMiniSuggest(kind, code) {
  const thisBox = document.getElementById(kind === 'fac' ? `sg-fac-${code}` : `sg-sec-${code}`);
  const otherBox = document.getElementById(kind === 'fac' ? `sg-sec-${code}` : `sg-fac-${code}`);
  if (!thisBox) return;
  if (otherBox) { otherBox.classList.add('hidden'); otherBox.classList.remove('active'); }
  thisBox.classList.remove('hidden');
  thisBox.classList.add('active');
}

function hideBothMiniSuggests(code) {
  const facBox = document.getElementById(`sg-fac-${code}`);
  const secBox = document.getElementById(`sg-sec-${code}`);
  if (facBox) { facBox.classList.add('hidden'); facBox.classList.remove('active'); }
  if (secBox) { secBox.classList.add('hidden'); secBox.classList.remove('active'); }
}
  function adjustMaxCoursesPerDay() {
    const n = Math.max(1, selectedCourses.size);
    maxCoursesPerDayRange.max = String(n);
    if (Number(maxCoursesPerDayRange.value) > n) {
      maxCoursesPerDayRange.value = String(n);
    }
    maxCoursesPerDayRange.value = String(n);
    maxCoursesPerDayVal.textContent = String(n);
  }
  function handleSearchInput() {
  const query = courseSearchInput.value.toUpperCase().trim();
  searchSuggestions.innerHTML = '';

  if (query.length < 2) {
    searchSuggestions.classList.add('hidden');
    return;
  }
  const matches = Object.keys(allCourses)
    .filter(code => code.includes(query) && !selectedCourses.has(code))
    .sort(); 

  if (matches.length > 0) {
    matches.forEach(code => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = code;
      item.onclick = () => {
        addCourse(code);
        courseSearchInput.value = '';
        searchSuggestions.classList.add('hidden');
        courseSearchInput.focus();
      };
      searchSuggestions.appendChild(item);
    });
    searchSuggestions.classList.remove('hidden');
  } else {
    searchSuggestions.classList.add('hidden');
  }
  resetCourseActive();
}
  function generateRoutines() {
    if (selectedCourses.size === 0) {
      alert("Please add at least one course.");
      return;
    }
    loadingIndicator.classList.remove('hidden');
    suggestionsContainer.innerHTML = '';
    finalRoutineContainer.classList.add('hidden');
    comboCount.classList.add('hidden');

    setTimeout(() => {
      const preferences = {
        ignoreDays: Array.from(ignoreDaysContainer.querySelectorAll('input:checked')).map(cb => cb.value),
        ignoreTimeBlocks: Array.from(ignoreTimeBlocksContainer.querySelectorAll('input:checked')).map(cb => cb.value),
        minDays: Number(minDaysRange.value),
        maxDays: Number(maxDaysRange.value),
        maxCoursesPerDay: Number(maxCoursesPerDayRange.value),
        coursePrefs
      };

      if (preferences.minDays > preferences.maxDays) {
        [preferences.minDays, preferences.maxDays] = [preferences.maxDays, preferences.minDays];
        minDaysRange.value = String(preferences.minDays);
        maxDaysRange.value = String(preferences.maxDays);
        syncRangeDisplays();
      }

      const routineGenerator = new RoutineGenerator(allCourses, Array.from(selectedCourses), preferences);
      const suggestions = routineGenerator.generate(); 

      displaySuggestions(suggestions);
      loadingIndicator.classList.add('hidden');
    }, 10);
  }

function displaySuggestions(suggestions, page=1) {
  const PAGE_SIZE = 12;
  lastSuggestions = suggestions;
  lastSuggestionsPage = page;
  suggestionsContainer.innerHTML = '';

  comboCount.textContent = `Found ${suggestions.length} combination${suggestions.length === 1 ? '' : 's'}.`;
  comboCount.classList.remove('hidden');

  if (!suggestions || suggestions.length === 0) {
    suggestionsContainer.innerHTML = '<p>No combinations found.</p>';
    return;
  }

  let currentPage = page
  const totalPages = Math.ceil(suggestions.length / PAGE_SIZE);

  const renderPageNums = (current, total) => {
    const windowSize = 5;
    const pages = new Set();
    pages.add(1);
    pages.add(total);
    let start = current - Math.floor(windowSize / 2);
    let end   = current + Math.floor(windowSize / 2);
    if (start < 1) {
      end += (1 - start);
      start = 1;
    }
    if (end > total) {
      const diff = end - total;
      start -= diff;
      end = total;
    }
    start = Math.max(1, start);
    end   = Math.min(total, end);
    for (let i = start; i <= end; i++) pages.add(i);
    const arr = Array.from(pages).sort((a,b)=>a-b);
    const withDots = [];
    for (let i = 0; i < arr.length; i++) {
      withDots.push(arr[i]);
      if (i < arr.length - 1 && arr[i+1] !== arr[i] + 1) {
        withDots.push('…'); 
      }
    }
    return withDots;
  };
  const renderPage = () => {
    suggestionsContainer.innerHTML = '';

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, suggestions.length);
    const slice = suggestions.slice(start, end);

    slice.forEach((suggestion, index) => {
      const globalIndex = start + index;
      const card = document.createElement('div');
      card.className = 'suggestion-card';
      card.innerHTML = `
        <h3>Suggestion ${globalIndex + 1}</h3>
        <div class="suggestion-routine-wrapper">
          <div class="routine-table card-scroll" id="rt-wrapper-${globalIndex}"></div>
          <div class="status-table card-scroll" id="st-wrapper-${globalIndex}"></div>
        </div>
        <button class="confirm-btn" id="confirm-btn-${globalIndex}">Confirm This Routine</button>
      `;
      suggestionsContainer.appendChild(card);

      document.getElementById(`rt-wrapper-${globalIndex}`).innerHTML = createRoutineTableHTML(`sug-rt-${globalIndex}`);
      populateTable(`sug-rt-${globalIndex}`, suggestion);
      document.getElementById(`st-wrapper-${globalIndex}`).innerHTML = createStatusTableHTML(suggestion);
      document.getElementById(`confirm-btn-${globalIndex}`).onclick = () => confirmRoutine(suggestion);
    });

    const pager = document.createElement('div');
    pager.style.display = 'flex';
    pager.style.flexWrap = 'wrap';
    pager.style.gap = '0.5rem';
    pager.style.justifyContent = 'center';
    pager.style.alignItems = 'center';
    pager.style.marginTop = '1rem';

    const makeBtn = (label, disabled, onClick, isActive=false) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = !!disabled;
      b.style.padding = '0.4rem 0.7rem';
      b.style.borderRadius = '8px';
      b.style.border = '1px solid var(--border-color)';
      b.style.cursor = disabled ? 'default' : 'pointer';
      if (isActive) {
        b.style.fontWeight = '700';
        b.style.background = 'var(--card-bg)';
      }
      if (!disabled && onClick) b.onclick = onClick;
      return b;
    };

pager.appendChild(makeBtn('Prev', currentPage === 1, () => {
  currentPage--;
  lastSuggestionsPage = currentPage;
  renderPage();
}));

const labels = renderPageNums(currentPage, totalPages);
labels.forEach(lbl => {
  if (lbl === '…') {
    const span = document.createElement('span');
    span.textContent = '…';
    span.style.opacity = '0.7';
    pager.appendChild(span);
  } else {
    const isActive = (lbl === currentPage); 
    pager.appendChild(makeBtn(String(lbl), false, () => { 
      currentPage = lbl; 
      lastSuggestionsPage = currentPage;
      renderPage();
    }, isActive));
  }
});

pager.appendChild(makeBtn('Next', currentPage === totalPages, () => {
  currentPage++;
  lastSuggestionsPage = currentPage;
  renderPage();
}));

suggestionsContainer.appendChild(pager);
  };

  renderPage();
}

  function confirmRoutine(routine) {
  confirmedRoutines.push(routine);
  lastScrollY = window.scrollY;
  suggestionsContainer.innerHTML = '';
  finalRoutineContainer.classList.remove('hidden');

  document.getElementById('final-routine-table-wrapper').innerHTML = createRoutineTableHTML('final-routine');
  populateTable('final-routine', routine);
  document.getElementById('final-status-table-wrapper').innerHTML = createStatusTableHTML(routine);
  const oldBackBtn = document.getElementById('back-to-suggestions');
  if (oldBackBtn) oldBackBtn.remove();

  const backBtn = document.createElement('button');
  backBtn.id = 'back-to-suggestions';
  backBtn.textContent = "⬅ Back to Suggestions";
  backBtn.className = "back-btn";
  backBtn.onclick = () => {
    displaySuggestions(lastSuggestions, lastSuggestionsPage);
    finalRoutineContainer.classList.add('hidden');
    window.scrollTo(0, lastScrollY);
  };
  finalRoutineContainer.appendChild(backBtn);

  renderConfirmedList();
}

  function syncRangeDisplays() {
    minDaysVal.textContent = minDaysRange.value;
    maxDaysVal.textContent = maxDaysRange.value;
    maxCoursesPerDayVal.textContent = maxCoursesPerDayRange.value;
  }

  themeToggleBtn.addEventListener('click', toggleTheme);
  addCourseBtn.addEventListener('click', () => addCourse(courseSearchInput.value));
  courseSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addCourse(courseSearchInput.value);
      courseSearchInput.value = '';
      searchSuggestions.classList.add('hidden');
    }
  });
  courseSearchInput.addEventListener('input', () => {
  const pos = courseSearchInput.selectionStart;
  courseSearchInput.value = courseSearchInput.value.toUpperCase();
  courseSearchInput.setSelectionRange(pos, pos);
  handleSearchInput();
  });
  courseSearchInput.addEventListener('keydown', (e) => {
  const items = Array.from(searchSuggestions.querySelectorAll('.suggestion-item'));
  if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setCourseActive(courseSugIndex < 0 ? 0 : courseSugIndex + 1); }
  else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setCourseActive(courseSugIndex < 0 ? items.length - 1 : courseSugIndex - 1); }
  else if (e.key === 'Enter' && courseSugIndex >= 0 && items[courseSugIndex]) {
    e.preventDefault(); items[courseSugIndex].click(); resetCourseActive();
  } else if (e.key === 'Escape') {
    searchSuggestions.classList.add('hidden'); resetCourseActive();
  }
});

  document.addEventListener('click', (e) => { if (!e.target.closest('.course-input-container')) { searchSuggestions.classList.add('hidden'); } 
  if (!e.target.closest('.course-input-container')) {
    const el = document.getElementById('search-suggestions');
    if (el) el.classList.add('hidden');
  }
  if (!e.target.closest('.fac-wrap') && !e.target.closest('.sec-wrap')) {
    document.querySelectorAll('.mini-suggest').forEach(b => {
      b.classList.add('hidden');
      b.classList.remove('active');
    });
  }
});

  minDaysRange.addEventListener('input', () => {
    if (Number(minDaysRange.value) > Number(maxDaysRange.value)) {
      maxDaysRange.value = minDaysRange.value;
    }
    syncRangeDisplays();
  });
  maxDaysRange.addEventListener('input', () => {
    if (Number(maxDaysRange.value) < Number(minDaysRange.value)) {
      minDaysRange.value = maxDaysRange.value;
    }
    syncRangeDisplays();
  });
  maxCoursesPerDayRange.addEventListener('input', syncRangeDisplays);

  generateBtn.addEventListener('click', generateRoutines);

downloadBtn.addEventListener("click", async () => {
  const source = document.querySelector(".final-routine-wrapper");
  if (!source || !window.htmlToImage) return;
  const clone = source.cloneNode(true);
  clone.querySelectorAll(".card-scroll").forEach(el => {
    el.style.overflow = "visible";
    el.style.maxHeight = "none";
    el.style.maxWidth = "none";
    el.style.height = "auto";
    el.style.width = "auto";
  });

  const rootStyles = getComputedStyle(document.documentElement);
  const borderColor = (rootStyles.getPropertyValue('--border-color') || '#374151').trim();
  clone.querySelectorAll('table').forEach(t => {
    t.style.borderCollapse = 'collapse';
    t.style.backgroundColor = 'transparent';
  });
  clone.querySelectorAll('th, td').forEach(cell => {
    cell.style.border = `1px solid ${borderColor}`;
  });

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.appendChild(clone);
  document.body.appendChild(holder);

  const bg = getComputedStyle(document.body).backgroundColor || "#111827";
  clone.style.background = bg;

  try {
    const dataUrl = await window.htmlToImage.toPng(clone, {
      backgroundColor: bg,
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      cacheBust: true
    });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "my_routine.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error("html-to-image failed:", e);
    alert("Couldn’t generate the image. Try again or use Print to PDF.");
  } finally {
    holder.remove();
  }
});

  initialize();
});

class RoutineGenerator {
  constructor(allCourses, selectedCourseCodes, preferences) {
    this.allCourses = allCourses;
    this.selectedCourseCodes = selectedCourseCodes;
    this.preferences = preferences;
  }

  generate() {
    const filteredCourses = this.selectedCourseCodes.map(code => {
      const prefs = this.preferences.coursePrefs[code] || { faculties: new Set(), sections: new Set() };
      const facSet = new Set(prefs.faculties);
      const secSet = new Set(prefs.sections);

      const sections = (this.allCourses[code] || []).filter(section => {
        let facOk = true;
        if (facSet.size > 0) {
          const facs = section.faculty && section.faculty.length ? section.faculty : ['TBA'];
          const wantTBA = facSet.has('TBA');
          const hasReal = facs.some(f => facSet.has(String(f)));
          const isTBA = (facs.length === 1 && facs[0] === 'TBA');
          facOk = hasReal || (wantTBA && isTBA);
        }
        let secOk = true;
        if (secSet.size > 0) {
          secOk = secSet.has(String(section.sectionName).toUpperCase());
        }
        return facOk && secOk && this.isSectionValid(section);
      });
      return { code, sections };
    });

    if (filteredCourses.some(course => course.sections.length === 0)) return [];

    const results = [];

    const backtrack = (idx, current) => {
      if (idx === filteredCourses.length) {
        const stats = this.computeStats(current);
        const daysUsed = Object.keys(stats.coursesPerDay).length;
        if (daysUsed >= this.preferences.minDays && daysUsed <= this.preferences.maxDays) {
          results.push(current);
        }
        return;
      }
      const { sections } = filteredCourses[idx];
      for (const sec of sections) {
        if (!this.conflictsOrBreaksLimits(current, sec)) {
          backtrack(idx + 1, [...current, sec]);
        }
      }
    };

    backtrack(0, []);
    return this.shuffleArray(results);
  }

  isSectionValid(section) {
    const { ignoreDays, ignoreTimeBlocks } = this.preferences;
    if (section.times.length === 0) return true;

    const ignored = new Set(ignoreTimeBlocks || []);

    return section.times.every(time => {
      if (ignoreDays.includes(time.day)) return false;
      const slots = getAffectedTimeSlots(time.startTime, time.endTime);
      return slots.every(s => !ignored.has(s));
    });
  }

  conflictsOrBreaksLimits(existingRoutine, newSection) {
    for (const existingSection of existingRoutine) {
      for (const a of newSection.times) {
        for (const b of existingSection.times) {
          if (a.day === b.day &&
              Math.max(timeToMinutes(a.startTime), timeToMinutes(b.startTime)) <
              Math.min(timeToMinutes(a.endTime), timeToMinutes(b.endTime))) {
            return true;
          }
        }
      }
    }
    const stats = this.computeStats([...existingRoutine, newSection]);
    for (const day in stats.coursesPerDay) {
      if (stats.coursesPerDay[day] > this.preferences.maxCoursesPerDay) {
        return true;
      }
    }
    return false;
  }

  computeStats(routine) {
    const coursesPerDay = {};
    routine.forEach(section => {
      const seenDays = new Set();
      section.times.forEach(t => {
        if (!seenDays.has(t.day)) {
          coursesPerDay[t.day] = (coursesPerDay[t.day] || 0) + 1;
          seenDays.add(t.day);
        }
      });
    });
    return { coursesPerDay };
  }

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

function createRoutineTableHTML(id) {
  const timeSlots = [
    "08:00 AM-09:20 AM","09:30 AM-10:50 AM","11:00 AM-12:20 PM",
    "12:30 PM-01:50 PM","02:00 PM-03:20 PM","03:30 PM-04:50 PM","05:00 PM-06:20 PM"
  ];
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  let tableHTML = `<table id="${id}"><thead><tr><th>Time/Day</th>`;
  days.forEach(day => tableHTML += `<th>${day}</th>`);
  tableHTML += '</tr></thead><tbody>';
  timeSlots.forEach((time, rIndex) => {
    tableHTML += `<tr><td><b>${time}</b></td>`;
    days.forEach((_, cIndex) => tableHTML += `<td id="${id}-${rIndex + 1}-${cIndex + 1}"></td>`);
    tableHTML += '</tr>';
  });
  return tableHTML + '</tbody></table>';
}

function createStatusTableHTML(routine) {
  let tableHTML = `<table><thead>
    <tr><th>Course-Sec</th><th>Faculty</th><th>Seats</th><th>Exam Time</th></tr>
  </thead><tbody>`;

  routine.forEach(section => {
    const available = section.capacity - section.consumedSeat;
    const seatStatus = available > 0
      ? `${available}/${section.capacity}`
      : `<span style="color: var(--conflict-color); font-weight: bold;">Full</span>`;
    const fac = Array.isArray(section.faculty) ? section.faculty.join(', ') : (section.faculty ?? '');

    const mid  = section.examMid   ? section.examMid   : 'N/A';
    const fin  = section.examFinal ? section.examFinal : 'N/A';

    tableHTML += `<tr>
      <td>${section.courseCode}-${section.sectionName}</td>
      <td>${escapeHtml(String(fac))}</td>
      <td>${seatStatus}</td>
      <td style="text-align:left">
        <b>MID:</b> ${escapeHtml(mid)}<br>
        <b>Final:</b> ${escapeHtml(fin)}
      </td>
    </tr>`;
  });

  return tableHTML + '</tbody></table>';
}

function populateTable(tableId, routine) {
  const grid = document.getElementById(tableId);
  if (!grid) return;
  grid.querySelectorAll('td:not(:first-child)').forEach(td => td.innerHTML = '');
  routine.forEach(section => {
    section.times.forEach(time => {
      getAffectedTimeSlots(time.startTime, time.endTime).forEach(slot => {
        const cellId = getCellId(tableId, time.day, slot);
        if (cellId) {
          const fac = Array.isArray(section.faculty) ? section.faculty.join(', ') : (section.faculty ?? '');
          const details = `${section.courseCode}<br><small>${section.sectionName}/${escapeHtml(String(fac))}<br>${time.room}</small>`;
          const cell = document.getElementById(cellId);
          if (cell) {
            cell.innerHTML += cell.innerHTML
              ? `<hr style="border-color: var(--border-color); margin: 2px 0;"><div class="conflict">${details}</div>`
              : details;
          }
        }
      });
    });
  });
}
function renderConfirmedList() {
  const container = document.getElementById('confirmed-routines-container');
  const list = document.getElementById('confirmed-routines-list');
  list.innerHTML = '';

  if (confirmedRoutines.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  confirmedRoutines.forEach((routine, idx) => {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    card.innerHTML = `
      <h3>Confirmed Routine ${idx + 1}</h3>
      <div class="suggestion-routine-wrapper">
        <div class="routine-table card-scroll" id="confirmed-rt-${idx}"></div>
        <div class="status-table card-scroll" id="confirmed-st-${idx}"></div>
      </div>
    `;
    list.appendChild(card);
    document.getElementById(`confirmed-rt-${idx}`).innerHTML = createRoutineTableHTML(`conf-rt-${idx}`);
    populateTable(`conf-rt-${idx}`, routine);
    document.getElementById(`confirmed-st-${idx}`).innerHTML = createStatusTableHTML(routine);
  });
}


function getAffectedTimeSlots(startTime, endTime) {
  const slots = ["08:00-09:20","09:30-10:50","11:00-12:20","12:30-13:50","14:00-15:20","15:30-16:50","17:00-18:20"];
  const start = timeToMinutes(startTime), end = timeToMinutes(endTime);
  if (isNaN(start) || isNaN(end)) return [];
  return slots.filter(slot => {
    const [slotStart, slotEnd] = slot.split('-').map(timeToMinutes);
    return start < slotEnd && end > slotStart;
  });
}

function getCellId(tableId, day, timeSlot) {
  const timeMap = {"08:00-09:20":1,"09:30-10:50":2,"11:00-12:20":3,"12:30-13:50":4,"14:00-15:20":5,"15:30-16:50":6,"17:00-18:20":7};
  const dayMap = {"Sunday":1,"Monday":2,"Tuesday":3,"Wednesday":4,"Thursday":5,"Friday":6,"Saturday":7};
  const row = timeMap[timeSlot];
  const col = dayMap[day];
  if (row && col) return `${tableId}-${row}-${col}`;
  return null;
}

function convertTo24Hour(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const lower = timeStr.toLowerCase().trim();
  const match = lower.match(/^(\d{1,2}):(\d{2})\s*(am|pm)/);
  if (!match) return null;
  let [_, hours, minutes, period] = match;
  hours = parseInt(hours, 10);
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function timeToMinutes(time24) {
  if (!time24) return NaN;
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

function parseScheduleString(scheduleString) {
  if (!scheduleString) return [];
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const timeRegex = /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i;
  let results = [];

  let processedString = scheduleString.replace(/,/g, '|||').replace(/\n/g, '|||');
  days.forEach(day => {
    processedString = processedString.replace(new RegExp(day, 'gi'), `|||${day}`);
  });
  const chunks = processedString.split('|||').filter(s => s.trim());

  chunks.forEach(chunk => {
    const dayMatch = chunk.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i);
    if (!dayMatch) return;
    const day = dayMatch[0].charAt(0).toUpperCase() + dayMatch[0].slice(1).toLowerCase();

    const timeMatch = chunk.match(timeRegex);
    if (!timeMatch) return;

    const startTime = convertTo24Hour(timeMatch[1]);
    const endTime = convertTo24Hour(timeMatch[2]);
    if (!startTime || !endTime) return;

    let room = chunk.substring(timeMatch.index + timeMatch[0].length).replace(/^[\-\s(),]+|[(),\s]+$/g, '').trim();
    results.push({ day, startTime, endTime, room: room || 'N/A' });
  });

  return results;
}
function formatExamDetail(dateStr, startStr, endStr) {
  if (!dateStr || !startStr || !endStr) return null;
  const d = new Date(`${dateStr}T${startStr}`);
  const end = new Date(`${dateStr}T${endStr}`);

  if (isNaN(d.getTime()) || isNaN(end.getTime())) {
    const shortStart = startStr.slice(0,5);
    const shortEnd = endStr.slice(0,5);
    return `${dateStr} ${shortStart} - ${shortEnd}`;
  }

  const dateFmt = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const startFmt = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endFmt = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateFmt} ${startFmt} - ${endFmt}`;
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  })[s]);
}
