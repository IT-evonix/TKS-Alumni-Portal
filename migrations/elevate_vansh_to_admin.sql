-- Force upgrade Vansh Awasthi to Administrator so he can log in to the portal

UPDATE users 
SET 
  is_admin = true, 
  user_role = 'administrator',
  account_blocked = false 
WHERE email = 'awasthivanshaj@gmail.com';
