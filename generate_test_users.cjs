const bcrypt = require('bcryptjs');

async function run() {
  const password = "Testing@123";
  const hashedPassword = await bcrypt.hash(password, 10);

  const users = [
    { username: 'Testone', email: 'testone@example.com', first_name: 'Test', last_name: 'One' },
    { username: 'Testtwo', email: 'testtwo@example.com', first_name: 'Test', last_name: 'Two' },
    { username: 'Testthree', email: 'testthree@example.com', first_name: 'Test', last_name: 'Three' },
    { username: 'Testfour', email: 'testfour@example.com', first_name: 'Test', last_name: 'Four' },
    { username: 'Testfive', email: 'testfive@example.com', first_name: 'Test', last_name: 'Five' },
  ];

  let sql = '-- STEP 1: Insert into users table\n';
  sql += 'INSERT INTO public.users (username, email, password, user_role, account_approved, account_blocked, is_admin)\nVALUES\n';
  
  users.forEach((u, i) => {
    sql += `  ('${u.username}', '${u.email}', '${hashedPassword}', 'alumni', true, false, false)`;
    if (i === users.length - 1) {
      sql += ';\n\n';
    } else {
      sql += ',\n';
    }
  });

  sql += '-- STEP 2: Insert into alumni table (required for profile completion)\n';
  sql += 'INSERT INTO public.alumni (user_id, first_name, last_name, email, graduation_year, is_public)\n';
  sql += 'SELECT id, username, \'User\', email, 2024, true FROM public.users WHERE email LIKE \'test%@example.com\';\n';

  console.log(sql);
}

run();
