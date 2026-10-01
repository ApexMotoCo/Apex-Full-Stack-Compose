// ============================================================
// USER PROFILE ROUTES
// ============================================================

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'public', 'uploads', 'profiles');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const user = req.session.user;
      const ext = path.extname(file.originalname);
      cb(null, `profile-${user.id}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed'));
    }
    cb(null, true);
  }
});

app.get('/profile', requireLogin, (req, res) => {
  res.render('profile', { user: req.session.user });
});

app.post('/profile/update', requireLogin, profileUpload.single('profilePicture'), (req, res) => {
  const { displayName, email } = req.body;
  const user = req.session.user;
  
  if (displayName && displayName.length < 3) {
    return res.json({ success: false, message: 'Display name must be at least 3 characters' });
  }
  
  let query = 'UPDATE users SET display_name = ?, email = ?';
  let params = [displayName || null, email];
  
  if (req.file) {
    query += ', profile_picture = ?';
    params.push(`/uploads/profiles/${req.file.filename}`);
  }
  
  query += ' WHERE id = ?';
  params.push(user.id);
  
  db.run(query, params, function(err) {
    if (err) {
      console.error('Profile update error:', err);
      return res.json({ success: false, message: 'Error updating profile' });
    }
    
    user.display_name = displayName || user.username;
    user.email = email;
    if (req.file) {
      user.profile_picture = `/uploads/profiles/${req.file.filename}`;
    }
    req.session.user = user;
    
    res.json({ success: true, message: 'Profile updated successfully' });
  });
});

app.post('/profile/change-password', requireLogin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.session.user;
  
  if (!currentPassword || !newPassword) {
    return res.json({ success: false, message: 'All fields are required' });
  }
  
  if (newPassword.length < 8) {
    return res.json({ success: false, message: 'Password must be at least 8 characters' });
  }
  
  db.get('SELECT password FROM users WHERE id = ?', [user.id], (err, userRecord) => {
    if (err || !userRecord) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    bcrypt.compare(currentPassword, userRecord.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.json({ success: false, message: 'Current password is incorrect' });
      }
      
      bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
        if (err) {
          return res.json({ success: false, message: 'Error hashing password' });
        }
        
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id], (err) => {
          if (err) {
            return res.json({ success: false, message: 'Error updating password' });
          }
          
          res.json({ success: true, message: 'Password changed successfully' });
        });
      });
    });
  });
});
