-- ============================================================================
-- Fix dummy alumni emails -> real emails   |   TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)
-- Generated 2026-09-04 by scripts/fix-dummy-emails.ts from "Dummy Email Alumnis.xlsx".
--
-- TWO statements below (A then B). The Supabase editor's "Run" executes the whole file
-- but treats A and B as separate statements — that's fine, each is self-contained and
-- atomic. Recommended: run A alone first (select it + "Run selection", or run the file
-- and read the FIRST result), confirm users_updated=323, then run B.
--
-- 323 email updates, 14 hard-deletes.
-- After both: still-dummy count should be 374
--   (181 dup-account + 177 dup-skip + 10 still-dummy + 1 blank + 5 not-in-sheet).
--   Run fix_dummy_emails_2026-09-04_verify.sql afterwards to check.
-- ============================================================================

-- =====================  STATEMENT A — 323 EMAIL UPDATES  =====================
-- One atomic statement. On success the result row reads:
--   guard_dummy=1  guard_users=1  guard_alumni=1
--   users_updated=323  alumni_updated=323
-- Any ERROR (e.g. "division by zero" from a guard) => nothing changed.
WITH
_email_fix (user_id, new_email) AS (VALUES
    ('fdfab404-fa39-4de3-a8dd-f68f46a3339c', 'sururajyam@gmail.com'),
    ('67b29c37-17fb-4064-95b2-1c0b200973d1', 'arnavkossireddi@gmail.com'),
    ('fac89750-f3d4-465c-a9f6-46e283cdd220', 'saket215161@gmail.com'),
    ('be0e8686-fac5-4a87-98ce-ee470f8ad48c', 'meenakshijeevan92@gmail.com'),
    ('1b2652e6-f6bd-4b90-84f8-8d22e7a83e8c', 'omkarlalla@outlook.com'),
    ('428a3c73-847f-4cc9-bd3b-3bbe00b2b521', 'sadarmanjula@gmail.com'),
    ('523314c0-6e43-41b3-90d6-61746b9be3be', 'arnagpal@gmail.com'),
    ('2f0d5c6d-0de7-4ee3-a186-f5c1f64e68a8', 'vallirajyam@gmail.com'),
    ('aa7b5e41-ac73-4d61-bb9a-6ad595368aad', 'harshiladiani14@gmail.com'),
    ('9e001c0f-9b04-416d-bacb-733d97d7bee7', 'sudayalakshmi@gmail.com'),
    ('d97121e8-47a5-4faf-b0f1-46b038ea31cd', 'ananya.komath.tks@gmail.com'),
    ('6889f4b4-e43c-4b8a-8f05-aad1f874f09c', 's.m.mhaske8180@gmail.com'),
    ('b3bd0498-9fef-4eb8-b71c-803ee07fc8ef', 'kabeer.poplee@gmail.com'),
    ('bb40a642-9727-49b4-b1b5-fbbe8bb36af7', 'gurpal.s.v@gmail.com'),
    ('76aede6f-d814-49c5-95fe-c662a4b445f5', 'lakshag932@gmail.com'),
    ('bff188c7-b3e3-466e-bfd6-8320041e47c1', 'ramyashekar@gmail.com'),
    ('f1efd4ce-e53f-48b3-acf2-d567e2379e0e', 'dishma.shah@gmail.com'),
    ('93d8b053-dcb8-4047-acd8-1faa7ac1f6f3', 'thakkarkeya09@gmail.com'),
    ('b4afe693-e9e7-4b2f-b7ef-fd45e1891017', 'vandana.lakhotiya@gmail.com'),
    ('fe7b3b80-4691-4876-bb73-4f9dd5b77fbd', 'rumahsudame@gmail.com'),
    ('49c63321-60ea-4805-8c83-67340673a4d3', 'arnav13.onenote@gmail.com'),
    ('99612dd4-96ab-48a5-8fbc-1cad389c6aa7', 'gauravsingh_24@yahoo.com'),
    ('c1ec5655-79d3-4d01-935b-815b7b18b174', 'johntsky@gmail.com'),
    ('79738dd7-d217-4d1c-a815-30476ac27aa6', 'ninadnitin22@gmail.com'),
    ('870ca457-0167-421b-a8ca-7be3822b56b5', 'ritubhasin22@gmail.com'),
    ('6411e752-d052-4784-8902-811ad4ae9416', 'pranav.v1108@gmail.com'),
    ('2c029b46-937d-4277-a5ea-452673b68b91', 'aryanjhaveri333@gmail.com'),
    ('2f704f0b-907a-4515-9df5-64cb83e85813', 'stickanimator77@gmail.com'),
    ('428030b3-f0aa-47cb-81f2-955a44dba7ae', 'kanishk.s5400@outlook.com'),
    ('84c17ee6-8bb3-43f8-ac76-65de08be460d', 'deeptikalsi19@gmail.com'),
    ('f672f2e1-7168-4806-aa71-45a3c1af088c', 'sunitazende07@gmail.com'),
    ('e7430894-7545-4e88-a376-2b43d258730f', 'shilpakharde@gmail.com'),
    ('38c338be-0028-4a7a-9cd9-5fecbfbef76d', 'rishitsaluja92@gmail.com'),
    ('7d8669a0-92f8-4288-89d7-063706cf52f9', 'rianchellani123@gmail.com'),
    ('cb1546b8-a881-4ee7-b401-3f8ec1a80ef9', 'shreyapattnaik2008@gmail.com'),
    ('a388113a-fff7-4743-857c-0e7745f28b1c', 'prithvirajpawar2010@gmail.com'),
    ('7aa2d5d6-63e9-4ead-9932-86fe64165fa9', 'virenk2610@gmail.com'),
    ('fc1c4468-e382-41c0-997b-16308e94a4d9', 'swaraskashid@gmail.com'),
    ('e119c04e-d9a7-4e2b-a5d9-bb0161416b2c', 'kjkaran4067@gmail.com'),
    ('d1c1c12b-9a99-4b31-98bb-d90ea2294658', 'shouryasinghtb@gmail.com'),
    ('74426f98-6205-4acc-bf14-91f2629563ec', 'thomas.biny@gmail.com'),
    ('674a79c5-fe39-40aa-890e-8c1b4ae42a2d', 'reambird85@gmail.com'),
    ('030e5e89-c1ce-48a1-8439-ebb4697c053a', 'kinderdea@gmail.com'),
    ('6987ac48-791d-4a7b-b8e1-4b49f98f1c65', 'titanusgodzilla426@gmail.com'),
    ('7a0bc88f-9bbd-42a6-9c4d-44ec4b09abce', 'tanishcadiwan21@gmail.com'),
    ('fa015e58-14bd-40d0-9d36-c4bfc4ffda23', 'ryanjenoy@gmail.com'),
    ('53507def-babe-42a5-a381-e93c75af3393', 'aksssrivastava@gmail.com'),
    ('8ac0da3b-0b1f-4e16-8ec2-c092da84ea45', 'vaishalipatil1777@gmail.com'),
    ('c0820481-f189-4260-abf0-4cb429bfebf5', 'tejomayadesigns@gmail.com'),
    ('205a251f-8ae1-4733-960c-4de18c00b80e', 'arshisaxena2009@gmail.com'),
    ('53fcec02-4451-496c-bd45-a7a28d2a8471', '1712akul@gmail.com'),
    ('4e5b013e-58c1-40bd-b5e8-686152c52cb0', 'subithashetty@gmail.com'),
    ('b336b295-0a74-4d97-8c4e-c60b86b754c8', 'pdesarda7@gmail.com'),
    ('c54a0b06-2ac4-4c3a-93a9-b5ab05ae8d2e', 'lalitsharma232@gmail.com'),
    ('b78a57ed-91e4-433f-a5ff-25868507a0ba', 'anvika.vohra@gmail.com'),
    ('5a9e627e-fb1f-4119-82f5-dc07eb7d853c', 'parthasaur@gmail.com'),
    ('f3da76bd-2614-4c3f-be0d-f301cb16b18a', 'spchou09@gmail.com'),
    ('076983f4-4321-4619-a905-198877411103', 'iampriyanka@gmail.com'),
    ('7674883a-962c-40f3-8437-0a2b89887ce1', 'csvc.9b2.aadi@gmail.com'),
    ('d0383baf-f25c-4696-a729-fe73909c6a88', 'shahruz@tuta.io'),
    ('26f4cb2d-3389-4fe4-a986-b42766029331', 'mannatbee@gmail.com'),
    ('8ef186fd-63b5-4300-9d4c-7109713694f9', 'edwinalex0311@gmail.com'),
    ('82ff9988-d72c-4fdb-9985-21b3a1e6cf75', 'kavita.pol@gmail.com'),
    ('7d1b3b49-c88d-477f-83a9-61298bcd7af5', 'meenakshikoul@rediffmail.com'),
    ('66d1324d-e114-421e-839f-ec6adafdc457', 'payalts@hotmail.com'),
    ('83f4a28e-30ea-4600-9128-3699342a9105', 'aaravnayar@gmail.com'),
    ('148d42dd-63c6-4958-bc68-8ea77d5a9634', 'anvip1023@gmail.com'),
    ('4cab486c-3ac7-4c5c-b17a-f19986970002', 'avyuktdaga@gmail.com'),
    ('5a202336-bd2f-4bae-bbe0-ccb43cda3022', 'digitrontechnology21@gmail.com'),
    ('66e5648a-f7a7-4388-96b6-640f48128cd9', 'tanushchinchwade98@gmail.com'),
    ('52bfdb3d-2790-4ccc-882b-3a53d319ef56', 'mail4vinamra@gmail.com'),
    ('931b4a79-a920-4dff-8599-d441ffdbad9b', 'drtapaswinimhetre@gmail.com'),
    ('b4a26399-7bab-4d6d-b815-fc813f6eaaed', 'devp832008@gmail.com'),
    ('7f1811f3-f7c3-4eb5-989e-8fbc40a516ab', 'ishaan.govilkar@gmail.com'),
    ('1d998d0e-02db-421c-b9e9-081703b52ef0', 'vaibhavbhat@hotmail.com'),
    ('841dc8ed-7e44-4164-bf41-a724da7b730d', 'dhirenjobanputra@hotmail.com'),
    ('34481756-a076-4e85-a1f5-3bf406957eb8', 'shaurya.meruga@gmail.com'),
    ('0ad8f111-5439-49e9-a4d0-62325874ec42', 'zendayaliansproton.me@gmail.com'),
    ('be6594dd-5e96-4907-ba7a-bee585a69adb', 'ranvirgenius@gmail.com'),
    ('c921b757-4ae0-4c9b-bd2f-1adaa6b7ffa4', 'why.bhuyan@gmail.com'),
    ('7f8c33db-3e91-446e-a5e5-86fc3eb22734', 'girisha.ghai@gmail.com'),
    ('288cc8c0-0eec-4c39-bef5-f96e740ff893', 'yeetayushmaan@gmail.com'),
    ('b9020e31-f82d-40f4-90b3-76d62b2588e9', 'premsoni5181@gmail.com'),
    ('405eedb4-8c80-43a9-a36b-17a30c7b46d3', 'sonali.surachita2010@gmail.com'),
    ('79c539d8-f44a-48ae-8d98-8a6a498d9332', 'jhaaishwarya151@gmail.com'),
    ('aa55b82a-a116-42a8-9c99-8c34f97ea517', 'divij.bishnoi@gmail.com'),
    ('cbe366b0-a748-4815-a553-e327530d489d', 'kashyaptrisha888@gmail.com'),
    ('eb9daf1b-d2b8-40f9-b023-5a1b10318e37', 'faisal18apr@gmail.com'),
    ('de2cde96-b86f-4758-97d7-2edaea2cd0d6', 'rbhadale22@gmail.com'),
    ('1eaed38d-bdc5-407f-b9fc-a43de34c0a46', 'rishithavemuri9@gmail.com'),
    ('6c1c229f-c799-41b6-90ae-7f4307b796cd', 'ganeri.anuragi@gmail.com'),
    ('b7be9086-3ccd-4038-ac4e-f0a85506f777', 'daharwalr@gmail.com'),
    ('2f772512-21b0-4615-a259-62628c1b93a5', 'advikasingh2103@gmail.com'),
    ('07bf9410-fab0-440a-a87e-13331298d679', 'shehnaz.patel@gmail.com'),
    ('a1eb5e61-24df-44ba-969a-2126249b400f', 'kshamasakpal@gmail.com'),
    ('742fa25e-4a65-4134-874c-fdfb3731e1a9', 'dwij2004@gmail.com'),
    ('10cda908-3d06-4417-b0fa-d3c8ba02b851', 'swarnimdeosingh@gmail.com'),
    ('f127a0fd-953d-4f42-8a98-2e2bbbd788b0', 'tanniannu@gmail.com'),
    ('6677f5f4-817a-4206-bb37-34c69662cec9', 'binita.anand58@gmail.com'),
    ('9d7e3d35-049d-4fe0-a10a-20518fd0af8b', 'sheetaldimri@yahoo.co.in'),
    ('e2ac1f7e-1a81-40b7-9560-6f7acb47d84f', 'vinojbc@gmail.com'),
    ('21e17fae-71ad-44cf-9268-42897dbbbcd9', 'anugupta071075@gmail.com'),
    ('c7a174a7-8446-4553-991b-0b1b3f3e3e8e', 'sunilasunil07@gmail.com'),
    ('24454d92-abb1-4bf9-a9d0-ba05179ce3ac', 'manjubalram999@gmail.com'),
    ('0767e33e-7ee7-4042-ad46-6db16531e2da', 'minksvaze23@gmail.com'),
    ('2517ba24-b758-4f50-ba94-22988eaac570', 'ssiddarth121@gmai.com'),
    ('35c0f9a9-edf7-4744-9141-7d8f5c5ccc6c', 'jhaajay1573@gmail.com'),
    ('ccf15c56-6d54-477f-a9ba-7ca6b93e061f', 'tiluliznaonad@gmail.com'),
    ('9f58a98e-8641-460f-aa42-13760113ec2b', 'yadavpratiksha@hotmail.com'),
    ('c9e7866f-fea2-42e6-8bea-e25ef79412a8', 'ritunarang73@gmail.com'),
    ('1e6bb076-9366-485a-a59b-2e72cdfb7a94', 'rinkal.mahendra@gmail.com'),
    ('82b750c6-cc56-48dc-b056-336111a4076d', 'magodeepti@gmail.com'),
    ('ffa0662e-8f7d-455f-b8d3-79de78865579', 'rosebij@gmail.com'),
    ('996dbe4e-b214-4178-9cfb-c8d2b069a6ca', 'preeti.nidemboor@gmail.com'),
    ('934cd7c0-a72a-432e-8dfc-10d9a41437f5', 'bibhu1973@yahoo.co.in'),
    ('1eeecaed-152d-4bd5-b181-e0aaf1dea4e3', 'jyotisinghmalik@gmail.com'),
    ('05dae3cf-8dfc-469a-85e6-3381cc682993', 'panrash78@gmail.com'),
    ('6387527f-bdec-4bfd-848e-436aace6a87b', 'rajalakshmi242424@gmail.com'),
    ('5d9d1ea3-096d-42cc-9ac3-e575eebef525', 'jyotidua1978@gmail.com'),
    ('9db93602-e3ce-4ca6-923b-0d473406f88d', 'aadyaasaran1502@gmail.com'),
    ('cfe9bac3-3f6f-469d-a080-969279756424', 'rajuj14apr@gmail.com'),
    ('0e9969c4-603a-4c4a-b21b-cfb5c3e38490', 'askolhatkar@hotmail.com'),
    ('9d86141c-17bd-4843-9cfb-6e6dea3421c3', 'supriti.2468@gmail.com'),
    ('8b86a013-2251-49f4-b8d1-71dfded0fa52', 'pranjrah@gmail.com'),
    ('a022021f-b425-452f-9a4c-881820debd25', 'anay.260101036@iimmumbai.ac.in'),
    ('8ce824fd-094f-4830-9cd2-5b2528103cc1', 'kumar.sinha78@gmail.com'),
    ('b670b4ee-874d-4c9f-a35f-a9b84b58d084', 'nairreshmy02@gmail.com'),
    ('34ce8593-d00c-4b48-9856-0c8123e43c80', 'sheetalje2001@yahoo.com'),
    ('99ab4718-7e5b-4124-a601-2854548ab2e2', 'r4hulgrover@gmail.com'),
    ('28e66035-90de-45ef-a80d-fbb948555b18', 'mamtamodani@yahoo.com'),
    ('9031b931-62f9-427b-8547-5fe76449266f', 'kavigrover17@gmail.com'),
    ('ff043587-14ed-4f98-b816-952045dad9d2', 'nirupamayur@gmail.com'),
    ('56481f63-6a66-465d-bf58-e06bdeecb4cf', 'pratibhasingh2206@gmail.com'),
    ('066a9eac-6124-49f0-b9b2-3cc4bcc86587', 'shanoy_j@yahoo.com'),
    ('8dd8ae12-8895-40c3-91f2-1635a5c4085f', 'indurawat1976@gmail.com'),
    ('bddac394-9b54-4d03-abde-e0c6fdce71ec', 'dop422657@gmail.com'),
    ('c35d796a-8f33-4904-b08b-5b4cd8d9196d', 'aayushraman2007@gmail.com'),
    ('325c3120-0cd3-40ac-89eb-a887f507a878', 'kydhongade@gmail.com'),
    ('d5db1c93-3319-4eff-aa7b-cfb59d41d271', 'advaitjainnerfgun@gmail.com'),
    ('7e37b3a5-5e34-45aa-9a93-2c1b0d5bd8e2', 'mehekdeepti@gmail.com'),
    ('996113f4-add3-4a77-922f-018394acbfe0', 'saumikisok09@gmail.com'),
    ('413354cc-ca9c-4d32-b6ac-707ecd0551fa', 'sheryassonaje8@gmail.com'),
    ('693672e6-cc7b-4056-aae0-c5ef34dd0b29', 'sakaraymanasvi@gmail.com'),
    ('bfc598e9-64cd-4f57-b7cb-f42b4e9a741f', 'asherhansie24@gmail.com'),
    ('413f16c1-0b17-49b7-9305-88e0bee91e82', 'akshusingh1609@gmail.com'),
    ('6bcef21f-6e46-40ac-a99f-eb003bb0b88e', 'ayeshatiwari2901@gmail.com'),
    ('62105bbd-ae8c-446b-9d85-dc0c58f24733', 'jaspreet.kaur16072008@gmail.com'),
    ('6a221ee6-f8ee-4994-8729-4ee805391420', 'azim.saira@gmail.com'),
    ('244df479-dc03-4010-8965-0f4e4d8f1814', 'sivaram.shilpa@gmail.com'),
    ('8330211a-ab26-4bb0-861a-0028a9b82110', 'devanshw16@gmail.com'),
    ('49c6550c-65f7-487e-87ca-9fd1124da800', 'ayushmaan.srivastava@gmail.com'),
    ('695c3e01-40be-4bb6-adea-b983a6cc5de8', 'yogesh.golwalkar@gmail.com'),
    ('332bf179-b81f-41a3-a6f7-d0394e05b2ef', 'ishita09dec@gmail.com'),
    ('ed632941-fcb3-40d0-add5-c5d0bad60710', 'sharanya.prashant2018@gmail.com'),
    ('94ae3b1e-6e1b-409d-95d5-db4f8fcd25d7', 'shivkala1207@gmail.com'),
    ('075a1090-79e6-4164-991b-a6997ecfcd82', 'poojaranamrata@gmail.com'),
    ('31c96edf-e323-4d05-accc-bc666a8194f4', 'anyabajaj07@gmail.com'),
    ('ff8f3504-f409-41e2-b199-31897d0d4ad8', 'divyanshdave0205@gmail.com'),
    ('815c648b-81bb-4c49-8b89-dd6d14088339', 'anshipra@yahoo.co.in'),
    ('e86cfb09-daa4-4010-816f-7596e0acf87c', 'samratmohapatra@gmail.com'),
    ('62bd7431-e8d4-447d-bae3-352f51378eea', 'bhardwajdivyansh1410@gmail.com'),
    ('2412e1e7-17b2-4266-a73f-ea21703e3630', 'tanisha.kosambi@gmail.com'),
    ('03a67eb8-2588-4972-bbc9-06770e3b5390', 'chandel.anamika@gmail.com'),
    ('9df5c698-b854-481e-aa9e-54d92868bf70', 'teenagoyal1982@gmail.com'),
    ('8d8f5c36-bea6-430a-9fb9-8800965f83dd', 'kartik49xl@gmail.com'),
    ('824ea0cc-534e-40ec-8494-0900d77fb0b7', 'devyanshi.verma914@gmail.com'),
    ('4d9f5816-6bc3-4194-ae69-3b096c75ac32', 'priyalprasad9@gmail.com'),
    ('b8fbe192-8594-4e1d-9514-c9dadda89fe0', 'jayden.fernandes01@gmail.com'),
    ('34706ccd-7157-4593-aad4-7435e46e9476', 'tiyagawale0305@gmail.com'),
    ('901451f8-2c83-4b1b-9135-bbe399c70cce', 'lakhani.falak05@gmail.com'),
    ('2c9fc7d2-3277-4d39-a58d-3ddf8839ad0a', 'ayaan.ch9@outlook.com'),
    ('e8733382-fcfa-49b7-8d09-64d35adcd525', 'mehrishiabhayani1009@gmail.com'),
    ('8c46acc9-212d-4ca0-82ff-f99421adbdff', 'keyashahtks@gmail.com'),
    ('0125c06d-3337-4c40-943c-24b869a53351', 'sudeepti.mail@gmail.com'),
    ('b7962f92-602d-48ba-94b9-e9294453f425', 'neerug60@gmail.com'),
    ('3e89e43e-efb1-40f1-926a-7172b73eeba5', 'vivaan.khanna.2009@gmail.com'),
    ('77711bee-6b94-4b84-9039-bd30dfa8fe19', 'pushpamishra@hotmali.com'),
    ('79085c01-bf07-4ec8-8e25-9580918a8cc5', 'sara.y.mundada1234@gmail.com'),
    ('bde43aeb-9bcf-4882-bd44-6496a6b31ec7', 'manaskumar.tks@gmail.com'),
    ('b2c2aa86-a6d2-4645-88be-0db0ade8a391', 'shineesh.m@gmail.com'),
    ('3a06b15b-63f5-4fb8-a130-31c1c19a68fa', 'hardikjangda32@gmail.com'),
    ('940f4491-5f05-452e-b7ba-f334f8c0c4a0', 'agrawalradhikaa@gmail.com'),
    ('8628ab5c-1c8a-4eef-90a0-e2ba5c96f412', 'rhea2808@gmail.com'),
    ('53fc27e1-a47f-4ae2-bd98-244e297fc5a4', 'menonnidhi08@gmail.com'),
    ('6e1567cf-9343-4823-8559-5ccf78ab3136', 'taniharpale@gmail.com'),
    ('8917685b-795d-4865-b0d0-2e5281dd469b', 'shaaravrn@gmail.com'),
    ('0c87c273-948f-42c4-baa0-581404fc5487', 'jp.shivahre1@gmail.com'),
    ('758492d0-9c42-4dcf-94dc-63fccb21a0c8', 'sandhya.tayade@gmail.com'),
    ('622c3165-5abf-402b-b869-1036e034bc34', 'navyamundra.28@gmail.com'),
    ('3607f83d-626f-40b6-a8f1-6afb0b4dcca9', 'hriday.moondra@gmail.com'),
    ('8675355c-5af2-4df8-8430-8460f5783006', 'chakravortytumpi@gmail.com'),
    ('20264b58-f3a1-49f3-8962-b0e5d8bb8e9b', 'aanyakothari13@gmail.com'),
    ('807ec22a-0b3a-45af-9341-221e5e2d58e1', 'ishita.umbarkar1503@gmail.com'),
    ('17ff17f3-9b3a-410e-bb54-41111540afd6', 'deepam.pandey@gmail.com'),
    ('ccfe522e-087b-4eda-a608-31e7b8db132b', 'niyatiasati09@gmail.com'),
    ('6b4a4c3f-79f5-4651-832f-d0925da61402', 'zainmohzib.009@gmail.com'),
    ('d61187d0-eb47-4a7e-af9d-f86bd2b5831c', 'bhawsar.om2309@gmail.com'),
    ('0ffe868b-1ef5-4d0f-8602-e544f900df35', 'emailtosimple@gmail.com'),
    ('fc08b665-25cc-4f63-87c4-3f0e87c7b778', 'suchitar@rediffmail.com'),
    ('d66f308f-5b14-41c6-add2-7b3a2f5093bc', 'khatriswati@gmail.com'),
    ('37802048-e428-4446-857b-644c1010d217', 'itsgathabadale@gmail.com'),
    ('f22b7e45-594c-49f3-8df8-255f2ebf6b50', 'himakshi.koloti@gmail.com'),
    ('69856e31-ac95-46f8-9959-18b0c9bf209c', 'deeksha.kalyani@thekalyanischool.edu.in'),
    ('7d1759d3-824e-48cb-8eec-c76a5f806c82', 'shauryanand7@gmail.com'),
    ('0e61ade7-c030-46b9-aa90-ae9470ba027d', 'agneejo@gmail.com'),
    ('9edba827-023f-4bfb-830a-a6aa7387f04a', 'prishasingh2008@gmail.com'),
    ('5e2bd069-5195-45f5-a5d0-e9de1667f5bb', 'shashpant@gmail.com'),
    ('29891fab-a242-4ad1-9416-91efbcf01d26', 'tanavsingh07@gmail.com'),
    ('05deea72-1125-43bf-a03c-22904a4c83a5', 'vikramgurbaxani@gmail.com'),
    ('5eeadea3-c378-4b7f-8f4e-38edd909999d', 'mokshakwadhwa@gmail.com'),
    ('12827c3d-570b-4bad-8fae-0707a2966471', 'anu.alurkar@gmail.com'),
    ('9c745453-64c0-47f0-9889-c1195dc1b769', 'studioshivani@yahoo.co.in'),
    ('51eb1a57-abaa-4f1e-b547-60a3780814c1', 'kossireddi.manisha@gmail.com'),
    ('bf8e0122-e8ba-472b-97dc-cf10804b953b', 'ruptiggadiya@gmail.com'),
    ('c192ef43-73f8-442a-a1e3-c0e302497ac2', 'kothekarradhika@gmail.com'),
    ('f7d38c8a-e487-4ba2-ba27-65fc951bb5d3', 'rumpa.mitra@gmail.com'),
    ('c863c4b6-b74c-4801-86b4-4303f160bd7a', 'rachna.deb@hdfcbank.com'),
    ('e790e759-10fb-4129-b4f4-1c0dc2df125e', 'ysp_007@rediffmail.com'),
    ('281d3759-6575-4a9e-860d-eea37d971cde', 'priyankaraajiv24@gmail.com'),
    ('cbe6f0d5-476d-4494-b4aa-68f3ecbf7211', 'chauhanbbya@gmail.com'),
    ('5099dcb5-c303-4a71-b2fe-9063f0db4b17', 'isonali@gmail.com'),
    ('9fe551e3-57ce-4b57-ac60-3bc0f9711da9', 'shreeya.zundaray24nvn@gmail.com'),
    ('d1bbef45-ca54-4960-8c3e-5f92a191bb4f', 'vihaandhankhar3@gmail.com'),
    ('f38ff14b-a697-41d0-bbf0-b622bae40247', 'pahunigarg24@gmail.com'),
    ('f06a57d6-1f92-4ae2-a851-a72281357ded', 'rhukaps@gmail.com'),
    ('ef962673-b173-4b92-8275-ecb7e20fa308', 'sapta_bubun@yahoo.com'),
    ('e14e0bea-ff23-43a5-be03-aa69da369292', 'sachinbhimrajka79@gmail.com'),
    ('48cbea33-6a1f-452f-b29f-abfb3142f078', 'dhages@yahoo.com'),
    ('bc63a4a0-6260-45e7-bbe9-27cca2ca0a6c', 'namratasingh097@gmail.com'),
    ('5dbbe961-9eaa-484b-bc6e-70687b2533ff', 'asmita.khedkar@gmail.com'),
    ('d2a99766-811e-4ca1-88d6-c1cf19a5f488', 'babitasingh16188@gmail.com'),
    ('dcc47a36-d789-4b98-913c-382c2113e79c', 'arush.nikhade14@gmail.com'),
    ('88caa599-ac6a-4bdd-b8ef-f82b77b6f31e', 'tara.kala2010@gmail.com'),
    ('a58a4de1-98bc-4cfe-9ab8-d0d7522c2a9b', 'vanya.agarwal.001@gmail.com'),
    ('cd7966aa-af9f-414b-8c78-b830494b1989', 'nishithavemuri@gmail.com'),
    ('1fbb4125-0341-4471-9544-874cb90f7eeb', 'rishans878@gmail.com'),
    ('1b99e88b-951e-4e5f-b8ed-949b832db7e2', 'uma.mani@gmail.com'),
    ('5da1e906-15fb-4ea9-aada-cd7051e70a5c', 'dishajhanjee382@gmail.com'),
    ('e11702a9-89f4-4ed0-a1a8-9dc970126fae', 'drishtiiagarwall@gmail.com'),
    ('72af3e3a-5002-4d29-8b9c-6c42d756b68e', 'greeshmachavan1325@gmail.com'),
    ('013924ce-4669-44ee-abcf-b8d1fee10e7d', 'ishita.rb73@gmail.com'),
    ('2e0bc7e6-323f-494d-9e76-3df9e408f2fd', 'aadityawankhade129@gmail.com'),
    ('07914c01-87a3-46bf-9293-a6fda79e7bf3', 'aadya192007@gmail.com'),
    ('b44cd940-49c0-4fbe-801c-0c17fe61a882', 'aanya.uppal3108@gmail.com'),
    ('26433186-0a1d-45f1-854c-5045302e6277', 'akiev.keer@gmail.com'),
    ('98b66a7d-1bbc-4126-8b2c-33322d063e09', 'vashistakshat@gmail.com'),
    ('1589c146-bfe5-4dcf-b723-30f4f0cce9e7', 'armaansikchi@gmail.com'),
    ('c0d8a29d-18cd-4f81-8eaa-99e707602f86', 'arshi07@gmail.com'),
    ('37c0463a-35f7-48c6-8f89-931248bc47fe', 'arshiyabhandari3@gmail.com'),
    ('f7221450-fae3-4170-8384-d9cda79c56db', 'dakshitag21@outlook.com'),
    ('5d7c2f6a-f0fe-4041-bc5e-fe6aac0fa8bb', 'kamakshdewan29@gmail.com'),
    ('88c7d243-519d-4571-bac8-897ffdb44ffe', 'labonyobanerjee@gmail.com'),
    ('ca20bc8b-3f87-4e7f-a2ea-1249ddde1759', 'leannamphilip@gmail.com'),
    ('a93f9fc1-5aeb-4263-a710-dcdf592a0bf3', 'mitali.vashishtha03@gmail.com'),
    ('fcb9ca8e-06ab-4b0d-b834-955828ca0117', 'phatakmk13@gmail.com'),
    ('9239ca14-26e1-469e-a7cc-667e708083e9', 'bandanachrispy@gmail.com'),
    ('cec74834-ed04-4842-a62d-669c44a7cba0', 'aggarwalria2007@gmail.com'),
    ('a448a68f-f36f-4256-92ae-2c9480889f75', 'rishabhwadhwani07@gmail.com'),
    ('75c61a5c-cc17-4b80-9e43-886509d9ff6e', 'ryanm0766@gmail.com'),
    ('2d49b049-a98f-4af7-934a-28d5fd7d4df4', 'sachi.chirkute@gmail.com'),
    ('e6a46a25-e5fc-407e-b1c1-67bbeda6b62d', 'ginnyrawat19@gmail.com'),
    ('2626c31a-1e9f-4378-8ad1-5fefb0952d70', 'shalutaneja73@gmail.com'),
    ('8e472f4a-c759-4484-9953-3ba47ae88f59', 'rupaagarwal3699@gmail.com'),
    ('733fa478-3acc-4748-a063-403ac6041f27', 'ekta.sahney@gmail.com'),
    ('b591c82e-c759-42f7-9c1c-33bf0500477f', 'sehejgumber@gmail.com'),
    ('ca3a6d60-a4dc-4b28-8f72-35c4c71dc17b', 'sonalabhi2003@gmail.com'),
    ('989d06a1-4fdf-4111-8343-d639bdc6f722', 'pallavidaga@gmail.com'),
    ('53692327-a4f3-4a1e-b45b-6c725f4c7670', 'swapna.sengupta.infy@gmail.com'),
    ('d01e253b-4d0b-42e6-8a18-a1297fd49efc', 'geetu.vigh@yahoo.co.in'),
    ('565c6ff0-2c73-4653-a3f5-1ebb3b8c52e2', 'iliyan.lakhani13@gmail.com'),
    ('d5b0506a-3e48-458e-9507-fb39cd6f213f', 'poushali.jha@gmail.com'),
    ('611fa466-7661-41fe-b842-6423bf7b03c8', 'himanikamdar6@gmail.com'),
    ('b62f68f9-255a-4ee0-ba18-4fae942f1b41', 'hardikgirachh291@gmail.com'),
    ('ed70687d-fb9f-4a36-a7a5-2123dd2222ed', 'mneetubala@gmail.com'),
    ('b52c0132-971b-451a-8dad-d89ae66384d0', 'mahapratibha@gmail.com'),
    ('f3123e2a-31eb-4ca9-9193-9a8df2903aa6', 'twaritasharma@gmail.com'),
    ('e7f65d21-5771-4ca4-9e57-00c546c43906', 'shamini.aditya@gmail.com'),
    ('63bbe101-8623-4b86-9ffa-99a3e4d0206c', 'pathania.sudipta@gmail.com'),
    ('83cc30e7-ec0c-4a19-b428-78e708ec0911', 'chandra.tulika@gmail.com'),
    ('0fbd139a-ceb5-44ea-b661-5b36c87c8b1e', 'gupta.tarush07@gmail.com'),
    ('27c03dde-aedd-4dbd-b479-5fd3bf856210', 'bakedbeans.op@gmail.com'),
    ('0e2232e7-cc91-4349-b804-2f41262d5fc4', 'kumarsanjay22@gmail.com'),
    ('f43476d0-2b87-4a9a-b7c7-de9b0bade3b9', 'shalinid_sinha@rediffmail.com'),
    ('bd8240cd-d487-4b09-abb9-3ec2729c7bfe', 'gurmeetkaursachdeva@gmail.com'),
    ('3a967789-2319-4e91-b34b-6dac5d0fe9f9', 'kiransanskrit2310@gmail.com'),
    ('28f3eb25-31c2-4859-827b-e6831989aa4a', 'rai.ghs01@gmail.com'),
    ('eb153b19-3f3b-4a62-91ad-76166d580a0f', 'mishrakalpanapune@gmail.com'),
    ('d2606254-e9ba-4451-b558-5c3d8a1377e3', 'reemaymundada@gmail.com'),
    ('dd8bed9e-73a9-4bfc-bd47-ed063315841e', 'aaravmum@gmail.com'),
    ('355180ad-820b-494f-8eee-c362d6e3c410', 'shweta.lodha@rediffmail.com'),
    ('9d822749-33a4-4016-ac37-ae90be2fcd2e', 'sush.lamba@gmail.com'),
    ('bd7db609-b1e2-4feb-9be2-4b675d0c34b0', 'monuverma06@gmail.com'),
    ('b8c923c8-e520-41bc-893b-e7f88cc7ce8c', 'patidar.prakash@gmail.com'),
    ('e1e1207b-309f-4677-9b51-4b31efc7717a', 'anupama.ramnany@gmail.com'),
    ('b9dd5b52-41da-4e78-b921-012514d9da2c', 'ki_kaur@yahoo.com'),
    ('b74096e0-9e22-4662-b723-a084216f0abf', 'pratyakshdhankher@gmail.com'),
    ('93efe952-9854-4fc2-9fe9-49b49e71c5f5', 'ranvirmehra1@gmail.com'),
    ('39472631-5a40-471f-8576-0cce87a3045f', 'urvijain0613@gmail.com'),
    ('a543bc04-eec9-40db-aec0-989f081e92a5', 'vidhipatodia1@gmail.com'),
    ('85154926-8761-45d0-a2de-f05b6087b7d6', 'yugalmittal23@gmail.com'),
    ('3747462a-7d38-4d91-a75f-83190f166c69', 'bajaj_juhi@hotmail.com'),
    ('785eeee3-4bfd-4c48-8b4c-46bcd0349391', 'monicamangal@hotmail.com'),
    ('062a895d-d26f-4a89-a54a-3f34cbab60a0', 'richa_rimu@yahoo.co.in'),
    ('2f585967-a0cc-4318-a692-4014bdce381f', 'ajaikumarb@yahoo.co.in'),
    ('5d9f7fa7-7306-446f-86ab-7bd326ac3a6a', 'amritasamir@gmail.com'),
    ('cd595aa8-da12-4549-b4de-fa4140805238', 'sk.chalka@yahoo.com'),
    ('c8fb2e9a-2acf-4cca-8e7b-0a30fa991a14', 'aparna.j.sastry@gmail.com'),
    ('ec2d8164-2436-4083-9029-3485eb87f664', 'siri2710@gmail.com'),
    ('ff6a064f-ca68-45b6-b374-178403ecfa41', 'preetinayak@hotmail.com'),
    ('c6002752-73fd-48d4-88f5-a60ad9203c2e', 'koutha_radhika@yahoo.com'),
    ('bf072f3c-383e-4b34-ae26-a43a40a078c2', 'rupalirk99@gmail.com'),
    ('968b033b-4721-4830-8401-a05adef98deb', 'shalini0303@yahoo.com'),
    ('3eda233e-bda0-468d-ad1b-2f053a550214', 'anil.dhankher@gmail.com'),
    ('933e134b-f709-47fe-9ebc-ab26617c7b7b', 'geomilind@gmail.com'),
    ('e6427ab5-be0f-4890-89ed-1959b6286342', 'deepali_deshmukh@ymail.com'),
    ('3e10134d-0da9-46ae-9db6-074636eb4b63', 'shnavita@gmail.com'),
    ('e2ed31fe-856d-4cad-9953-e49260a4400c', 'abhanipunkhurana@yahoo.com'),
    ('ba1a9b3d-0130-4ed9-87ad-f2bd8923c932', 'madhu_gurumurthy@outlook.com'),
    ('2c324634-0bd0-4f10-a413-3c9aa39f21f0', 'aarti.nigade@gmail.com'),
    ('b9409b02-a9fb-49cf-8223-8648bd9d1be3', 'sanchari.dass@gmail.com'),
    ('b58cb79d-9a08-4975-98a4-9c1838121160', 'shellymaggu001@gmail.com'),
    ('f9b29759-9008-4f0a-9499-c6dc480d6d63', 'nanyabhandari2004@gmail.com'),
    ('b7870b85-1fc9-4bcd-8de3-8d285c2bd3a1', 'sheetal_saraf@yahoo.co.in')
),
guard_dummy AS (            -- every target is currently on a dummy email
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email_fix f JOIN users u ON u.id = f.user_id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
guard_users AS (            -- no new email already on a DIFFERENT users row
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email_fix f JOIN users u ON lower(u.email) = f.new_email AND u.id <> f.user_id
),
guard_alumni AS (           -- no new email already on a DIFFERENT alumni row
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email_fix f JOIN alumni a ON lower(a.email) = f.new_email AND a.user_id <> f.user_id
),
upd_users AS (
  UPDATE users u SET email = f.new_email, updated_at = now()
    FROM _email_fix f
   WHERE u.id = f.user_id
     AND (SELECT ok FROM guard_dummy) = 1
     AND (SELECT ok FROM guard_users) = 1
     AND (SELECT ok FROM guard_alumni) = 1
  RETURNING 1
),
upd_alumni AS (
  UPDATE alumni a SET email = f.new_email, updated_at = now()
    FROM _email_fix f
   WHERE a.user_id = f.user_id
     AND (SELECT ok FROM guard_dummy) = 1
     AND (SELECT ok FROM guard_users) = 1
     AND (SELECT ok FROM guard_alumni) = 1
  RETURNING 1
)
SELECT
  (SELECT ok FROM guard_dummy)      AS guard_dummy,
  (SELECT ok FROM guard_users)      AS guard_users,
  (SELECT ok FROM guard_alumni)     AS guard_alumni,
  (SELECT count(*) FROM upd_users)  AS users_updated,
  (SELECT count(*) FROM upd_alumni) AS alumni_updated;


-- =====================  STATEMENT B — 14 HARD-DELETES  =====================
-- Run this ONLY after Statement A succeeded. One atomic statement. On success:
--   guard_preflight=1  conn_cleared=<0+>  alumni_deleted=14  users_deleted=14
WITH
_del_users (user_id) AS (VALUES
    ('0cdc9326-b2a4-422b-ac80-642cff7c4ebe'),
    ('f851f7fb-3e6f-4151-9272-e9af4e32ef26'),
    ('377280e0-51ea-40c9-8838-59c3bb511477'),
    ('d7335e39-9cc2-403b-8b03-3c5d7263cc96'),
    ('aa03b84d-0892-46ea-b342-5fefe2c9cdb3'),
    ('f67e3695-d5c8-4f56-811c-fb675469b601'),
    ('ef3ee980-b7ea-4583-94ba-3c601acf5289'),
    ('c7b9a989-5e54-48fe-b95c-670c2095cac6'),
    ('93e178ab-9014-4a5c-82c6-23fa93b8dac3'),
    ('4cb45ccb-92ec-4690-b6f1-bf045501c53d'),
    ('c82324f9-eb40-43f9-af67-39483adca5c4'),
    ('008b59a1-56ae-421f-ad11-a8b791452d56'),
    ('2ffaef59-b8d8-480e-9f33-7779b1db0f9e'),
    ('fbb285dc-42e8-4999-b884-24df84108589')
),
guard_preflight AS (        -- no blocking child row for the 14 deletes, EXCLUDING
                            -- connection_requests (conn_clear removes those first)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT user_id FROM _del_users))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT user_id FROM _del_users) OR blocked_id IN (SELECT user_id FROM _del_users))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT user_id FROM _del_users))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT user_id FROM _del_users))
     )))::int AS ok
),
conn_clear AS (
  DELETE FROM connection_requests
   WHERE (requester_id IN (SELECT user_id FROM _del_users) OR recipient_id IN (SELECT user_id FROM _del_users))
     AND (SELECT ok FROM guard_preflight) = 1
  RETURNING 1
),
del_alumni AS (
  DELETE FROM alumni
   WHERE user_id IN (SELECT user_id FROM _del_users)
     AND (SELECT ok FROM guard_preflight) = 1
     AND (SELECT count(*) FROM conn_clear) >= 0   -- force conn_clear to run first
  RETURNING 1
),
del_users AS (
  DELETE FROM users
   WHERE id IN (SELECT user_id FROM _del_users)
     AND (SELECT ok FROM guard_preflight) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0   -- force del_alumni to run first
  RETURNING 1
)
SELECT
  (SELECT ok FROM guard_preflight)  AS guard_preflight,
  (SELECT count(*) FROM conn_clear) AS conn_cleared,
  (SELECT count(*) FROM del_alumni) AS alumni_deleted,
  (SELECT count(*) FROM del_users)  AS users_deleted;
