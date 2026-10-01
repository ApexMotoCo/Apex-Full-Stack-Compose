const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('data/database.db', sqlite3.OPEN_READONLY);
db.get("select count(*) total, sum(booking_date is not null and booking_date != '') with_date, sum(booking_time is not null and booking_time != '') with_time from bookings", (e, r) => console.log(e ? e.message : r));
db.all("select id, created_at, booking_date, booking_time from bookings order by id desc limit 5", (e, rows) => console.log(e ? e.message : rows));
