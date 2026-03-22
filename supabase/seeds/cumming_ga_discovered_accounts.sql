-- ============================================================================
-- Seed: Discovered accounts for Cumming, GA area
-- Run this in Supabase SQL Editor after replacing ORG_ID with your org UUID
-- To find your org ID: SELECT id FROM organizations LIMIT 1;
-- ============================================================================

-- First, delete existing Tampa-based discovered accounts (optional)
-- DELETE FROM discovered_accounts WHERE latitude BETWEEN 27.0 AND 29.0;

-- Replace 'YOUR_ORG_ID' with the actual organization UUID
DO $$
DECLARE
  org UUID;
BEGIN
  -- Get the first org (adjust if you have multiple)
  SELECT id INTO org FROM organizations LIMIT 1;

  INSERT INTO discovered_accounts (organization_id, name, address, phone, category, latitude, longitude, google_rating, google_review_count, ai_score, ai_reasons, hours, website, is_claimed) VALUES
  -- Bars
  (org, 'Coal Mountain Tap House', '6185 Coal Mountain Dr, Cumming, GA 30028', '(770) 555-0101', 'bar', 34.2274, -84.1302, 4.5, 312, 88, ARRAY['High foot traffic area', 'Strong craft beer selection', 'No current distributor relationship'], 'Mon-Thu 4pm-12am, Fri-Sat 12pm-2am, Sun 12pm-10pm', 'https://coalmountaintap.com', false),
  (org, 'Vickery Village Pub', '5655 Vickery Creek Rd, Cumming, GA 30040', '(770) 555-0102', 'bar', 34.2065, -84.1198, 4.3, 198, 82, ARRAY['Growing neighborhood', 'Weekend live music crowd', 'Expanding drink menu'], 'Mon-Sat 11am-12am, Sun 12pm-10pm', NULL, false),
  (org, 'Halcyon Social House', '6365 Halcyon Way, Alpharetta, GA 30005', '(770) 555-0103', 'bar', 34.0915, -84.2621, 4.6, 523, 91, ARRAY['Premium mixed-use development', 'High-income demographic', 'Multiple event spaces'], 'Mon-Sun 11am-2am', 'https://halcyonsocial.com', false),
  (org, 'The Alley Bar & Grill', '410 Peachtree Pkwy, Cumming, GA 30041', '(770) 555-0104', 'bar', 34.2148, -84.1355, 4.1, 145, 75, ARRAY['Sports bar crowd', 'Large outdoor patio', 'Good wing night traffic'], 'Tue-Sun 4pm-12am', NULL, false),
  (org, 'Suwanee Beer Fest Taproom', '340 Town Center Ave, Suwanee, GA 30024', '(770) 555-0105', 'bar', 34.0515, -84.0715, 4.4, 287, 85, ARRAY['Town center location', 'Beer festival connections', 'Strong local following'], 'Mon-Thu 3pm-11pm, Fri-Sun 12pm-12am', 'https://suwaneebeer.com', false),

  -- Restaurants
  (org, 'Tam''s Backstage', '44 S Main St, Alpharetta, GA 30009', '(770) 555-0201', 'restaurant', 34.0754, -84.2941, 4.5, 412, 87, ARRAY['Downtown Alpharetta location', 'Upscale dining', 'Strong cocktail program'], 'Mon-Sat 5pm-10pm, Sun Brunch 10am-3pm', 'https://tamsbackstage.com', false),
  (org, 'Cabernet Steakhouse', '5575 Windward Pkwy, Alpharetta, GA 30004', '(770) 555-0202', 'restaurant', 34.1021, -84.2387, 4.7, 634, 93, ARRAY['High-end steakhouse', 'Premium wine list opportunity', 'Corporate dining clientele'], 'Mon-Sat 5pm-10pm', 'https://cabernetsteakhouse.com', false),
  (org, 'Butcher & Brew', '5851 Windward Pkwy, Alpharetta, GA 30005', '(770) 555-0203', 'restaurant', 34.1065, -84.2352, 4.4, 389, 84, ARRAY['Craft burger + craft beer concept', 'Strong lunch and dinner traffic', 'Active social media presence'], 'Mon-Sun 11am-10pm', 'https://butcherandbrew.com', false),
  (org, 'Tabla Indian Restaurant', '2920 Peachtree Pkwy, Suwanee, GA 30024', '(770) 555-0204', 'restaurant', 34.0498, -84.0668, 4.6, 521, 86, ARRAY['High-volume Indian cuisine', 'Full bar with cocktail program', 'Large party/event space'], 'Mon-Sun 11:30am-10pm', NULL, false),
  (org, 'Seed Kitchen & Bar', '1311 Johnson Ferry Rd, Marietta, GA 30068', '(770) 555-0205', 'restaurant', 33.9712, -84.4215, 4.5, 445, 82, ARRAY['Farm-to-table concept', 'Seasonal cocktail menu', 'Strong brunch program'], 'Tue-Sat 5pm-10pm, Sun Brunch 10am-3pm', 'https://seedkitchenandbar.com', false),

  -- Liquor Stores
  (org, 'Total Wine Cumming', '2155 Market Place Blvd, Cumming, GA 30041', '(770) 555-0301', 'liquor_store', 34.2198, -84.1287, 4.3, 856, 95, ARRAY['Major chain — high volume', 'Existing relationship potential', 'End-cap display opportunities'], 'Mon-Sat 9am-10pm, Sun 12:30pm-7pm', 'https://totalwine.com', false),
  (org, 'Forsyth Package Store', '1895 Buford Hwy, Cumming, GA 30041', '(770) 555-0302', 'liquor_store', 34.2087, -84.1190, 4.1, 167, 78, ARRAY['Local independent store', 'Flexible shelf space', 'Open to new brands'], 'Mon-Sat 9am-11pm, Sun 12:30pm-8pm', NULL, false),
  (org, 'Green''s Beverages Alpharetta', '3070 Windward Plaza, Alpharetta, GA 30005', '(770) 555-0303', 'liquor_store', 34.1032, -84.2401, 4.5, 423, 89, ARRAY['Premium selection focus', 'Tasting event program', 'Strong wine + spirits mix'], 'Mon-Sat 9am-10pm, Sun 12:30pm-7pm', 'https://greensbeverages.com', false),
  (org, 'Beverage Superstore Johns Creek', '10900 Medlock Bridge Rd, Johns Creek, GA 30097', '(770) 555-0304', 'liquor_store', 34.0321, -84.1876, 4.2, 298, 83, ARRAY['High-traffic intersection', 'Large format store', 'Regular tasting events'], 'Mon-Sat 9am-10pm, Sun 12:30pm-7pm', NULL, false),

  -- Breweries
  (org, 'Variant Brewing', '280 N Main St, Roswell, GA 30075', '(770) 555-0401', 'brewery', 34.0238, -84.3615, 4.6, 567, 90, ARRAY['Award-winning craft brewery', 'Large taproom', 'Distribution partnerships'], 'Tue-Thu 4pm-9pm, Fri 3pm-10pm, Sat 12pm-10pm, Sun 12pm-8pm', 'https://variantbrewing.com', false),
  (org, 'Gate City Brewing', '43 Magnolia St, Roswell, GA 30075', '(770) 555-0402', 'brewery', 34.0225, -84.3521, 4.5, 434, 87, ARRAY['Downtown Roswell location', 'Food truck partnerships', 'Strong local brand'], 'Wed-Thu 4pm-9pm, Fri 3pm-10pm, Sat 12pm-10pm, Sun 12pm-7pm', 'https://gatecitybrewing.com', false),
  (org, 'Ironmonger Brewing', '585 S Main St, Alpharetta, GA 30004', '(770) 555-0403', 'brewery', 34.0687, -84.2945, 4.4, 312, 84, ARRAY['Downtown Alpharetta foot traffic', 'Growing distribution', 'Event space available'], 'Tue-Thu 4pm-9pm, Fri 4pm-10pm, Sat 12pm-10pm, Sun 12pm-7pm', 'https://ironmongerbrewing.com', false),

  -- Hotels
  (org, 'Hotel Margaritaville Atlanta', '6345 Halcyon Way, Alpharetta, GA 30005', '(770) 555-0501', 'hotel', 34.0918, -84.2625, 4.3, 289, 88, ARRAY['Resort-style hotel bar', 'Pool bar opportunity', 'High tourist traffic'], NULL, 'https://margaritavilleresorts.com', false),
  (org, 'Hilton Garden Inn Cumming', '870 Buford Hwy, Cumming, GA 30041', '(770) 555-0502', 'hotel', 34.2112, -84.1245, 4.0, 198, 72, ARRAY['Business traveler clientele', 'On-site restaurant', 'Conference room catering'], NULL, 'https://hilton.com', false),

  -- Convenience Stores
  (org, 'QuikTrip Cumming', '5865 Bethelview Rd, Cumming, GA 30040', '(770) 555-0601', 'convenience_store', 34.2215, -84.1498, 4.2, 512, 80, ARRAY['High-traffic QT location', 'Cold beverage section', 'Strong impulse buy potential'], 'Open 24 hours', 'https://quiktrip.com', false),
  (org, 'RaceTrac Alpharetta', '3500 Old Milton Pkwy, Alpharetta, GA 30005', '(770) 555-0602', 'convenience_store', 34.0865, -84.2512, 4.1, 387, 77, ARRAY['Major intersection location', 'Cooler door availability', 'Commuter traffic'], 'Open 24 hours', 'https://racetrac.com', false);

END $$;
