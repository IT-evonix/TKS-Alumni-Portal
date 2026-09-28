-- ============================================================================
-- Round-2 dedupe merge   |   TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)
-- Generated 2026-09-04 by scripts/dedupe-193-merge.ts from scripts/out/dedupe-193-precheck.json
--
-- ONE atomic statement (WITH-chain). Applies fully and auto-commits, or errors and changes
-- nothing. Guards compute 1/(1-LEAST(1,<bad>)) -> 1 when clean, else division-by-zero.
--
-- 137 placeholder accounts deleted (59 pattern-A groups: real self-registered
-- account already holds the email -> just delete the placeholders; 18 pattern-B groups: no real
-- account -> keep one placeholder and apply the email to it).
-- Child rows first: 16 connection_requests + 3 messages reassigned to the
-- target account, 1 connection_request deleted (would duplicate/self-connect).
--
-- On SUCCESS the result row: g_drops_dummy=1 g_targets_ok=1 g_email_free=1 g_disjoint=1 g_preflight=1
--   conn_reassigned=16 conn_deleted=1 msgs_reassigned=3
--   emails_applied_users=18 emails_applied_alumni=18
--   alumni_deleted=137 users_deleted=137
-- Then run dedupe_193_merge_2026-09-04_verify.sql -> expect still-dummy 38.
-- ============================================================================
WITH
_drop (id, target) AS (VALUES
    ('e41a9902-3a81-415b-8b5c-0341123ac6d7', '452ef24d-0f82-4ab5-8ff8-20c2e962e447'),
    ('b1743564-9f0e-4414-b27c-1f2750148861', '452ef24d-0f82-4ab5-8ff8-20c2e962e447'),
    ('d6450897-d475-44f9-938c-028676e80a1f', '2a099b20-7788-4cfb-a104-d577f7c25ff3'),
    ('c63352c0-9b04-4368-b74f-24f17243c00c', '2a099b20-7788-4cfb-a104-d577f7c25ff3'),
    ('55ecf0d4-257e-4293-be22-8453425716db', '57134e64-1fae-4469-909f-31338333877e'),
    ('42e4cee1-da2a-4e82-8832-9232f5fdc541', '57134e64-1fae-4469-909f-31338333877e'),
    ('d9784f72-a989-4b69-b753-99a41ddfc44c', '57134e64-1fae-4469-909f-31338333877e'),
    ('70335401-a5b4-47f8-9e81-92c3e04857d7', '3b31cc15-9274-4f72-b2f5-30e7d62ae15f'),
    ('e147227f-61bd-4050-b288-6ed7bfba3c66', '3b31cc15-9274-4f72-b2f5-30e7d62ae15f'),
    ('735c5a99-2a5b-400f-9e2f-3daa938378c5', '076dabdd-d997-4f96-aa06-02bbd5d95af2'),
    ('43bc01ce-2434-4054-9140-25bcff1d4c1c', '076dabdd-d997-4f96-aa06-02bbd5d95af2'),
    ('5aa3317e-6a7e-41d7-b31d-07b5cbbcc3af', '4a60f60f-a144-42d7-bde9-d2e179adc319'),
    ('bad22886-f908-4a4e-81e4-90fd4db1f8c8', '4a60f60f-a144-42d7-bde9-d2e179adc319'),
    ('22f94d3e-06a7-41a9-b1c2-e94f871240ca', 'a142e49b-f036-494c-af52-ef83dc406ae5'),
    ('2f240d0d-f82b-4eb0-b631-f07349fc163e', '7f4ac8c5-c741-4ea0-99d9-1a17af8e068b'),
    ('159f187b-7904-48cc-9490-d28f3b4a8690', '7f4ac8c5-c741-4ea0-99d9-1a17af8e068b'),
    ('3e408746-1c73-487d-9934-de33922faa9e', 'd722131b-d281-47c5-9fe9-0fd586a6bc5d'),
    ('c1d7dd21-44f1-41d5-8ece-126aab273938', 'd722131b-d281-47c5-9fe9-0fd586a6bc5d'),
    ('586c2618-a715-4cff-b3db-af1fdc3e0067', '45692c43-b336-4157-95f5-b9d577f3671b'),
    ('7886da6c-7901-4c8b-bcf3-66c4b9a74b76', '870aaba0-dc96-4300-8f45-34db0bd2435d'),
    ('1a75b130-d766-43a9-9689-dca70382ac33', '870aaba0-dc96-4300-8f45-34db0bd2435d'),
    ('b7df821f-b7b3-4bf8-8181-0fa83a43e8b0', '78081f92-713d-4c96-b65d-70edeb4c62d1'),
    ('f0698d66-341f-48b1-be2f-80f19beb6f5d', '78081f92-713d-4c96-b65d-70edeb4c62d1'),
    ('b1c0e92a-880f-4e30-a32b-fef765ef9bce', 'e429df9e-ff79-441c-b37a-1b02a837767a'),
    ('fb73e641-28ae-4939-be18-f6220c9abdd0', 'e429df9e-ff79-441c-b37a-1b02a837767a'),
    ('a50f621a-8451-48e3-a15c-73c96f1db8d1', '2706d64a-6536-45d1-b2f5-a3befa1306bc'),
    ('49dc42ad-a472-48b4-b8c2-11d468a81d5a', '04bc23bc-6348-41c2-8c74-0730870e8407'),
    ('cbebfd94-810b-4802-8aea-faa4edae390e', '04bc23bc-6348-41c2-8c74-0730870e8407'),
    ('55af2547-fc6b-4e48-b2e0-8b513739491d', 'b68d7d76-3220-4109-a0c6-aba2d850b2b8'),
    ('e871fb7f-9689-4522-8721-4a362582b43e', 'b68d7d76-3220-4109-a0c6-aba2d850b2b8'),
    ('7fc52aaf-8157-4c3b-9f9f-ed6add94893d', '65bd3203-1f3a-458c-bee9-4326ffd13b99'),
    ('caa5c6b9-bd00-4c6c-a041-bf25cb8f4017', '118752a9-5392-4ccc-a3f1-a8dc31169216'),
    ('8c4c4418-1e6a-4853-bf21-be27e2ab3cbc', '720798f4-bc5f-417c-97bb-abbc87170a5f'),
    ('d57a6906-0a62-405e-8cef-a2cb37126e94', '720798f4-bc5f-417c-97bb-abbc87170a5f'),
    ('01116405-af09-4dab-9d42-2291a29c0e44', '648ae1a3-e5a0-48ac-b157-262a25879a64'),
    ('a582294b-cc40-489e-997e-3da93e795413', '648ae1a3-e5a0-48ac-b157-262a25879a64'),
    ('31c41a41-c067-4b16-9e49-70bfdd024de7', '93a991b5-5fd2-4fc6-8a58-6c2af0b02f22'),
    ('cbceb13f-2d73-4cd7-b1fb-8d5ac31e6db0', '920861fa-f19d-4809-b588-44df9d144037'),
    ('6495d2ac-7342-4c6f-877c-946512e5c290', '920861fa-f19d-4809-b588-44df9d144037'),
    ('4f079ed0-28a8-411c-a292-042387ee3bbb', 'b3537012-3954-41d0-9855-15f97e825457'),
    ('273e9f53-8ef7-4ac5-ac1c-ced695260a12', 'b3537012-3954-41d0-9855-15f97e825457'),
    ('29bfd878-3285-4e51-86dc-c2413ba3ec00', 'da8e9e89-c043-4b01-89e9-b1e638da4b27'),
    ('d1d97291-ce81-4afb-a078-595b3818c366', 'da8e9e89-c043-4b01-89e9-b1e638da4b27'),
    ('db9ed163-68d8-4876-ab1c-e24fce1e1971', '5dab63b4-34de-4aee-a665-ee625776919f'),
    ('3e301388-7eb4-456d-84ec-977897ed4129', '5dab63b4-34de-4aee-a665-ee625776919f'),
    ('2624a72e-be3e-47b9-b205-642af8f02dab', 'b8d25c8e-86f2-4e47-84b6-3dcb0d9a2be6'),
    ('da20b52b-f737-4130-82da-f8855fa39765', 'b8d25c8e-86f2-4e47-84b6-3dcb0d9a2be6'),
    ('73d4525e-5193-45c1-83d7-313f1f2e19d0', '12e8a9f0-24e4-4360-bac5-c8ef0de6074f'),
    ('8f2554a8-9deb-4725-b373-124bf1465270', '12e8a9f0-24e4-4360-bac5-c8ef0de6074f'),
    ('f130cb01-3e1d-47ca-b756-f52237e0d284', '756c3696-5a0a-4be2-a5d0-5c25c765fc52'),
    ('bd2cf54c-1b0a-4d23-9bfb-fdeaa30eb173', '756c3696-5a0a-4be2-a5d0-5c25c765fc52'),
    ('f9de0abf-a5c5-4e22-bb60-d961fe314cf2', 'cc1692a1-bf01-40e0-9e70-525b6d9726dc'),
    ('4a6ce319-91a4-4fc3-9b8b-9285197edf16', '624ac0ed-2a06-496d-b37f-402f57370116'),
    ('91d35f90-4136-467d-a5a4-d11850149dd0', '624ac0ed-2a06-496d-b37f-402f57370116'),
    ('8c12527c-f05c-4a9f-820b-598844adb90c', '09d17c13-943b-4feb-883a-32b28fa8688c'),
    ('410004aa-b1bb-4896-bc43-d38615149bc2', '09d17c13-943b-4feb-883a-32b28fa8688c'),
    ('0313575d-2e11-4d48-bb33-09338c862a74', '091bfbc4-cec7-4c46-8674-02a447016078'),
    ('7044d623-9bce-44a1-96a0-9f23c26242a2', '558f3eb9-05cf-42ca-8b10-d44e6deaf60e'),
    ('1f0145fe-6ef5-4fff-b4b0-4e883e4d4c31', '558f3eb9-05cf-42ca-8b10-d44e6deaf60e'),
    ('1505e826-11aa-4226-8ac2-c05bd509ed1b', 'b6fbe264-bf6b-4d6f-a9c0-cb4422e8a913'),
    ('f8c148c0-14f3-4521-9c57-fdfd5248ee65', 'b6fbe264-bf6b-4d6f-a9c0-cb4422e8a913'),
    ('0a0a455e-bbe3-48d1-a66c-09f0152d7e7e', '19ad7242-f4e3-4bad-9493-3e850a90458c'),
    ('cc1bdc0f-0826-4de8-845d-8e246f1b96a4', '19ad7242-f4e3-4bad-9493-3e850a90458c'),
    ('a7b1ddfa-4017-4bc1-b1c0-943ff3d73158', '7c5d16c6-877f-41f4-9128-26688f90fa05'),
    ('dfb903a4-2ed3-4e93-b5a7-eac27c1515e2', '7c5d16c6-877f-41f4-9128-26688f90fa05'),
    ('1b641db4-3c75-4457-9c17-acafb2e90622', 'd935aed1-3a37-48f4-94d2-2a1b87ccdcd0'),
    ('bc4c1b22-7047-48e9-968b-8678ca926919', 'd935aed1-3a37-48f4-94d2-2a1b87ccdcd0'),
    ('a5751ae2-fda5-4473-8999-8fdb63a4639f', '876d35df-a335-4fc7-9c08-a5aa635fad1f'),
    ('bb4386cb-fc2d-4198-b7da-d0e9f8fb4676', '876d35df-a335-4fc7-9c08-a5aa635fad1f'),
    ('51c5a2c4-4c11-41c7-b2c0-59842483c6cc', '65b2644f-5e0f-4c5d-9e6a-18f6729fa51f'),
    ('50bd0017-e1b8-4a83-80ad-356fc9869e22', '44c4c17f-6f36-474a-8fa7-f567054d6f32'),
    ('12d53a7f-f9c3-46e0-bb5c-ebb8db6403b6', '4971fef6-49b1-4fb6-9202-768664ca7bc0'),
    ('19671e91-d7b9-416a-a389-1a72798a9c83', 'c7c07b5f-ce9d-498e-9655-363e34e8b328'),
    ('e2f74343-6cce-4af1-be96-600cbad3db61', 'c7c07b5f-ce9d-498e-9655-363e34e8b328'),
    ('689cb322-cea7-4eb9-a462-83eb0b891bbf', 'e458b86e-bac1-42a2-971d-1b86898d60c6'),
    ('bd10bbd3-c136-486f-84cc-937cab9a0b8c', 'e458b86e-bac1-42a2-971d-1b86898d60c6'),
    ('10e7f199-f85b-4269-b15e-630918ff6f11', '53c7db2b-747c-44df-b863-6bc44ab6ff66'),
    ('8ec6f11e-e4ed-4760-a694-3b6f6843a690', '53c7db2b-747c-44df-b863-6bc44ab6ff66'),
    ('865106d0-7b36-4440-809b-fa0456d166de', 'b1aa14bf-9a7a-4a4e-bb03-fb0ca3e772dd'),
    ('d9d0f098-1372-4faa-a8b4-743255cfd202', 'b1aa14bf-9a7a-4a4e-bb03-fb0ca3e772dd'),
    ('661a0036-7fa6-4fd7-9584-7cb9ed000cd8', 'b8add8ef-64dd-44d9-96ed-8118e51e50ae'),
    ('f2ee554d-98b5-4d78-981f-122d74442f0b', 'b8add8ef-64dd-44d9-96ed-8118e51e50ae'),
    ('d0ea604f-17c7-4ef7-a756-cf9d3922a469', '2dbcdd3c-9233-41aa-9741-350fc9456a21'),
    ('784ba575-b546-44ac-9ade-c93daf78727c', '45a8bf3e-2603-42ed-98e6-276bc0cb9c73'),
    ('173ae362-3c20-4b0c-8625-25ea00079f9e', '45a8bf3e-2603-42ed-98e6-276bc0cb9c73'),
    ('e8510ad7-7838-4abb-bd7b-256a587b37b8', '071dd176-1992-42dd-8b32-d936e3b1e039'),
    ('53062f3d-fd7d-412a-bff1-b1609738e9d5', '071dd176-1992-42dd-8b32-d936e3b1e039'),
    ('e0b07af9-7ac0-4b49-b960-279aa05bccd7', '9ac87f29-fcbc-4200-a861-41101d698fdb'),
    ('75e030fa-7d99-40a7-8ded-9c6e572a01ea', '9ac87f29-fcbc-4200-a861-41101d698fdb'),
    ('fa1b7e32-d798-4524-872a-11c8b1275e11', 'bec84d71-2fcd-4931-8c3c-0b90931c5a08'),
    ('5f04a23c-7653-46c6-9a24-8a13c717ae57', 'bec84d71-2fcd-4931-8c3c-0b90931c5a08'),
    ('219e1d49-8dc3-4f14-8ae6-5f2c9b466602', '1a37357b-3a54-4869-aad4-bf1e77989bf0'),
    ('77351073-db34-468a-b573-3dd4911350f4', 'aa567219-207f-444f-82d1-6a0222e780c5'),
    ('702718de-c94e-4e32-be53-a334ad1d16f1', 'aa567219-207f-444f-82d1-6a0222e780c5'),
    ('2fd970a6-fccc-427b-9e38-e736462b546b', '730de9b7-72c8-427b-87b0-4da87a8c3132'),
    ('59a75fa8-3e2c-422b-afd8-b0d9787b2a5f', '730de9b7-72c8-427b-87b0-4da87a8c3132'),
    ('6ae6b8dc-b0b0-424b-a182-bb2f5ae21f8b', '0aa0e557-19d1-4e9d-8882-586332b5f647'),
    ('e5cd96d1-3751-403d-b677-f280712a94aa', '0aa0e557-19d1-4e9d-8882-586332b5f647'),
    ('0705e0c5-3932-4ddb-be12-57635690d72f', '89d9ce40-f09c-423a-a1c5-9f734e7f11e4'),
    ('c77a2bf0-4b6b-41af-bf13-a5d41f755efc', '89d9ce40-f09c-423a-a1c5-9f734e7f11e4'),
    ('63eb882a-01ba-4e33-a71e-eac57a3ea13c', 'edf4981f-9687-416c-9b8b-5fb466d0b36b'),
    ('395821da-8074-4058-9ab8-7b80f5ef5e2a', 'edf4981f-9687-416c-9b8b-5fb466d0b36b'),
    ('d9cf282c-18a7-4d6f-b249-0279a43c2622', '33a7aba1-1cee-492f-b5dc-3a9f0bb9ed12'),
    ('2c4e0984-af92-42f2-8d98-6d98489b4157', '0b8ea718-1d7b-4822-a565-1fba5e6e8810'),
    ('0061d872-261a-4eef-b155-cade423a1a50', '0b8ea718-1d7b-4822-a565-1fba5e6e8810'),
    ('f12991b8-0cee-455a-ad8b-8299d9b3fb84', '0cb7fb09-5feb-439c-ba60-4361fddfdbe3'),
    ('72ba8f85-ba13-4996-9402-bf62a45fbd4f', '0cb7fb09-5feb-439c-ba60-4361fddfdbe3'),
    ('82519753-17bc-418f-9d3b-c1ba78da484a', '44d6c590-cfe9-49f6-8520-4ad27281fa5e'),
    ('63558e1b-0763-49af-a29a-6c74bbcc5f25', '44d6c590-cfe9-49f6-8520-4ad27281fa5e'),
    ('f6792a5b-6df0-46e9-97fa-105c41db41fa', '0452b47b-e268-4039-b1db-0baefce94fbd'),
    ('affb4b93-f588-43f8-a458-d5bddff53a0c', 'f76869ad-f8d0-4cd2-b8db-bc3adc249929'),
    ('3208c5cf-ec8a-4944-a281-f1dc71f1b830', 'f76869ad-f8d0-4cd2-b8db-bc3adc249929'),
    ('38cb1faf-3e70-4750-93e0-69bc18d580e5', 'c2bf0cba-9f66-4239-b76b-bbe2a9812b6b'),
    ('aab815d7-3e95-4f94-a7d8-2546d1e56719', 'c2bf0cba-9f66-4239-b76b-bbe2a9812b6b'),
    ('ab16dc22-3fac-49f2-a34f-f6c6f8e2ab2f', '33d58502-b98f-4130-b548-dd77112ac189'),
    ('90edaaa8-d289-4022-8f72-70c36f729ce0', '33d58502-b98f-4130-b548-dd77112ac189'),
    ('b4e520b1-7a8a-4be1-93d2-af13c480b978', 'bbe88acf-4b9e-481d-9717-5f72e3313a2d'),
    ('cc3db895-b8f6-4f35-ba06-4922d04e20f4', 'bbe88acf-4b9e-481d-9717-5f72e3313a2d'),
    ('6f7cce3b-59c6-4eb2-a10c-40b1d57adb3b', '7d26ff33-f781-4e93-82e0-9cf8f5c45a47'),
    ('f044f88c-0d9a-4bcc-b065-e88af1decbaf', '7d26ff33-f781-4e93-82e0-9cf8f5c45a47'),
    ('e82e6e2d-8af3-4d4b-b938-45a584720d3c', '127d3698-ea51-4b52-aff7-d747e798de63'),
    ('7de5bba0-bd24-4c1c-a962-fe162ea268c5', '127d3698-ea51-4b52-aff7-d747e798de63'),
    ('51dc32c6-ebdb-4ed2-848a-a9e8052b77c4', 'b67d39af-38e5-49a6-b09b-0500b4cb8627'),
    ('ab414ae2-75ec-4623-83d3-621a966550ad', '04e332d1-300e-43e9-9911-067fd968cced'),
    ('38f37c71-7eb2-42b3-8fd7-1435330010d4', '04e332d1-300e-43e9-9911-067fd968cced'),
    ('bde8230e-46c9-4342-8c9c-59065f44e738', '50544b0c-448b-4f55-801c-74148e5a1ba5'),
    ('8abec4af-7e05-456b-a14d-b2557c067376', '50544b0c-448b-4f55-801c-74148e5a1ba5'),
    ('703acd38-7cae-437f-a9b9-97fe52057182', '9558947d-060d-43d0-a85d-d6f6acc53fae'),
    ('88e6852e-ab3a-4801-a8bf-65947326b2a1', '9558947d-060d-43d0-a85d-d6f6acc53fae'),
    ('672d89ef-eb84-422f-b14e-fbe309bad8e7', '9d6f4a7e-57e2-4ff7-a55c-c3237c4361e9'),
    ('6faf2511-8dc2-4fed-ae02-7c052a84cbb5', '9d6f4a7e-57e2-4ff7-a55c-c3237c4361e9'),
    ('25685e39-da09-4824-809d-7244c2e082fd', '6d55b918-0db5-4c49-a5f1-1c6494a09bbb'),
    ('eda27df8-02e0-4967-8b47-d11d5ae2cff7', '6d55b918-0db5-4c49-a5f1-1c6494a09bbb'),
    ('1dd26700-c985-4e5f-a45b-fd44af513a34', '1ebc9733-53ad-4f2b-90b4-cf99e6d0061e'),
    ('cca20df0-32c5-4c06-b748-8fb33265bff4', '1ebc9733-53ad-4f2b-90b4-cf99e6d0061e'),
    ('5bdf43b2-ea4b-4df3-9d78-b426dbd520b2', '73051367-3d6b-431b-a752-5a6b37262add'),
    ('22b3ab39-e058-44b4-b567-edd9dc537424', 'c866045c-c13b-4dee-a7e1-79d2678f2899')
),
_email (user_id, new_email) AS (VALUES
    ('a142e49b-f036-494c-af52-ef83dc406ae5', 'sanskutigupta@gmail.com'),
    ('45692c43-b336-4157-95f5-b9d577f3671b', 'palashshringi@gmail.com'),
    ('2706d64a-6536-45d1-b2f5-a3befa1306bc', 'monasonu80@yahoo.com'),
    ('65bd3203-1f3a-458c-bee9-4326ffd13b99', 'kaavya.201@gmail.com'),
    ('118752a9-5392-4ccc-a3f1-a8dc31169216', 'raunkmalhotra4708@gmail.com'),
    ('93a991b5-5fd2-4fc6-8a58-6c2af0b02f22', 'pranjaliliu2@gmail.com'),
    ('cc1692a1-bf01-40e0-9e70-525b6d9726dc', 'anish25jan@gmail.com'),
    ('091bfbc4-cec7-4c46-8674-02a447016078', 'neeta6march@gmail.com'),
    ('65b2644f-5e0f-4c5d-9e6a-18f6729fa51f', '2329janvi@gmail.com'),
    ('44c4c17f-6f36-474a-8fa7-f567054d6f32', 'avanigujare@gmail.com'),
    ('4971fef6-49b1-4fb6-9202-768664ca7bc0', 'delzin.faridani@gmail.com'),
    ('2dbcdd3c-9233-41aa-9741-350fc9456a21', 'siddhib.0151@gmail.com'),
    ('1a37357b-3a54-4869-aad4-bf1e77989bf0', 'aarshi.vatsa673@gmail.com'),
    ('33a7aba1-1cee-492f-b5dc-3a9f0bb9ed12', 'bhatilokeshhh@gmail.com'),
    ('0452b47b-e268-4039-b1db-0baefce94fbd', 'devanshiran02@gmail.com'),
    ('b67d39af-38e5-49a6-b09b-0500b4cb8627', 'rahulsukhija2007@gmail.com'),
    ('73051367-3d6b-431b-a752-5a6b37262add', 'vidushichouksey.vc@gmail.com'),
    ('c866045c-c13b-4dee-a7e1-79d2678f2899', 'aaronn.13x@gmail.com')
),
_conn_reassign (id) AS (VALUES
    ('783c543b-e8af-486d-a7f1-36ee6c50fd77'),
    ('33970a10-0881-40cd-a398-225a8134be52'),
    ('477880c7-656a-41d4-9f8b-473c4afdd74d'),
    ('172f3c72-cdec-4f74-bae1-3fed0b8f53e0'),
    ('fff98fd9-f099-40bb-bc3b-e6a8a00faa27'),
    ('ee9985e9-dfb7-4b3b-a15f-98957472c4cc'),
    ('a5577504-33fc-4f78-a04f-0de4b4cf48af'),
    ('22fb52ec-8f20-4dc2-b0bc-cbed8b193415'),
    ('caf313c5-0a9d-411e-9bf7-91cdfe846bba'),
    ('1dd773ad-7d62-435e-9a35-f93551f150c8'),
    ('e7fb5e7c-1c73-485f-adb6-94a858bfacda'),
    ('4a6cc117-3891-4cf9-8379-9ec89cc91dec'),
    ('d09c5c39-a9e0-435a-9837-f653801d4178'),
    ('1a010fd4-08cf-4560-9a67-8fce2c5f3c17'),
    ('6e6b16a0-4d10-4c85-b27c-843f9609a803'),
    ('f2292189-1795-4148-8e8f-ada0f7227fe4')
),
_conn_delete (id) AS (VALUES
    ('92b930b4-282b-49ae-bc91-c41f16238c46')
),
_msg_reassign (id) AS (VALUES
    ('5b65957c-b7f2-4cea-a3c8-f29b400e3497'),
    ('874f5bac-8d9f-4538-a79d-2d5c7f69dad6'),
    ('290ec255-8da1-4746-8b8e-fb24eec94f4b')
),

-- ---- guards ----
g_drops_dummy AS (          -- every account to delete is currently on a dummy email
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _drop d JOIN users u ON u.id = d.id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_targets_ok AS (           -- every target account exists and is NOT itself being deleted
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM (SELECT DISTINCT target FROM _drop) t
    LEFT JOIN users u ON u.id = t.target
   WHERE u.id IS NULL OR u.account_blocked
      OR t.target IN (SELECT id FROM _drop)
),
g_email_free AS (           -- each pattern-B new email is free on users AND alumni (except its keeper)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM _email e JOIN users  u ON lower(u.email) = e.new_email AND u.id      <> e.user_id)
     + (SELECT count(*) FROM _email e JOIN alumni a ON lower(a.email) = e.new_email AND a.user_id <> e.user_id)
     )))::int AS ok
),
g_disjoint AS (             -- no connection_request id in both reassign and delete
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _conn_reassign r JOIN _conn_delete d ON r.id = d.id
),
g_preflight AS (            -- no blocking child row (no cascade) for the deletes, EXCLUDING
                            -- connection_requests / messages (handled below)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT id FROM _drop) OR blocked_id IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT id FROM _drop))
     )))::int AS ok
),

-- ---- writes ----
conn_re_req AS (
  UPDATE connection_requests c SET requester_id = d.target, updated_at = now()
    FROM _drop d
   WHERE c.requester_id = d.id AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_re_rec AS (
  UPDATE connection_requests c SET recipient_id = d.target, updated_at = now()
    FROM _drop d
   WHERE c.recipient_id = d.id AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_del AS (
  DELETE FROM connection_requests WHERE id IN (SELECT id FROM _conn_delete)
     AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
msg_re_snd AS (
  UPDATE messages m SET sender_id = d.target
    FROM _drop d
   WHERE m.sender_id = d.id AND m.id IN (SELECT id FROM _msg_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
  RETURNING 1
),
msg_re_rcv AS (
  UPDATE messages m SET receiver_id = d.target
    FROM _drop d
   WHERE m.receiver_id = d.id AND m.id IN (SELECT id FROM _msg_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
  RETURNING 1
),
email_users AS (
  UPDATE users u SET email = e.new_email, updated_at = now()
    FROM _email e
   WHERE u.id = e.user_id
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING 1
),
email_alumni AS (
  UPDATE alumni a SET email = e.new_email, updated_at = now()
    FROM _email e
   WHERE a.user_id = e.user_id
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING 1
),
del_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
     AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM conn_re_req) >= 0
     AND (SELECT count(*) FROM conn_del) >= 0
     AND (SELECT count(*) FROM msg_re_snd) >= 0
     AND (SELECT count(*) FROM email_alumni) >= 0
  RETURNING 1
),
del_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
     AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0
     AND (SELECT count(*) FROM email_users) >= 0
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_drops_dummy)   AS g_drops_dummy,
  (SELECT ok FROM g_targets_ok)    AS g_targets_ok,
  (SELECT ok FROM g_email_free)    AS g_email_free,
  (SELECT ok FROM g_disjoint)      AS g_disjoint,
  (SELECT ok FROM g_preflight)     AS g_preflight,
  (SELECT count(*) FROM conn_re_req) + (SELECT count(*) FROM conn_re_rec) AS conn_reassigned,
  (SELECT count(*) FROM conn_del)   AS conn_deleted,
  (SELECT count(*) FROM msg_re_snd) + (SELECT count(*) FROM msg_re_rcv)   AS msgs_reassigned,
  (SELECT count(*) FROM email_users)  AS emails_applied_users,
  (SELECT count(*) FROM email_alumni) AS emails_applied_alumni,
  (SELECT count(*) FROM del_alumni)   AS alumni_deleted,
  (SELECT count(*) FROM del_users)    AS users_deleted;
