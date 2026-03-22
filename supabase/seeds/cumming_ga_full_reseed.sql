-- ============================================================================
-- Full Reseed: Cumming, GA Demo Data
-- Replaces Tampa data with Cumming/Alpharetta/Roswell area accounts
-- Run in Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  org UUID;
  uid UUID;
  acc_id UUID;
  acc_ids RECORD;
  -- Account IDs for visit/task references
  id_roosters UUID;
  id_taco_mac UUID;
  id_cabernet UUID;
  id_total_wine UUID;
  id_greens UUID;
  id_variant UUID;
  id_gate_city UUID;
  id_iron UUID;
  id_margaritaville UUID;
  id_hilton UUID;
  id_qt UUID;
  id_southern UUID;
  id_butcher UUID;
  id_seed UUID;
  id_tabla UUID;
  id_vickery UUID;
  id_coal UUID;
  id_halcyon UUID;
BEGIN
  -- Tarun's org and user
  org := 'f7fdf374-a14a-493a-8bdb-d91c44186caf';
  uid := 'e3a22083-455a-4edc-b8fe-904f8245b899';

  IF org IS NULL OR uid IS NULL THEN
    RAISE EXCEPTION 'No organization or user found. Create an account first.';
  END IF;

  -- ========================================
  -- 1. CLEAN ALL EXISTING DATA
  -- ========================================
  DELETE FROM account_notes WHERE organization_id = org;
  DELETE FROM account_contacts WHERE organization_id = org;
  DELETE FROM insights WHERE organization_id = org;
  DELETE FROM tasks WHERE organization_id = org;
  DELETE FROM captures WHERE organization_id = org;
  DELETE FROM visits WHERE organization_id = org;
  DELETE FROM discovered_accounts WHERE organization_id = org;
  DELETE FROM accounts WHERE organization_id = org;

  RAISE NOTICE 'Cleaned all existing data for org %', org;

  -- ========================================
  -- 2. INSERT MANAGED ACCOUNTS (Cumming/Alpharetta/Roswell area)
  -- ========================================

  -- Bars
  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Roosters Drive In', '8890 Atlanta Hwy, Cumming, GA 30041', 'Bar', 'on_premise', 34.2312, -84.1198, '(770) 887-2300', 'Southern Glazer''s')
  RETURNING id INTO id_roosters;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Taco Mac Cumming', '410 Peachtree Pkwy, Cumming, GA 30041', 'Bar', 'on_premise', 34.2148, -84.1355, '(770) 887-8226', 'Republic National')
  RETURNING id INTO id_taco_mac;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Vickery Village Pub', '5655 Vickery Creek Rd, Cumming, GA 30040', 'Bar', 'on_premise', 34.2065, -84.1198, '(770) 555-0102', 'Southern Glazer''s')
  RETURNING id INTO id_vickery;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Coal Mountain Tap House', '6185 Coal Mountain Dr, Cumming, GA 30028', 'Bar', 'on_premise', 34.2274, -84.1302, '(770) 555-0101', 'Republic National')
  RETURNING id INTO id_coal;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Halcyon Social House', '6365 Halcyon Way, Alpharetta, GA 30005', 'Bar', 'on_premise', 34.0915, -84.2621, '(770) 555-0103', 'Southern Glazer''s')
  RETURNING id INTO id_halcyon;

  -- Restaurants
  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Cabernet Steakhouse', '5575 Windward Pkwy, Alpharetta, GA 30004', 'Restaurant', 'on_premise', 34.1021, -84.2387, '(770) 777-0606', 'Southern Glazer''s')
  RETURNING id INTO id_cabernet;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Butcher & Brew', '5851 Windward Pkwy, Alpharetta, GA 30005', 'Restaurant', 'on_premise', 34.1065, -84.2352, '(678) 691-3419', 'Republic National')
  RETURNING id INTO id_butcher;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Seed Kitchen & Bar', '1311 Johnson Ferry Rd, Marietta, GA 30068', 'Restaurant', 'on_premise', 33.9712, -84.4215, '(770) 509-4478', 'Southern Glazer''s')
  RETURNING id INTO id_seed;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Tabla Indian Restaurant', '2920 Peachtree Pkwy, Suwanee, GA 30024', 'Restaurant', 'on_premise', 34.0498, -84.0668, '(770) 831-1212', 'Republic National')
  RETURNING id INTO id_tabla;

  -- Liquor Stores
  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Total Wine Cumming', '2155 Market Place Blvd, Cumming, GA 30041', 'Liquor Store', 'off_premise', 34.2198, -84.1287, '(770) 292-8855', 'Southern Glazer''s')
  RETURNING id INTO id_total_wine;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Green''s Beverages Alpharetta', '3070 Windward Plaza, Alpharetta, GA 30005', 'Liquor Store', 'off_premise', 34.1032, -84.2401, '(770) 664-9463', 'Republic National')
  RETURNING id INTO id_greens;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Southern Spirits', '4600 Bethelview Rd, Cumming, GA 30040', 'Liquor Store', 'off_premise', 34.2185, -84.1478, '(770) 887-1123', 'Southern Glazer''s')
  RETURNING id INTO id_southern;

  -- Breweries
  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Variant Brewing', '280 N Main St, Roswell, GA 30075', 'Brewery', 'on_premise', 34.0238, -84.3615, '(678) 973-0008', 'Southern Glazer''s')
  RETURNING id INTO id_variant;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Gate City Brewing', '43 Magnolia St, Roswell, GA 30075', 'Brewery', 'on_premise', 34.0225, -84.3521, '(678) 309-7777', 'Republic National')
  RETURNING id INTO id_gate_city;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Ironmonger Brewing', '585 S Main St, Alpharetta, GA 30004', 'Brewery', 'on_premise', 34.0687, -84.2945, '(678) 691-2827', 'Southern Glazer''s')
  RETURNING id INTO id_iron;

  -- Hotels
  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Hotel Margaritaville Atlanta', '6345 Halcyon Way, Alpharetta, GA 30005', 'Hotel', 'on_premise', 34.0918, -84.2625, '(470) 443-1600', 'Southern Glazer''s')
  RETURNING id INTO id_margaritaville;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'Hilton Garden Inn Cumming', '870 Buford Hwy, Cumming, GA 30041', 'Hotel', 'on_premise', 34.2112, -84.1245, '(770) 888-8500', 'Republic National')
  RETURNING id INTO id_hilton;

  -- Convenience Store
  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, distributor_name)
  VALUES (org, uid, 'QuikTrip Cumming', '5865 Bethelview Rd, Cumming, GA 30040', 'Convenience Store', 'off_premise', 34.2215, -84.1498, '(770) 888-2200', 'Republic National')
  RETURNING id INTO id_qt;

  RAISE NOTICE 'Inserted 18 managed accounts';

  -- ========================================
  -- 3. INSERT CONTACTS
  -- ========================================
  INSERT INTO account_contacts (organization_id, account_id, name, role, phone, email) VALUES
  (org, id_roosters, 'Danny Mills', 'Owner', '(770) 887-2300', 'danny@roosters.com'),
  (org, id_taco_mac, 'Brad Simmons', 'General Manager', '(770) 887-8226', 'brad@tacomac.com'),
  (org, id_taco_mac, 'Ashley White', 'Bar Manager', '(770) 887-8227', 'ashley@tacomac.com'),
  (org, id_cabernet, 'Richard Huang', 'Head Sommelier', '(770) 777-0607', 'richard@cabernetsteakhouse.com'),
  (org, id_cabernet, 'Sophia Martinez', 'General Manager', '(770) 777-0606', 'sophia@cabernetsteakhouse.com'),
  (org, id_total_wine, 'Jason Park', 'Store Manager', '(770) 292-8856', 'j.park@totalwine.com'),
  (org, id_total_wine, 'Lisa Chang', 'Spirits Buyer', '(770) 292-8857', 'l.chang@totalwine.com'),
  (org, id_greens, 'Mark Henderson', 'Owner', '(770) 664-9464', 'mark@greensbeverages.com'),
  (org, id_variant, 'Travis Herman', 'Head Brewer', '(678) 973-0009', 'travis@variantbrewing.com'),
  (org, id_gate_city, 'Todd DiMatteo', 'Founder', '(678) 309-7778', 'todd@gatecitybrewing.com'),
  (org, id_iron, 'Kevin McCoy', 'Taproom Manager', '(678) 691-2828', 'kevin@ironmongerbrewing.com'),
  (org, id_margaritaville, 'Jen Crawford', 'Beverage Director', '(470) 443-1601', 'jen.crawford@margaritaville.com'),
  (org, id_margaritaville, 'Paul Stein', 'Events Manager', '(470) 443-1602', 'paul.stein@margaritaville.com'),
  (org, id_butcher, 'Chris Dupree', 'Owner', '(678) 691-3420', 'chris@butcherandbrew.com'),
  (org, id_halcyon, 'Nina Patel', 'Bar Manager', '(770) 555-0104', 'nina@halcyonsocial.com');

  RAISE NOTICE 'Inserted contacts';

  -- ========================================
  -- 4. INSERT TASKS
  -- ========================================
  INSERT INTO tasks (organization_id, user_id, account_id, account_name, task, due_date, priority, completed) VALUES
  -- Overdue
  (org, uid, id_roosters, 'Roosters Drive In', 'Follow up with Danny on seasonal beer rotation — he mentioned wanting to try new seltzer brands', CURRENT_DATE - 3, 'high', false),
  (org, uid, id_total_wine, 'Total Wine Cumming', 'Submit Q2 pricing sheet for promotional endcap program', CURRENT_DATE - 1, 'high', false),
  -- Today
  (org, uid, id_cabernet, 'Cabernet Steakhouse', 'Drop off tasting samples of new Napa Cabernet for Richard', CURRENT_DATE, 'high', false),
  (org, uid, id_taco_mac, 'Taco Mac Cumming', 'Check draft line placement — should have 3 taps per agreement', CURRENT_DATE, 'medium', false),
  (org, uid, id_variant, 'Variant Brewing', 'Confirm tap takeover date for April launch event', CURRENT_DATE, 'medium', false),
  -- This week
  (org, uid, id_greens, 'Green''s Beverages Alpharetta', 'Deliver tasting event kit — 8 bottles for Saturday sampling', CURRENT_DATE + 1, 'high', false),
  (org, uid, id_margaritaville, 'Hotel Margaritaville Atlanta', 'Meet with Jen about summer pool bar spirit packages', CURRENT_DATE + 2, 'high', false),
  (org, uid, id_gate_city, 'Gate City Brewing', 'Send updated pricing for guest tap partnership', CURRENT_DATE + 2, 'medium', false),
  (org, uid, id_butcher, 'Butcher & Brew', 'Review craft cocktail menu additions with Chris', CURRENT_DATE + 3, 'medium', false),
  (org, uid, id_halcyon, 'Halcyon Social House', 'Discuss event sponsorship for Halcyon summer series', CURRENT_DATE + 4, 'medium', false),
  (org, uid, id_iron, 'Ironmonger Brewing', 'Follow up on taproom expansion — additional keg placement', CURRENT_DATE + 5, 'low', false),
  -- Later
  (org, uid, id_hilton, 'Hilton Garden Inn Cumming', 'Annual hotel bar contract renewal meeting', CURRENT_DATE + 10, 'medium', false),
  (org, uid, id_southern, 'Southern Spirits', 'Submit local craft spirits proposal for summer display', CURRENT_DATE + 14, 'low', false),
  (org, uid, id_qt, 'QuikTrip Cumming', 'Cooler door placement review — new SKU rotation', CURRENT_DATE + 7, 'low', false);

  RAISE NOTICE 'Inserted tasks';

  -- ========================================
  -- 5. INSERT VISITS (past week + next week)
  -- ========================================
  INSERT INTO visits (organization_id, user_id, account_id, account_name, visit_date, notes) VALUES
  -- Past visits
  (org, uid, id_roosters, 'Roosters Drive In', CURRENT_DATE - 6, 'Checked beer rotation, discussed new seltzer options with Danny'),
  (org, uid, id_total_wine, 'Total Wine Cumming', CURRENT_DATE - 5, 'Quarterly review with Jason — bourbon sales up 12%'),
  (org, uid, id_variant, 'Variant Brewing', CURRENT_DATE - 4, 'Toured new barrel room, discussed collaboration brew'),
  (org, uid, id_cabernet, 'Cabernet Steakhouse', CURRENT_DATE - 3, 'Wine list review with Richard — spring menu pairing'),
  (org, uid, id_greens, 'Green''s Beverages Alpharetta', CURRENT_DATE - 2, 'Tasting event setup, Mark loved the new bourbon'),
  (org, uid, id_taco_mac, 'Taco Mac Cumming', CURRENT_DATE - 1, 'Draft line audit — all 3 taps verified'),

  -- Today
  (org, uid, id_cabernet, 'Cabernet Steakhouse', CURRENT_DATE, 'Morning tasting sample delivery'),
  (org, uid, id_butcher, 'Butcher & Brew', CURRENT_DATE, 'Lunch meeting — craft cocktail menu review'),
  (org, uid, id_iron, 'Ironmonger Brewing', CURRENT_DATE, 'Afternoon check on taproom expansion progress'),
  (org, uid, id_total_wine, 'Total Wine Cumming', CURRENT_DATE, 'End-cap display setup for weekend promotion'),

  -- Tomorrow
  (org, uid, id_greens, 'Green''s Beverages Alpharetta', CURRENT_DATE + 1, 'Tasting event kit delivery'),
  (org, uid, id_roosters, 'Roosters Drive In', CURRENT_DATE + 1, 'Follow up on seltzer rotation with Danny'),
  (org, uid, id_gate_city, 'Gate City Brewing', CURRENT_DATE + 1, 'Guest tap pricing discussion'),

  -- Day after tomorrow
  (org, uid, id_margaritaville, 'Hotel Margaritaville Atlanta', CURRENT_DATE + 2, 'Pool bar summer program kickoff with Jen'),
  (org, uid, id_halcyon, 'Halcyon Social House', CURRENT_DATE + 2, 'Event sponsorship discussion'),
  (org, uid, id_southern, 'Southern Spirits', CURRENT_DATE + 2, 'Shelf placement review'),

  -- 3 days out
  (org, uid, id_taco_mac, 'Taco Mac Cumming', CURRENT_DATE + 3, 'Verify cocktail menu card placement'),
  (org, uid, id_butcher, 'Butcher & Brew', CURRENT_DATE + 3, 'Follow up on cocktail menu additions'),
  (org, uid, id_variant, 'Variant Brewing', CURRENT_DATE + 3, 'Tap takeover event planning session'),

  -- 4 days out
  (org, uid, id_cabernet, 'Cabernet Steakhouse', CURRENT_DATE + 4, 'Wine pairing dinner prep with Richard'),
  (org, uid, id_total_wine, 'Total Wine Cumming', CURRENT_DATE + 4, 'Weekend promotion check-in'),
  (org, uid, id_qt, 'QuikTrip Cumming', CURRENT_DATE + 4, 'Cooler door audit'),

  -- 5 days out
  (org, uid, id_hilton, 'Hilton Garden Inn Cumming', CURRENT_DATE + 5, 'Bar contract renewal discussion'),
  (org, uid, id_greens, 'Green''s Beverages Alpharetta', CURRENT_DATE + 5, 'Post-tasting event follow up'),
  (org, uid, id_seed, 'Seed Kitchen & Bar', CURRENT_DATE + 5, 'Seasonal cocktail menu review'),

  -- 6 days out
  (org, uid, id_margaritaville, 'Hotel Margaritaville Atlanta', CURRENT_DATE + 6, 'Pool bar inventory pre-check'),
  (org, uid, id_roosters, 'Roosters Drive In', CURRENT_DATE + 6, 'Weekly check-in with Danny'),
  (org, uid, id_tabla, 'Tabla Indian Restaurant', CURRENT_DATE + 6, 'First visit — cocktail program assessment'),

  -- 7 days out
  (org, uid, id_coal, 'Coal Mountain Tap House', CURRENT_DATE + 7, 'New account intro meeting'),
  (org, uid, id_vickery, 'Vickery Village Pub', CURRENT_DATE + 7, 'New account intro meeting'),
  (org, uid, id_iron, 'Ironmonger Brewing', CURRENT_DATE + 7, 'Taproom expansion keg placement');

  RAISE NOTICE 'Inserted visits (past week + next week)';

  -- ========================================
  -- 6. INSERT INSIGHTS
  -- ========================================
  INSERT INTO insights (organization_id, user_id, account_id, account_name, insight_type, description, sub_category, suggested_action) VALUES
  (org, uid, id_roosters, 'Roosters Drive In', 'expansion', 'Danny interested in expanding seltzer selection — currently only carries 2 brands', 'new_product', 'Bring samples of top 3 seltzer SKUs for tasting'),
  (org, uid, id_total_wine, 'Total Wine Cumming', 'demand', 'Premium bourbon sales up 12% QoQ at this location — outperforming regional average', 'growth_trend', 'Propose Father''s Day end-cap display'),
  (org, uid, id_total_wine, 'Total Wine Cumming', 'competitive', 'Shelf share at 31% — up from 28%. Gained 2 facings from Maker''s Mark', 'shelf_share', 'Lock in position with updated planogram'),
  (org, uid, id_cabernet, 'Cabernet Steakhouse', 'relationship', 'Richard refreshing spring wine list — interested in our Napa Cabernet allocation', 'buyer_relationship', 'Send tasting samples of 2022 vintage'),
  (org, uid, id_greens, 'Green''s Beverages Alpharetta', 'demand', 'Tasting event drove 40% increase in featured spirit sales — Mark wants monthly events', 'sampling_roi', 'Schedule monthly tasting calendar'),
  (org, uid, id_variant, 'Variant Brewing', 'expansion', 'New barrel room opening — collaboration brew opportunity with our grain neutral spirits', 'new_distribution', 'Submit collaboration proposal for spring release'),
  (org, uid, id_margaritaville, 'Hotel Margaritaville Atlanta', 'expansion', 'Summer pool bar program launching April — Jen wants premium spirit partnerships', 'seasonal_program', 'Prepare premium spirit package proposal'),
  (org, uid, id_taco_mac, 'Taco Mac Cumming', 'friction', 'One of 3 contracted taps switched to competitor last visit — needs correction', 'compliance', 'Verify tap lines and escalate if needed'),
  (org, uid, id_gate_city, 'Gate City Brewing', 'relationship', 'Todd interested in guest tap rotation — good entry point for our craft brands', 'buyer_relationship', 'Send pricing for guest tap partnership'),
  (org, uid, id_butcher, 'Butcher & Brew', 'demand', 'Craft cocktail sales growing 20% month over month — Chris expanding menu', 'growth_trend', 'Propose premium spirit additions for new menu'),
  (org, uid, id_halcyon, 'Halcyon Social House', 'promotion', 'Summer concert series sponsorship available — high-visibility branding opportunity', 'event_opportunity', 'Submit sponsorship proposal by end of month'),
  (org, uid, id_iron, 'Ironmonger Brewing', 'expansion', 'Taproom expanding from 12 to 20 taps — 8 new placements available', 'new_distribution', 'Submit tap placement proposal for expansion');

  RAISE NOTICE 'Inserted insights';

  -- ========================================
  -- 7. INSERT NOTES
  -- ========================================
  INSERT INTO account_notes (organization_id, account_id, user_id, content) VALUES
  (org, id_roosters, uid, 'Danny is the owner and bartender most nights. Casual vibe, best to visit after 3pm when it slows down. He''s open to trying new products if you bring samples.'),
  (org, id_cabernet, uid, 'Richard is extremely knowledgeable — come prepared with producer stories and vintage details. Best time to visit is Tuesday afternoon before dinner service.'),
  (org, id_total_wine, uid, 'Jason is data-driven — always have sell-through numbers ready. Lisa handles spirits buying and is responsive via email. Saturday tastings get the most foot traffic.'),
  (org, id_greens, uid, 'Mark runs a tight ship. Store is well-organized. He values personal relationships — remember his daughter plays lacrosse at North Forsyth.'),
  (org, id_variant, uid, 'Travis is passionate about barrel-aging. Their customer base is adventurous — perfect for limited releases and new product launches.'),
  (org, id_margaritaville, uid, 'Pool bar opens April 1st. Jen Crawford makes all beverage decisions. Paul Stein handles events — coordinate through him for sponsorships.'),
  (org, id_taco_mac, uid, 'Corporate account — local manager Brad has some flexibility on tap selection but major changes go through regional. Ashley at the bar is a great brand advocate.'),
  (org, id_butcher, uid, 'Chris is the owner-operator. Very hands-on with the cocktail program. He''s been experimenting with infusions — could be a good collaboration partner.');

  RAISE NOTICE 'Inserted notes';

  -- ========================================
  -- 8. INSERT DISCOVERED ACCOUNTS (Cumming/Alpharetta area)
  -- ========================================
  INSERT INTO discovered_accounts (organization_id, name, address, phone, category, latitude, longitude, google_rating, google_review_count, ai_score, ai_reasons, hours, website, is_claimed) VALUES
  -- Bars
  (org, 'Brewsters Bar & Grill', '625 Peachtree Pkwy, Cumming, GA 30041', '(770) 555-1001', 'bar', 34.2185, -84.1340, 4.3, 245, 82, ARRAY['Growing neighborhood bar', 'Live trivia brings crowds', 'No current premium spirit supplier'], 'Mon-Sat 11am-12am, Sun 12pm-10pm', NULL, false),
  (org, 'Twisted Taco Cumming', '1145 Marketplace Blvd, Cumming, GA 30041', '(770) 555-1002', 'bar', 34.2205, -84.1275, 4.1, 312, 76, ARRAY['Good happy hour traffic', 'Expanding margarita program', 'Strip mall location with parking'], 'Mon-Sun 11am-11pm', NULL, false),
  (org, 'The Alley Bar', '2780 Keith Bridge Rd, Cumming, GA 30041', '(770) 555-1003', 'bar', 34.2350, -84.1150, 4.0, 178, 71, ARRAY['Sports bar crowd', 'Large screen setup for events', 'Open to craft beer rotation'], 'Tue-Sun 4pm-12am', NULL, false),

  -- Restaurants
  (org, 'Tam''s Backstage Alpharetta', '44 S Main St, Alpharetta, GA 30009', '(770) 555-2001', 'restaurant', 34.0754, -84.2941, 4.5, 412, 87, ARRAY['Downtown Alpharetta location', 'Upscale dining crowd', 'Strong cocktail program'], 'Mon-Sat 5pm-10pm, Sun Brunch 10am-3pm', 'https://tamsbackstage.com', false),
  (org, 'South Main Kitchen', '6050 S Main St, Alpharetta, GA 30004', '(770) 555-2002', 'restaurant', 34.0702, -84.2938, 4.6, 534, 89, ARRAY['Farm-to-table concept', 'Award-winning chef', 'Premium wine and spirits list'], 'Tue-Sat 5pm-10pm, Sun 10am-3pm', NULL, false),
  (org, 'Drift Fish House & Oyster Bar', '6655 Halcyon Way, Alpharetta, GA 30005', '(770) 555-2003', 'restaurant', 34.0920, -84.2618, 4.4, 387, 84, ARRAY['Halcyon development location', 'Raw bar with cocktail pairing', 'High-income demographic'], 'Mon-Sun 11am-10pm', NULL, false),
  (org, 'Jinya Ramen Bar', '3005 Old Alabama Rd, Johns Creek, GA 30022', '(770) 555-2004', 'restaurant', 34.0445, -84.1652, 4.3, 298, 78, ARRAY['Growing chain with sake program', 'Full bar with Asian cocktails', 'High repeat customer rate'], 'Mon-Sun 11am-10pm', NULL, false),

  -- Liquor Stores
  (org, 'Forsyth Package Store', '1895 Buford Hwy, Cumming, GA 30041', '(770) 555-3001', 'liquor_store', 34.2087, -84.1190, 4.1, 167, 78, ARRAY['Local independent store', 'Flexible shelf space', 'Owner open to new brands'], 'Mon-Sat 9am-11pm, Sun 12:30pm-8pm', NULL, false),
  (org, 'Beverage Superstore Johns Creek', '10900 Medlock Bridge Rd, Johns Creek, GA 30097', '(770) 555-3002', 'liquor_store', 34.0321, -84.1876, 4.2, 298, 83, ARRAY['High-traffic intersection', 'Large format store', 'Regular tasting events'], 'Mon-Sat 9am-10pm, Sun 12:30pm-7pm', NULL, false),
  (org, 'Windward Wine & Spirits', '5530 Windward Pkwy, Alpharetta, GA 30004', '(770) 555-3003', 'liquor_store', 34.1015, -84.2395, 4.4, 210, 81, ARRAY['Premium focus — high margin products', 'Corporate gift basket program', 'Receptive to tastings'], 'Mon-Sat 10am-9pm, Sun 12pm-6pm', NULL, false),

  -- Breweries
  (org, 'Pontoon Brewing', '8601 Dunwoody Pl, Sandy Springs, GA 30350', '(770) 555-4001', 'brewery', 33.9325, -84.3512, 4.5, 567, 86, ARRAY['Award-winning sour program', 'Large taproom with events', 'Distribution growing rapidly'], 'Wed-Fri 4pm-9pm, Sat 12pm-9pm, Sun 12pm-7pm', 'https://pontoonbrewing.com', false),
  (org, 'Hopstix Brewery', '10920 Crabapple Rd, Roswell, GA 30075', '(770) 555-4002', 'brewery', 34.0385, -84.3725, 4.6, 445, 88, ARRAY['Unique Asian fusion + brewery concept', 'Strong local following', 'Expanding distribution'], 'Tue-Sun 11am-9pm', 'https://hopstix.com', false),

  -- Hotels
  (org, 'Hyatt Place Alpharetta', '5595 Windward Pkwy, Alpharetta, GA 30004', '(770) 555-5001', 'hotel', 34.1028, -84.2378, 4.1, 234, 74, ARRAY['Business traveler clientele', 'Bar and breakfast area', 'Conference room catering'], NULL, NULL, false),

  -- Convenience Stores
  (org, 'RaceTrac Alpharetta', '3500 Old Milton Pkwy, Alpharetta, GA 30005', '(770) 555-6001', 'convenience_store', 34.0865, -84.2512, 4.1, 387, 77, ARRAY['Major intersection location', 'Cooler door availability', 'Commuter traffic'], 'Open 24 hours', 'https://racetrac.com', false),
  (org, 'QuikTrip Johns Creek', '10950 State Bridge Rd, Johns Creek, GA 30022', '(770) 555-6002', 'convenience_store', 34.0398, -84.1798, 4.3, 445, 79, ARRAY['High-volume QT location', 'Strong RTD and seltzer sales', 'Premium cooler placement available'], 'Open 24 hours', 'https://quiktrip.com', false);

  RAISE NOTICE 'Inserted discovered accounts';
  RAISE NOTICE 'Done! Cumming GA demo data is ready.';

END $$;
