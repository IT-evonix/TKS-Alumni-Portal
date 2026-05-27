const bcrypt = require('bcryptjs');

async function run() {
  const password = "Testing@123";
  const hashedPassword = await bcrypt.hash(password, 10);

  const users = [
    { username: 'Testone', email: 'testone@example.com' },
    { username: 'Testtwo', email: 'testtwo@example.com' },
    { username: 'Testthree', email: 'testthree@example.com' },
    { username: 'Testfour', email: 'testfour@example.com' },
    { username: 'Testfive', email: 'testfive@example.com' },
  ];

  let sql = 'INSERT INTO public.users (username, email, password, user_role, account_approved, account_blocked, is_admin) VALUES\n';
  
  users.forEach((u, i) => {
    sql += `  ('${u.username}', '${u.email}', '${hashedPassword}', 'alumni', true, false, false)`;
    if (i === users.length - 1) {
      sql += ';';
    } else {
      sql += ',\n';
    }
  });

  console.log(sql);
}

run();
