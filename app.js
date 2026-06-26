/* ============================================
   FitTrack — app logic
   All calculations run locally. Nothing leaves this device.
   ============================================ */

const STORAGE_KEY = 'fitTrackState';
const TOTAL_STEPS = 4;

const state = {
  sex: 'male',
  age: null,
  height: null,   // cm
  weight: null,   // kg
  activity: 1.55,
  currentPhoto: null,
  dreamPhoto: null
};

let currentStep = 1;
const el = (id) => document.getElementById(id);

/* ---------- persistence ---------- */
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch(e){ console.warn('Could not save — storage may be full', e); }
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) Object.assign(state, JSON.parse(raw));
  }catch(e){ console.warn('Could not load saved data', e); }
}

/* ---------- DOM refs ---------- */
const fields = {
  age: el('age'),
  height: el('height'),
  weight: el('weight')
};

/* ============================================
   Navigation
   ============================================ */
function showStep(n){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el(`screen-${n}`).classList.add('active');

  document.querySelectorAll('.side-icon').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.step) === n);
  });

  el('stepChip').textContent = `Step ${n} of ${TOTAL_STEPS}`;
  el('btnBack').disabled = (n === 1);
  el('btnNext').textContent = (n === TOTAL_STEPS) ? 'Done' : 'Next';
  currentStep = n;

  if(n === 4) renderResults();
  const screensEl = document.querySelector('.screens');
  if(screensEl) screensEl.scrollTop = 0;
}

function validateStep2(){
  if(!state.age || !state.height || !state.weight || state.age<=0 || state.height<=0 || state.weight<=0){
    el('error-2').hidden = false;
    el('error-2').textContent = 'Please fill in age, height and weight to continue.';
    return false;
  }
  el('error-2').hidden = true;
  return true;
}

el('btnNext').addEventListener('click', () => {
  if(currentStep === 2 && !validateStep2()) return;
  if(currentStep < TOTAL_STEPS) showStep(currentStep + 1);
});

el('btnBack').addEventListener('click', () => {
  if(currentStep > 1) showStep(currentStep - 1);
});

document.querySelectorAll('.side-icon').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = Number(btn.dataset.step);
    // allow free navigation backward, but require step 2 valid before jumping past it
    if(target > 2 && !(state.age && state.height && state.weight)){
      showStep(2);
      return;
    }
    showStep(target);
  });
});

el('btnRestart').addEventListener('click', () => {
  if(confirm('Clear everything and start over?')){
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

/* ============================================
   Stats fields
   ============================================ */
fields.age.addEventListener('input', () => { state.age = parseFloat(fields.age.value) || null; saveState(); });
fields.height.addEventListener('input', () => { state.height = parseFloat(fields.height.value) || null; saveState(); });
fields.weight.addEventListener('input', () => { state.weight = parseFloat(fields.weight.value) || null; saveState(); });

document.querySelectorAll('#sexPills .pill').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('#sexPills .pill').forEach(x => x.classList.toggle('active', x === p));
    state.sex = p.dataset.sex;
    saveState();
  });
});

document.querySelectorAll('#activityPills .pill').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('#activityPills .pill').forEach(x => x.classList.toggle('active', x === p));
    state.activity = parseFloat(p.dataset.activity);
    saveState();
  });
});

/* ============================================
   Photo upload — resized client-side, never uploaded anywhere
   ============================================ */
function handlePhoto(inputId, previewId, stateKey){
  el(inputId).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 700;
        const scale = Math.min(1, MAX_W / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        state[stateKey] = dataUrl;
        const previewEl = el(previewId);
        previewEl.src = dataUrl;
        previewEl.hidden = false;
        saveState();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
handlePhoto('input-current', 'preview-current', 'currentPhoto');
handlePhoto('input-dream', 'preview-dream', 'dreamPhoto');

/* ============================================
   Calculations
   ============================================ */

// Mifflin-St Jeor
function calculateBMR(){
  const base = 10 * state.weight + 6.25 * state.height - 5 * state.age;
  return state.sex === 'male' ? base + 5 : base - 161;
}

function calculateTDEE(bmr){
  return bmr * state.activity;
}

// daily intake target — assumes a fat-loss goal, with a safe deficit cap and floor
function calculateCalorieTarget(tdee){
  const SAFE_MIN = state.sex === 'male' ? 1500 : 1200;
  const deficit = Math.min(500, tdee * 0.25);
  return Math.max(SAFE_MIN, Math.round(tdee - deficit));
}

function calculateMacros(calories){
  const proteinG = Math.round(state.weight * 2.2);
  const proteinCal = proteinG * 4;

  const fatCal = calories * 0.25;
  const fatG = Math.round(fatCal / 9);

  const carbCal = Math.max(0, calories - proteinCal - fatG * 9);
  const carbG = Math.round(carbCal / 4);

  return { proteinG, fatG, carbG, proteinCal, fatCal: fatG * 9, carbCal };
}

/* ============================================
   Render results
   ============================================ */
function renderResults(){
  const bmr = calculateBMR();
  const tdee = calculateTDEE(bmr);
  const calories = calculateCalorieTarget(tdee);
  const { proteinG, fatG, carbG, proteinCal, fatCal, carbCal } = calculateMacros(calories);

  el('resultBurn').textContent = Math.round(tdee);
  el('resultTake').textContent = calories;

  const maxCal = Math.max(proteinCal, fatCal, carbCal, 1);
  requestAnimationFrame(() => {
    el('barProtein').style.width = `${(proteinCal / maxCal) * 100}%`;
    el('barCarbs').style.width = `${(carbCal / maxCal) * 100}%`;
    el('barFat').style.width = `${(fatCal / maxCal) * 100}%`;
  });
  el('valProtein').textContent = `${proteinG} g`;
  el('valCarbs').textContent = `${carbG} g`;
  el('valFat').textContent = `${fatG} g`;

  el('result-current').src = state.currentPhoto || placeholderSVG('Current');
  el('result-dream').src = state.dreamPhoto || placeholderSVG('Dream');
}

function placeholderSVG(label){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <rect width="100%" height="100%" fill="#F6F4FD"/>
    <text x="50%" y="50%" fill="#8E89AC" font-family="sans-serif" font-size="14" text-anchor="middle">${label} photo</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/* ============================================
   Restore saved state into the UI
   ============================================ */
function hydrateUI(){
  if(state.age) fields.age.value = state.age;
  if(state.height) fields.height.value = state.height;
  if(state.weight) fields.weight.value = state.weight;

  document.querySelectorAll('#sexPills .pill').forEach(p => p.classList.toggle('active', p.dataset.sex === state.sex));
  document.querySelectorAll('#activityPills .pill').forEach(p => p.classList.toggle('active', parseFloat(p.dataset.activity) === state.activity));

  if(state.currentPhoto){ el('preview-current').src = state.currentPhoto; el('preview-current').hidden = false; }
  if(state.dreamPhoto){ el('preview-dream').src = state.dreamPhoto; el('preview-dream').hidden = false; }
}

/* ============================================
   Init
   ============================================ */
loadState();
hydrateUI();
showStep(1);
