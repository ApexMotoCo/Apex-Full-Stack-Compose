'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Package names on the booking form include the price, e.g.
// "Tier 01: The Express Refresh - From £35". Read it from there so the Workshop
// app can show a price. Packages with no price (e.g. bespoke quotes) return "Quote".
function priceFromService(serviceType) {
  const m = String(serviceType || '').match(/£\s*(\d+(?:\.\d{1,2})?)/);
  return m ? `£${m[1]}` : 'Quote';
}

function registerDetailingMobileApi(app, db, options = {}) {
  const secret = options.secret || process.env.DETAILING_APP_SECRET;
  const allowedRoles = options.allowedRoles || ['admin'];

  const photoDir = path.join(
    __dirname,
    '..',
    'public',
    'uploads',
    'detailing-jobs'
  );

  fs.mkdirSync(photoDir, { recursive: true });

  // These additions are safe to run repeatedly. Existing installations are
  // upgraded automatically without replacing the bookings table.
  const schemaAdds = [
    ['assigned_to', 'INTEGER'],
    ['assigned_at', 'DATETIME'],
    ['internal_notes', 'TEXT'],
    ['payment_status', "TEXT DEFAULT 'unpaid'"]
  ];

  schemaAdds.forEach(([name, type]) => {
    db.run(
      `ALTER TABLE bookings ADD COLUMN ${name} ${type}`,
      err => {
        if (
          err &&
          !String(err.message).includes('duplicate column name')
        ) {
          console.error(
            `[DETAILING MOBILE] Unable to add bookings.${name}:`,
            err.message
          );
        }
      }
    );
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS detailing_job_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS detailing_job_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const workshopAuthenticate = options.workshopAuth && options.workshopAuth.authenticate;

  if (typeof workshopAuthenticate !== 'function') {
    throw new Error('Workshop authentication is required for the detailing API.');
  }

  function auth(req, res, next) {
    workshopAuthenticate(req, res, () => {
      // Keep the existing handler code compatible while moving authentication
      // to the dedicated Workshop API session.
      req.mobileUser = req.workshopUser;
      next();
    });
  }

  function recordHistory(
    bookingId,
    action,
    oldValue,
    newValue,
    userId
  ) {
    db.run(
      `
        INSERT INTO detailing_job_history
        (
          booking_id,
          action,
          old_value,
          new_value,
          changed_by
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        bookingId,
        action,
        oldValue == null
          ? null
          : String(oldValue),
        newValue == null
          ? null
          : String(newValue),
        userId || null
      ]
    );
  }

  app.get(
    '/api/workshop/detailing/health',
    (req, res) => {
      res.json({
        ok: true,
        service:
          'APEX Detailing Mobile API'
      });
    }
  );

  app.get(
    '/api/workshop/detailing/session',
    auth,
    (req, res) => {

      const u =
        req.mobileUser;

      res.json({
        authenticated:
          true,

        user: {
          id:
            u.id,

          username:
            u.username,

          email:
            u.email,

          role:
            u.role,

          display_name:
            u.display_name ||
            u.username
        }
      });

    }
  );

  app.get(
    '/api/workshop/detailing/technicians',
    auth,
    (req, res) => {

      db.all(
        `
          SELECT
            id,
            username,
            email,
            role,
            display_name
          FROM workshop_users
          WHERE
            COALESCE(is_active, 1) = 1
          ORDER BY
            COALESCE(display_name, username),
            username
        `,
        [],
        (err, rows) => {

          if (err) {
            console.error(
              '[DETAILING MOBILE] Technician lookup failed:',
              err.message
            );

            return res.status(500).json({
              error:
                'Unable to load technicians'
            });
          }

          res.json({
            technicians:
              rows || []
          });

        }
      );

    }
  );

  app.get(
    '/api/workshop/detailing/bookings',
    auth,
    (req, res) => {

      // Completed jobs are hidden from the Workshop app but stay in the
      // database (and on the website admin) for compliance records.
      db.all(
        `
          SELECT
            b.id,
            b.name,
            b.email,
            b.phone,
            b.vehicle_type,
            b.service_type,
            b.booking_date,
            b.booking_time,
            b.notes,
            b.status,
            b.created_at,
            b.assigned_to,
            b.assigned_at,
            b.internal_notes,
            COALESCE(
              b.payment_status,
              'unpaid'
            ) AS payment_status,
            COALESCE(
              u.display_name,
              u.username
            ) AS assigned_name,
            (
              SELECT COUNT(*)
              FROM detailing_job_photos p
              WHERE p.booking_id = b.id
            ) AS photo_count
          FROM bookings b
          LEFT JOIN workshop_users u
            ON u.id = b.assigned_to
          WHERE COALESCE(b.status, 'pending') != 'completed'
          ORDER BY
            CASE
              WHEN b.status = 'completed'
              THEN 1
              ELSE 0
            END,
            b.booking_date ASC,
            b.booking_time ASC,
            b.id DESC
        `,
        [],
        (err, rows) => {

          if (err) {
            console.error(
              '[DETAILING MOBILE] Booking lookup failed:',
              err.message
            );

            return res.status(500).json({
              error:
                'Unable to load detailing bookings'
            });
          }

          res.json({
            bookings:
              (rows || []).map(
                row => ({
                  ...row,
                  price:
                    priceFromService(
                      row.service_type
                    )
                })
              )
          });

        }
      );

    }
  );

  app.get(
    '/api/workshop/detailing/bookings/:id',
    auth,
    (req, res) => {

      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error:
            'Invalid booking ID'
        });
      }

      db.get(
        `
          SELECT
            b.*,
            COALESCE(
              u.display_name,
              u.username
            ) AS assigned_name
          FROM bookings b
          LEFT JOIN workshop_users u
            ON u.id = b.assigned_to
          WHERE b.id = ?
        `,
        [id],
        (err, booking) => {

          if (err) {
            return res.status(500).json({
              error:
                'Unable to load booking'
            });
          }

          if (!booking) {
            return res.status(404).json({
              error:
                'Booking not found'
            });
          }

          db.all(
            `
              SELECT
                h.*,
                COALESCE(
                  u.display_name,
                  u.username
                ) AS changed_by_name
              FROM detailing_job_history h
              LEFT JOIN workshop_users u
                ON u.id = h.changed_by
              WHERE h.booking_id = ?
              ORDER BY h.created_at DESC, h.id DESC
            `,
            [id],
            (historyErr, history) => {

              db.all(
                `
                  SELECT
                    p.id,
                    p.filename,
                    p.original_name,
                    p.created_at,
                    COALESCE(
                      u.display_name,
                      u.username
                    ) AS created_by_name
                  FROM detailing_job_photos p
                  LEFT JOIN workshop_users u
                    ON u.id = p.created_by
                  WHERE p.booking_id = ?
                  ORDER BY p.created_at DESC, p.id DESC
                `,
                [id],
                (photoErr, photos) => {

                  res.json({
                    booking: {
                      ...booking,
                      price:
                        priceFromService(
                          booking.service_type
                        )
                    },
                    history:
                      history || [],
                    photos:
                      (photos || []).map(
                        photo => ({
                          ...photo,
                          url:
                            `/uploads/detailing-jobs/${photo.filename}`
                        })
                      )
                  });

                }
              );

            }
          );

        }
      );

    }
  );

  app.patch(
    '/api/workshop/detailing/bookings/:id/status',
    auth,
    (req, res) => {

      const allowed =
        new Set([
          'pending',
          'assigned',
          'vehicle_arrived',
          'inspection',
          'in_progress',
          'quality_check',
          'ready_for_collection',
          'completed'
        ]);

      const status =
        String(
          req.body?.status || ''
        ).trim();

      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        !allowed.has(status)
      ) {
        return res.status(400).json({
          error:
            'Invalid booking or status'
        });
      }

      db.get(
        `
          SELECT status
          FROM bookings
          WHERE id = ?
        `,
        [id],
        (findErr, booking) => {

          if (findErr) {
            return res.status(500).json({
              error:
                'Unable to load booking'
            });
          }

          if (!booking) {
            return res.status(404).json({
              error:
                'Booking not found'
            });
          }

          db.run(
            `
              UPDATE bookings
              SET status = ?
              WHERE id = ?
            `,
            [
              status,
              id
            ],
            function (err) {

              if (err) {
                return res.status(500).json({
                  error:
                    'Unable to update booking'
                });
              }

              if (!this.changes) {
                return res.status(404).json({
                  error:
                    'Booking not found'
                });
              }

              recordHistory(
                id,
                'status',
                booking.status,
                status,
                req.mobileUser.id
              );

              res.json({
                success:
                  true,
                id,
                status
              });

            }
          );

        }
      );

    }
  );

  app.patch(
    '/api/workshop/detailing/bookings/:id/assign',
    auth,
    (req, res) => {

      const id =
        Number(req.params.id);

      const technicianId =
        req.body?.technician_id == null ||
        req.body.technician_id === ''
          ? null
          : Number(
              req.body.technician_id
            );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error:
            'Invalid booking ID'
        });
      }

      if (
        technicianId !== null &&
        !Number.isInteger(
          technicianId
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid technician'
        });
      }

      const lookupSql =
        technicianId === null
          ? `
              SELECT NULL AS id
            `
          : `
              SELECT id
              FROM workshop_users
              WHERE
                id = ?
                AND COALESCE(is_active, 1) = 1
                AND role IN ('admin', 'user')
            `;

      const lookupParams =
        technicianId === null
          ? []
          : [technicianId];

      db.get(
        lookupSql,
        lookupParams,
        (techErr, technician) => {

          if (
            techErr ||
            (
              technicianId !== null &&
              !technician
            )
          ) {
            return res.status(400).json({
              error:
                'Technician not found or inactive'
            });
          }

          db.get(
            `
              SELECT
                assigned_to,
                status
              FROM bookings
              WHERE id = ?
            `,
            [id],
            (findErr, booking) => {

              if (findErr) {
                return res.status(500).json({
                  error:
                    'Unable to load booking'
                });
              }

              if (!booking) {
                return res.status(404).json({
                  error:
                    'Booking not found'
                });
              }

              db.run(
                `
                  UPDATE bookings
                  SET
                    assigned_to = ?,
                    assigned_at =
                      CASE
                        WHEN ? IS NULL
                        THEN NULL
                        ELSE CURRENT_TIMESTAMP
                      END,
                    status =
                      CASE
                        WHEN ?
                          IS NOT NULL
                          AND status = 'pending'
                        THEN 'assigned'
                        ELSE status
                      END
                  WHERE id = ?
                `,
                [
                  technicianId,
                  technicianId,
                  technicianId,
                  id
                ],
                function (err) {

                  if (err) {
                    return res.status(500).json({
                      error:
                        'Unable to assign booking'
                    });
                  }

                  recordHistory(
                    id,
                    'assignment',
                    booking.assigned_to,
                    technicianId,
                    req.mobileUser.id
                  );

                  if (
                    technicianId !== null &&
                    booking.status === 'pending'
                  ) {
                    recordHistory(
                      id,
                      'status',
                      'pending',
                      'assigned',
                      req.mobileUser.id
                    );
                  }

                  res.json({
                    success:
                      true,
                    assigned_to:
                      technicianId,
                    status:
                      technicianId !== null &&
                      booking.status === 'pending'
                        ? 'assigned'
                        : booking.status
                  });

                }
              );

            }
          );

        }
      );

    }
  );

  app.patch(
    '/api/workshop/detailing/bookings/:id/notes',
    auth,
    (req, res) => {

      const id =
        Number(req.params.id);

      const notes =
        String(
          req.body?.internal_notes || ''
        ).trim();

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error:
            'Invalid booking ID'
        });
      }

      if (notes.length > 5000) {
        return res.status(400).json({
          error:
            'Internal notes are limited to 5000 characters'
        });
      }

      db.get(
        `
          SELECT internal_notes
          FROM bookings
          WHERE id = ?
        `,
        [id],
        (findErr, booking) => {

          if (findErr) {
            return res.status(500).json({
              error:
                'Unable to load booking'
            });
          }

          if (!booking) {
            return res.status(404).json({
              error:
                'Booking not found'
            });
          }

          db.run(
            `
              UPDATE bookings
              SET internal_notes = ?
              WHERE id = ?
            `,
            [
              notes,
              id
            ],
            function (err) {

              if (err) {
                return res.status(500).json({
                  error:
                    'Unable to save notes'
                });
              }

              recordHistory(
                id,
                'notes',
                booking.internal_notes,
                notes,
                req.mobileUser.id
              );

              res.json({
                success:
                  true
              });

            }
          );

        }
      );

    }
  );

  app.patch(
    '/api/workshop/detailing/bookings/:id/payment',
    auth,
    (req, res) => {

      const allowed =
        new Set([
          'unpaid',
          'cash_pending',
          'cash_paid'
        ]);

      const id =
        Number(req.params.id);

      const paymentStatus =
        String(
          req.body?.payment_status || ''
        ).trim();

      if (
        !Number.isInteger(id) ||
        !allowed.has(paymentStatus)
      ) {
        return res.status(400).json({
          error:
            'Invalid booking or payment status'
        });
      }

      db.get(
        `
          SELECT payment_status
          FROM bookings
          WHERE id = ?
        `,
        [id],
        (findErr, booking) => {

          if (findErr) {
            return res.status(500).json({
              error:
                'Unable to load booking'
            });
          }

          if (!booking) {
            return res.status(404).json({
              error:
                'Booking not found'
            });
          }

          db.run(
            `
              UPDATE bookings
              SET payment_status = ?
              WHERE id = ?
            `,
            [
              paymentStatus,
              id
            ],
            function (err) {

              if (err) {
                return res.status(500).json({
                  error:
                    'Unable to update payment status'
                });
              }

              recordHistory(
                id,
                'payment',
                booking.payment_status,
                paymentStatus,
                req.mobileUser.id
              );

              res.json({
                success:
                  true,
                payment_status:
                  paymentStatus
              });

            }
          );

        }
      );

    }
  );

  app.post(
    '/api/workshop/detailing/bookings/:id/photos',
    auth,
    (req, res) => {

      const id =
        Number(req.params.id);

      const filename =
        String(
          req.body?.filename ||
          `photo-${Date.now()}.jpg`
        )
        .replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

      const data =
        String(
          req.body?.data_base64 ||
          ''
        ).replace(
          /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
          ''
        );

      if (
        !Number.isInteger(id) ||
        !data
      ) {
        return res.status(400).json({
          error:
            'Booking ID and photo are required'
        });
      }

      if (
        data.length >
        12 * 1024 * 1024
      ) {
        return res.status(413).json({
          error:
            'Photo is too large'
        });
      }

      db.get(
        'SELECT id FROM bookings WHERE id = ?',
        [id],
        (findErr, booking) => {

          if (findErr) {
            return res.status(500).json({
              error:
                'Unable to load booking'
            });
          }

          if (!booking) {
            return res.status(404).json({
              error:
                'Booking not found'
            });
          }

          let buffer;

          try {
            buffer =
              Buffer.from(
                data,
                'base64'
              );
          } catch (_) {
            return res.status(400).json({
              error:
                'Invalid photo data'
            });
          }

          if (
            !buffer.length ||
            buffer.length >
              8 * 1024 * 1024
          ) {
            return res.status(413).json({
              error:
                'Photo is too large'
            });
          }

          const safeName =
            `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${filename}`;

          const destination =
            path.join(
              photoDir,
              safeName
            );

          fs.writeFile(
            destination,
            buffer,
            writeErr => {

              if (writeErr) {
                console.error(
                  '[DETAILING MOBILE] Photo write failed:',
                  writeErr.message
                );

                return res.status(500).json({
                  error:
                    'Unable to save photo'
                });
              }

              db.run(
                `
                  INSERT INTO detailing_job_photos
                  (
                    booking_id,
                    filename,
                    original_name,
                    created_by
                  )
                  VALUES (?, ?, ?, ?)
                `,
                [
                  id,
                  safeName,
                  filename,
                  req.mobileUser.id
                ],
                function (err) {

                  if (err) {
                    fs.unlink(
                      destination,
                      () => {}
                    );

                    return res.status(500).json({
                      error:
                        'Unable to save photo record'
                    });
                  }

                  recordHistory(
                    id,
                    'photo',
                    null,
                    safeName,
                    req.mobileUser.id
                  );

                  res.status(201).json({
                    success:
                      true,
                    id:
                      this.lastID,
                    filename:
                      safeName,
                    url:
                      `/uploads/detailing-jobs/${safeName}`
                  });

                }
              );

            }
          );

        }
      );

    }
  );
}

module.exports = {
  registerDetailingMobileApi
};