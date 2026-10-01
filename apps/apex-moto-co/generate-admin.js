const bcrypt = require('bcryptjs');
const password = process.env.ADMIN_PASSWORD;
const email = process.env.ADMIN_EMAIL;

if (!password || !email) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before generating an admin hash.');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('\n=== APEX MOTO ADMIN SETUP ===\n');
  console.log('Demo Admin User:');
  console.log(`Email: ${email}`);
  console.log('\nBcrypt Hash for DB:');
  console.log(hash);
  console.log('\n✓ Use these credentials to log in after inserting the hash into the database.');
  console.log('\nSQL to insert into users table:');
  console.log(`INSERT INTO users (email, password, name, role) VALUES ('${email}', '${hash}', 'Admin', 'admin');\n`);
});
