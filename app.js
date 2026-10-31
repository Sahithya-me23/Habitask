/**
 * Habitask - Application Logic
 * Client-side State, Rendering, and Persistence Engine
 */

// Helper: Generate UUID for unique identifiers
function generateUUID() {
  return 'uuid_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Default Seed Data to prevent empty states and showcase premium aesthetics
const DEFAULT_HABITS = [
  //{ id: 'h1', name: 'Drink 3L Water', emoji: '💧', history: { Mon: true, Tue: true, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false } },
  { id: 'h2', name: 'Meditate 10 Minutes', emoji: '🧘', history: { Mon: true, Tue: false, Wed: true, Thu: false, Fri: false, Sat: false, Sun: false } },
  //{ id: 'h3', name: 'Read 15 Pages', emoji: '📚', history: { Mon: false, Tue: true, Wed: true, Thu: false, Fri: false, Sat: false, Sun: false } },
  { id: 'h4', name: 'Exercise / Workout', emoji: '💪', history: { Mon: true, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false } }
];

const DEFAULT_GOALS = [
  { id: 'g1', text: 'Make a list of all deliverables', completed: true }
  //{ id: 'g2', text: 'Complete the week layout prototype', completed: false },
  //{ id: 'g3', text: 'Read 2 chapters of my book', completed: false }
];

const DEFAULT_TASKS = [
  //{ id: 't1', title: 'Plan next week schedule and activities', priority: 'low', completed: false, day: 'Mon' },
  { id: 't2', title: 'Team status sync-up meeting', priority: 'medium', completed: true, day: 'Mon' },
 // { id: 't3', title: 'Fix CSS layout responsiveness bugs', priority: 'high', completed: false, day: 'Mon' },
  //{ id: 't4', title: 'Write project functional specs', priority: 'high', completed: false, day: 'Tue' },
  //{ id: 't5', title: 'Gym leg day session', priority: 'medium', completed: false, day: 'Wed' },
  //{ id: 't6', title: 'Review Github Pull Requests', priority: 'low', completed: true, day: 'Thu' },
  { id: 't7', title: 'Submit Timesheet', priority: 'high', completed: false, day: 'Fri' }
];

const DEFAULT_SETTINGS = {
  theme: 'light',
  pageTitle: 'Weekly Planner & Habit Tracker',
  quoteText: '"We are what we repeatedly do.Excellence, then is not an act, but a habit"',
  quoteEmoji: '✨',
  avatarEmoji: '💜',
  activeDay: 'Mon',
  activeFilter: 'all',
  lastLoggedWeek: ''
};

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Hash a password using SHA-256 via Web Crypto API with custom salt
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_habitask_salt_v1_secure');
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * AuthManager - Handles Client-side multi-user registration,
 * secure credential hashing, persistent sessions, and guest accounts.
 */
class AuthManager {
  constructor() {
    this.USERS_KEY = 'habitask_registered_users_v1';
    this.SESSION_KEY = 'habitask_active_session_v1';
  }

  // Retrieve all registered accounts
  getUsers() {
    try {
      return JSON.parse(localStorage.getItem(this.USERS_KEY)) || [];
    } catch (e) {
      console.error('Error reading users from storage:', e);
      return [];
    }
  }

  // Save all registered accounts
  saveUsers(users) {
    try {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users to storage:', e);
    }
  }

  // Get active session user
  getCurrentUser() {
    try {
      let session = localStorage.getItem(this.SESSION_KEY);
      if (session) return JSON.parse(session);

      session = sessionStorage.getItem(this.SESSION_KEY);
      if (session) return JSON.parse(session);

      return null;
    } catch (e) {
      console.error('Error reading session:', e);
      return null;
    }
  }

  // Save session
  setSession(user, remember = true) {
    const sessionData = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(this.SESSION_KEY, sessionData);
      sessionStorage.removeItem(this.SESSION_KEY);
    } else {
      sessionStorage.setItem(this.SESSION_KEY, sessionData);
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  // Clear session
  clearSession() {
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
  }

  // Update current user profile info in users db & session
  updateUser(updatedProps) {
    const current = this.getCurrentUser();
    if (!current) return;
    const updated = Object.assign({}, current, updatedProps);
    
    // If not guest, update users database
    if (!current.isGuest) {
      const users = this.getUsers();
      const idx = users.findIndex(u => u.id === current.id);
      if (idx !== -1) {
        users[idx] = Object.assign({}, users[idx], updatedProps);
        this.saveUsers(users);
      }
    }
    // Update active session
    const isRemembered = localStorage.getItem(this.SESSION_KEY) !== null;
    this.setSession(updated, isRemembered);
    return updated;
  }

  // Sign up new user
  async signUp({ name, email, password, avatarEmoji }) {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedName) throw new Error('Please enter your full name.');
    if (!trimmedEmail) throw new Error('Please enter a valid email or username.');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters long.');

    const users = this.getUsers();
    const existing = users.find(u => u.email === trimmedEmail);
    if (existing) {
      throw new Error('An account with this email or username already exists. Please sign in instead.');
    }

    const passwordHash = await hashPassword(password);
    const newUser = {
      id: generateUUID(),
      name: trimmedName,
      email: trimmedEmail,
      passwordHash: passwordHash,
      avatarEmoji: avatarEmoji || '💜',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);

    const sessionUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatarEmoji: newUser.avatarEmoji,
      isGuest: false
    };

    this.setSession(sessionUser, true);
    return sessionUser;
  }

  // Sign in existing user
  async signIn({ email, password, remember = true }) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) throw new Error('Please enter your email or username.');
    if (!password) throw new Error('Please enter your password.');

    const users = this.getUsers();
    const user = users.find(u => u.email === trimmedEmail);
    if (!user) {
      throw new Error('No account found with this email or username. Please check your credentials or create an account.');
    }

    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      throw new Error('Incorrect password. Please verify your password and try again.');
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarEmoji: user.avatarEmoji || '💜',
      isGuest: false
    };

    this.setSession(sessionUser, remember);
    return sessionUser;
  }

  // Continue as Guest / Demo
  continueAsGuest() {
    const guestUser = {
      id: 'guest_user',
      name: 'Guest Explorer',
      email: 'guest@habitask.local',
      avatarEmoji: '✨',
      isGuest: true
    };
    this.setSession(guestUser, false);
    return guestUser;
  }
}

// Main Application Class
class HabitaskApp {
  constructor() {
    this.authManager = new AuthManager();
    this.currentUser = this.authManager.getCurrentUser();
    this.habits = [];
    this.tasks = [];
    this.goals = [];
    this.settings = {};
    
    this.init();
  }

  // Storage key helper scoped to active user
  getUserKey(suffix) {
    const userId = this.currentUser ? this.currentUser.id : 'anonymous';
    return `habitask_u_${userId}_${suffix}`;
  }

  // Initialize the App
  init() {
    this.cacheDOM();
    this.bindEvents();

    if (this.currentUser) {
      this.showAppView();
      this.loadFromLocalStorage();

      // Reset layout elements and checklists if week shifts
      const currentWeekId = this.getWeekId();
      if (!this.settings.lastLoggedWeek) {
        this.settings.lastLoggedWeek = currentWeekId;
        this.saveToLocalStorage();
      } else if (this.settings.lastLoggedWeek !== currentWeekId) {
        this.handleWeeklyReset();
        this.settings.lastLoggedWeek = currentWeekId;
        this.saveToLocalStorage();
      }

      this.calculateWeekRange();
      this.applyTheme();
      this.render();
    } else {
      this.showAuthView();
      this.applyTheme();
    }
  }

  // Get unique week string based on Monday of current week
  getWeekId() {
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    return monday.toISOString().split('T')[0];
  }

  // Reset checkboxes, tasks, and goals for the new week, keeping habit structures
  handleWeeklyReset() {
    this.habits.forEach(habit => {
      habit.history = { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false };
    });
    this.tasks = [];
    this.goals = [];
    this.saveToLocalStorage();
  }

  // Load from local storage or populate seeds
  loadFromLocalStorage() {
    if (!this.currentUser) return;
    const habitsKey = this.getUserKey('habits');
    const tasksKey = this.getUserKey('tasks');
    const goalsKey = this.getUserKey('goals');
    const settingsKey = this.getUserKey('settings');

    try {
      const savedHabits = localStorage.getItem(habitsKey);
      const savedTasks = localStorage.getItem(tasksKey);
      const savedGoals = localStorage.getItem(goalsKey);
      const savedSettings = localStorage.getItem(settingsKey);

      if (savedHabits === null && savedTasks === null && savedGoals === null) {
        // First login for this user: check for legacy un-scoped data, or seed fresh starter data
        const legacyHabits = localStorage.getItem('habitask_habits');
        if (legacyHabits) {
          this.habits = JSON.parse(legacyHabits) || JSON.parse(JSON.stringify(DEFAULT_HABITS));
          this.tasks = JSON.parse(localStorage.getItem('habitask_tasks')) || JSON.parse(JSON.stringify(DEFAULT_TASKS));
          this.goals = JSON.parse(localStorage.getItem('habitask_goals')) || JSON.parse(JSON.stringify(DEFAULT_GOALS));
          this.settings = JSON.parse(localStorage.getItem('habitask_settings')) || JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        } else {
          this.habits = JSON.parse(JSON.stringify(DEFAULT_HABITS));
          this.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
          this.goals = JSON.parse(JSON.stringify(DEFAULT_GOALS));
          this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
        if (this.currentUser.avatarEmoji) {
          this.settings.avatarEmoji = this.currentUser.avatarEmoji;
        }
        this.saveToLocalStorage();
      } else {
        this.habits = savedHabits ? JSON.parse(savedHabits) : [];
        this.tasks = savedTasks ? JSON.parse(savedTasks) : [];
        this.goals = savedGoals ? JSON.parse(savedGoals) : [];
        this.settings = savedSettings ? JSON.parse(savedSettings) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        if (this.currentUser.avatarEmoji) {
          this.settings.avatarEmoji = this.currentUser.avatarEmoji;
        }
      }
    } catch (e) {
      console.error('Error loading data from localStorage. Defaulting to seed data.', e);
      this.habits = JSON.parse(JSON.stringify(DEFAULT_HABITS));
      this.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
      this.goals = JSON.parse(JSON.stringify(DEFAULT_GOALS));
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  // Sync state with local storage
  saveToLocalStorage() {
    if (!this.currentUser) return;
    try {
      localStorage.setItem(this.getUserKey('habits'), JSON.stringify(this.habits));
      localStorage.setItem(this.getUserKey('tasks'), JSON.stringify(this.tasks));
      localStorage.setItem(this.getUserKey('goals'), JSON.stringify(this.goals));
      localStorage.setItem(this.getUserKey('settings'), JSON.stringify(this.settings));
    } catch (e) {
      console.error('Error saving data to localStorage.', e);
    }
  }

  // Cache DOM element handles
  cacheDOM() {
    this.dom = {
      // Auth elements
      authScreenWrapper: document.getElementById('auth-screen-wrapper'),
      pageCoverWrapper: document.getElementById('page-cover-wrapper'),
      appContainer: document.getElementById('app-container'),
      authTabs: document.getElementById('auth-tabs'),
      tabBtnSignin: document.getElementById('tab-btn-signin'),
      tabBtnSignup: document.getElementById('tab-btn-signup'),
      authAlert: document.getElementById('auth-alert'),
      formSignin: document.getElementById('form-signin'),
      formSignup: document.getElementById('form-signup'),
      signinEmail: document.getElementById('signin-email'),
      signinPassword: document.getElementById('signin-password'),
      signinRemember: document.getElementById('signin-remember'),
      btnToggleSigninPassword: document.getElementById('btn-toggle-signin-password'),
      btnContinueGuest: document.getElementById('btn-continue-guest'),
      signupName: document.getElementById('signup-name'),
      signupEmail: document.getElementById('signup-email'),
      signupPassword: document.getElementById('signup-password'),
      signupConfirmPassword: document.getElementById('signup-confirm-password'),
      btnToggleSignupPassword: document.getElementById('btn-toggle-signup-password'),
      strengthMeter: document.getElementById('strength-meter'),
      strengthFeedback: document.getElementById('strength-feedback'),
      signupEmojiSelector: document.getElementById('signup-emoji-selector'),
      signupSelectedEmoji: document.getElementById('signup-selected-emoji'),
      linkToSignin: document.getElementById('link-to-signin'),

      // User Menu elements
      userMenuWrapper: document.getElementById('user-menu-wrapper'),
      btnUserProfile: document.getElementById('btn-user-profile'),
      headerUserAvatar: document.getElementById('header-user-avatar'),
      headerUserName: document.getElementById('header-user-name'),
      userDropdownMenu: document.getElementById('user-dropdown-menu'),
      dropdownUserAvatar: document.getElementById('dropdown-user-avatar'),
      dropdownUserName: document.getElementById('dropdown-user-name'),
      dropdownUserEmail: document.getElementById('dropdown-user-email'),
      dropdownUserBadge: document.getElementById('dropdown-user-badge'),
      btnDropdownExport: document.getElementById('btn-dropdown-export'),
      labelDropdownImport: document.getElementById('label-dropdown-import'),
      inputImportFile: document.getElementById('input-import-file'),
      btnDropdownSwitch: document.getElementById('btn-dropdown-switch'),
      btnDropdownLogout: document.getElementById('btn-dropdown-logout'),

      // App Header & Theme
      themeToggle: document.getElementById('btn-theme-toggle'),
      pageTitle: document.getElementById('page-title'),
      currentWeekDisplay: document.getElementById('current-week-display'),
      profileAvatar: document.getElementById('profile-avatar'),
      quoteText: document.getElementById('quote-text'),
      quoteEmoji: document.getElementById('quote-emoji'),
      
      // Stats
      habitCompletionRate: document.getElementById('stat-habit-rate'),
      taskCompletionRate: document.getElementById('stat-tasks-rate'),
      streakCount: document.getElementById('stat-streak-count'),
      
      // Goals
      goalsContainer: document.getElementById('weekly-goals-container'),
      formAddGoal: document.getElementById('form-add-goal'),
      inputGoalTitle: document.getElementById('input-goal-title'),
      
      // Calendar
      miniCalendar: document.getElementById('mini-calendar-container'),
      
      // Habits
      habitsTableBody: document.getElementById('habits-table-body'),
      btnAddHabitModal: document.getElementById('btn-add-habit-modal'),
      habitModalOverlay: document.getElementById('habit-modal-overlay'),
      formAddHabit: document.getElementById('form-add-habit'),
      inputHabitName: document.getElementById('input-habit-name'),
      inputHabitEmoji: document.getElementById('input-habit-emoji'),
      btnCancelHabit: document.getElementById('btn-cancel-habit'),
      btnCloseHabitModal: document.getElementById('btn-close-habit-modal'),
      
      // Planner / Tasks
      selectedDayHeading: document.getElementById('selected-day-heading'),
      daysTabsContainer: document.getElementById('days-selector-tabs'),
      formAddTask: document.getElementById('form-add-task'),
      inputTaskTitle: document.getElementById('input-task-title'),
      selectTaskPriority: document.getElementById('select-task-priority'),
      tasksFilters: document.getElementById('tasks-filters'),
      plannerTasksContainer: document.getElementById('planner-tasks-container'),
      
      // Toast
      toastContainer: document.getElementById('toast-notification-container')
    };
  }

  // Bind all event listeners
  bindEvents() {
    // ----------------------------------------
    // AUTHENTICATION EVENTS
    // ----------------------------------------
    // Switch between Sign In and Sign Up tabs
    if (this.dom.tabBtnSignin) {
      this.dom.tabBtnSignin.addEventListener('click', () => this.switchAuthTab('signin'));
    }
    if (this.dom.tabBtnSignup) {
      this.dom.tabBtnSignup.addEventListener('click', () => this.switchAuthTab('signup'));
    }
    if (this.dom.linkToSignin) {
      this.dom.linkToSignin.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthTab('signin');
      });
    }

    // Toggle Password Visibility
    if (this.dom.btnToggleSigninPassword) {
      this.dom.btnToggleSigninPassword.addEventListener('click', () => {
        const isPassword = this.dom.signinPassword.type === 'password';
        this.dom.signinPassword.type = isPassword ? 'text' : 'password';
        this.dom.btnToggleSigninPassword.innerText = isPassword ? '🙈' : '👁️';
      });
    }
    if (this.dom.btnToggleSignupPassword) {
      this.dom.btnToggleSignupPassword.addEventListener('click', () => {
        const isPassword = this.dom.signupPassword.type === 'password';
        this.dom.signupPassword.type = isPassword ? 'text' : 'password';
        this.dom.btnToggleSignupPassword.innerText = isPassword ? '🙈' : '👁️';
      });
    }

    // Password strength check on signup input
    if (this.dom.signupPassword) {
      this.dom.signupPassword.addEventListener('input', () => {
        const strength = this.calculatePasswordStrength(this.dom.signupPassword.value);
        if (this.dom.strengthMeter) {
          this.dom.strengthMeter.className = 'strength-meter ' + strength.className;
        }
        if (this.dom.strengthFeedback) {
          this.dom.strengthFeedback.innerText = strength.text;
        }
      });
    }

    // Avatar emoji selection in signup form
    if (this.dom.signupEmojiSelector) {
      this.dom.signupEmojiSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.emoji-pick-btn');
        if (btn) {
          this.dom.signupEmojiSelector.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          const emoji = btn.getAttribute('data-emoji') || '💜';
          this.dom.signupSelectedEmoji.value = emoji;
        }
      });
    }

    // Sign In Form Submission
    if (this.dom.formSignin) {
      this.dom.formSignin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = this.dom.signinEmail.value.trim();
        const password = this.dom.signinPassword.value;
        const remember = this.dom.signinRemember ? this.dom.signinRemember.checked : true;

        try {
          const user = await this.authManager.signIn({ email, password, remember });
          this.showAuthAlert('Welcome back! Loading your dashboard...', 'success');
          setTimeout(() => {
            this.loginUser(user);
          }, 350);
        } catch (err) {
          this.showAuthAlert(err.message, 'error');
        }
      });
    }

    // Sign Up Form Submission
    if (this.dom.formSignup) {
      this.dom.formSignup.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = this.dom.signupName.value.trim();
        const email = this.dom.signupEmail.value.trim();
        const password = this.dom.signupPassword.value;
        const confirmPassword = this.dom.signupConfirmPassword.value;
        const avatarEmoji = this.dom.signupSelectedEmoji.value || '💜';

        if (password !== confirmPassword) {
          this.showAuthAlert('Passwords do not match. Please re-enter them.', 'error');
          return;
        }

        try {
          const user = await this.authManager.signUp({ name, email, password, avatarEmoji });
          this.showAuthAlert('Account created successfully! Preparing your weekly tracker...', 'success');
          setTimeout(() => {
            this.loginUser(user);
          }, 450);
        } catch (err) {
          this.showAuthAlert(err.message, 'error');
        }
      });
    }

    // Continue as Guest / Quick Demo Button
    if (this.dom.btnContinueGuest) {
      this.dom.btnContinueGuest.addEventListener('click', () => {
        const guestUser = this.authManager.continueAsGuest();
        this.loginUser(guestUser);
      });
    }

    // ----------------------------------------
    // USER ACCOUNT MENU & DROPDOWN EVENTS
    // ----------------------------------------
    if (this.dom.btnUserProfile) {
      this.dom.btnUserProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.userDropdownMenu.classList.toggle('active');
        this.dom.userMenuWrapper.classList.toggle('active');
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (this.dom.userMenuWrapper && !this.dom.userMenuWrapper.contains(e.target)) {
        if (this.dom.userDropdownMenu) this.dom.userDropdownMenu.classList.remove('active');
        if (this.dom.userMenuWrapper) this.dom.userMenuWrapper.classList.remove('active');
      }
    });

    // Export Data JSON Backup
    if (this.dom.btnDropdownExport) {
      this.dom.btnDropdownExport.addEventListener('click', () => {
        this.exportUserData();
        if (this.dom.userDropdownMenu) this.dom.userDropdownMenu.classList.remove('active');
      });
    }

    // Import Data Backup
    if (this.dom.inputImportFile) {
      this.dom.inputImportFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.importUserData(file);
          e.target.value = ''; // Reset input
        }
        if (this.dom.userDropdownMenu) this.dom.userDropdownMenu.classList.remove('active');
      });
    }

    // Switch Account
    if (this.dom.btnDropdownSwitch) {
      this.dom.btnDropdownSwitch.addEventListener('click', () => {
        if (this.dom.userDropdownMenu) this.dom.userDropdownMenu.classList.remove('active');
        this.logoutUser();
        this.switchAuthTab('signin');
      });
    }

    // Sign Out
    if (this.dom.btnDropdownLogout) {
      this.dom.btnDropdownLogout.addEventListener('click', () => {
        if (this.dom.userDropdownMenu) this.dom.userDropdownMenu.classList.remove('active');
        this.logoutUser();
      });
    }

    // ----------------------------------------
    // APP CORE & DASHBOARD EVENTS
    // ----------------------------------------
    // Theme Toggle
    this.dom.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Editable Header & Quote
    this.dom.pageTitle.addEventListener('blur', () => {
      this.settings.pageTitle = this.dom.pageTitle.innerText;
      this.saveToLocalStorage();
      this.showToast('📝 Title updated');
    });

    this.dom.quoteText.addEventListener('blur', () => {
      this.settings.quoteText = this.dom.quoteText.innerText;
      this.saveToLocalStorage();
      this.showToast('✨ Quote updated');
    });

    // Profile Avatar Emoji change
    this.dom.profileAvatar.addEventListener('click', () => {
      const emojis = [
        '💜', '✨', '🔮', '🌸', '🦋', '☕', '🐱', '🌙', '🦄',
        '🦁', '🐺', '🔥', '⚡', '⚔️', '👑', '🚀', '🎯', '🧠'
      ];
      const currentIndex = emojis.indexOf(this.settings.avatarEmoji);
      const nextIndex = (currentIndex + 1) % emojis.length;
      this.settings.avatarEmoji = emojis[nextIndex];
      this.dom.profileAvatar.innerText = this.settings.avatarEmoji;
      
      // Sync with user account profile
      if (this.currentUser) {
        this.currentUser.avatarEmoji = this.settings.avatarEmoji;
        this.authManager.updateUser({ avatarEmoji: this.settings.avatarEmoji });
        this.updateHeaderProfile();
      }

      this.saveToLocalStorage();
      this.showToast('🎨 Avatar updated');
    });

    // Add Goal
    this.dom.formAddGoal.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.dom.inputGoalTitle.value.trim();
      if (text) {
        this.addGoal(text);
        this.dom.inputGoalTitle.value = '';
      }
    });

    // Add Habit Modal
    this.dom.btnAddHabitModal.addEventListener('click', () => this.openHabitModal());
    this.dom.btnCloseHabitModal.addEventListener('click', () => this.closeHabitModal());
    this.dom.btnCancelHabit.addEventListener('click', () => this.closeHabitModal());
    this.dom.habitModalOverlay.addEventListener('click', (e) => {
      if (e.target === this.dom.habitModalOverlay) this.closeHabitModal();
    });

    // Save Habit
    this.dom.formAddHabit.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.dom.inputHabitName.value.trim();
      const emoji = this.dom.inputHabitEmoji.value.trim() || '📝';
      if (name) {
        this.addHabit(name, emoji);
        this.closeHabitModal();
      }
    });

    // Task Planner Day Selection Tabs
    this.dom.daysTabsContainer.addEventListener('click', (e) => {
      const tabButton = e.target.closest('.day-tab');
      if (tabButton) {
        const day = tabButton.getAttribute('data-day');
        this.switchActiveDay(day);
      }
    });

    // Task Planner Filters
    this.dom.tasksFilters.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.filter-btn');
      if (filterBtn) {
        // Remove active class from all filters
        this.dom.tasksFilters.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        // Add active class
        filterBtn.classList.add('active');
        this.settings.activeFilter = filterBtn.getAttribute('data-filter');
        this.saveToLocalStorage();
        this.renderTasks();
      }
    });

    // Add Task
    this.dom.formAddTask.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = this.dom.inputTaskTitle.value.trim();
      const priority = this.dom.selectTaskPriority.value;
      if (title) {
        this.addTask(title, priority);
        this.dom.inputTaskTitle.value = '';
      }
    });
  }

  // Toggle light/dark theme
  toggleTheme() {
    this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
    this.saveToLocalStorage();
    this.applyTheme();
    this.showToast(`🌙 Theme switched to ${this.settings.theme}`);
  }

  // Apply visual theme selection
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    // Change sun/moon icon based on active theme
    if (this.settings.theme === 'dark') {
      this.dom.themeToggle.innerHTML = `
        <svg id="moon-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
        </svg>
      `;
    } else {
      this.dom.themeToggle.innerHTML = `
        <svg id="sun-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 100 10 5 5 0 000-10z"></path>
        </svg>
      `;
    }
  }

  // Calculate dates of the current week (Monday to Sunday)
  calculateWeekRange() {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    // Adjust index to make Monday = 0, Sunday = 6
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    
    this.dom.currentWeekDisplay.innerText = `${formatDate(monday)} – ${formatDate(sunday)}, ${today.getFullYear()}`;
  }

  // Display toast alerts
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `💜 <span>${message}</span>`;
    
    this.dom.toastContainer.appendChild(toast);
    
    // Automatically remove toast from DOM after animation completes
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Global Render Core
  render() {
    // Apply static loaded texts
    this.dom.pageTitle.innerText = this.settings.pageTitle;
    this.dom.quoteText.innerText = this.settings.quoteText;
    this.dom.profileAvatar.innerText = this.settings.avatarEmoji;

    // Sub-renders
    this.renderGoals();
    this.renderHabits();
    this.renderTasks();
    this.renderCalendar();
    this.updateStats();
  }

  // ==========================================
  // GOALS PANEL ACTIONS & RENDERING
  // ==========================================
  
  renderGoals() {
    this.dom.goalsContainer.innerHTML = '';
    
    if (this.goals.length === 0) {
      this.dom.goalsContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">🎯</span>
          <span class="empty-state-text">No weekly goals set yet.</span>
        </div>
      `;
      return;
    }

    this.goals.forEach(goal => {
      const goalEl = document.createElement('div');
      goalEl.className = `goal-item ${goal.completed ? 'completed-state' : ''}`;
      goalEl.setAttribute('data-id', goal.id);

      goalEl.innerHTML = `
        <div class="goal-checkbox ${goal.completed ? 'completed' : ''}" role="checkbox" aria-checked="${goal.completed}"></div>
        <span class="goal-text" contenteditable="true" spellcheck="false">${this.escapeHTML(goal.text)}</span>
        <button class="delete-btn" aria-label="Delete goal">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      `;

      // Event: Toggle complete
      goalEl.querySelector('.goal-checkbox').addEventListener('click', () => this.toggleGoalCompletion(goal.id));
      
      // Event: Edit text inline
      const textSpan = goalEl.querySelector('.goal-text');
      textSpan.addEventListener('blur', () => {
        const newText = textSpan.innerText.trim();
        if (newText) {
          this.updateGoalText(goal.id, newText);
        } else {
          textSpan.innerText = goal.text; // revert
        }
      });

      // Event: Delete goal
      goalEl.querySelector('.delete-btn').addEventListener('click', () => this.deleteGoal(goal.id));

      this.dom.goalsContainer.appendChild(goalEl);
    });
  }

  addGoal(text) {
    const newGoal = {
      id: generateUUID(),
      text: text,
      completed: false
    };
    this.goals.push(newGoal);
    this.saveToLocalStorage();
    this.renderGoals();
    this.showToast('🎯 Goal added successfully');
  }

  toggleGoalCompletion(id) {
    const goal = this.goals.find(g => g.id === id);
    if (goal) {
      goal.completed = !goal.completed;
      this.saveToLocalStorage();
      this.renderGoals();
      this.showToast(goal.completed ? '🎉 Goal accomplished!' : 'Goal status set to incomplete');
    }
  }

  updateGoalText(id, newText) {
    const goal = this.goals.find(g => g.id === id);
    if (goal && goal.text !== newText) {
      goal.text = newText;
      this.saveToLocalStorage();
      this.showToast('🎯 Goal description updated');
    }
  }

  deleteGoal(id) {
    this.goals = this.goals.filter(g => g.id !== id);
    this.saveToLocalStorage();
    this.renderGoals();
    this.showToast('🗑️ Goal removed');
  }

  // ==========================================
  // HABITS ACTIONS & RENDERING
  // ==========================================

  openHabitModal() {
    this.dom.habitModalOverlay.classList.add('active');
    this.dom.inputHabitName.focus();
  }

  closeHabitModal() {
    this.dom.habitModalOverlay.classList.remove('active');
    this.dom.formAddHabit.reset();
    this.dom.inputHabitEmoji.value = '📝';
  }

  addHabit(name, emoji) {
    const newHabit = {
      id: generateUUID(),
      name: name,
      emoji: emoji,
      history: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false }
    };
    this.habits.push(newHabit);
    this.saveToLocalStorage();
    this.renderHabits();
    this.updateStats();
    this.showToast(`${emoji} Habit "${name}" added`);
  }

  deleteHabit(id) {
    const habit = this.habits.find(h => h.id === id);
    this.habits = this.habits.filter(h => h.id !== id);
    this.saveToLocalStorage();
    this.renderHabits();
    this.updateStats();
    if (habit) this.showToast(`🗑️ Habit "${habit.name}" deleted`);
  }

  updateHabitName(id, newName) {
    const habit = this.habits.find(h => h.id === id);
    if (habit && habit.name !== newName) {
      habit.name = newName;
      this.saveToLocalStorage();
      this.showToast('✍️ Habit updated');
    }
  }

  toggleHabitDay(id, day) {
    const today = new Date();
    const currentDay = today.getDay();
    const todayIndex = currentDay === 0 ? 6 : currentDay - 1;
    const dayIndex = DAYS_OF_WEEK.indexOf(day);
    
    if (dayIndex > todayIndex) {
      this.showToast('⚠️ Cannot check off habits for future days!');
      return;
    }

    const habit = this.habits.find(h => h.id === id);
    if (habit) {
      habit.history[day] = !habit.history[day];
      this.saveToLocalStorage();
      this.renderHabitRowProgress(id);
      this.updateStats();
      
      // Fun visual micro-animation trigger
      const checkboxEl = document.querySelector(`[data-habit-id="${id}"] [data-day="${day}"] .habit-checkmark`);
      if (checkboxEl && habit.history[day]) {
        checkboxEl.classList.add('animate-check');
        setTimeout(() => checkboxEl.classList.remove('animate-check'), 300);
      }
    }
  }

  // Calculate single habit percentage
  calculateHabitPercentage(habit) {
    const totalDays = 7;
    const completedDays = Object.values(habit.history).filter(val => val === true).length;
    return Math.round((completedDays / totalDays) * 100);
  }

  // Render a specific habit's progress ring dynamically
  renderHabitRowProgress(id) {
    const habit = this.habits.find(h => h.id === id);
    if (!habit) return;

    const percentage = this.calculateHabitPercentage(habit);
    const progressEl = document.querySelector(`[data-habit-id="${id}"] .progress-radial-wrapper`);
    const streakEl = document.querySelector(`[data-habit-id="${id}"] .habit-streak`);
    
    if (progressEl) {
      // svg circumference ≈ 100.5
      const circumference = 100.5;
      const offset = circumference - (percentage / 100) * circumference;
      
      const bar = progressEl.querySelector('.progress-radial-bar');
      const text = progressEl.querySelector('.progress-text');
      
      bar.style.strokeDashoffset = offset;
      text.innerText = `${percentage}%`;
    }

    if (streakEl) {
      streakEl.innerText = `${this.calculateStreakForHabit(habit)}d Streak`;
    }
  }

  // Calculates current consecutive streak of completed days for a habit (counting backwards from Sun)
  calculateStreakForHabit(habit) {
    let streak = 0;
    // Map history to an array of booleans sequentially Mon->Sun
    const historyArray = DAYS_OF_WEEK.map(d => habit.history[d]);
    
    // Find the latest index that is checked to start calculation, or scan all checked segments
    // Simple Notion weekly planner behavior is streak of consecutive checked days within this week.
    let maxStreak = 0;
    let currentStreak = 0;
    for (let i = 0; i < historyArray.length; i++) {
      if (historyArray[i]) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
    return maxStreak;
  }

  renderHabits() {
    this.dom.habitsTableBody.innerHTML = '';
    
    if (this.habits.length === 0) {
      this.dom.habitsTableBody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state">
              <span class="empty-state-icon">🔁</span>
              <span class="empty-state-text">No habits tracked. Add your first habit!</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.habits.forEach(habit => {
      const row = document.createElement('tr');
      row.className = 'habit-row';
      row.setAttribute('data-habit-id', habit.id);

      // 1. Habit metadata (emoji, editable name, streak, delete button)
      let rowHtml = `
        <td>
          <button class="delete-btn" aria-label="Delete habit">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
          <span style="font-size: 1.15rem; user-select: none;">${habit.emoji}</span>
          <div class="habit-meta">
            <span class="habit-name" contenteditable="true" spellcheck="false">${this.escapeHTML(habit.name)}</span>
            <span class="habit-streak">${this.calculateStreakForHabit(habit)}d Streak</span>
          </div>
        </td>
      `;

      // 2. Day checkboxes (Mon - Sun)
      const today = new Date();
      const currentDay = today.getDay();
      const todayIndex = currentDay === 0 ? 6 : currentDay - 1;

      DAYS_OF_WEEK.forEach((day, index) => {
        const checked = habit.history[day] ? 'checked' : '';
        const isFuture = index > todayIndex;
        const disabledAttr = isFuture ? 'disabled' : '';
        const titleAttr = isFuture ? 'title="Cannot log habits for future dates"' : '';

        rowHtml += `
          <td data-day="${day}">
            <label class="habit-check-wrapper" ${titleAttr}>
              <input type="checkbox" class="habit-checkbox" ${checked} ${disabledAttr}>
              <span class="habit-checkmark"></span>
            </label>
          </td>
        `;
      });

      // 3. Radial Progress indicator cell
      const percentage = this.calculateHabitPercentage(habit);
      const circumference = 100.5;
      const offset = circumference - (percentage / 100) * circumference;
      
      rowHtml += `
        <td>
          <div class="progress-radial-wrapper">
            <svg class="progress-radial-svg">
              <circle class="progress-radial-bg" cx="20" cy="20" r="16"></circle>
              <circle class="progress-radial-bar" cx="20" cy="20" r="16" stroke-dashoffset="${offset}"></circle>
            </svg>
            <span class="progress-text">${percentage}%</span>
          </div>
        </td>
      `;

      row.innerHTML = rowHtml;

      // Event: Edit name inline
      const nameSpan = row.querySelector('.habit-name');
      nameSpan.addEventListener('blur', () => {
        const newName = nameSpan.innerText.trim();
        if (newName) {
          this.updateHabitName(habit.id, newName);
        } else {
          nameSpan.innerText = habit.name;
        }
      });

      // Event: Toggle check on click for each day checkbox
      DAYS_OF_WEEK.forEach(day => {
        const checkbox = row.querySelector(`[data-day="${day}"] .habit-checkbox`);
        checkbox.addEventListener('change', () => this.toggleHabitDay(habit.id, day));
      });

      // Event: Delete habit
      row.querySelector('.delete-btn').addEventListener('click', () => this.deleteHabit(habit.id));

      this.dom.habitsTableBody.appendChild(row);
    });
  }

  // ==========================================
  // PLANNER / DAILY TASKS ACTIONS & RENDERING
  // ==========================================

  switchActiveDay(day) {
    if (DAYS_OF_WEEK.includes(day)) {
      this.settings.activeDay = day;
      this.saveToLocalStorage();
      
      // Update active tabs styling
      this.dom.daysTabsContainer.querySelectorAll('.day-tab').forEach(tab => {
        if (tab.getAttribute('data-day') === day) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // Update planner card title
      const dayNames = {
        Mon: 'Monday',
        Tue: 'Tuesday',
        Wed: 'Wednesday',
        Thu: 'Thursday',
        Fri: 'Friday',
        Sat: 'Saturday',
        Sun: 'Sunday'
      };
      this.dom.selectedDayHeading.innerText = `📝 Daily Planner - ${dayNames[day]}`;
      
      // Re-render tasks and mini calendar focus
      this.renderTasks();
      this.renderCalendar();
    }
  }

  addTask(title, priority) {
    const newTask = {
      id: generateUUID(),
      title: title,
      priority: priority,
      completed: false,
      day: this.settings.activeDay
    };
    this.tasks.push(newTask);
    this.saveToLocalStorage();
    this.renderTasks();
    this.renderCalendar();
    this.updateStats();
    this.updateDayTabsCounts();
    this.showToast(`📌 Task added to ${this.settings.activeDay}`);
  }

  toggleTaskCompletion(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      this.saveToLocalStorage();
      this.renderTasks();
      this.renderCalendar();
      this.updateStats();
      this.updateDayTabsCounts();
      this.showToast(task.completed ? '🎉 Task completed!' : 'Task set to incomplete');
    }
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveToLocalStorage();
    this.renderTasks();
    this.renderCalendar();
    this.updateStats();
    this.updateDayTabsCounts();
    this.showToast('🗑️ Task deleted');
  }

  updateDayTabsCounts() {
    DAYS_OF_WEEK.forEach(day => {
      const countEl = document.getElementById(`count-${day}`);
      if (countEl) {
        // Count incomplete tasks
        const incompleteCount = this.tasks.filter(t => t.day === day && !t.completed).length;
        countEl.innerText = incompleteCount;
      }
    });
  }

  renderTasks() {
    this.dom.plannerTasksContainer.innerHTML = '';
    
    // Filter tasks based on day and selected filter
    let filteredTasks = this.tasks.filter(t => t.day === this.settings.activeDay);
    
    const activeFilter = this.settings.activeFilter;
    if (activeFilter === 'pending') {
      filteredTasks = filteredTasks.filter(t => !t.completed);
    } else if (activeFilter === 'completed') {
      filteredTasks = filteredTasks.filter(t => t.completed);
    } else if (activeFilter === 'high') {
      filteredTasks = filteredTasks.filter(t => t.priority === 'high');
    }

    // Update counts on the tabs dynamically
    this.updateDayTabsCounts();

    if (filteredTasks.length === 0) {
      this.dom.plannerTasksContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">📋</span>
          <span class="empty-state-text">No tasks found for ${this.settings.activeDay}.</span>
        </div>
      `;
      return;
    }

    filteredTasks.forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.className = `task-item ${task.completed ? 'completed-state' : ''}`;
      taskEl.setAttribute('data-id', task.id);

      taskEl.innerHTML = `
        <div class="goal-checkbox ${task.completed ? 'completed' : ''}" role="checkbox" aria-checked="${task.completed}"></div>
        <span class="task-title">${this.escapeHTML(task.title)}</span>
        <span class="priority-badge ${task.priority}">${task.priority}</span>
        <button class="delete-btn" aria-label="Delete task">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      `;

      // Event: Toggle completed
      taskEl.querySelector('.goal-checkbox').addEventListener('click', () => this.toggleTaskCompletion(task.id));
      
      // Event: Delete task
      taskEl.querySelector('.delete-btn').addEventListener('click', () => this.deleteTask(task.id));

      this.dom.plannerTasksContainer.appendChild(taskEl);
    });
  }

  // ==========================================
  // MINI CALENDAR RENDERING
  // ==========================================

  renderCalendar() {
    // Calculate dates of the current week dynamically
    const today = new Date();
    const currentDayOfWeek = today.getDay(); 
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    this.dom.miniCalendar.innerHTML = '';

    const dayNamesFull = {
      Mon: 'Monday',
      Tue: 'Tuesday',
      Wed: 'Wednesday',
      Thu: 'Thursday',
      Fri: 'Friday',
      Sat: 'Saturday',
      Sun: 'Sunday'
    };

    DAYS_OF_WEEK.forEach((day, index) => {
      const cell = document.createElement('div');
      cell.className = `calendar-row-item ${this.settings.activeDay === day ? 'active' : ''}`;
      cell.setAttribute('data-day', day);

      // Calculate the actual date number for this cell
      const cellDate = new Date(monday);
      cellDate.setDate(monday.getDate() + index);
      const dayNum = cellDate.getDate(); // e.g. 15

      // Find tasks for this day to generate stats and dots
      const dayTasks = this.tasks.filter(t => t.day === day);
      const totalCount = dayTasks.length;
      const completedCount = dayTasks.filter(t => t.completed).length;

      let dotsHtml = '';
      if (totalCount > 0) {
        dayTasks.slice(0, 3).forEach(task => {
          dotsHtml += `<span class="calendar-row-dot ${task.completed ? 'completed' : ''}"></span>`;
        });
      }

      const statsText = totalCount > 0 ? `${completedCount}/${totalCount}` : 'No tasks';

      cell.innerHTML = `
        <div class="calendar-row-left">
          <div class="calendar-row-date-badge">${dayNum}</div>
          <span class="calendar-row-day-name">${dayNamesFull[day]}</span>
        </div>
        <div class="calendar-row-right">
          <span class="calendar-row-stats">${statsText}</span>
          <div class="calendar-row-dots">
            ${dotsHtml}
          </div>
        </div>
      `;

      // Event: Click on cell switches active planner day
      cell.addEventListener('click', () => this.switchActiveDay(day));

      this.dom.miniCalendar.appendChild(cell);
    });
  }

  // ==========================================
  // ANALYTICS & GLOBAL WIDGETS calculations
  // ==========================================

  updateStats() {
    // 1. Habit Completion Rate calculations
    let totalHabitCells = this.habits.length * 7;
    let completedHabitCells = 0;
    
    this.habits.forEach(habit => {
      DAYS_OF_WEEK.forEach(day => {
        if (habit.history[day]) completedHabitCells++;
      });
    });

    const habitRate = totalHabitCells > 0 ? Math.round((completedHabitCells / totalHabitCells) * 100) : 0;
    this.dom.habitCompletionRate.innerText = `${habitRate}%`;

    // 2. Tasks Completion Rate
    const completedTasks = this.tasks.filter(t => t.completed).length;
    const totalTasks = this.tasks.length;
    
    const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    this.dom.taskCompletionRate.innerText = `${taskRate}%`;

    // 3. Best streak calculations
    let bestStreak = 0;
    this.habits.forEach(habit => {
      const streak = this.calculateStreakForHabit(habit);
      if (streak > bestStreak) bestStreak = streak;
    });
    this.dom.streakCount.innerText = `${bestStreak} Day${bestStreak !== 1 ? 's' : ''}`;
  }

  // ==========================================
  // AUTHENTICATION & MULTI-USER HELPERS
  // ==========================================

  switchAuthTab(tab) {
    if (tab === 'signin') {
      if (this.dom.tabBtnSignin) this.dom.tabBtnSignin.classList.add('active');
      if (this.dom.tabBtnSignup) this.dom.tabBtnSignup.classList.remove('active');
      if (this.dom.formSignin) this.dom.formSignin.style.display = 'block';
      if (this.dom.formSignup) this.dom.formSignup.style.display = 'none';
      if (this.dom.signinEmail) this.dom.signinEmail.focus();
    } else {
      if (this.dom.tabBtnSignup) this.dom.tabBtnSignup.classList.add('active');
      if (this.dom.tabBtnSignin) this.dom.tabBtnSignin.classList.remove('active');
      if (this.dom.formSignup) this.dom.formSignup.style.display = 'block';
      if (this.dom.formSignin) this.dom.formSignin.style.display = 'none';
      if (this.dom.signupName) this.dom.signupName.focus();
    }
    this.clearAuthAlert();
  }

  showAuthAlert(message, type = 'error') {
    if (!this.dom.authAlert) return;
    this.dom.authAlert.className = `auth-alert ${type}`;
    const icon = type === 'success' ? '✅' : '⚠️';
    this.dom.authAlert.innerHTML = `<span>${icon}</span><span>${this.escapeHTML(message)}</span>`;
    this.dom.authAlert.style.display = 'flex';
  }

  clearAuthAlert() {
    if (!this.dom.authAlert) return;
    this.dom.authAlert.style.display = 'none';
    this.dom.authAlert.innerHTML = '';
  }

  showAuthView() {
    if (this.dom.authScreenWrapper) this.dom.authScreenWrapper.classList.remove('hidden');
    if (this.dom.pageCoverWrapper) this.dom.pageCoverWrapper.style.display = 'none';
    if (this.dom.appContainer) this.dom.appContainer.style.display = 'none';
    this.clearAuthAlert();
    this.switchAuthTab('signin');
  }

  showAppView() {
    if (this.dom.authScreenWrapper) this.dom.authScreenWrapper.classList.add('hidden');
    if (this.dom.pageCoverWrapper) this.dom.pageCoverWrapper.style.display = '';
    if (this.dom.appContainer) this.dom.appContainer.style.display = '';
    this.updateHeaderProfile();
  }

  updateHeaderProfile() {
    if (!this.currentUser) return;
    const avatar = this.currentUser.avatarEmoji || '💜';
    const name = this.currentUser.name || 'User';
    const email = this.currentUser.email || '';

    if (this.dom.headerUserAvatar) this.dom.headerUserAvatar.innerText = avatar;
    if (this.dom.headerUserName) this.dom.headerUserName.innerText = name;
    if (this.dom.profileAvatar) this.dom.profileAvatar.innerText = avatar;

    if (this.dom.dropdownUserAvatar) this.dom.dropdownUserAvatar.innerText = avatar;
    if (this.dom.dropdownUserName) this.dom.dropdownUserName.innerText = name;
    if (this.dom.dropdownUserEmail) this.dom.dropdownUserEmail.innerText = email;
    if (this.dom.dropdownUserBadge) {
      this.dom.dropdownUserBadge.innerText = this.currentUser.isGuest ? 'Guest Mode' : 'Personal Account';
      this.dom.dropdownUserBadge.style.backgroundColor = this.currentUser.isGuest ? 'var(--priority-medium-bg)' : 'var(--accent-purple-light)';
      this.dom.dropdownUserBadge.style.color = this.currentUser.isGuest ? 'var(--priority-medium)' : 'var(--accent-purple)';
    }
  }

  loginUser(user) {
    this.currentUser = user;
    this.showAppView();
    this.loadFromLocalStorage();
    this.calculateWeekRange();
    this.applyTheme();
    this.render();
    this.showToast(`👋 Welcome, ${user.name}!`);
  }

  logoutUser() {
    this.authManager.clearSession();
    this.currentUser = null;
    this.showAuthView();
    this.showToast('👋 You have signed out.');
  }

  calculatePasswordStrength(password) {
    if (!password) return { score: 0, text: 'Minimum 6 characters', className: '' };
    if (password.length < 6) return { score: 1, text: 'Too short (min 6 chars)', className: 'weak' };

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) {
      return { score: 1, text: 'Weak password', className: 'weak' };
    } else if (score === 2 || score === 3) {
      return { score: 2, text: 'Good password 👍', className: 'medium' };
    } else {
      return { score: 3, text: 'Strong password 🔥', className: 'strong' };
    }
  }

  exportUserData() {
    if (!this.currentUser) return;
    const backup = {
      app: 'Habitask',
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      user: {
        name: this.currentUser.name,
        email: this.currentUser.email
      },
      habits: this.habits,
      tasks: this.tasks,
      goals: this.goals,
      settings: this.settings
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    const sanitizedName = (this.currentUser.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `habitask-backup-${sanitizedName}-${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.showToast('💾 Backup downloaded successfully!');
  }

  importUserData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || (!data.habits && !data.tasks && !data.goals)) {
          throw new Error('Invalid Habitask backup file structure.');
        }

        if (Array.isArray(data.habits)) this.habits = data.habits;
        if (Array.isArray(data.tasks)) this.tasks = data.tasks;
        if (Array.isArray(data.goals)) this.goals = data.goals;
        if (data.settings && typeof data.settings === 'object') {
          this.settings = Object.assign({}, this.settings, data.settings);
        }

        this.saveToLocalStorage();
        this.render();
        this.showToast('✅ Data successfully restored from backup!');
      } catch (err) {
        console.error('Error importing backup:', err);
        this.showToast('❌ Failed to import: Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  // Escape HTML characters to prevent XSS issues when rendering dynamically
  escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate App once DOM Content is fully parsed and ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new HabitaskApp();
});
