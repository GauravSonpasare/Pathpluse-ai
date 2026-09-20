// ==============================================================================
// PathPulse AI - Central Supabase Client & API Service (js/supabase.js)
// Official @supabase/supabase-js v2 integration
// ==============================================================================

// Public Client-side Configuration (Safe to expose in browser)
const SUPABASE_CONFIG = {
  url: 'https://iepzzsrrixbdgzmymtat.supabase.co',
  anonKey: 'sb_publishable_bZ1R-6-mKX3fLWuMiUA9wQ_3YOWzLc-'
};

// Global PathPulseSupabase namespace
window.PathPulseSupabase = window.PathPulseSupabase || {};

// Initialize Client Instance
let _supabase = null;
if (typeof supabase !== 'undefined' && supabase.createClient) {
  try {
    _supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    window.PathPulseSupabase.client = _supabase;
    console.log('✓ PathPulse AI: Supabase client ready.');
  } catch (err) {
    console.warn('Supabase client initialization notice:', err);
  }
}

// Check connectivity status
window.PathPulseSupabase.isConfigured = function() {
  return _supabase !== null;
};

// ==============================================================================
// 1. AUTHENTICATION MODULE
// ==============================================================================
window.PathPulseSupabase.auth = {
  // Sign Up with Email & Password
  // 1. Creates Supabase Auth User
  // 2. Creates corresponding profile record with default role = 'user'
  async signUp(email, password, fullName, phone) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    
    const { data, error } = await _supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || '',
          role: 'user' // Default role
        }
      }
    });
    if (error) throw error;
    
    // Create corresponding profile record if user was created
    if (data.user) {
      try {
        const { error: profError } = await _supabase.from('profiles').upsert({
          user_id: data.user.id,
          full_name: fullName,
          email: email,
          phone: phone || '',
          role: 'user', // Explicit default role, users cannot choose admin
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
        }, { onConflict: 'user_id' });
        
        if (profError) {
          console.warn('Profile creation sync note:', profError.message);
        }
      } catch (profileErr) {
        console.warn('Profile creation caught notice:', profileErr);
      }
    }
    return data;
  },

  // Sign In with Email & Password
  // Authenticates and returns user session and database profile record
  async signIn(email, password) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    
    const { data, error } = await _supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;

    let profile = null;
    if (data && data.user) {
      try {
        const { data: profData } = await _supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();
        profile = profData;
      } catch (profErr) {
        console.warn('Could not fetch user profile record:', profErr);
      }
    }

    return { ...data, profile };
  },

  // Fetch Profile for a User ID
  async getProfile(userId) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('Profile fetch warning:', error.message);
      return null;
    }
    return data;
  },

  // Forgot Password: Send Supabase password reset email
  async resetPassword(email) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const redirectUrl = window.location.origin + window.location.pathname;
    const { data, error } = await _supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    if (error) throw error;
    return data;
  },

  // Sign Out
  async signOut() {
    if (!_supabase) return;
    try {
      const { error } = await _supabase.auth.signOut();
      if (error) console.warn('Supabase signOut notice:', error.message);
    } catch (e) {
      console.warn('SignOut exception:', e);
    }
    localStorage.removeItem('pathpulse_logged_in');
    localStorage.removeItem('pathpulse_user');
    localStorage.removeItem('pathpulse_user_profile');
  },

  // Get Current Authenticated User
  async getUser() {
    if (!_supabase) return null;
    try {
      const { data: { user } } = await _supabase.auth.getUser();
      return user;
    } catch (e) {
      return null;
    }
  },

  // Get Current Session
  async getSession() {
    if (!_supabase) return null;
    try {
      const { data: { session } } = await _supabase.auth.getSession();
      return session;
    } catch (e) {
      return null;
    }
  },

  // Listen to Auth State Changes
  onAuthStateChange(callback) {
    if (!_supabase) return null;
    return _supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
};

// ==============================================================================
// 2. DATABASE: HAZARD REPORTS MODULE
// ==============================================================================
window.PathPulseSupabase.reports = {
  // Fetch All Reports (with optional filtering)
  async getAll(filterStatus = 'all') {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    let query = _supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterStatus && filterStatus !== 'all' && filterStatus !== 'ALL') {
      if (filterStatus === 'critical') {
        query = query.in('severity', ['Critical', 'High']);
      } else if (filterStatus === 'inprogress') {
        query = query.in('status', ['In Progress', 'Assigned', 'Reported']);
      } else if (filterStatus === 'resolved') {
        query = query.eq('status', 'Resolved');
      } else {
        query = query.ilike('status', `%${filterStatus}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Fetch Public Safety Map Reports (Strictly selects only non-sensitive public civic hazard columns)
  async getPublicSafetyMapReports() {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('reports')
      .select('id, title, category, severity, risk_score, latitude, longitude, address, status, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Fetch Single Report by ID
  async getById(id) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Create / Submit a New Hazard Report
  async create(reportData) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    
    // Format payload matching the database schema
    const payload = {
      user_id: reportData.user_id || reportData.userId || null,
      title: reportData.title || reportData.hazardType || 'Pedestrian Hazard',
      description: reportData.description || '',
      category: reportData.category || 'broken_footpath',
      severity: (reportData.severity || 'high').toLowerCase(),
      risk_score: parseInt(reportData.risk_score || reportData.riskScore || 78, 10),
      latitude: parseFloat(reportData.latitude || reportData.lat || 12.9784),
      longitude: parseFloat(reportData.longitude || reportData.lng || 77.6408),
      address: reportData.address || reportData.location || reportData.location_address || 'Local Pedestrian Corridor',
      image_url: reportData.image_url || reportData.image || null,
      ai_detected: reportData.ai_detected !== undefined ? reportData.ai_detected : true,
      ai_confidence: parseFloat(reportData.ai_confidence || reportData.aiConfidence || 91.0),
      status: 'reported',
      admin_note: ''
    };

    // If a specific valid UUID is provided, attach it, otherwise PostgreSQL defaults to gen_random_uuid()
    if (reportData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportData.id)) {
      payload.id = reportData.id;
    }

    const { data, error } = await _supabase
      .from('reports')
      .insert([payload])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  // Update Report Status & Assignment (Admin Dashboard actions)
  async updateStatus(id, newStatus, assignedTo = null) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const updates = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    if (assignedTo !== null) {
      updates.assigned_to = assignedTo;
    }

    const { data, error } = await _supabase
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// ==============================================================================
// 3. DATABASE: USER PROFILES MODULE
// ==============================================================================
window.PathPulseSupabase.profiles = {
  // Get Profile by User ID
  async get(userId) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Update Profile
  async update(userId, profileUpdates) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('profiles')
      .update({
        full_name: profileUpdates.fullName || profileUpdates.full_name,
        phone: profileUpdates.phone,
        avatar_url: profileUpdates.avatarUrl || profileUpdates.avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};

// ==============================================================================
// 4. DATABASE: NOTIFICATIONS MODULE
// ==============================================================================
window.PathPulseSupabase.notifications = {
  // Get Notifications for a User (enforced by RLS & user_id filter)
  async getAll(userId) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Mark a Notification as Read: Updates is_read to true in Supabase
  async markAsRead(id) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Toggle Notification Read Status: Updates is_read in Supabase
  async toggleRead(id, currentIsRead) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('notifications')
      .update({ is_read: !currentIsRead })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Mark All Notifications as Read for User: Updates is_read to true in Supabase
  async markAllAsRead(userId) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return data;
  }
};

// ==============================================================================
// 4B. ADMIN OPERATIONS MODULE (Protected by Database RLS)
// ==============================================================================
window.PathPulseSupabase.admin = {
  // Check if current user is an authenticated administrator
  async checkAdminStatus() {
    if (!_supabase) return { isAdmin: false, user: null, role: null };
    try {
      const { data: { user } } = await _supabase.auth.getUser();
      if (!user) return { isAdmin: false, user: null, role: null };

      // Query profiles table for cryptographically verified role
      const { data: profile } = await _supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .eq('user_id', user.id)
        .maybeSingle();

      const verifiedRole = profile?.role || user.user_metadata?.role || 'user';
      return {
        isAdmin: verifiedRole === 'admin',
        user: { ...user, full_name: profile?.full_name || user.user_metadata?.full_name, role: verifiedRole },
        role: verifiedRole
      };
    } catch (e) {
      console.warn('Admin status check error:', e);
      return { isAdmin: false, user: null, role: null };
    }
  },

  // Load all reports for administrative operations
  async getAllReports() {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    const { data, error } = await _supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Update report status with full audit logging & owner notifications
  async changeReportStatus(reportId, newStatus, adminNote = '') {
    if (!_supabase) throw new Error('Supabase client is not loaded.');

    const normStatus = (newStatus || '').toLowerCase().replace(/\s+/g, '_');
    const { data: { user: adminUser } } = await _supabase.auth.getUser();

    // 1. Fetch current report to obtain old_status and owner user_id
    const { data: currentReport, error: fetchErr } = await _supabase
      .from('reports')
      .select('id, user_id, title, status, admin_note')
      .eq('id', reportId)
      .single();

    if (fetchErr) throw fetchErr;

    const oldStatus = currentReport ? currentReport.status : 'reported';
    const nowIso = new Date().toISOString();

    // 2. Update reports: status, admin_note, updated_at
    const updatePayload = {
      status: normStatus,
      updated_at: nowIso
    };
    if (adminNote !== undefined && adminNote !== null && adminNote !== '') {
      updatePayload.admin_note = adminNote;
    }

    const { error: updateErr } = await _supabase
      .from('reports')
      .update(updatePayload)
      .eq('id', reportId);

    if (updateErr) throw updateErr;

    // 3. Create record in report_updates (check if DB trigger already ran)
    try {
      const { data: existingUpdates } = await _supabase
        .from('report_updates')
        .select('id')
        .eq('report_id', reportId)
        .eq('new_status', normStatus)
        .gte('created_at', new Date(Date.now() - 4000).toISOString());

      if (!existingUpdates || existingUpdates.length === 0) {
        await _supabase
          .from('report_updates')
          .insert({
            report_id: reportId,
            updated_by: adminUser?.id || null,
            old_status: oldStatus,
            new_status: normStatus,
            note: adminNote || `Status updated from ${oldStatus} to ${normStatus}`
          });
      }
    } catch (auditErr) {
      console.warn('Report audit log notice:', auditErr.message);
    }

    // 4. Create notification for the report owner
    if (currentReport && currentReport.user_id) {
      try {
        let notifMsg = `Your report has been ${normStatus.replace(/_/g, ' ')}.`;
        if (normStatus === 'verified') notifMsg = 'Your report has been verified.';
        else if (normStatus === 'rejected') notifMsg = 'Your report has been rejected.';
        else if (normStatus === 'assigned') notifMsg = 'Your report has been assigned.';
        else if (normStatus === 'in_progress') notifMsg = 'Your report is now in progress.';
        else if (normStatus === 'resolved') notifMsg = 'Your reported hazard has been resolved.';

        const { data: existingNotifs } = await _supabase
          .from('notifications')
          .select('id')
          .eq('report_id', reportId)
          .eq('user_id', currentReport.user_id)
          .gte('created_at', new Date(Date.now() - 4000).toISOString());

        if (!existingNotifs || existingNotifs.length === 0) {
          await _supabase
            .from('notifications')
            .insert({
              user_id: currentReport.user_id,
              report_id: reportId,
              message: notifMsg,
              is_read: false
            });
        }
      } catch (notifErr) {
        console.warn('Owner notification notice:', notifErr.message);
      }
    }

    return { success: true, oldStatus, newStatus: normStatus };
  }
};

// ==============================================================================
// 5. STORAGE MODULE (HAZARD IMAGES & USER AVATARS)
// ==============================================================================
window.PathPulseSupabase.storage = {
  // Upload Hazard Photo to 'hazard-images' bucket
  // Organizes files as hazard-images/{user-id}/{report-image.jpg}
  async uploadHazardImage(fileOrBlob, filename, userId = null) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    
    // Default to 'guest' or 'anonymous' if user-id not provided
    const userFolder = userId || 'anonymous';
    const safeFilename = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '') : 'report_photo.jpg';
    const filePath = `${userFolder}/${Date.now()}_${safeFilename}`;

    const { data, error } = await _supabase.storage
      .from('hazard-images')
      .upload(filePath, fileOrBlob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Supabase Storage upload error:', error.message);
      throw error;
    }

    const { data: publicData } = _supabase.storage
      .from('hazard-images')
      .getPublicUrl(filePath);

    if (!publicData || !publicData.publicUrl) {
      throw new Error('Failed to retrieve public URL for uploaded hazard image.');
    }

    return publicData.publicUrl;
  },

  // Upload Avatar Photo to 'avatars' bucket
  async uploadAvatar(fileOrBlob, userId) {
    if (!_supabase) throw new Error('Supabase client is not loaded.');
    
    const filename = `avatar_${userId || 'user'}_${Date.now()}.jpg`;
    const { data, error } = await _supabase.storage
      .from('avatars')
      .upload(filename, fileOrBlob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn('Avatar storage upload notice:', error.message);
      return null;
    }

    const { data: publicData } = _supabase.storage
      .from('avatars')
      .getPublicUrl(filename);

    return publicData ? publicData.publicUrl : null;
  }
};
