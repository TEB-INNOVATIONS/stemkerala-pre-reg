/**
 * =========================================================================
 * STEM KERALA — INTERACTIVE CLIENT CONTROLLER
 * =========================================================================
 * - Full-screen 100vh hero environment
 * - The Butterfly Surprise: 25-30 fluttering butterflies swarming on first scroll
 * - Audio playback on submission trigger (assets/submit.mp3 with fallback)
 * - Strict client-side validation for Student & School registration forms
 * - Dual submission pipeline: Direct AJAX + Hidden Iframe fallback
 * - Live first-200 discount slot calculation via Apps Script stats
 * - Interactive lightbox with Prev/Next navigation for Achievements & Media
 * - Smooth scroll, mobile navigation toggle & gentle interactive parallax
 * =========================================================================
 */

// Active Google Apps Script Web App Endpoints
// Student Endpoint (Official v2 verified endpoint with JSONP stats & POST registration)
const STUDENT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxDQ2Ck5txLpQE82qtdJoewdPxPuB7t2RFuwgl87hviq0tnlIUq0NNuNRnkbcWqPN45tA/exec';

// School Endpoint (Configure here once codeforschool.gs deployment URL is available)
const SCHOOL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyPNnmfYjzCpcpD85FBwdfIBQ6lk8SKlQGpWWfVnRzyebtgbuUuTGMkC2uxz9MryuyIEw/exec';

const KERALA_DISTRICTS = [
  'Alappuzha',
  'Ernakulam',
  'Idukki',
  'Kannur',
  'Kasaragod',
  'Kollam',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Palakkad',
  'Pathanamthitta',
  'Thiruvananthapuram',
  'Thrissur',
  'Wayanad'
];

let submitAudio = null;
let currentStudentSlotsRemaining = 200;

// Lightbox state
let lightboxItems = [];
let currentLightboxIndex = 0;

// Butterfly surprise trigger flag
let butterflySwarmTriggered = false;

// Loading & submission state flags
let brandLoaderTimeout = null;
let isStudentSubmitting = false;
let isSchoolSubmitting = false;

document.addEventListener('DOMContentLoaded', () => {
  initBrandLoader();
  initAudio();
  initHeaderNav();
  populateDistrictDropdowns();
  initFormModalToggles();
  initStudentForm();
  initSchoolForm();
  initLightbox();
  initLandscapeParallax();
  initButterflySurpriseTrigger();
  initScrollRevealAnimations();
  fetchLiveStats();
});

/**
 * =========================================================================
 * 0. BRAND LOADING SCREEN CONTROLLER — "KERALA THINKS DIFFERENT!"
 * Handles:
 * - Initial website loading experience
 * - Student & School registration submission states
 * - Dynamic status messages and smooth page / success modal transitions
 * =========================================================================
 */
function initBrandLoader() {
  const loader = document.getElementById('brandLoadingScreen');
  if (!loader) return;

  const pageStartTime = performance.now();
  const MIN_INITIAL_DISPLAY_TIME = 1600; // ensures full tagline reveal sequence plays gracefully

  const dismissInitialLoader = () => {
    const elapsed = performance.now() - pageStartTime;
    const remaining = Math.max(0, MIN_INITIAL_DISPLAY_TIME - elapsed);
    setTimeout(() => {
      hideBrandLoader();
    }, remaining);
  };

  if (document.readyState === 'complete') {
    dismissInitialLoader();
  } else {
    window.addEventListener('load', dismissInitialLoader, { once: true });
    // Safety fallback: dismiss after 3.2s even if third-party assets are hanging
    setTimeout(() => {
      hideBrandLoader();
    }, 3200);
  }
}

/**
 * Show the Brand Loading Screen with the animated tagline
 * @param {Object} options
 * @param {string} options.statusText - Dynamic context message (e.g. Processing registration...)
 * @param {string} options.context - Context identifier (initial, student, school, etc.)
 */
function showBrandLoader(options = {}) {
  const loader = document.getElementById('brandLoadingScreen');
  if (!loader) return;

  const statusEl = document.getElementById('brandLoaderStatus');
  if (statusEl) {
    statusEl.textContent = options.statusText || 'Empowering curious minds across Kerala';
  }

  // Clear any pending dismissal timeouts
  if (brandLoaderTimeout) {
    clearTimeout(brandLoaderTimeout);
    brandLoaderTimeout = null;
  }

  loader.setAttribute('aria-busy', 'true');
  loader.classList.remove('fade-out');
  loader.classList.add('active');

  // Trigger CSS keyframe restart for words and letters
  loader.classList.remove('animate-active');
  void loader.offsetWidth; // Force synchronous reflow
  loader.classList.add('animate-active');
}

/**
 * Hide the Brand Loading Screen with a smooth exit transition
 * @param {Function} onComplete - Callback executed after screen has smoothly vanished
 */
function hideBrandLoader(onComplete) {
  const loader = document.getElementById('brandLoadingScreen');
  if (!loader) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  loader.classList.add('fade-out');
  loader.setAttribute('aria-busy', 'false');

  if (brandLoaderTimeout) clearTimeout(brandLoaderTimeout);
  brandLoaderTimeout = setTimeout(() => {
    loader.classList.remove('active', 'fade-out', 'animate-active');
    if (typeof onComplete === 'function') {
      onComplete();
    }
  }, 480);
}

// Global hook for transitions
window.stemKeralaLoader = {
  show: showBrandLoader,
  hide: hideBrandLoader
};

/**
 * 1. Audio Initialization (assets/submit.mp3 + Web Audio chime fallback)
 */
let isAudioPlaying = false;

function initAudio() {
  try {
    submitAudio = document.getElementById('submitAudioElement');
    if (!submitAudio) {
      submitAudio = new Audio();
      submitAudio.id = 'submitAudioElement';
      document.body.appendChild(submitAudio);
    }
    submitAudio.src = 'assets/submit.mp3';
    submitAudio.preload = 'auto';
    submitAudio.onerror = () => {
      if (submitAudio.src.indexOf('assets/submit.mp3') !== -1) {
        submitAudio.src = 'submit.mp3';
      }
    };

    // Pre-unlock on first user interaction so browser grants instant unmuted playback
    const unlockUserGesture = () => {
      if (submitAudio) {
        submitAudio.load();
      }
      document.removeEventListener('click', unlockUserGesture);
      document.removeEventListener('touchstart', unlockUserGesture);
      document.removeEventListener('keydown', unlockUserGesture);
    };
    document.addEventListener('click', unlockUserGesture, { once: true, passive: true });
    document.addEventListener('touchstart', unlockUserGesture, { once: true, passive: true });
    document.addEventListener('keydown', unlockUserGesture, { once: true, passive: true });
  } catch (e) {
    console.warn('submit.mp3 initialization error:', e);
  }
}

/**
 * Play submit.mp3 for Student and School form submission
 * Strictly uses submit.mp3 with no generic Web Audio synthesis
 */
function playSubmissionSound() {
  if (isAudioPlaying) return;
  isAudioPlaying = true;
  setTimeout(() => { isAudioPlaying = false; }, 1500);

  if (!submitAudio) {
    submitAudio = new Audio('assets/submit.mp3');
  }

  try {
    submitAudio.pause();
    submitAudio.currentTime = 0;
    const playPromise = submitAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('submit.mp3 playback restricted or pending user interaction:', err);
        const fallbackAudio = new Audio('submit.mp3');
        fallbackAudio.play().catch(e => {
          console.warn('Root submit.mp3 play also restricted:', e);
        });
      });
    }
  } catch (err) {
    console.warn('submit.mp3 execution error:', err);
  }
}

function initHeaderNav() {
  const header = document.querySelector('.site-header');
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const navMenu = document.getElementById('mainNavMenu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }, { passive: true });

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const isExpanded = navMenu.classList.contains('active');
      toggleBtn.setAttribute('aria-expanded', isExpanded);
      toggleBtn.innerHTML = isExpanded ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-list"></i>';
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = '<i class="bi bi-list"></i>';
      });
    });
  }
}

/**
 * 3. THE BUTTERFLY SURPRISE (SCROLL TRIGGERED)
 * Triggered once when the visitor scrolls out of the hero section.
 * Spawns 25-30 butterflies (8-12 on mobile) that flutter across the screen
 * along independent flight vectors, then gently fade out after 4-5 seconds.
 */
function initButterflySurpriseTrigger() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  const heroSection = document.getElementById('hero');
  if (!heroSection) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // Trigger swarm when hero is scrolled past (ratio drops below 0.35)
      if (!entry.isIntersecting || entry.intersectionRatio < 0.35) {
        if (!butterflySwarmTriggered) {
          butterflySwarmTriggered = true;
          triggerButterflySwarm();
        }
      }
    });
  }, {
    threshold: [0, 0.35, 1.0]
  });

  observer.observe(heroSection);
}

function triggerButterflySwarm() {
  const container = document.getElementById('butterflySwarmContainer');
  if (!container) return;

  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 10 : 27;

  const species = [
    { primary: '#00512E', accent: '#FFE500', veins: '#002B18', spot: '#FFF466', body: '#002B18' },
    { primary: '#003B22', accent: '#00A859', veins: '#002414', spot: '#FFE500', body: '#001D10' },
    { primary: '#0A7340', accent: '#FFE500', veins: '#004724', spot: '#FFFFFF', body: '#003319' },
    { primary: '#FFE500', accent: '#00512E', veins: '#003B22', spot: '#00512E', body: '#003B22' }
  ];

  for (let i = 0; i < count; i++) {
    const butterfly = document.createElement('div');
    butterfly.className = 'swarm-butterfly';

    const sp = species[i % species.length];

    const startX = 5 + Math.random() * 88;
    const startY = 80 + Math.random() * 25;
    const deltaX = (Math.random() - 0.48) * (isMobile ? 55 : 85);
    const deltaY = -(68 + Math.random() * 65);

    const scale = isMobile ? (0.85 + Math.random() * 0.45) : (1.1 + Math.random() * 0.7);
    const duration = 3.6 + Math.random() * 2.0;
    const delay = Math.random() * 0.8;
    const rotStart = -20 + Math.random() * 40;
    const rotEnd = (deltaX > 0 ? 12 : -12) + (Math.random() - 0.5) * 20;

    butterfly.style.left = startX + 'vw';
    butterfly.style.top = startY + 'vh';
    butterfly.style.setProperty('--fly-dx', deltaX + 'vw');
    butterfly.style.setProperty('--fly-dy', deltaY + 'vh');
    butterfly.style.setProperty('--fly-scale', scale);
    butterfly.style.setProperty('--fly-rot-start', rotStart + 'deg');
    butterfly.style.setProperty('--fly-rot-end', rotEnd + 'deg');
    butterfly.style.animationDuration = duration + 's';
    butterfly.style.animationDelay = delay + 's';

    butterfly.innerHTML = 
      '<svg width="64" height="52" viewBox="0 0 64 52" fill="none" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="wingGradL_' + i + '" x1="100%" y1="100%" x2="0%" y2="0%">' +
            '<stop offset="0%" stop-color="' + sp.primary + '"/>' +
            '<stop offset="70%" stop-color="' + sp.accent + '"/>' +
            '<stop offset="100%" stop-color="' + sp.primary + '"/>' +
          '</linearGradient>' +
          '<linearGradient id="wingGradR_' + i + '" x1="0%" y1="100%" x2="100%" y2="0%">' +
            '<stop offset="0%" stop-color="' + sp.primary + '"/>' +
            '<stop offset="70%" stop-color="' + sp.accent + '"/>' +
            '<stop offset="100%" stop-color="' + sp.primary + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<g class="butterfly-wing-left">' +
          '<path d="M32,32 C26,18 10,2 2,10 C-4,17 12,32 30,34 Z" fill="url(#wingGradL_' + i + ')" stroke="' + sp.veins + '" stroke-width="0.8"/>' +
          '<path d="M32,33 C26,38 8,46 14,51 C22,54 30,44 32,35 Z" fill="' + sp.primary + '" stroke="' + sp.veins + '" stroke-width="0.7"/>' +
          '<path d="M32,32 C22,24 12,18 6,14 M32,32 C20,28 14,26 8,24 M32,34 C24,40 18,46 16,49" stroke="' + sp.veins + '" stroke-width="0.65" stroke-linecap="round" opacity="0.7"/>' +
          '<circle cx="14" cy="20" r="1.8" fill="' + sp.spot + '" opacity="0.85"/>' +
          '<circle cx="22" cy="14" r="1.4" fill="' + sp.spot + '" opacity="0.75"/>' +
        '</g>' +
        '<g class="butterfly-wing-right">' +
          '<path d="M32,32 C38,18 54,2 62,10 C68,17 52,32 34,34 Z" fill="url(#wingGradR_' + i + ')" stroke="' + sp.veins + '" stroke-width="0.8"/>' +
          '<path d="M32,33 C38,38 56,46 50,51 C42,54 34,44 32,35 Z" fill="' + sp.primary + '" stroke="' + sp.veins + '" stroke-width="0.7"/>' +
          '<path d="M32,32 C42,24 52,18 58,14 M32,32 C44,28 50,26 56,24 M32,34 C40,40 46,46 48,49" stroke="' + sp.veins + '" stroke-width="0.65" stroke-linecap="round" opacity="0.7"/>' +
          '<circle cx="50" cy="20" r="1.8" fill="' + sp.spot + '" opacity="0.85"/>' +
          '<circle cx="42" cy="14" r="1.4" fill="' + sp.spot + '" opacity="0.75"/>' +
        '</g>' +
        '<g class="butterfly-body">' +
          '<ellipse cx="32" cy="34" rx="1.8" ry="9" fill="' + sp.body + '"/>' +
          '<circle cx="32" cy="24" r="2.2" fill="' + sp.body + '"/>' +
          '<path d="M32,23 Q27,15 22,14 M32,23 Q37,15 42,14" stroke="' + sp.body + '" stroke-width="0.9" stroke-linecap="round" fill="none"/>' +
          '<circle cx="22" cy="14" r="0.8" fill="' + sp.accent + '"/>' +
          '<circle cx="42" cy="14" r="0.8" fill="' + sp.accent + '"/>' +
        '</g>' +
      '</svg>';

    container.appendChild(butterfly);
  }

  setTimeout(() => {
    container.innerHTML = '';
  }, 6200);
}

function populateDistrictDropdowns() {
  const studentSelect = document.getElementById('studentDistrict');
  const schoolSelect = document.getElementById('schoolDistrict');

  KERALA_DISTRICTS.forEach(district => {
    if (studentSelect) {
      const opt1 = document.createElement('option');
      opt1.value = district;
      opt1.textContent = district;
      studentSelect.appendChild(opt1);
    }
    if (schoolSelect) {
      const opt2 = document.createElement('option');
      opt2.value = district;
      opt2.textContent = district;
      schoolSelect.appendChild(opt2);
    }
  });
}

/**
 * 5. Form Modal / Dedicated View Toggles & Hash routing
 */
function initFormModalToggles() {
  const studentModal = document.getElementById('studentFormView');
  const schoolModal = document.getElementById('schoolFormView');

  document.querySelectorAll('[data-open-form="student"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openForm('student');
    });
  });

  document.querySelectorAll('[data-open-form="school"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openForm('school');
    });
  });

  document.querySelectorAll('.form-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllForms();
    });
  });

  [studentModal, schoolModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeAllForms();
        }
      });
    }
  });

  if (window.location.hash === '#student-register' || window.location.hash === '#student') {
    openForm('student');
  } else if (window.location.hash === '#school-register' || window.location.hash === '#school') {
    openForm('school');
  }
}

function openForm(type) {
  closeAllForms();
  if (type === 'student') {
    const modal = document.getElementById('studentFormView');
    if (modal) modal.classList.add('active');
    history.replaceState(null, '', '#student-register');
  } else if (type === 'school') {
    const modal = document.getElementById('schoolFormView');
    if (modal) modal.classList.add('active');
    history.replaceState(null, '', '#school-register');
  }
}

function closeAllForms() {
  document.querySelectorAll('.form-view-container').forEach(el => el.classList.remove('active'));
  if (window.location.hash.includes('register') || window.location.hash.includes('school') || window.location.hash.includes('student')) {
    history.replaceState(null, '', window.location.pathname);
  }
}

/**
 * 6. Fetch Live Early Bird Stats from Google Sheets Backend
 */
function fetchLiveStats() {
  const endpoint = `${STUDENT_SCRIPT_URL}?action=stats&callback=stemStatsCallback&_=${Date.now()}`;
  const scriptTag = document.createElement('script');
  scriptTag.src = endpoint;

  window.stemStatsCallback = function(data) {
    if (data && data.status === 'success') {
      const total = typeof data.totalRegistrations === 'number' ? data.totalRegistrations : 0;
      const remaining = Math.max(0, 200 - total);
      currentStudentSlotsRemaining = remaining;
      updateDiscountUI(currentStudentSlotsRemaining);
    }
    scriptTag.remove();
  };

  scriptTag.onerror = function() {
    console.warn('Could not retrieve live stats via JSONP, using baseline.');
    scriptTag.remove();
  };

  document.body.appendChild(scriptTag);
}

function updateDiscountUI(remaining) {
  const heroBadge = document.getElementById('heroEarlyBirdStatus');
  const cardRemainingEl = document.getElementById('offerSpotsRemainingText');
  const formSlotEl = document.getElementById('studentFormSlotsRemaining');
  const bannerText = document.getElementById('studentDiscountBannerText');

  if (remaining > 0) {
    if (heroBadge) {
      heroBadge.innerHTML = `<i class="bi bi-tag-fill text-warning"></i> <span>Only <strong>${remaining}</strong> early-bird spots remaining</span>`;
    }
    if (cardRemainingEl) {
      cardRemainingEl.textContent = `Only ${remaining} early-bird spots remaining`;
    }
    if (formSlotEl) {
      formSlotEl.textContent = `${remaining} spots remaining`;
    }
    if (bannerText) {
      bannerText.innerHTML = `<strong>20% OFF — Early Bird Offer Active!</strong> Exclusive discount for the first 200 successful student registrations (Only ${remaining} spots remaining).`;
    }
  } else {
    if (heroBadge) {
      heroBadge.innerHTML = `<i class="bi bi-info-circle-fill"></i> <span>Early Bird Offer Fully Claimed</span>`;
    }
    if (cardRemainingEl) {
      cardRemainingEl.textContent = `Early Bird Offer Fully Claimed`;
    }
    if (formSlotEl) {
      formSlotEl.textContent = `Offer Fully Claimed`;
    }
    if (bannerText) {
      bannerText.innerHTML = `<strong>Early Bird Offer Fully Claimed!</strong> Standard pre-registration is open for all interested students.`;
    }
  }
}

/**
 * 7. Student Registration Form Submission Pipeline
 */
function initStudentForm() {
  const form = document.getElementById('studentForm');
  if (!form) return;

  const generalErrorBox = document.getElementById('studentSubmitError');
  const generalErrorText = document.getElementById('studentSubmitErrorText');
  const submitBtn = document.getElementById('studentSubmitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isStudentSubmitting) return;

    if (generalErrorBox) generalErrorBox.style.display = 'none';
    clearFieldErrors(form);

    const fullName = form.fullName.value.trim();
    const studentClass = form.studentClass.value.trim();
    const parentName = form.parentName.value.trim();
    const phone = form.phoneNumber.value.trim().replace(/[^\d]/g, '');
    const schoolName = form.schoolName.value.trim();
    const district = form.district.value.trim();

    let hasError = false;

    if (!fullName || fullName.length < 2) {
      showFieldError('studentFullNameError', 'Please enter your full name (at least 2 letters).');
      hasError = true;
    }
    if (!studentClass) {
      showFieldError('studentClassError', 'Please select your class grade.');
      hasError = true;
    }
    if (!parentName || parentName.length < 2) {
      showFieldError('studentParentError', 'Please enter parent / guardian name (at least 2 letters).');
      hasError = true;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      showFieldError('studentPhoneError', 'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
      hasError = true;
    }
    if (!schoolName || schoolName.length < 2) {
      showFieldError('studentSchoolError', 'Please enter your school or institution name.');
      hasError = true;
    }
    if (!district) {
      showFieldError('studentDistrictError', 'Please select your district in Kerala.');
      hasError = true;
    }

    if (hasError) return;

    // Prevent duplicate submissions: lock flag and disable submit button
    isStudentSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    // Audio chime immediately on valid trigger
    playSubmissionSound();

    // Launch the full-screen branded loading screen with tagline animation
    showBrandLoader({
      statusText: 'Confirming your STEM Kerala pre-registration...',
      context: 'student-submission'
    });

    const clientGeneratedRegId = generateStudentRegistrationId(fullName, phone);
    const payload = {
      fullName: fullName,
      studentClass: studentClass,
      parentName: parentName,
      phoneNumber: phone,
      schoolName: schoolName,
      district: district,
      regNo: clientGeneratedRegId,
      website_check: form.website_check ? form.website_check.value : ''
    };

    try {
      const response = await sendRegistrationPayload(STUDENT_SCRIPT_URL, payload);

      if (response && (response.status === 'success' || response.status === 'duplicate')) {
        const finalStudentId = (response.regNo && response.regNo.startsWith('SK-EBO-SU-'))
          ? response.regNo
          : clientGeneratedRegId;

        saveLocalSubmission('student', { ...payload, regNo: finalStudentId, response });
        form.reset();
        closeAllForms();

        const remaining = typeof response.totalRegistrations === 'number' 
          ? Math.max(0, 200 - response.totalRegistrations) 
          : currentStudentSlotsRemaining;
        currentStudentSlotsRemaining = remaining;
        updateDiscountUI(remaining);

        // Tagline animation finishes smoothly and transitions directly into success screen
        hideBrandLoader(() => {
          showStudentSuccessModal({
            name: response.name || fullName,
            regNo: finalStudentId,
            discountEligible: typeof response.discountEligible === 'boolean' 
              ? response.discountEligible 
              : (response.totalRegistrations ? response.totalRegistrations <= 200 : true)
          });
          isStudentSubmitting = false;
          if (submitBtn) submitBtn.disabled = false;
        });
      } else {
        throw new Error(response && response.message ? response.message : 'Registration was not confirmed by the server.');
      }
    } catch (err) {
      console.error('Student registration error:', err);
      // Smoothly dismiss brand loader and transition to attractive in-form error state
      hideBrandLoader(() => {
        isStudentSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        if (generalErrorBox) {
          if (generalErrorText) {
            generalErrorText.textContent = err.message || 'Unable to submit registration right now. Please check your internet connection and try again.';
          }
          generalErrorBox.style.display = 'flex';
          generalErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      // Form fields are preserved so the user can easily retry!
    }
  });
}

/**
 * 8. School Registration Form Submission Pipeline
 */
function initSchoolForm() {
  const form = document.getElementById('schoolForm');
  if (!form) return;

  const schoolErrorBox = document.getElementById('schoolSubmitError');
  const schoolErrorText = document.getElementById('schoolSubmitErrorText');
  const submitBtn = document.getElementById('schoolSubmitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSchoolSubmitting) return;

    if (schoolErrorBox) schoolErrorBox.style.display = 'none';
    clearFieldErrors(form);

    const schoolName = form.schoolName.value.trim();
    const district = form.district.value.trim();
    const mentorName = form.mentorName.value.trim();
    const mentorPhone = form.mentorPhone.value.trim().replace(/[^\d]/g, '');
    const studentCount = parseInt(form.studentCount.value.trim(), 10);
    const principalName = form.principalName.value.trim();
    const principalContact = form.principalContact.value.trim().replace(/[^\d]/g, '');
    const schoolEmail = form.schoolEmail.value.trim();

    let hasError = false;

    if (!schoolName || schoolName.length < 2) {
      showFieldError('schoolNameError', 'Please enter official school name.');
      hasError = true;
    }
    if (!district) {
      showFieldError('schoolDistrictError', 'Please select school district.');
      hasError = true;
    }
    if (!mentorName || mentorName.length < 2) {
      showFieldError('schoolMentorError', 'Please enter mentor / coordinating teacher name.');
      hasError = true;
    }
    if (!/^[6-9]\d{9}$/.test(mentorPhone)) {
      showFieldError('schoolMentorPhoneError', 'Please enter a valid 10-digit mentor phone number.');
      hasError = true;
    }
    if (isNaN(studentCount) || studentCount <= 0) {
      showFieldError('schoolCountError', 'Please enter number of interested students (greater than 0).');
      hasError = true;
    }
    if (!principalName || principalName.length < 2) {
      showFieldError('schoolPrincipalError', 'Please enter School Principal\'s name.');
      hasError = true;
    }
    if (!/^[6-9]\d{9}$/.test(principalContact)) {
      showFieldError('schoolPrincipalPhoneError', 'Please enter a valid 10-digit Principal contact number.');
      hasError = true;
    }

    if (hasError) return;

    // Prevent duplicate submissions
    isSchoolSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    playSubmissionSound();

    // Launch the full-screen branded loading screen with tagline animation
    showBrandLoader({
      statusText: 'Processing school registration with STEM Kerala...',
      context: 'school-submission'
    });

    const clientGeneratedSchoolId = generateSchoolRegistrationId(schoolName, mentorPhone);
    const payload = {
      type: 'school',
      schoolName: schoolName,
      district: district,
      mentorName: mentorName,
      mentorPhone: mentorPhone,
      studentCount: studentCount,
      principalName: principalName,
      principalContact: principalContact,
      schoolEmail: schoolEmail,
      regNo: clientGeneratedSchoolId,
      regId: clientGeneratedSchoolId,
      website_check: form.website_check ? form.website_check.value : ''
    };

    if (!SCHOOL_SCRIPT_URL) {
      // Backend pending: Keep tagline animation visible while saving inquiry and preparing confirmation
      setTimeout(() => {
        let schoolSeq = parseInt(localStorage.getItem('stem_school_reg_seq') || '28', 10) + 1;
        localStorage.setItem('stem_school_reg_seq', schoolSeq);
        const regNo = 'STEM-SCH-' + String(schoolSeq).padStart(4, '0');

        saveLocalSubmission('school', { ...payload, regNo: regNo, status: 'inquiry_saved' });
        closeAllForms();
        form.reset();

        hideBrandLoader(() => {
          showSchoolSuccessModal({
            schoolName: schoolName,
            regNo: regNo,
            isComingSoon: true
          });
          isSchoolSubmitting = false;
          if (submitBtn) submitBtn.disabled = false;
        });
      }, 1400);
      return;
    }

    try {
      const response = await sendRegistrationPayload(SCHOOL_SCRIPT_URL, payload);
      if (response && response.status === 'success') {
        // Authoritative ID: if backend returns an SK-EBO-SH- ID, use it; otherwise use the verified client-generated ID
        const finalSchoolId = (response.regId && response.regId.startsWith('SK-EBO-SH-')) 
          ? response.regId 
          : (response.regNo && response.regNo.startsWith('SK-EBO-SH-'))
            ? response.regNo
            : clientGeneratedSchoolId;

        saveLocalSubmission('school', { ...payload, regNo: finalSchoolId, response });
        closeAllForms();
        form.reset();
        hideBrandLoader(() => {
          showSchoolSuccessModal({
            schoolName: response.schoolName || schoolName,
            regNo: finalSchoolId,
            isComingSoon: false
          });
          isSchoolSubmitting = false;
          if (submitBtn) submitBtn.disabled = false;
        });
      } else {
        throw new Error(response && response.message ? response.message : 'School submission could not be verified.');
      }
    } catch (err) {
      console.error('School submission error:', err);
      hideBrandLoader(() => {
        isSchoolSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        if (schoolErrorBox) {
          if (schoolErrorText) {
            schoolErrorText.textContent = err.message || 'Unable to submit school registration right now. Please check your connection and try again.';
          }
          schoolErrorBox.style.display = 'flex';
          schoolErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          alert('Unable to connect to school registration service. Please reach out to us at hello@tebinnovations.in.');
        }
      });
    }
  });
}

/**
 * 9. Registration Payload Sender
 */
function sendRegistrationPayload(url, payload) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    const formData = new URLSearchParams();
    for (const key in payload) {
      if (payload[key] !== undefined && payload[key] !== null) {
        formData.append(key, payload[key]);
      }
    }

    fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      signal: controller.signal
    })
    .then(async res => {
      clearTimeout(timeoutId);
      return res.json();
    })
    .then(data => {
      if (data && (data.status === 'success' || data.status === 'duplicate')) {
        resolve(data);
      } else {
        reject(new Error(data && data.message ? data.message : 'Invalid response from registration server.'));
      }
    })
    .catch(err => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        reject(new Error('Request timed out. Please check your internet connection and try again.'));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * 10. Button State Helper
 */
function setButtonLoading(btn, msgEl, isLoading, customText) {
  if (!btn) return;
  const btnText = btn.querySelector('.btn-text');
  if (isLoading) {
    btn.disabled = true;
    if (btnText && customText) btnText.textContent = customText;
  } else {
    btn.disabled = false;
    if (btnText) {
      btnText.textContent = btn.getAttribute('data-original-text') || 'Submit';
    }
  }
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
  }
}

function clearFieldErrors(form) {
  form.querySelectorAll('.field-error-msg').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
}

function saveLocalSubmission(type, data) {
  try {
    const key = `stem_${type}_submissions`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ ...data, savedAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {}
}

/**
 * 11. Success Modal Presentations
 */
function showStudentSuccessModal(details) {
  const modal = document.getElementById('successModal');
  const title = document.getElementById('successModalTitle');
  const desc = document.getElementById('successModalDesc');
  const regIdEl = document.getElementById('successRegId');
  const discountTag = document.getElementById('successDiscountTag');

  if (title) title.textContent = "You're officially on your STEM journey!";
  if (regIdEl) regIdEl.textContent = details.regNo;

  if (details.discountEligible) {
    if (desc) desc.textContent = "Congratulations! You've secured your exclusive 20% OFF early-bird offer!";
    if (discountTag) {
      discountTag.textContent = "✓ 20% OFF Early Bird Confirmed";
      discountTag.style.display = "inline-block";
    }
  } else {
    if (desc) desc.textContent = "Your registration details have been verified and confirmed. Welcome to STEM Kerala!";
    if (discountTag) {
      discountTag.textContent = "Standard Pre-Registration Confirmed";
      discountTag.style.display = "inline-block";
    }
  }

  // WhatsApp Share button
  const shareBtn = document.getElementById('successWhatsappShare');
  if (shareBtn) {
    const shareMsg = encodeURIComponent(
      `I just pre-registered for STEM Kerala with an exclusive 20% early-bird discount! 🚀 My Registration ID is ${details.regNo}. Explore robotics, AI, coding, and hands-on STEM: https://preregister.stemkerala.com/`
    );
    shareBtn.href = `https://api.whatsapp.com/send?text=${shareMsg}`;
  }

  // Copy Reg ID button
  const copyBtn = document.getElementById('copyRegIdBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(details.regNo);
      copyBtn.textContent = 'Copied! ✓';
      setTimeout(() => {
        copyBtn.textContent = 'Copy ID';
      }, 2500);
    };
  }

  // Register Another Student button
  const anotherBtn = document.getElementById('successRegisterAnotherBtn');
  if (anotherBtn) {
    anotherBtn.onclick = () => {
      modal.classList.remove('active');
      const studentForm = document.getElementById('studentForm');
      if (studentForm) studentForm.reset();
      clearFieldErrors(studentForm);
      const errBox = document.getElementById('studentSubmitError');
      if (errBox) errBox.style.display = 'none';
      openForm('student');
      const nameInput = document.getElementById('studentFullName');
      if (nameInput) nameInput.focus();
    };
  }

  const doneBtn = document.getElementById('successDoneBtn');
  if (doneBtn) {
    doneBtn.onclick = () => {
      modal.classList.remove('active');
    };
  }

  modal.classList.add('active');
  triggerConfetti();
}

function showSchoolSuccessModal(details) {
  const modal = document.getElementById('successModal');
  const title = document.getElementById('successModalTitle');
  const desc = document.getElementById('successModalDesc');
  const regIdEl = document.getElementById('successRegId');
  const discountTag = document.getElementById('successDiscountTag');

  if (title) title.textContent = details.isComingSoon ? "School Interest Registered!" : "School Registered Successfully!";
  if (desc) {
    desc.textContent = details.isComingSoon
      ? `Thank you for your interest in STEM Kerala for ${details.schoolName}. The online portal is launching shortly. Our coordinator will reach out directly.`
      : `Registration received for ${details.schoolName}. Let's build a generation of creators and innovators together!`;
  }
  if (regIdEl) regIdEl.textContent = details.regNo;
  if (discountTag) {
    discountTag.textContent = details.isComingSoon ? "Priority Onboarding Request Recorded" : "School Registration Confirmed";
    discountTag.style.display = "inline-block";
  }

  // WhatsApp Share button
  const shareBtn = document.getElementById('successWhatsappShare');
  if (shareBtn) {
    const text = encodeURIComponent(`Our school (${details.schoolName}) has registered interest for STEM Kerala! Join the movement: https://preregister.stemkerala.com/`);
    shareBtn.href = `https://api.whatsapp.com/send?text=${text}`;
  }

  // Copy Reg ID button
  const copyBtn = document.getElementById('copyRegIdBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(details.regNo);
      copyBtn.textContent = 'Copied! ✓';
      setTimeout(() => {
        copyBtn.textContent = 'Copy ID';
      }, 2500);
    };
  }

  // Register Another action
  const anotherBtn = document.getElementById('successRegisterAnotherBtn');
  if (anotherBtn) {
    anotherBtn.onclick = () => {
      modal.classList.remove('active');
      openForm('student');
    };
  }

  const doneBtn = document.getElementById('successDoneBtn');
  if (doneBtn) {
    doneBtn.onclick = () => {
      modal.classList.remove('active');
    };
  }

  modal.classList.add('active');
  triggerConfetti();
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 55,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#FFE500', '#00512E', '#003B22', '#FFFFFF']
    });
    confetti({
      particleCount: 55,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#FFE500', '#00512E', '#003B22', '#FFFFFF']
    });
  }
}

/**
 * 12. Lightbox with Prev/Next Navigation
 */
function initLightbox() {
  const lightbox = document.getElementById('galleryLightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const closeBtn = document.getElementById('lightboxCloseBtn');
  const prevBtn = document.getElementById('lightboxPrevBtn');
  const nextBtn = document.getElementById('lightboxNextBtn');

  if (!lightbox || !lightboxImg) return;

  const elements = Array.from(document.querySelectorAll('[data-lightbox-src]'));
  lightboxItems = elements.map(el => el.getAttribute('data-lightbox-src'));

  elements.forEach((item, index) => {
    item.addEventListener('click', () => {
      currentLightboxIndex = index;
      openLightboxAt(currentLightboxIndex);
    });
  });

  function openLightboxAt(index) {
    if (index >= 0 && index < lightboxItems.length) {
      currentLightboxIndex = index;
      lightboxImg.src = lightboxItems[currentLightboxIndex];
      lightbox.classList.add('active');
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentLightboxIndex = (currentLightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
      lightboxImg.src = lightboxItems[currentLightboxIndex];
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentLightboxIndex = (currentLightboxIndex + 1) % lightboxItems.length;
      lightboxImg.src = lightboxItems[currentLightboxIndex];
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      lightbox.classList.remove('active');
      lightboxImg.src = '';
    });
  }

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove('active');
      lightboxImg.src = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('active')) {
      if (e.key === 'ArrowLeft') {
        currentLightboxIndex = (currentLightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
        lightboxImg.src = lightboxItems[currentLightboxIndex];
      } else if (e.key === 'ArrowRight') {
        currentLightboxIndex = (currentLightboxIndex + 1) % lightboxItems.length;
        lightboxImg.src = lightboxItems[currentLightboxIndex];
      } else if (e.key === 'Escape') {
        lightbox.classList.remove('active');
      }
    }
  });
}

/**
 * 13. Subtle Interactive Parallax on Scroll
 */
function initLandscapeParallax() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  const hills = document.querySelector('.ghats-silhouette');
  const riverBoat = document.querySelector('.houseboat-group');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY < 900) {
      if (hills) {
        hills.style.transform = `translate3d(0, ${scrollY * 0.08}px, 0)`;
      }
      if (riverBoat) {
        riverBoat.style.transform = `translate3d(${-scrollY * 0.05}px, 0, 0)`;
      }
    }
  }, { passive: true });
}

/**
 * 14. Viewport Scroll Reveal for Promotional Banner & Achievements
 */
function initScrollRevealAnimations() {
  const revealTargets = document.querySelectorAll('.discount-promo-banner, .achievements-multi-viewport');
  if (!revealTargets.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealTargets.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -30px 0px'
  });

  revealTargets.forEach(el => observer.observe(el));
}

/**
 * Generate Student Registration ID: SK-EBO-SU-
 * Rules:
 * - FIRST2: first two letters of student's name (uppercase, letters only)
 * - LAST2: last two digits of phone number
 * - RANDOM3: 3 randomly generated uppercase English letters
 */

/**
 * Generate Student Registration ID: SK-EBO-SU-${FIRST2}${LAST2}${RANDOM3}
 * Rules:
 * - FIRST2: first two letters of student's name (uppercase, letters only)
 * - LAST2: last two digits of phone number
 * - RANDOM3: 3 randomly generated uppercase English letters
 */
function generateStudentRegistrationId(fullName, phone) {
  const cleanName = (fullName || 'ST').replace(/[^a-zA-Z]/g, '').toUpperCase();
  const first2 = (cleanName.length >= 2 ? cleanName.substring(0, 2) : (cleanName + 'X').substring(0, 2));
  const cleanDigits = (phone || '00').replace(/[^0-9]/g, '');
  const last2 = cleanDigits.length >= 2 ? cleanDigits.substring(cleanDigits.length - 2) : '00';
  const random3 = generateRandomLetters(3);
  return 'SK-EBO-SU-' + first2 + last2 + random3;
}

/**
 * Generate School Registration ID: SK-EBO-SH-${FIRST2}${LAST2}${RANDOM3}
 * Rules:
 * - FIRST2: first two letters of school's name (uppercase, letters only)
 * - LAST2: last two digits of mentor's phone number
 * - RANDOM3: 3 randomly generated uppercase English letters
 */
function generateSchoolRegistrationId(schoolName, mentorPhone) {
  const cleanSchool = (schoolName || 'SC').replace(/[^a-zA-Z]/g, '').toUpperCase();
  const first2 = (cleanSchool.length >= 2 ? cleanSchool.substring(0, 2) : (cleanSchool + 'X').substring(0, 2));
  const cleanDigits = (mentorPhone || '00').replace(/[^0-9]/g, '');
  const last2 = cleanDigits.length >= 2 ? cleanDigits.substring(cleanDigits.length - 2) : '00';
  const random3 = generateRandomLetters(3);
  return 'SK-EBO-SH-' + first2 + last2 + random3;
}

function generateRandomLetters(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let res = '';
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(len);
    window.crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) {
      res += chars[arr[i] % chars.length];
    }
  } else {
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return res;
}
