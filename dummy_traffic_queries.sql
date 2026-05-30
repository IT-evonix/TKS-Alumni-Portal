-- SQL Queries to insert 30 dummy alumni users to test heat map traffic

DO $$
DECLARE
    -- Array of UUIDs to use for both users and alumni tables
    user_id_1 UUID := gen_random_uuid(); user_id_2 UUID := gen_random_uuid(); user_id_3 UUID := gen_random_uuid();
    user_id_4 UUID := gen_random_uuid(); user_id_5 UUID := gen_random_uuid(); user_id_6 UUID := gen_random_uuid();
    user_id_7 UUID := gen_random_uuid(); user_id_8 UUID := gen_random_uuid(); user_id_9 UUID := gen_random_uuid();
    user_id_10 UUID := gen_random_uuid(); user_id_11 UUID := gen_random_uuid(); user_id_12 UUID := gen_random_uuid();
    user_id_13 UUID := gen_random_uuid(); user_id_14 UUID := gen_random_uuid(); user_id_15 UUID := gen_random_uuid();
    user_id_16 UUID := gen_random_uuid(); user_id_17 UUID := gen_random_uuid(); user_id_18 UUID := gen_random_uuid();
    user_id_19 UUID := gen_random_uuid(); user_id_20 UUID := gen_random_uuid(); user_id_21 UUID := gen_random_uuid();
    user_id_22 UUID := gen_random_uuid(); user_id_23 UUID := gen_random_uuid(); user_id_24 UUID := gen_random_uuid();
    user_id_25 UUID := gen_random_uuid(); user_id_26 UUID := gen_random_uuid(); user_id_27 UUID := gen_random_uuid();
    user_id_28 UUID := gen_random_uuid(); user_id_29 UUID := gen_random_uuid(); user_id_30 UUID := gen_random_uuid();
    
    dummy_pass TEXT := 'Testing@123';
BEGIN

    -- 1. Insert into USERS table
    INSERT INTO users (id, username, password, email, user_role) VALUES
    (user_id_1, 'dummy_user_1', dummy_pass, 'dummy1@tks.edu', 'alumni'),
    (user_id_2, 'dummy_user_2', dummy_pass, 'dummy2@tks.edu', 'alumni'),
    (user_id_3, 'dummy_user_3', dummy_pass, 'dummy3@tks.edu', 'alumni'),
    (user_id_4, 'dummy_user_4', dummy_pass, 'dummy4@tks.edu', 'alumni'),
    (user_id_5, 'dummy_user_5', dummy_pass, 'dummy5@tks.edu', 'alumni'),
    (user_id_6, 'dummy_user_6', dummy_pass, 'dummy6@tks.edu', 'alumni'),
    (user_id_7, 'dummy_user_7', dummy_pass, 'dummy7@tks.edu', 'alumni'),
    (user_id_8, 'dummy_user_8', dummy_pass, 'dummy8@tks.edu', 'alumni'),
    (user_id_9, 'dummy_user_9', dummy_pass, 'dummy9@tks.edu', 'alumni'),
    (user_id_10, 'dummy_user_10', dummy_pass, 'dummy10@tks.edu', 'alumni'),
    (user_id_11, 'dummy_user_11', dummy_pass, 'dummy11@tks.edu', 'alumni'),
    (user_id_12, 'dummy_user_12', dummy_pass, 'dummy12@tks.edu', 'alumni'),
    (user_id_13, 'dummy_user_13', dummy_pass, 'dummy13@tks.edu', 'alumni'),
    (user_id_14, 'dummy_user_14', dummy_pass, 'dummy14@tks.edu', 'alumni'),
    (user_id_15, 'dummy_user_15', dummy_pass, 'dummy15@tks.edu', 'alumni'),
    (user_id_16, 'dummy_user_16', dummy_pass, 'dummy16@tks.edu', 'alumni'),
    (user_id_17, 'dummy_user_17', dummy_pass, 'dummy17@tks.edu', 'alumni'),
    (user_id_18, 'dummy_user_18', dummy_pass, 'dummy18@tks.edu', 'alumni'),
    (user_id_19, 'dummy_user_19', dummy_pass, 'dummy19@tks.edu', 'alumni'),
    (user_id_20, 'dummy_user_20', dummy_pass, 'dummy20@tks.edu', 'alumni'),
    (user_id_21, 'dummy_user_21', dummy_pass, 'dummy21@tks.edu', 'alumni'),
    (user_id_22, 'dummy_user_22', dummy_pass, 'dummy22@tks.edu', 'alumni'),
    (user_id_23, 'dummy_user_23', dummy_pass, 'dummy23@tks.edu', 'alumni'),
    (user_id_24, 'dummy_user_24', dummy_pass, 'dummy24@tks.edu', 'alumni'),
    (user_id_25, 'dummy_user_25', dummy_pass, 'dummy25@tks.edu', 'alumni'),
    (user_id_26, 'dummy_user_26', dummy_pass, 'dummy26@tks.edu', 'alumni'),
    (user_id_27, 'dummy_user_27', dummy_pass, 'dummy27@tks.edu', 'alumni'),
    (user_id_28, 'dummy_user_28', dummy_pass, 'dummy28@tks.edu', 'alumni'),
    (user_id_29, 'dummy_user_29', dummy_pass, 'dummy29@tks.edu', 'alumni'),
    (user_id_30, 'dummy_user_30', dummy_pass, 'dummy30@tks.edu', 'alumni');

    -- 2. Insert into ALUMNI table
    INSERT INTO alumni (user_id, first_name, last_name, email, current_city, current_state, current_country, latitude, longitude, location_label) VALUES
    (user_id_1, 'Alex', 'Johnson', 'dummy1@tks.edu', 'New York', 'New York', 'USA', 40.7128, -74.0060, 'New York, USA'),
    (user_id_2, 'Sarah', 'Smith', 'dummy2@tks.edu', 'London', 'England', 'UK', 51.5074, -0.1278, 'London, England, UK'),
    (user_id_3, 'David', 'Brown', 'dummy3@tks.edu', 'Sydney', 'New South Wales', 'Australia', -33.8688, 151.2093, 'Sydney, Australia'),
    (user_id_4, 'Aisha', 'Khan', 'dummy4@tks.edu', 'Dubai', 'Dubai', 'UAE', 25.2048, 55.2708, 'Dubai, UAE'),
    (user_id_5, 'Michael', 'Lee', 'dummy5@tks.edu', 'Toronto', 'Ontario', 'Canada', 43.6532, -79.3832, 'Toronto, Ontario, Canada'),
    (user_id_6, 'Wei', 'Chen', 'dummy6@tks.edu', 'Singapore', 'Singapore', 'Singapore', 1.3521, 103.8198, 'Singapore'),
    (user_id_7, 'Lukas', 'Müller', 'dummy7@tks.edu', 'Berlin', 'Berlin', 'Germany', 52.5200, 13.4050, 'Berlin, Germany'),
    (user_id_8, 'Emma', 'Garcia', 'dummy8@tks.edu', 'Paris', 'Ile-de-France', 'France', 48.8566, 2.3522, 'Paris, France'),
    (user_id_9, 'Kenji', 'Sato', 'dummy9@tks.edu', 'Tokyo', 'Tokyo', 'Japan', 35.6762, 139.6503, 'Tokyo, Japan'),
    (user_id_10, 'Rahul', 'Sharma', 'dummy10@tks.edu', 'Mumbai', 'Maharashtra', 'India', 19.0760, 72.8777, 'Mumbai, Maharashtra, India'),
    
    (user_id_11, 'Priya', 'Patel', 'dummy11@tks.edu', 'Pune', 'Maharashtra', 'India', 18.5204, 73.8567, 'Pune, Maharashtra, India'),
    (user_id_12, 'Karthik', 'Rao', 'dummy12@tks.edu', 'Bangalore', 'Karnataka', 'India', 12.9716, 77.5946, 'Bangalore, Karnataka, India'),
    (user_id_13, 'Neha', 'Reddy', 'dummy13@tks.edu', 'Hyderabad', 'Telangana', 'India', 17.3850, 78.4867, 'Hyderabad, Telangana, India'),
    (user_id_14, 'Amit', 'Singh', 'dummy14@tks.edu', 'Delhi', 'Delhi', 'India', 28.7041, 77.1025, 'Delhi, India'),
    (user_id_15, 'Divya', 'Iyer', 'dummy15@tks.edu', 'Chennai', 'Tamil Nadu', 'India', 13.0827, 80.2707, 'Chennai, Tamil Nadu, India'),
    
    (user_id_16, 'James', 'Wilson', 'dummy16@tks.edu', 'San Francisco', 'California', 'USA', 37.7749, -122.4194, 'San Francisco, California, USA'),
    (user_id_17, 'Maria', 'Martinez', 'dummy17@tks.edu', 'Los Angeles', 'California', 'USA', 34.0522, -118.2437, 'Los Angeles, California, USA'),
    (user_id_18, 'Robert', 'Taylor', 'dummy18@tks.edu', 'Chicago', 'Illinois', 'USA', 41.8781, -87.6298, 'Chicago, Illinois, USA'),
    (user_id_19, 'Olivia', 'Thomas', 'dummy19@tks.edu', 'Melbourne', 'Victoria', 'Australia', -37.8136, 144.9631, 'Melbourne, Victoria, Australia'),
    (user_id_20, 'Liam', 'White', 'dummy20@tks.edu', 'Auckland', 'Auckland', 'New Zealand', -36.8485, 174.7633, 'Auckland, New Zealand'),
    
    (user_id_21, 'Sipho', 'Mbeki', 'dummy21@tks.edu', 'Cape Town', 'Western Cape', 'South Africa', -33.9249, 18.4241, 'Cape Town, South Africa'),
    (user_id_22, 'Carlos', 'Silva', 'dummy22@tks.edu', 'Rio de Janeiro', 'Rio de Janeiro', 'Brazil', -22.9068, -43.1729, 'Rio de Janeiro, Brazil'),
    (user_id_23, 'Sven', 'Jansen', 'dummy23@tks.edu', 'Amsterdam', 'North Holland', 'Netherlands', 52.3676, 4.9041, 'Amsterdam, Netherlands'),
    (user_id_24, 'Anna', 'Lindström', 'dummy24@tks.edu', 'Stockholm', 'Stockholm', 'Sweden', 59.3293, 18.0686, 'Stockholm, Sweden'),
    (user_id_25, 'Min-jun', 'Kim', 'dummy25@tks.edu', 'Seoul', 'Seoul', 'South Korea', 37.5665, 126.9780, 'Seoul, South Korea'),
    
    (user_id_26, 'Jing', 'Wang', 'dummy26@tks.edu', 'Beijing', 'Beijing', 'China', 39.9042, 116.4074, 'Beijing, China'),
    (user_id_27, 'Ivan', 'Ivanov', 'dummy27@tks.edu', 'Moscow', 'Moscow', 'Russia', 55.7558, 37.6173, 'Moscow, Russia'),
    (user_id_28, 'Ali', 'Yilmaz', 'dummy28@tks.edu', 'Istanbul', 'Istanbul', 'Turkey', 41.0082, 28.9784, 'Istanbul, Turkey'),
    (user_id_29, 'Fatima', 'Ahmed', 'dummy29@tks.edu', 'Cairo', 'Cairo', 'Egypt', 30.0444, 31.2357, 'Cairo, Egypt'),
    (user_id_30, 'John', 'Odinga', 'dummy30@tks.edu', 'Nairobi', 'Nairobi', 'Kenya', -1.2921, 36.8219, 'Nairobi, Kenya');

END $$;
