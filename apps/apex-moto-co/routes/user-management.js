// ============================================================
// UPDATE USER ROLE
// ============================================================

app.put(
  '/admin/users/:id/role',
  requireAdmin,
  (req, res) => {

    const userId =
      Number(req.params.id);

    const { role } = req.body;

    if (!Number.isInteger(userId)) {

      return res.status(400).json({
        error: 'Invalid user ID'
      });

    }

    if (!['user', 'admin'].includes(role)) {

      return res.status(400).json({
        error: 'Invalid role. Use "user" or "admin".'
      });

    }

    if (
      userId === req.session.user.id &&
      role !== 'admin'
    ) {

      return res.status(400).json({
        error:
          'You cannot remove your own admin access.'
      });

    }

    db.run(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId],
      function (err) {

        if (err) {

          console.error(
            'Error updating user role:',
            err
          );

          return res.status(500).json({
            error: 'Error updating user role'
          });

        }

        if (this.changes === 0) {

          return res.status(404).json({
            error: 'User not found'
          });

        }

        if (userId === req.session.user.id) {
          req.session.user.role = role;
        }

        res.json({
          success: true,
          message: `User role changed to ${role}`
        });

      }
    );

  }
);

// ============================================================
// UPDATE USER PASSWORD
// ============================================================

app.put(
  '/admin/users/:id/password',
  requireAdmin,
  async (req, res) => {

    const userId =
      Number(req.params.id);

    const { password } = req.body;

    if (!Number.isInteger(userId)) {

      return res.status(400).json({
        error: 'Invalid user ID'
      });

    }

    if (
      typeof password !== 'string' ||
      password.length < 8
    ) {

      return res.status(400).json({
        error:
          'Password must be at least 8 characters'
      });

    }

    try {

      const hashedPassword =
        await bcrypt.hash(password, 10);

      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        function (err) {

          if (err) {

            console.error(
              'Error updating password:',
              err
            );

            return res.status(500).json({
              error: 'Error updating password'
            });

          }

          if (this.changes === 0) {

            return res.status(404).json({
              error: 'User not found'
            });

          }

          res.json({
            success: true,
            message: 'Password updated successfully'
          });

        }
      );

    } catch (err) {

      console.error(
        'Password hashing error:',
        err
      );

      res.status(500).json({
        error: 'Error updating password'
      });

    }

  }
);
