// ==========================================================================
// PathPulse AI - Supabase Authentication Controller (js/auth.js)
// Production Integration with Supabase Auth & PostgreSQL Profiles
// ==========================================================================

// Email format validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).trim().toLowerCase());
}

// HTML sanitizer for safe UI rendering
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toggle password visibility (eye icon)
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector('i');
  
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }
}

// Clear field error state
function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(fieldId + '-error');
  if (input) {
    input.classList.remove('is-invalid');
  }
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }
}

// Set field error state
function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(fieldId + '-error');
  if (input) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
  }
  if (errorEl) {
    errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(message)}`;
    errorEl.classList.add('visible');
  }
}

// Map Supabase Auth errors to friendly, actionable messages
function mapAuthError(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const msg = (err.message || err.error_description || String(err)).toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid username or password')) {
    return 'Incorrect email or password. Please verify your credentials and try again.';
  }
  if (msg.includes('user already registered') || msg.includes('user already exists') || msg.includes('already exists')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('password should be at least') || msg.includes('password too short') || msg.includes('weak password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email') || msg.includes('email address is invalid')) {
    return 'Please enter a valid email address.';
  }
  if (msg.includes('email not confirmed') || msg.includes('not verified')) {
    return 'Please verify your email address. Check your inbox for the confirmation link.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please wait a few moments before trying again.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || !navigator.onLine) {
    return 'Network connection error. Please check your internet connection and try again.';
  }

  return err.message || 'Authentication request could not be completed.';
}

// Quick Fill for evaluator testing
function fillDemoLogin() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  if (emailInput) {
    emailInput.value = 'demo@pathpulse.ai';
    clearFieldError('email');
  }
  if (passwordInput) {
    passwordInput.value = 'demo123';
    clearFieldError('password');
  }
}

// ==============================================================================
// FORGOT PASSWORD: Send Supabase Password Reset Email
// ==============================================================================
async function handleForgotPassword() {
  const emailInput = document.getElementById('email');
  const alertBox = document.getElementById('auth-alert');
  const forgotBtn = document.getElementById('forgot-password-btn');
  const enteredEmail = emailInput ? emailInput.value.trim() : '';

  clearFieldError('email');
  if (alertBox) {
    alertBox.className = 'auth-alert-box';
    alertBox.innerHTML = '';
  }

  // Require email address
  if (!enteredEmail) {
    setFieldError('email', 'Please enter your registered email address first.');
    if (emailInput) emailInput.focus();
    return;
  }

  if (!validateEmail(enteredEmail)) {
    setFieldError('email', 'Please enter a valid email address (e.g. name@example.com).');
    if (emailInput) emailInput.focus();
    return;
  }

  try {
    if (forgotBtn) {
      forgotBtn.disabled = true;
      forgotBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    }

    if (!window.PathPulseSupabase || !window.PathPulseSupabase.auth) {
      throw new Error('Supabase client is not loaded. Please check your connection.');
    }

    await window.PathPulseSupabase.auth.resetPassword(enteredEmail);

    if (alertBox) {
      alertBox.className = 'auth-alert-box alert-success-custom visible';
      alertBox.innerHTML = `
        <i class="fa-solid fa-circle-check" style="font-size: 1.15rem; margin-top: 2px;"></i>
        <div>
          <strong>Password Reset Email Sent!</strong><br>
          We've dispatched password recovery instructions to <strong>${escapeHtml(enteredEmail)}</strong>.<br>
          Please check your email inbox and spam folder.
        </div>
      `;
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (err) {
    console.error('Password reset error:', err);
    const friendlyMsg = mapAuthError(err);
    
    if (alertBox) {
      alertBox.className = 'auth-alert-box alert-error-custom visible';
      alertBox.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.1rem; margin-top: 2px;"></i>
        <div>
          <strong>Reset Request Failed:</strong> ${escapeHtml(friendlyMsg)}
        </div>
      `;
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } finally {
    if (forgotBtn) {
      forgotBtn.disabled = false;
      forgotBtn.textContent = 'Forgot Password?';
    }
  }
}

// ==============================================================================
// LOGIN: Authenticate with Supabase Auth & Retrieve Profile
// ==============================================================================
async function handleLoginSubmit(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('login-submit-btn');
  const alertBox = document.getElementById('auth-alert');
  
  if (!emailInput || !passwordInput) return;
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Clear previous alerts
  if (alertBox) {
    alertBox.className = 'auth-alert-box';
    alertBox.innerHTML = '';
  }
  
  clearFieldError('email');
  clearFieldError('password');
  
  let isValid = true;
  
  // Validate Email
  if (!email) {
    setFieldError('email', 'Email address is required.');
    isValid = false;
  } else if (!validateEmail(email)) {
    setFieldError('email', 'Please enter a valid email address (e.g. name@example.com).');
    isValid = false;
  }
  
  // Validate Password
  if (!password) {
    setFieldError('password', 'Password is required.');
    isValid = false;
  }
  
  if (!isValid) return;
  
  // Button Loading State
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
  }

  try {
    if (!window.PathPulseSupabase || !window.PathPulseSupabase.auth) {
      throw new Error('Supabase authentication client is not loaded.');
    }

    // 1. Authenticate with Supabase Auth (passwords securely checked by Supabase Auth)
    const authResult = await window.PathPulseSupabase.auth.signIn(email, password);

    if (!authResult || !authResult.user) {
      throw new Error('Sign in failed. No user was returned from Supabase Auth.');
    }

    const user = authResult.user;

    // 2. Retrieve the user's profile from database
    let profile = authResult.profile;
    if (!profile) {
      try {
        profile = await window.PathPulseSupabase.auth.getProfile(user.id);
      } catch (profErr) {
        console.warn('Profile fetch note:', profErr.message);
      }
    }

    const userRole = profile?.role || user.user_metadata?.role || 'user';
    const fullName = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
    const phone = profile?.phone || user.user_metadata?.phone || '';
    const avatarUrl = profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400';

    // 3. Store the authenticated session & sync PathPulse state
    localStorage.setItem('pathpulse_logged_in', 'true');
    localStorage.setItem('pathpulse_user', JSON.stringify({
      id: user.id,
      name: fullName,
      email: user.email,
      role: userRole,
      phone: phone,
      avatarUrl: avatarUrl
    }));

    localStorage.setItem('pathpulse_user_profile', JSON.stringify({
      fullName: fullName,
      email: user.email,
      phone: phone,
      role: userRole,
      avatarUrl: avatarUrl,
      reportsSubmitted: profile?.reports_submitted || 0,
      reportsResolved: profile?.reports_resolved || 0
    }));

    // Success Notification
    if (alertBox) {
      alertBox.className = 'auth-alert-box alert-success-custom visible';
      alertBox.innerHTML = `
        <i class="fa-solid fa-circle-check" style="font-size: 1.1rem; margin-top: 2px;"></i>
        <div>
          <strong>Sign In Successful!</strong><br>
          Welcome back, ${escapeHtml(fullName)}. Redirecting to your dashboard...
        </div>
      `;
    }

    // 4. Redirect to Dashboard
    setTimeout(() => {
      if (userRole === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 750);

  } catch (err) {
    console.error('Supabase Sign-In Error:', err);
    const friendlyMsg = mapAuthError(err);

    if (err.message && (err.message.toLowerCase().includes('invalid login credentials') || err.message.toLowerCase().includes('wrong password'))) {
      setFieldError('password', 'Incorrect email or password.');
      setFieldError('email', 'Please check your email address.');
    }

    if (alertBox) {
      alertBox.className = 'auth-alert-box alert-error-custom visible';
      alertBox.innerHTML = `
        <i class="fa-solid fa-circle-exclamation" style="font-size: 1.1rem; margin-top: 2px;"></i>
        <div>
          <strong>Sign In Failed:</strong> ${escapeHtml(friendlyMsg)}
          ${email === 'demo@pathpulse.ai' ? '<br><small style="margin-top:4px; display:inline-block;">Tip: If this demo user is not yet created in your Supabase project, click <a href="register.html" style="color:#FBBF24; text-decoration:underline;">Create an account</a> to register it.</small>' : ''}
        </div>
      `;
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In</span> <i class="fa-solid fa-arrow-right"></i>';
    }
  }
}

// ==============================================================================
// REGISTRATION: Create Supabase User & Corresponding Profile (role = 'user')
// ==============================================================================
async function handleRegisterSubmit(event) {
  event.preventDefault();
  
  const nameInput = document.getElementById('fullname');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const submitBtn = document.getElementById('register-submit-btn');
  const alertBox = document.getElementById('auth-alert');
  
  if (!nameInput || !emailInput || !passwordInput || !confirmPasswordInput) return;
  
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Clear previous alerts and errors
  if (alertBox) {
    alertBox.className = 'auth-alert-box';
    alertBox.innerHTML = '';
  }
  clearFieldError('fullname');
  clearFieldError('email');
  clearFieldError('phone');
  clearFieldError('password');
  clearFieldError('confirm-password');
  
  let isValid = true;
  
  // 1. Full Name Validation
  if (!name) {
    setFieldError('fullname', 'Full name is required.');
    isValid = false;
  } else if (name.length < 2) {
    setFieldError('fullname', 'Please enter your full name (at least 2 characters).');
    isValid = false;
  }
  
  // 2. Email Validation
  if (!email) {
    setFieldError('email', 'Email address is required.');
    isValid = false;
  } else if (!validateEmail(email)) {
    setFieldError('email', 'Please enter a valid email address (e.g. name@example.com).');
    isValid = false;
  }
  
  // 3. Phone (Optional, but validate format if entered)
  if (phone && phone.replace(/\D/g, '').length < 7) {
    setFieldError('phone', 'Please enter a valid phone number (at least 7 digits).');
    isValid = false;
  }
  
  // 4. Password Validation
  if (!password) {
    setFieldError('password', 'Password is required.');
    isValid = false;
  } else if (password.length < 6) {
    setFieldError('password', 'Password must be at least 6 characters long.');
    isValid = false;
  }
  
  // 5. Confirm Password Validation
  if (!confirmPassword) {
    setFieldError('confirm-password', 'Please confirm your password.');
    isValid = false;
  } else if (password !== confirmPassword) {
    setFieldError('confirm-password', 'Passwords do not match. Please re-enter.');
    isValid = false;
  }
  
  if (!isValid) return;
  
  // Loading State
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
  }

  try {
    if (!window.PathPulseSupabase || !window.PathPulseSupabase.auth) {
      throw new Error('Supabase authentication client is not loaded.');
    }

    // 1. Create Supabase Auth User & 2. Create corresponding profile record
    // Default role = 'user' (Users must NOT be able to choose admin during registration)
    const result = await window.PathPulseSupabase.auth.signUp(email, password, name, phone);

    if (!result || !result.user) {
      throw new Error('Failed to create account with Supabase Auth.');
    }

    const user = result.user;
    const defaultRole = 'user';

    // 3. Store authenticated session & sync PathPulse state
    localStorage.setItem('pathpulse_logged_in', 'true');
    localStorage.setItem('pathpulse_user', JSON.stringify({
      id: user.id,
      name: name,
      email: email,
      phone: phone || '',
      role: defaultRole,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
      joinedDate: new Date().toISOString()
    }));

    localStorage.setItem('pathpulse_user_profile', JSON.stringify({
      fullName: name,
      email: email,
      phone: phone || '',
      role: defaultRole,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
      reportsSubmitted: 0,
      reportsResolved: 0
    }));

    // If email confirmation is required by Supabase project settings
    const isEmailConfirmationPending = !result.session && user.identities && user.identities.length > 0;

    if (alertBox) {
      alertBox.className = 'auth-alert-box alert-success-custom visible';
      alertBox.innerHTML = `
        <i class="fa-solid fa-circle-check" style="font-size: 1.15rem; margin-top: 2px;"></i>
        <div>
          <strong>Account Created Successfully!</strong><br>
          Welcome to PathPulse AI, ${escapeHtml(name)}. Your profile has been initialized.<br>
          ${isEmailConfirmationPending ? 'A confirmation email was sent to your inbox. ' : ''}
          Redirecting to dashboard...
        </div>
      `;
    }

    // 4. Redirect to Dashboard
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);

  } catch (err) {
    console.error('Supabase Registration Error:', err);
    const friendlyMsg = mapAuthError(err);
    
    if (err.message && (err.message.toLowerCase().includes('already registered') || err.message.toLowerCase().includes('already exists'))) {
      setFieldError('email', 'This email is already registered. Please sign in instead.');
    } else if (err.message && err.message.toLowerCase().includes('password')) {
      setFieldError('password', friendlyMsg);
    }

    if (alertBox) {
      alertBox.className = 'auth-alert-box alert-error-custom visible';
      alertBox.innerHTML = `
        <i class="fa-solid fa-circle-exclamation" style="font-size: 1.1rem; margin-top: 2px;"></i>
        <div>
          <strong>Registration Failed:</strong> ${escapeHtml(friendlyMsg)}
        </div>
      `;
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Create Account</span> <i class="fa-solid fa-arrow-right"></i>';
    }
  }
}

// Password strength evaluator indicator
function updatePasswordStrength(password) {
  const b1 = document.getElementById('strength-1');
  const b2 = document.getElementById('strength-2');
  const b3 = document.getElementById('strength-3');
  const b4 = document.getElementById('strength-4');
  const textEl = document.getElementById('strength-text');
  
  if (!b1 || !b2 || !b3 || !b4 || !textEl) return;
  
  // Reset all
  [b1, b2, b3, b4].forEach(b => {
    b.style.background = 'rgba(255, 255, 255, 0.08)';
  });
  
  if (!password) {
    textEl.textContent = 'Minimum 6 characters';
    textEl.style.color = '#71717A';
    return;
  }
  
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8 && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z\d]/.test(password)) score++;
  
  if (score <= 1) {
    b1.style.background = '#EF4444';
    textEl.textContent = 'Strength: Weak (min 6 chars)';
    textEl.style.color = '#EF4444';
  } else if (score === 2) {
    b1.style.background = '#F59E0B';
    b2.style.background = '#F59E0B';
    textEl.textContent = 'Strength: Fair';
    textEl.style.color = '#F59E0B';
  } else if (score === 3) {
    b1.style.background = '#06B6D4';
    b2.style.background = '#06B6D4';
    b3.style.background = '#06B6D4';
    textEl.textContent = 'Strength: Good';
    textEl.style.color = '#06B6D4';
  } else {
    b1.style.background = '#10B981';
    b2.style.background = '#10B981';
    b3.style.background = '#10B981';
    b4.style.background = '#10B981';
    textEl.textContent = 'Strength: Strong';
    textEl.style.color = '#10B981';
  }
}

// Global exports for inline HTML attributes
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.handleForgotPassword = handleForgotPassword;
window.fillDemoLogin = fillDemoLogin;
window.togglePasswordVisibility = togglePasswordVisibility;

// Attach event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
  
  // Real-time error clearing on typing
  const inputs = document.querySelectorAll('.auth-input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      clearFieldError(input.id);
    });
  });
  
  // Real-time password strength update
  const regPassword = document.getElementById('password');
  if (regPassword && document.getElementById('strength-1')) {
    regPassword.addEventListener('input', (e) => {
      updatePasswordStrength(e.target.value);
    });
  }
});
