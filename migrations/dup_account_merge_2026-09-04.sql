-- ============================================================================
-- Merge 180 duplicate placeholder accounts into their real self-registered accounts
-- TARGET: Supabase project aikvtpqqxasdctchtgct  (PROD)
-- Generated 2026-09-04 by scripts/dup-account-merge.ts from scripts/out/dup-account-precheck.json
--
-- PREREQUISITE: fix_dummy_emails_2026-09-04.sql is committed (baseline 374/374). Verified.
--
-- HOW TO RUN: paste this ENTIRE file into the Supabase SQL editor and click RUN. It is ONE
-- atomic statement (a WITH-chain): it applies completely and auto-commits, or errors and
-- changes NOTHING. Guards are CTEs computing 1/(1-LEAST(1,<bad>)) — = 1 when the bad count
-- is 0, else "division by zero" aborting the whole statement.
--
-- On SUCCESS the single result row shows:
--   g_dummy=1 g_real=1 g_disjoint=1 g_noref=1 g_preflight=1
--   clean_email_updated=1
--   conn_reassigned=70 conn_deleted=9 msgs_reassigned=10 companies_ported=<0..9>
--   alumni_deleted=180 users_deleted=180
--   users_still_dummy=193 alumni_still_dummy=193   (pre-write snapshot minus deletes)
-- Any ERROR => nothing changed. Refresh the precheck, regenerate, re-run.
--
-- 180 placeholders merged+deleted; 70 conn reassigned, 9 deleted;
-- 10 messages reassigned; + 1 clean email update (muskaan.nj.bhatt@gmail.com).
-- ============================================================================
WITH
_merge (placeholder_id, real_id, port_company) AS (VALUES
    ('012c2a8e-fcea-4e97-9234-66b826d5df6b', '1acc78d1-d433-47a2-ab39-4c684409878f', NULL),
    ('02034ddc-ef08-4d52-baf8-d9eae9aaf5a5', '799b7c6e-8de3-4afe-8eea-b76b6a436063', NULL),
    ('021387ea-ed34-475d-9615-c40a5fe2d87b', 'deda01d2-1520-49ef-b39b-1abc90eed666', NULL),
    ('03ee1eed-7fd2-4c0a-aff4-caeaa1532109', '001a6317-bdf4-4117-b0aa-e94063b4ef7d', NULL),
    ('04a19bb3-ce97-465f-bc08-824f2113de72', '2cade44c-0cf6-4851-8b75-ba6b5bb2a837', NULL),
    ('05aeda05-3c43-4cc7-8c80-e095020ca1d2', 'd88486cb-1e2f-49f7-8c47-21b988f6a63e', NULL),
    ('0e90715c-81d8-450d-877d-960d37d02ccf', 'b7d83176-8af3-4ba8-98fa-1872ac687f14', NULL),
    ('110868a1-3ef4-484a-b62c-41281df49a2c', 'ab7de3b3-5b02-47d9-a160-a3f980dc2903', NULL),
    ('12536395-677f-4f06-bba7-be4a191a7232', '64329037-ba2d-43b6-9565-093f1c3e669a', NULL),
    ('134eb7a3-94c3-44bf-80b0-67fcead704ad', '5ee3cb27-b297-4489-9fce-d654541205d9', NULL),
    ('13b394ba-5d4d-45eb-858f-69431b93d523', '5db07719-97ec-46d4-b1bc-749aa128fb7a', 'Taris Technologies'),
    ('14ce49b7-f24d-48bd-8429-4fffce9800c6', 'af146e8b-99a5-4e07-ad66-ee94e5dd5bd1', NULL),
    ('159a28b9-ece2-487d-b7eb-70c0ecd1123c', '842cb11d-f5b2-4992-8ebd-fc84ae1eac3d', NULL),
    ('16f3d152-777c-465f-af14-e88fc607e207', 'f47fc868-0ba2-4f41-9b41-abe995c6df78', NULL),
    ('17238bd4-1781-4dc1-bbf5-b21fc774e7f4', '5121689e-11e3-4693-96e7-6b50429ebb5a', 'Ernst & Young Global Limited (EY)'),
    ('17c90648-a1f7-495c-8fe5-dd965947e1ab', '0e56c97a-845b-4ea1-b87c-f2238e024306', NULL),
    ('18bd7f1d-4a6b-4dca-9aff-c43a818e56e6', '3f9e8b21-aa83-4746-b5d2-d4d76ad5360c', NULL),
    ('1ca90582-63e0-4427-897f-bdab0ec5d0d0', '9aeb2f82-6487-4ab7-b18d-06a4b5015b86', NULL),
    ('1fd18322-d634-4e93-88a9-007f9db1f168', '14cd7d2a-8399-4863-b5d8-80b62fcc90f7', NULL),
    ('213fde4b-90cf-4e31-a613-649124e20cb0', '64f2175b-6045-48a0-9dbc-d5385db1aa1b', 'Citi India'),
    ('218901a3-def6-4984-924a-db70cec1c22f', '76dd2095-1237-4d51-b1dd-c79274a2e3a6', NULL),
    ('249a4f5c-7c75-4de2-8a20-c78e0e63bf29', '450aa6ae-2d64-4a65-a5f8-b2adb93775c7', NULL),
    ('2563343b-7560-449c-a66d-483be33dd4da', '735d2599-680e-43ec-851d-8bae94539a30', NULL),
    ('25b29376-d27c-4676-a1f0-f9277a77436c', '6fc99b1c-5718-4355-9aeb-63147acc55f5', NULL),
    ('26df6ee6-3382-416b-9d0b-201922044016', '0b8baa8f-3159-4c0c-9495-91e97b4bcbda', NULL),
    ('2791634b-4b92-4f0d-bd4b-c08847d97a28', '69754c80-c623-4573-b691-428f14ffcfbd', NULL),
    ('28877379-0ef2-436b-8eb8-e32a1e2fa895', '7cb3d4ef-b8af-4ab8-9f7e-f4ef4b93bbdf', NULL),
    ('28d7f5fb-b20a-4bab-9e89-d5e5c294ecb7', 'de7518cd-0adf-4c77-95d3-99c2b12285d7', NULL),
    ('291c1a09-ac1c-43f1-b8fe-519d2bca584f', '405ec351-2f7c-4f89-8f4b-892b42bca544', NULL),
    ('2985805f-0c16-4b11-a13d-8e85d44a4571', 'beda2088-afa4-412e-884b-e263fb677a1a', NULL),
    ('298c4948-21f0-4073-bc3d-25f290e817ee', '776bc3a7-a1f5-48a1-a1c0-1c41523daf42', NULL),
    ('2ab96b68-f583-408e-83a0-498d5329904a', '1de1948b-0809-4fbc-bf26-a953b258b824', NULL),
    ('2c9844db-3158-40c1-a7b7-1a102ab8e1ab', '3236ad24-46e6-475c-bb9b-5e1db91c616b', NULL),
    ('2ca7eb32-13d4-49db-a788-1b2f912f0204', '17e46f3b-a0f5-4ebc-aa9a-88c35f1b6687', NULL),
    ('2cb5f2e8-f057-4be3-819b-63605e9407a6', 'c2e3180e-8805-4e91-ba1e-89ad9e515196', NULL),
    ('2dfa8dd5-0f4c-44a1-9f46-014ca195fc9e', 'e6884cc9-0822-4e02-a86c-98459fd19ab6', NULL),
    ('2f10bb79-0f8b-4991-8a79-b1dce5aa1f5b', '1de6c44e-1941-4302-b2ec-1bd706ad7778', NULL),
    ('2f78eb40-cf0f-449c-b4b0-fd35ceb6bcc8', '8e2af79a-c275-4b87-a30b-d1d07ef3251f', NULL),
    ('30cca345-6efa-4e6f-9989-9cdcd41ef838', '2bafc269-55a6-4f12-a426-5b250d74493d', NULL),
    ('31735406-0dd5-4834-9b7a-90366a8c2180', '6aca0784-8eff-455f-8018-b9eddfbd3abc', NULL),
    ('36caccaa-886d-493c-b84d-22716a1e22ed', 'bff07947-39df-416b-84b1-f172ce449b52', NULL),
    ('3aead26a-2a5c-4b7d-843c-1c66a041edc5', 'b5e26669-6e0a-4e87-9ca1-2d8b7d464f86', NULL),
    ('3c5dbad1-ec83-4868-9630-e6a6828e9adf', 'e377d629-5102-4335-9dc7-60f60783d2a4', NULL),
    ('3e58f02e-87ef-4caa-b67c-b8dc63a733a3', 'cd3372dd-55be-4951-b6b1-664661974b7d', NULL),
    ('45e17c67-08a5-4138-ac6b-9a6e1c587986', '09d9bba1-fb23-4504-aaaf-c70bd90a258e', NULL),
    ('476b86c5-280d-4366-a54d-38a3fc6213d0', '2cfdeb5b-8055-46ef-9445-1e405879b7eb', NULL),
    ('477d9f23-8b18-465c-b2ea-75b0c5450c51', '391f5363-5254-4e80-b558-d4f6fbfb9741', NULL),
    ('48b7d58d-c4ba-4ab0-b071-d59272078f23', '64f2af40-f0f9-4952-b97e-2d2105d2e7bc', NULL),
    ('48c35940-ff03-443a-85d7-6e0fd6378bbe', 'd8637447-046b-42de-8872-ee05e42fdd37', NULL),
    ('4993364a-fd0b-4af3-9530-4cb9e15b7651', '80dfaa53-d2fd-4ed2-bf2a-5f5dcc491e97', NULL),
    ('499a1928-2b53-488f-a026-848689e32ae5', '36c7affc-6fc2-4606-83b1-f66c7fb16638', NULL),
    ('4b30beaa-b983-4118-9d37-4d7e3b4fc1a8', '220670b9-ed05-445c-b807-2866a11e04a7', NULL),
    ('50734a91-90e3-4f5c-85b1-242b692e1388', '1d6e0b1e-2829-4ab1-b706-12cf7ca787a4', NULL),
    ('52ba38d8-4c24-4d76-b95a-3612deb77ca6', '9866e3b2-f8f9-452a-aac6-7093a886a9dc', NULL),
    ('57c0a579-9124-41f4-94e5-8ce7be3026f5', '34762901-aec6-42d8-95e9-1500da594eb6', NULL),
    ('58e8c4b4-efba-48d7-bdd0-e9e14700ec1c', 'ed3312af-787c-4f41-b2b5-68555fa0d374', NULL),
    ('5b85c622-792f-4f82-a1ec-542cbca26dff', '714011bb-b3e0-4672-8aab-57b7124480ae', NULL),
    ('5cce5bd8-2ec4-4ce2-b737-1b05e91c6e92', 'ffa2f872-5808-4de5-b449-183114e7b4cf', NULL),
    ('5d32cf4d-bbd6-4a96-88d8-e50f24b69c3b', 'e5dcd5d0-70ea-42ae-b60d-8dfd97af9d46', NULL),
    ('5d9b6c6c-fd7c-4e40-b267-fe1fa2fba236', '7a77cd8e-589c-499c-a8e9-0bb7ba26728c', NULL),
    ('5f4faab1-52fe-4c23-a089-d1e06fc0068c', '196be892-b261-412f-a23c-3fbbee8de098', NULL),
    ('5faf9fe7-f0b5-480a-9368-36f608e5ea2d', '18290ebb-78c7-48f9-b6db-9cca581771cd', NULL),
    ('609a8dcf-7e23-42e1-aa63-9ea3c70bfca7', '124587ca-a057-43ce-91f7-0cdf13909786', NULL),
    ('637f661d-03b7-4fd3-b767-c16baac77d42', '5a928004-7374-44d6-85a4-1ceb40d170fb', NULL),
    ('64459894-d0f4-455a-8977-c4acdf1af4ce', 'f8ac6309-f816-4892-b2ba-ea6cffbc28f8', NULL),
    ('6547bb6c-624e-46da-aec4-6309dc1d6d1c', '52c725a4-ab95-463e-9040-35ab562bc3b1', NULL),
    ('665868eb-dec7-4478-9a5b-28a37e1cf31a', '6f66859e-f675-41c2-9cf7-f3c48e2d1f91', NULL),
    ('689e86b3-efdf-4112-b1a3-3329d7a6488a', '04b77246-3f09-421c-86f2-7497a9658e4a', NULL),
    ('6a358ab2-d072-4121-aefa-4cf909ec971f', '03dbb200-a3f8-4895-a43a-71a589d67170', NULL),
    ('6a5dc3d6-bcdb-4551-86e1-3bccf6bbb931', 'f84269b4-4f30-4285-8359-1a39c5ca6372', NULL),
    ('6b89d2fc-cece-481c-8dd3-ae5f7cf4e26b', '15c1b3c2-71b8-43a4-a528-6d92c041b286', NULL),
    ('6c813547-6a51-4f31-805b-524d6b2137d4', '5b5f0c75-10dd-4aec-8252-c8807d22b268', NULL),
    ('6d402152-e356-4f3c-8dfb-2f280fe11d5f', '74db6385-070c-4f13-9e40-c4aaa8558c3b', NULL),
    ('6db74487-7000-4152-bcb5-88ab3c560998', 'c46fa9bd-1b8b-491b-be44-f8ae7455dd9f', NULL),
    ('6e12dba2-dc38-4a47-af60-523a1089c584', 'f9e7df6c-11d1-450d-a108-d6150656077c', NULL),
    ('6eb2c32b-48e4-49f5-a5d7-335bac5801df', 'd4edb68b-8e3b-4bd2-a1f3-acbc7290438e', NULL),
    ('6ebf7ee9-edb3-428f-b7d5-b8a57cbbd430', '08f3a813-3208-4f3a-9afb-e37342f04150', 'Deloitte Touche Tohmatsu India, LLP'),
    ('6ee0d90c-01c2-4577-8df5-8e8d80e51a63', '127c871b-9a23-40e6-8fd3-89b06447ddf7', NULL),
    ('6f539224-2254-48e9-919f-05a71d510cf8', '62568117-9a4e-42a6-8b24-b0746781ca7e', NULL),
    ('6f6525fb-69a9-4df5-992b-fefa70b9199d', '806664a6-f971-43c6-8055-0e15164f27af', NULL),
    ('6fb775fa-f98c-42f4-ba81-c9a6ce2da083', 'd15b680d-b1c4-4f4d-95d4-75f8f47816d4', NULL),
    ('707c21db-c9ae-4e29-b5de-b5dd1012ed3e', '8eee88a7-405b-42ee-a918-c6cd7e755edd', NULL),
    ('70ed1711-8221-43c5-aa79-d1f927614e7c', 'ddaff0e3-e1b8-4fdf-a0f4-082a2ac06486', NULL),
    ('71650543-a7b8-4ba3-9fd3-345b7e22a78a', 'a8b4a439-19fe-4874-9ba8-15c6f221e2e2', NULL),
    ('727c87a5-442b-4296-908d-4da998031de3', '12b460ae-495d-4277-a6c3-106d410c3ee8', NULL),
    ('72be4fdc-610d-473a-adf8-55544524dfe4', '97149ca2-ab7d-4ed5-8813-e58b94140946', NULL),
    ('7377de41-96cd-4fc5-b100-6b2dd76cfedd', '97309caa-c432-4fa3-ab3c-eac5e5b184bb', 'Major League Baseball'),
    ('7474fa07-ce50-4dc7-8754-c1df7c94f418', '84bff29a-43e0-4505-8a98-43a5431cd79b', NULL),
    ('76649c24-9b18-4784-b63e-3e5441ee5ba7', 'c3ac57a6-7a2e-41bd-aef7-992548710a1a', NULL),
    ('76f01042-f643-4b76-9984-f23da12879a9', '098d12c4-9aff-4314-8d4a-82b68bcc2ea1', NULL),
    ('77244d98-cffb-467d-a5b4-9ceccad135b8', 'c5b9d039-787e-46d0-a455-5627dce858e6', NULL),
    ('79c5404b-4eac-4b88-b84c-df5affabd4fc', '8d951bb6-6dc0-49cc-819c-2d28a7475155', 'Gaurav Gupta Couture'),
    ('7cb06d38-6ae2-443e-8bcb-b6f4c206e8ce', '5265d3dc-d8ca-4784-8c40-65a79e6f5536', NULL),
    ('7d5999ac-e2ef-4921-82cb-a869e0f7dab0', '14fb4d24-8868-4553-951b-ab9efabd3aec', NULL),
    ('7d97a301-d72e-4f1e-96c1-cb6abe9168ff', '5e7048f5-11d8-405d-97a2-799b61769cf1', NULL),
    ('7d9a7cdb-15d3-4c05-86fb-13a17bfa7106', '0210913e-6788-48ca-bc58-49bf0ce0351b', NULL),
    ('7d9c88ec-12bf-4b57-8599-e4795334b532', '6f8849cb-445f-4a39-adc9-7c815637fdde', NULL),
    ('7e3a9e2d-ea67-4f90-97f8-a7e83cad247d', '73e2e58e-a549-496e-b9c4-7f155cc7f8e8', NULL),
    ('7f38a6a9-9713-44ad-aef4-d4acbf6e36bb', 'bf40efd0-b24d-4053-9862-632d0cdad917', NULL),
    ('7ff5e2ff-ba66-45a7-b3b2-ecd3caa81ee8', 'dd401dff-4328-4590-b584-4bd4cb36ca56', 'Deloitte Touche Tohmatsu India, LLP'),
    ('819e7112-3743-4297-ab6f-4b70efa3dda2', 'ab152423-e620-4a78-b59d-f1001ed1ab0b', NULL),
    ('83ba5263-a8ca-45d7-ac83-15999b9a265f', 'a6026170-dcf1-4362-94c4-ad96e283cebb', NULL),
    ('8603af77-106c-4c9c-bc47-35b0a3073f0d', 'c24a884a-5b21-4bb4-ac5e-8f5d3b676329', NULL),
    ('8b214042-95d4-4377-be10-4124ee263a3b', '77e9cbb8-696d-4ce6-9eed-dbc9408c12a2', NULL),
    ('8c134d45-3986-42e7-87ca-d4bdb13dc850', '2692b8f5-1eb2-47e2-a5d6-e8ece478c486', NULL),
    ('8db147be-1f54-4bea-a9fe-481f9b55d75e', '462c0c84-f25c-48aa-b1aa-feb89109eed9', NULL),
    ('8e51c905-314e-4b02-949d-3224a5e8b4eb', '366ef4a7-6b85-4e08-b193-ca54b4867c15', NULL),
    ('90a2ead5-c203-4d81-b26b-62df1089f884', 'c7f1d6ec-5270-4509-98f3-23322c156792', NULL),
    ('91023fea-50a9-451b-972a-176d57bfe005', '443d2fef-b882-4afc-ba5f-af01f30a8bff', NULL),
    ('964bcf76-4d64-400a-82e7-c29882685267', 'b8ea45ca-9ce3-44ba-99dc-fd4c6367eb63', NULL),
    ('983a75e2-4b7f-4067-a0f4-96830362b3f3', '64c8b062-19ad-4e79-afc2-a36949341700', NULL),
    ('996c403b-f652-43b6-8751-34dbf5388b45', 'ecb87ace-4154-4a7f-af80-702362b838dc', NULL),
    ('9cd2ab52-71d3-41c7-8ba3-c2ce31fb2833', '3b9c41c8-af09-475e-8aa9-75c642e534a5', NULL),
    ('9d695368-247b-4e75-b47d-dae98058586a', '4c87fd66-09f4-4ca5-ba80-a6f2f9a70a0f', NULL),
    ('9dc1392b-9471-4502-ae8a-da274c485781', '1512124f-51e4-47ce-90c1-31a9e71c6f3b', NULL),
    ('9e67f5db-b1e2-401b-bd50-cdd43ff7aa7d', '029e2856-0ee1-4291-9afb-7c5e4fe8135f', NULL),
    ('9f61a0eb-da03-434b-9315-70e6a5a1b109', 'd4fd87e5-d04a-48fe-80de-a41884c8ded8', 'Notebit'),
    ('9fbeb34d-37a2-4890-9fe5-ce8530844fd8', 'af2f312d-ad4e-4da4-97fa-0144f1111436', NULL),
    ('a152315c-e475-4508-9027-ef9749bc879d', 'e86976a1-b827-4e44-9095-d240ef203fc9', NULL),
    ('a2075cb3-0603-46a3-b266-9710a5a1e40c', '96ac4221-6a6c-47f2-964e-7de9d82e2211', NULL),
    ('a28b6db5-167b-43f6-8f0d-9b1c5df1b5e2', 'af265e14-a635-4af6-bd9f-9fce1bae7cdf', NULL),
    ('a35b1a2c-f524-4f6c-b477-474cf622ff20', 'c03bad8e-ca33-4c56-a99b-23c4c591e367', NULL),
    ('a5289544-ec3c-4cfc-b327-5de186423c82', '37e8fac8-77c1-42ad-ae39-070fbb671a53', NULL),
    ('a5c65cd5-41b3-4067-b2df-5e3aa560c783', '089221fd-3134-4bb3-94db-a1dd28c32329', NULL),
    ('a8663473-f7c2-4220-8099-c8fc8da5b964', '29eb37a5-50ec-4ae8-beef-9290cacf5a6e', NULL),
    ('a87d396d-a615-4b6a-a735-43d9ca278216', '697273e2-2dc8-4343-8b1c-2b8202f088e1', NULL),
    ('a8a2ef1c-6184-43c8-a0c8-4f8303c26933', '539aa27f-bb08-437e-ab43-72c7ef4aae8e', NULL),
    ('ab25a3eb-1c33-4e38-a69f-0477e40b1976', '5e3ecb9b-40fa-4e64-b70a-a06b983d4be6', NULL),
    ('addc312c-afe2-443f-b6cd-1baaab3f5b11', 'aa573369-7197-4d87-bc3e-4cc5e3ce949d', NULL),
    ('b3260cdd-4cd6-45e6-98f2-33898626822f', 'eabb3af0-39a7-45ca-8f15-949235ad8ebb', NULL),
    ('b431329b-ab9e-497a-9baf-c70fb2c4fedc', 'c0712551-a379-4e89-8b17-04ff7346252b', NULL),
    ('b481b3a1-f623-44a0-b16c-f54e333225f0', '1baef160-d8f5-4931-b755-e96e0ac56133', 'Change Healthcare'),
    ('b66929d4-4acb-4738-ac48-ec4ed4a2d4b7', '9cb35c1d-dfe0-4ff5-b564-7139d0e03101', NULL),
    ('b724727f-3555-4e4b-812f-22d5ecee944b', '67e14c21-cb0e-4c59-82eb-0a1658c4e04f', NULL),
    ('b84cee04-1667-404f-b62f-e357aa579cff', 'a8d8ce9d-2fad-4ecb-8a5e-7f5eb46fc639', NULL),
    ('b9b8c40d-a1db-412e-a3f0-b5e9ab553a2b', 'a8c0b69f-184a-47ad-8d7b-cca82862284b', NULL),
    ('beacc078-05e9-40d6-b82c-a2a4f1c90f35', '2720258d-b8b9-44a2-baef-faddc66c7f0a', NULL),
    ('c23ad6fe-3e73-4d8a-81ac-8b16aad55de0', '25d48759-b1d5-4883-b6f5-355e676cff1b', NULL),
    ('c2caab1e-b9ff-4aac-ab97-9739329484d8', '4f3f2ccf-b2a9-4c04-9c2a-565e86f66028', NULL),
    ('c38e6323-7ac2-4b7e-8a7a-0bd5eb756c31', '1cee9fc8-65a1-4049-8eb0-7c443a31f3d9', NULL),
    ('c4308859-4581-4e10-9f04-224943391b4c', 'eec052da-0438-4679-baac-47e41b62585e', NULL),
    ('c54e047c-f3ed-4155-a3ff-8cfa1b41de50', 'ba3412dc-9e95-4000-a7a5-a3e62cdbbac3', NULL),
    ('c557f609-5937-459e-9c01-f99f26053d22', 'a4918667-5885-49cd-9924-1bdc5a34188b', NULL),
    ('c5e66ef9-c828-4bc6-89a8-0f5ded188148', 'a4a32e47-4583-4419-9eb0-675a53901c99', NULL),
    ('c8b0d9d5-5907-4a87-ac37-eacc2d0e3bc6', '0d3b7f32-7c7b-42aa-8145-542c0de44201', NULL),
    ('c8f0a52a-e6be-40e3-beea-625183981763', '944e4ffa-a30a-4aea-9168-aae69b64affe', NULL),
    ('cb202054-243a-47e0-9776-1559df6ec78d', 'b06f4785-93af-4809-8040-dd50a5b248bf', NULL),
    ('cb918fd2-71b0-44ef-b0d0-ba2badd00cfc', 'da63a156-4475-48ee-a7d7-ee1c69135e53', NULL),
    ('cc0a05ef-b6c2-4920-bdc0-ccc2366cc5e1', 'efde1265-07c4-4a6c-9d54-3a1cc4e3787f', NULL),
    ('cfe44d22-26b7-4321-b364-027dd33e25b4', 'eae1867a-5400-4bb1-836b-492f9b10d002', NULL),
    ('d275cbfb-b2fa-487f-a2d9-57595daf349c', 'cf1332c2-1310-4f93-9e4f-a58c7016e6e4', NULL),
    ('d3cbc3cd-8f52-4410-9289-40cac3cc1b40', '82c7cd01-6360-44fc-b38a-2efd69ca44d6', NULL),
    ('d4c52539-1f69-4ba3-9ec0-f8e571856d2f', 'd846c801-4d77-4ab8-8c8d-5ff3ced21166', NULL),
    ('d6a2ff80-0430-46b3-aefc-50ac32c826e4', 'cfaeb292-b852-414d-8cbb-12ffc0acbc30', NULL),
    ('d74fcd33-a7e2-41d8-b204-10b65ef4b0e6', '814b09ee-157e-400b-9cdf-c323529b48e5', NULL),
    ('d7a0a884-b630-4bda-9e09-a5c938e57d81', '4cfc4bda-572a-4edb-a953-f729b7faba1c', NULL),
    ('d8f27444-63e3-4d74-b36f-15229d126b9a', '74bd41b9-6e7b-4e6d-8a65-ad17da366aa8', NULL),
    ('da89604f-05ba-4447-a706-cf37348f3eea', '99789a69-bc76-4c7c-b797-e4e9f1c4df9d', NULL),
    ('dad80648-bdbd-4272-b45a-1a77b8b11e04', 'd85d3b59-817a-42f5-ba5b-ae9c23361fec', NULL),
    ('dd7a6bbc-5be9-4e21-8299-3c7fa94a3d84', '5affc5f3-08ea-49be-ad14-f9c9d45cd6b3', NULL),
    ('de632d2e-3e7c-4a0c-b3ba-2eb5318565b3', '0a9979ed-9f47-4db9-8e69-7f0a4d1225d2', NULL),
    ('e002acbc-b8ff-4448-aebc-d31895f71711', '9ba1406e-a243-4a79-9555-16a0b3019192', NULL),
    ('e1b67a0f-c317-4e6a-b3f1-a959b3ad4812', '81d7cc3b-f308-4faa-a43d-b2f209cecacb', NULL),
    ('e1ecf459-88d7-4a56-b1b4-ecee8ec1ddca', '09777520-5ef2-4434-ab6e-93e3f5d30de4', NULL),
    ('e68192f3-6e06-45a5-a03a-571449939a79', 'dce9fd7e-3135-410f-9df4-0a65f9df5cc5', NULL),
    ('e6e4398c-953e-48b9-ae52-cdc79a5eddad', '8fb927d8-bb4e-4380-bda0-b6294c228ef8', NULL),
    ('e706f6d3-6ccc-4e33-ad41-69cb57d2b323', 'd9bd1b35-aa4b-4642-ad2f-0767f101c8c8', NULL),
    ('e8e4fd6d-792a-4d25-a225-0526bf3bdd2b', '5dd8122b-240c-4534-a24d-a197fb637d56', NULL),
    ('e95be261-13d8-43f1-b80f-6b1462ac74ac', 'b06d9932-0a99-45f0-aec8-481375125200', NULL),
    ('e9e84c5c-ae76-40bb-8cc9-860044663ff0', '26642094-c4ad-4234-9779-0f725278d808', NULL),
    ('ec38f7ae-fc88-4d03-ad36-a2c408645220', '01f70df7-47fa-428f-b00d-41025a6b49ce', NULL),
    ('f0207bd5-7123-4740-85de-a6553e667b3b', '27a0f6ae-fa92-4e82-a9d3-1b542653bac2', NULL),
    ('f42a512f-eaa0-49e2-95fd-8e3aad54b9d3', 'b9a8d7aa-b033-43ec-ada5-d4a6041e5270', NULL),
    ('f4af6a23-bf5f-4b8f-810a-23835b73c65f', '657ba017-19df-4d70-9386-6dddd88aa6e8', NULL),
    ('f7981ef8-0a94-440d-9a8e-98fed9855b92', '36573a8c-0e24-4383-9c78-e812f136fbd6', NULL),
    ('f7dac785-fe4f-4604-ae73-d2de0e74c8ec', 'c6c0f7f3-6f6f-41c6-9ec8-dd997039b156', NULL),
    ('fafb558c-5ca1-42e3-81e7-8568d83d48a4', '0a354d81-0639-4c72-9709-5bf7756b358d', NULL),
    ('fd0a2829-d999-4d8f-9ac5-74eedde1e571', '7f46ac0c-1a40-4416-9116-9f1d3413d996', NULL),
    ('fd22ea5e-2a43-4247-94a7-dc9999069d11', '733f0a43-b0bd-4b82-adcd-32970ae5e6b5', NULL),
    ('fdc65266-5f95-4cef-b221-75839cbbcf65', 'c6d35f6a-e499-46f8-b02d-359e1aefc465', NULL)
),
_conn_reassign (req_id) AS (VALUES
    ('8cc79436-000d-4992-9838-d38dbffdda9c'),
    ('e2f22473-254a-4ea1-be14-2ea96468dde5'),
    ('173c8199-c4bf-4119-b864-61beb7358ee0'),
    ('d4882eaf-c8bf-4b9e-bd43-bd5c86cfa053'),
    ('bc805a00-485b-49a4-baeb-1f620a290f35'),
    ('6e75e946-5838-49a9-af00-a23025c5124e'),
    ('237e9c26-6559-43f9-b028-c8084ba3edd8'),
    ('0c1ea4fa-1f52-49c7-8ca4-df146d69654c'),
    ('56ab1a46-6a15-4b99-a7d6-1ed0187ea39c'),
    ('9741927e-866b-4ea2-b5e9-7d9d30bf3291'),
    ('bc15d4d7-fb27-4088-9616-6bb94c6cd437'),
    ('4ff954d9-ac5a-40c9-b097-65526de28910'),
    ('26fa1834-97c8-4b8f-a83c-079ac5e3d284'),
    ('1615846b-f776-434d-9e9b-5e962135e5b6'),
    ('fdea459e-ed88-43c3-a77c-2d7b99593eaf'),
    ('a65a4cd9-b022-4874-9736-ad99ab3feceb'),
    ('7303f211-9f9e-4280-b919-6fa3ca9ca124'),
    ('fd729bc6-0bb6-486f-9202-d6cef3e1f7cd'),
    ('a1e32115-d3ed-43e9-818b-f1dbfa545a2e'),
    ('f47751ed-25fe-47f0-bc62-42c8bc7b1ea4'),
    ('dd3a8640-090b-442d-ac36-cd6d5a429de3'),
    ('8409977f-353c-454b-b74f-ae31e550dbf3'),
    ('c44a84e3-f9b5-4a59-9bf2-faab3583a2c6'),
    ('985a456a-c94e-44b7-97b6-a4c2b5cc48dd'),
    ('c6233085-f016-4181-9805-bef88fad165f'),
    ('e46731e4-dd36-4be4-be59-b0badc8a9bed'),
    ('7935350a-db0d-47e7-8b98-ceee6ada596e'),
    ('a1145cc8-ebce-4d55-b845-c3375714ae75'),
    ('62507a4f-5ad9-447e-9964-a244e9177008'),
    ('d3e8c7ca-eea3-4b05-94e8-64da9e45a6fc'),
    ('0e919eb1-49a1-4914-91f2-b380658786bc'),
    ('120d2648-59e9-4fb2-9913-0a560bb54ab8'),
    ('cb5717c2-9478-4154-a463-6f62c32f68fa'),
    ('2e5a2f84-516c-4145-bac8-035f5a0d668c'),
    ('ed8e29da-05f9-4efb-931b-386b2209f1ca'),
    ('e4b687b8-7711-441e-a6b3-e67205b1173c'),
    ('8317690c-8047-47e9-bcda-bc64fcbba9d5'),
    ('28a1f918-3b36-42f6-a543-b2872cf56e4e'),
    ('bb7e487d-5f56-4843-93da-7c1a4f46bb56'),
    ('fc1f4478-e1a6-4afe-8a46-3a7dff1aaf3a'),
    ('0254b92b-f268-4508-b650-a4b613f10597'),
    ('142ef057-e6a4-4228-9287-a905c295782b'),
    ('5b5c2026-a552-4189-bf44-3c03c477c649'),
    ('adef8505-1064-4657-94d4-adc01c3b3abf'),
    ('dc78ec2b-84d4-4c36-a748-9069d67711a3'),
    ('fad26afb-24b9-4477-a7f2-b7232fad582f'),
    ('d5c9e219-3d7c-4f05-b912-4255bc27bda5'),
    ('c9c79318-2069-4281-bc88-d299f0533118'),
    ('b9878ba2-a662-40c8-bc97-fd5f329d19c7'),
    ('c392a79e-2b87-4a5d-9c98-ce9c417b0cf0'),
    ('a5748dd1-daa6-4fb8-baf8-f00419437760'),
    ('b3870c94-8a4a-4998-8fc1-ceaa6076a64d'),
    ('2fd0195b-b209-4443-baee-b3478e4c7901'),
    ('a3d23214-4c25-4953-b977-1051f5e366a0'),
    ('fe03e9cb-546e-4976-baac-ebf54edf8361'),
    ('9315c081-d5c0-4782-881b-eda256211080'),
    ('16fa3d54-5b5d-4db6-8f19-05eb51970a59'),
    ('c20df02d-fe32-496f-a165-77f1c8438db9'),
    ('021d9f34-cfaa-438e-a61a-d89b76a5e968'),
    ('756517d0-06e5-4f88-9af9-f73703bfdfa5'),
    ('252d18fb-3fc1-4515-b8be-7ef3c35d52fe'),
    ('8dbae6fb-b87e-4f71-9252-5be296dc3ad3'),
    ('ba601daa-480b-484f-8a6d-9468ec9e19cc'),
    ('e22e096d-68fa-472b-8d98-fb36a230289f'),
    ('eeca2a6b-300a-4b0c-b497-137b66a3ae4a'),
    ('aa89a505-2b51-4929-b2df-8733cd854cdf'),
    ('9b41a056-dcff-49c0-9c23-c6bd2bceeb76'),
    ('717ff653-7c52-4d7f-8f00-c8eda4979c74'),
    ('f68f3171-f55f-4f5f-8f40-9ad11beb2dd2'),
    ('97167836-4425-413e-93da-fd4694e9d4d1')
),
_conn_delete (req_id) AS (VALUES
    ('35632688-4367-4431-9a72-c14251358a28'),
    ('119910e6-d889-4d63-a4d9-ac5a5c01721d'),
    ('4ecfcabb-fef7-4162-bdd3-6e191143c18a'),
    ('2b384c8e-15c0-4012-91d1-127fea9bfe9c'),
    ('2bf02960-c75e-4520-993e-ad81852b5420'),
    ('4ac60487-6e6c-44fe-a66d-f63b5db2a9bd'),
    ('6944df07-637a-408e-a30c-308c65439863'),
    ('4bdc9e4a-a42f-451c-99aa-b5a21b12811c'),
    ('9be9069f-77af-4a28-96be-1097ac809755')
),
_msg_reassign (msg_id) AS (VALUES
    ('a0fc18c3-2d7e-473a-90c5-9a16933469e7'),
    ('e4819841-aefc-499e-87c5-c77ddb63b90a'),
    ('0f9f537c-2256-40d1-bedd-1297f4a0945e'),
    ('8b33a68d-21e7-4b44-b365-982200a5ec1e'),
    ('9a597502-d9b2-4baa-97dd-969d97c0fff5'),
    ('8f4ad480-aac9-4c2c-9225-cdeaf2101f11'),
    ('49583e39-0dff-4f02-b701-e0009078b8a4'),
    ('901fd7e5-66d2-4bf6-a944-e1b7604089e1'),
    ('06d24234-b035-477a-9098-415b8013945a'),
    ('fc4873d6-6b88-454b-bdfb-e3607826a801')
),

-- ---- guards ----
g_dummy AS (            -- every placeholder still on a dummy email
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _merge m JOIN users u ON u.id = m.placeholder_id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_real AS (             -- every real_id exists, not blocked, itself not a placeholder
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _merge m LEFT JOIN users u ON u.id = m.real_id
   WHERE u.id IS NULL OR u.account_blocked
      OR u.email LIKE '%placeholder%' OR u.email LIKE '%@student.tks.com'
),
g_disjoint AS (         -- no connection_request id in both reassign and delete
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _conn_reassign r JOIN _conn_delete d ON r.req_id = d.req_id
),
g_preflight AS (        -- no blocking child row for the deletes, EXCLUDING connection_requests
                        -- and messages (handled below)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT placeholder_id FROM _merge))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT placeholder_id FROM _merge) OR blocked_id IN (SELECT placeholder_id FROM _merge))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT placeholder_id FROM _merge))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT placeholder_id FROM _merge))
     )))::int AS ok
),

-- ---- writes ----
clean_upd AS (          -- the 1 row that was mis-bucketed as a dup (email only on alumni table)
  UPDATE users SET email = 'muskaan.nj.bhatt@gmail.com', updated_at = now()
   WHERE id = 'e35e6888-855b-4c00-b7c8-34c55ef4dfdb'
     AND (email LIKE '%placeholder%' OR email LIKE '%@student.tks.com')
  RETURNING 1
),
conn_re_recipient AS (
  UPDATE connection_requests c SET recipient_id = m.real_id, updated_at = now()
    FROM _merge m
   WHERE c.recipient_id = m.placeholder_id
     AND c.id IN (SELECT req_id FROM _conn_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_re_requester AS (  -- defensive: precheck saw placeholders only as recipient, cover both
  UPDATE connection_requests c SET requester_id = m.real_id, updated_at = now()
    FROM _merge m
   WHERE c.requester_id = m.placeholder_id
     AND c.id IN (SELECT req_id FROM _conn_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_del AS (
  DELETE FROM connection_requests
   WHERE id IN (SELECT req_id FROM _conn_delete)
     AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
msg_re_receiver AS (
  UPDATE messages msg SET receiver_id = m.real_id
    FROM _merge m
   WHERE msg.receiver_id = m.placeholder_id
     AND msg.id IN (SELECT msg_id FROM _msg_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
  RETURNING 1
),
msg_re_sender AS (
  UPDATE messages msg SET sender_id = m.real_id
    FROM _merge m
   WHERE msg.sender_id = m.placeholder_id
     AND msg.id IN (SELECT msg_id FROM _msg_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
  RETURNING 1
),
company_port AS (
  UPDATE alumni a SET current_company = m.port_company, updated_at = now()
    FROM _merge m
   WHERE a.user_id = m.real_id
     AND m.port_company IS NOT NULL
     AND (a.current_company IS NULL OR lower(btrim(a.current_company)) IN ('', 'no', 'none', 'n/a', 'na', '-', 'yes'))
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
  RETURNING 1
),
-- g_noref: is there ANY connection_request / message that references a placeholder but is NOT
-- in our reassign/delete lists? (i.e. something we're not handling → abort). Snapshot-time check.
g_noref AS (
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM connection_requests
         WHERE (requester_id IN (SELECT placeholder_id FROM _merge) OR recipient_id IN (SELECT placeholder_id FROM _merge))
           AND id NOT IN (SELECT req_id FROM _conn_reassign)
           AND id NOT IN (SELECT req_id FROM _conn_delete))
     + (SELECT count(*) FROM messages
         WHERE (sender_id IN (SELECT placeholder_id FROM _merge) OR receiver_id IN (SELECT placeholder_id FROM _merge))
           AND id NOT IN (SELECT msg_id FROM _msg_reassign))
     )))::int AS ok
),
del_alumni AS (
  DELETE FROM alumni
   WHERE user_id IN (SELECT placeholder_id FROM _merge)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
     AND (SELECT ok FROM g_preflight) = 1 AND (SELECT ok FROM g_noref) = 1
     AND (SELECT count(*) FROM conn_del) >= 0        -- force conn_del + reassigns to run first
     AND (SELECT count(*) FROM conn_re_recipient) >= 0
     AND (SELECT count(*) FROM msg_re_receiver) >= 0
     AND (SELECT count(*) FROM company_port) >= 0
  RETURNING 1
),
del_users AS (
  DELETE FROM users
   WHERE id IN (SELECT placeholder_id FROM _merge)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
     AND (SELECT ok FROM g_preflight) = 1 AND (SELECT ok FROM g_noref) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0     -- force del_alumni first
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_dummy)                    AS g_dummy,
  (SELECT ok FROM g_real)                     AS g_real,
  (SELECT ok FROM g_disjoint)                 AS g_disjoint,
  (SELECT ok FROM g_noref)                    AS g_noref,
  (SELECT ok FROM g_preflight)                AS g_preflight,
  (SELECT count(*) FROM clean_upd)            AS clean_email_updated,
  (SELECT count(*) FROM conn_re_recipient)
    + (SELECT count(*) FROM conn_re_requester) AS conn_reassigned,
  (SELECT count(*) FROM conn_del)             AS conn_deleted,
  (SELECT count(*) FROM msg_re_receiver)
    + (SELECT count(*) FROM msg_re_sender)     AS msgs_reassigned,
  (SELECT count(*) FROM company_port)         AS companies_ported,
  (SELECT count(*) FROM del_alumni)           AS alumni_deleted,
  (SELECT count(*) FROM del_users)            AS users_deleted,
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- pre-write snapshot
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy;  -- run _verify.sql after to confirm 193
