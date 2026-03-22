-- ============================================================================
-- Target Accounts: National chains enriched via Google Places (nearest to Dallas, TX)
-- For Michael Anorue's org (Armand de Brignac)
-- Run in Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  org UUID := 'afbd354c-0a98-420d-8cd9-4af984c7cd69';
  uid UUID := 'dfa60964-b955-4f19-9b2d-62c0639a0778';
  acc_id UUID;
BEGIN

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Aimbridge', '5301 Headquarters Dr, Plano, TX 75024, USA', 'Hotel', 'on_premise', 33.0877, -96.8091, '(972) 952-0200', 'https://aimbridgehospitality.com/?utm_source=google&utm_medium=Yext')
  RETURNING id INTO acc_id;
  INSERT INTO account_contacts (organization_id, account_id, name, role, email) VALUES (org, acc_id, 'Danny Caffall', 'Director of Beverage', 'Danny.Caffall@aimbridge.com');

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Accor Hotels', '1717 N Akard St, Dallas, TX 75201, USA', 'Hotel', 'on_premise', 32.7857, -96.8018, '(214) 720-2020', 'https://www.fairmont.com/dallas/?goto=fiche_hotel&code_hotel=A558&merchantid=seo-maps-US-A558&sourceid=aw-cen&utm_medium=seo%20maps&utm_source=google%20Maps&utm_campaign=seo%20maps')
  RETURNING id INTO acc_id;
  INSERT INTO account_contacts (organization_id, account_id, name, role, email) VALUES (org, acc_id, 'Shayna Kaufman', 'Beverage Manager', 'shayna.kaufman@accor.com');

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Alterra Mountain Group', '3501 Wazee St, Denver, CO 80216, USA', 'Resort', 'on_premise', 39.7695, -104.9768, '(303) 749-8200', 'https://www.alterramtnco.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'American Social', '1520 Main St, Dallas, TX 75201, USA', 'Restaurant', 'on_premise', 32.7806, -96.7987, '(469) 498-9890', 'https://www.thehamptonsocial.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Atrium Hospitality', '4600 W Airport Fwy, Irving, TX 75062, USA', 'Hotel', 'on_premise', 32.8350, -97.0192, '(972) 513-0800', 'http://www.atriumhotelandsuites.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Benchmark Pyramid', '1780 Hughes Landing Blvd #400, The Woodlands, TX 77380, USA', 'Hotel', 'on_premise', 30.1737, -95.4697, '(281) 367-5757', 'https://www.benchmarkresortsandhotels.com/?utm_source=googlemybusiness&utm_medium=organic')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Black Rock Coffee', '12107 Abrams Rd, Dallas, TX 75243, USA', 'Restaurant', 'on_premise', 32.9130, -96.7359, '(833) 843-5776', 'https://br.coffee/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Bloomin Brands Flemmings', '7250 Dallas Pkwy Suite 110, Plano, TX 75024, USA', 'Restaurant', 'on_premise', 33.0775, -96.8231, '(972) 543-2141', 'https://www.flemingssteakhouse.com/Locations/TX/Plano?y_source=1_MTU1MDMxOTItNzE1LWxvY2F0aW9uLndlYnNpdGU%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'BlueStone Lane', '1900 Lake Woodlands Dr, The Woodlands, TX 77380, USA', 'Restaurant', 'on_premise', 30.1662, -95.4651, '(718) 374-6858', 'https://bluestonelane.com/?y_source=1_MTAwNDg3NDE2NC03MTUtbG9jYXRpb24ud2Vic2l0ZQ%3D%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Cameron Mitchell Restaurants', '2101 Cedar Springs Rd #150, Dallas, TX 75201, USA', 'Restaurant', 'on_premise', 32.7937, -96.8056, '(214) 965-0440', 'https://www.ocean-prime.com/locations-menus/dallas')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Caribbean Restaurants Applebees', '8008 Herb Kelleher Way, Dallas, TX 75235, USA', 'Restaurant', 'on_premise', 32.8441, -96.8485, '(888) 592-7753', 'https://restaurants.applebees.com/en-us/tx/dallas/8008-herb-kelleher-way-74032?utm_source=google&utm_medium=organic&utm_campaign=google_my_business&utm_term=74032&utm_content=website')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Charlestowne Hotels', '28 Bridgeside Blvd, Mt Pleasant, SC 29464, USA', 'Hotel', 'on_premise', 32.7982, -79.9047, '(843) 972-1400', 'https://www.charlestownehotels.com/?utm_source=google&utm_medium=organic&utm_campaign=business_listing')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Chick-fil-A', '1401 Elm St Ste 220, Dallas, TX 75202, USA', 'Restaurant', 'on_premise', 32.7814, -96.8001, '(214) 748-4520', 'https://www.chick-fil-a.com/locations/tx/elm-st-in-line?utm_source=google&utm_medium=gmb')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Chipotle', '2401 Victory Park Ln #140, Dallas, TX 75219, USA', 'Restaurant', 'on_premise', 32.7878, -96.8099, '(214) 453-8267', 'https://locations.chipotle.com/tx/dallas/2401-victory-park-ln?utm_source=google&utm_medium=yext&utm_campaign=yext_listings?restaurant=3489')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'ClubCorp Invited', '5221 N O''Connor Blvd #300, Irving, TX 75039, USA', 'Restaurant', 'on_premise', 32.9113, -96.8758, '(972) 243-6191', 'http://invitedclubs.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Compass Group Flik', '139 W 91st St, New York, NY 10024, USA', 'Concessions', 'on_premise', 40.7905, -73.9714, NULL, 'http://flik-usa.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Compass Group Levy', '980 N Michigan Ave, Chicago, IL 60611, USA', 'Concessions', 'on_premise', 41.9005, -87.6246, '(312) 664-8200', 'https://www.levyrestaurants.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Compass Group Restaurant Associates', '132 W 31st St #601, New York, NY 10001, USA', 'Concessions', 'on_premise', 40.7483, -73.9906, '(212) 613-5500', 'https://www.restaurantassociates.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Delaware North', '1090 Ballpark Way, Arlington, TX 76011, USA', 'Concessions', 'on_premise', 32.7514, -97.0814, '(817) 795-8838', 'https://www.delawarenorth.com/metroplex-sportservice')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Del Friscos Restaurant Group', '2323 Olive St, Dallas, TX 75201, USA', 'Restaurant', 'on_premise', 32.7914, -96.8037, '(972) 490-9000', 'https://www.delfriscos.com/location/del-friscos-double-eagle-steakhouse-dallas-tx/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Dine Brands', '10 W Walnut St, Pasadena, CA 91103, USA', 'Restaurant', 'on_premise', 34.1494, -118.1511, '(866) 955-3463', 'https://www.dinebrands.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Dunkin', '5406 Harry Hines Blvd, Dallas, TX 75235, USA', 'Restaurant', 'on_premise', 32.8142, -96.8394, '(469) 480-6029', 'https://locations.dunkindonuts.com/en/tx/dallas/5406-harry-hines-boulevard/364987?utm_source=google&utm_medium=local&utm_campaign=localmaps&utm_content=364987&y_source=1_MTAzMDEyNjg2MS03MTUtbG9jYXRpb24ud2Vic2l0ZQ%3D%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Einstein Bros Bagels', '4113 Lemmon Ave, Dallas, TX 75219, USA', 'Restaurant', 'on_premise', 32.8150, -96.8097, '(972) 327-7192', 'https://locations.einsteinbros.com/us/tx/dallas/4113-lemmon-ave?y_source=1_NDEwNjAyNjYtNzE1LWxvY2F0aW9uLndlYnNpdGU%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Elior North America', '667 N Broad St, Philadelphia, PA 19123, USA', 'Concessions', 'on_premise', 39.9656, -75.1603, '(215) 923-2675', 'http://www.constellationculinary.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Eurest', '500 N Akard St Suite #200, Dallas, TX 75201, USA', 'Concessions', 'on_premise', 32.7845, -96.8000, NULL, 'https://eurestcafes.compass-usa.com/45OaksCafe/Pages/Home.aspx?lid=a1')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Fogo de Chao', '2619 McKinney Ave #150, Dallas, TX 75204, USA', 'Restaurant', 'on_premise', 32.7971, -96.8018, '(214) 720-2777', 'https://fogodechao.com/location/uptown/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Four Seasons Hotels', '9011 Collins Ave, Surfside, FL 33154, USA', 'Hotel', 'on_premise', 25.8775, -80.1216, '(305) 381-3333', 'https://www.fourseasons.com/surfside/?utm_source=google&utm_medium=organicsearch&utm_campaign=tor-mfl-hre-mid-seo-na&utm_content=na-na&utm_term=na')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Fox Restaurant Concepts', '4455 E Camelback Rd suite B100, Phoenix, AZ 85018, USA', 'Restaurant', 'on_premise', 33.5089, -111.9844, '(480) 905-6920', 'http://www.foxrc.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Great Wolf Lodge', '100 Great Wolf Dr, Grapevine, TX 76051, USA', 'Hotel', 'on_premise', 32.9420, -97.0598, '(800) 693-9653', 'https://www.greatwolf.com/grapevine?utm_source=google&utm_medium=organic&utm_campaign=gmb-grapevine')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Hard Rock Cafe', '111 W Crockett St, San Antonio, TX 78205, USA', 'Restaurant', 'on_premise', 29.4252, -98.4892, '(210) 224-7625', 'https://cafe.hardrock.com/san-antonio/#utm_source=Google&utm_medium=Yext&utm_campaign=Listings')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Hilton Hotels', '1600 Pacific Ave, Dallas, TX 75201, USA', 'Hotel', 'on_premise', 32.7821, -96.7990, '(214) 299-8982', 'https://www.hilton.com/en/hotels/dalpagi-hilton-garden-inn-downtown-dallas/?SEO_id=GMB-AMER-GI-DALPAGI&y_source=1_MjcyMzA5NC03MTUtbG9jYXRpb24ud2Vic2l0ZQ%3D%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Hyatt Hotels', '300 Reunion Blvd, Dallas, TX 75207, USA', 'Hotel', 'on_premise', 32.7753, -96.8092, '(214) 651-1234', 'https://www.hyatt.com/hyatt-regency/en-US/dfwrd-hyatt-regency-dallas?src=corp_lclb_google_seo_dfwrd&utm_source=google&utm_medium=organic&utm_campaign=lmr')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'IHG Hotels', '1933 Main St, Dallas, TX 75201, USA', 'Hotel', 'on_premise', 32.7819, -96.7944, '(214) 741-7700', 'https://www.ihg.com/hotelindigo/hotels/us/en/dallas/dalar/hoteldetail?cm_mmc=GoogleMaps-_-IN-_-US-_-DALAR')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Jamba Juice', '5923 Greenville Ave, Dallas, TX 75206, USA', 'Restaurant', 'on_premise', 32.8576, -96.7690, '(214) 363-6461', 'https://locations.jamba.com/tx/dallas/5923-greenville-ave?utm_source=google&utm_medium=organic&utm_campaign=locations_partner')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Joe & The Juice', '2633 McKinney Ave #170, Dallas, TX 75204, USA', 'Restaurant', 'on_premise', 32.7976, -96.8020, '(214) 466-8586', 'http://www.juiceland.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Kimpton Hotels', '2551 Elm St, Dallas, TX 75226, USA', 'Hotel', 'on_premise', 32.7845, -96.7873, '(469) 498-2500', 'https://www.pittmanhoteldallas.com/?&cm_mmc=WEB-_-KI-_-AMER-_-EN-_-EV-_-Google%20Business%20Profile-_-DD-_-pittman%20hotel')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Krispy Kreme', 'Drive Thru Only, 5118 Greenville Ave, Dallas, TX 75206, USA', 'Restaurant', 'on_premise', 32.8496, -96.7695, '(214) 750-5118', 'https://site.krispykreme.com/tx/dallas/5118-greenville-ave?y_source=1_MTE4OTc4MTctNzE1LWxvY2F0aW9uLndlYnNpdGU%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Landrys Restaurants', '1212 Lake Robbins Dr, The Woodlands, TX 77380, USA', 'Restaurant', 'on_premise', 30.1617, -95.4528, '(281) 362-9696', 'https://www.landrysseafood.com/location/landrys-seafood-the-woodlands/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Loews Hotels', '888 Nolan Ryan Expy, Arlington, TX 76011, USA', 'Hotel', 'on_premise', 32.7504, -97.0850, '(682) 318-2810', 'https://www.loewshotels.com/arlington-hotel')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Marriott Hotels', '650 N Pearl St, Dallas, TX 75201, USA', 'Hotel', 'on_premise', 32.7872, -96.7953, '(214) 979-9000', 'https://www.marriott.com/en-us/hotels/daldt-dallas-marriott-downtown/overview/?scid=f2ae0541-1279-4f24-b197-a979c79310b0')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'McDonalds', '1000 Commerce St, Dallas, TX 75202, USA', 'Restaurant', 'on_premise', 32.7787, -96.8030, '(469) 227-8533', 'https://www.mcdonalds.com/us/en-us/location/TX/DALLAS/1000-COMMERCE-ST/4777.html?cid=RF:YXT:GMB::Clicks')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'MGM Resorts', '3799 S Las Vegas Blvd, Las Vegas, NV 89109, USA', 'Hotel', 'on_premise', 36.1036, -115.1676, '(877) 880-0880', 'https://mgmgrand.mgmresorts.com/en.html')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Noble House Hotels', '600 6th St South, Kirkland, WA 98033, USA', 'Hotel', 'on_premise', 47.6707, -122.1960, '(425) 827-8737', 'https://www.noblehousehotels.com/?utm_source=gmb-hotel&utm_medium=organic&utm_campaign=gmb')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Omni Hotels', '555 S Lamar St, Dallas, TX 75202, USA', 'Hotel', 'on_premise', 32.7751, -96.8043, '(214) 744-6664', 'https://www.omnihotels.com/hotels/dallas?utm_source=gmblisting&utm_medium=organic')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Outback Steakhouse', '1101 N Interstate 35 E Rd, DeSoto, TX 75115, USA', 'Restaurant', 'on_premise', 32.6087, -96.8238, '(972) 228-8748', 'https://locations.outback.com/texas/desoto/1101-north-i-35-east?utm_source=gmb&utm_medium=local_search&utm_campaign=website_cta&y_source=1_MTU1MDIzMjktNzE1LWxvY2F0aW9uLndlYnNpdGU%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Panera Bread', '3826 Lemmon Ave, Dallas, TX 75219, USA', 'Restaurant', 'on_premise', 32.8129, -96.8063, '(214) 443-0880', 'https://www.panerabread.com/en-us/cafe/locations/tx/dallas/3826-lemmon-ave?utm_medium=local&utm_source=google&utm_campaign=dpm-dist&utm_term=601225&utm_content=main')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Peets Coffee', NULL, 'Restaurant', 'on_premise', NULL, NULL, NULL, NULL)
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'PF Changs', '8687 N Central Expy Ste 225, Dallas, TX 75225, USA', 'Restaurant', 'on_premise', 32.8668, -96.7731, '(214) 265-8669', 'https://locations.pfchangs.com/tx/dallas/8687-north-central-expressway-ste-225.html?utm_source=google_gbp&utm_medium=organic')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Raising Canes', '5201 Ross Ave, Dallas, TX 75206, USA', 'Restaurant', 'on_premise', 32.8091, -96.7734, '(214) 515-9105', 'https://locations.raisingcanes.com/tx/dallas/5201-ross-ave')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Red Lobster', '3906 Towne Crossing Blvd, Mesquite, TX 75150, USA', 'Restaurant', 'on_premise', 32.8185, -96.6307, '(972) 613-1444', 'https://www.redlobster.com/seafood-restaurants/locations/tx/mesquite/3906-towne-crossing-blvd')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Ritz Carlton', '2121 McKinney Ave, Dallas, TX 75201, USA', 'Hotel', 'on_premise', 32.7922, -96.8034, '(214) 922-0200', 'https://www.ritzcarlton.com/en/hotels/dalrz-the-ritz-carlton-dallas/overview/?scid=f2ae0541-1279-4f24-b197-a979c79310b0')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Sage Hospitality', '1809 Blake St #200, Denver, CO 80202, USA', 'Hotel', 'on_premise', 39.7527, -104.9966, '(303) 595-7200', 'http://www.sagehospitalitygroup.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Shake Shack', '2500 N Pearl St, Dallas, TX 75201, USA', 'Restaurant', 'on_premise', 32.7935, -96.8031, '(214) 983-1023', 'https://www.shakeshack.com/location/dallas-uptown-tx?utm_source=google&utm_medium=listing')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Sodexo', '5000 Headquarters Dr ste 600, Plano, TX 75024, USA', 'Concessions', 'on_premise', 33.0873, -96.8063, NULL, NULL)
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Starbucks', '208 S Akard St, Dallas, TX 75202, USA', 'Restaurant', 'on_premise', 32.7795, -96.7986, '(214) 782-6655', 'https://www.starbucks.com/store-locator/store/1007558')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Subway', '1302 Elm St 1st Floor, Dallas, TX 75202, USA', 'Restaurant', 'on_premise', 32.7809, -96.8010, '(214) 747-1088', 'https://restaurants.subway.com/united-states/tx/dallas/1302-elm-st?utm_source=yxt-goog&utm_medium=local&utm_term=acq&utm_content=28455&utm_campaign=evergreen-2020&y_source=1_MTQ5MDgyNTEtNzE1LWxvY2F0aW9uLndlYnNpdGU%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Sweetgreen', '3636 McKinney Ave Ste 100, Dallas, TX 75204, USA', 'Restaurant', 'on_premise', 32.8075, -96.7971, '(214) 833-0802', 'https://www.sweetgreen.com/locations/west-village')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Taco Bell', '2404 N Washington Ave, Dallas, TX 75204, USA', 'Restaurant', 'on_premise', 32.8023, -96.7906, '(214) 821-4866', 'https://locations.tacobell.com/tx/dallas/2404-north-washington-avenue.html?utm_source=yext&utm_campaign=googlelistings&utm_medium=referral&utm_term=016224&utm_content=website&y_source=1_NjE0NDk1Mi03MTUtbG9jYXRpb24ud2Vic2l0ZQ%3D%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Texas Roadhouse', '1420 N Peachtree Rd, Mesquite, TX 75149, USA', 'Restaurant', 'on_premise', 32.7860, -96.6255, '(972) 289-4473', 'https://www.texasroadhouse.com/locations/texas/mesquite?utm_source=listing&utm_medium=search')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'The Cheesecake Factory', '7700 W Northwest Hwy, Dallas, TX 75225, USA', 'Restaurant', 'on_premise', 32.8644, -96.7730, '(214) 373-4844', 'https://locations.thecheesecakefactory.com/tx/dallas-26.html?utm_source=Google&utm_medium=Maps&utm_campaign=Google+Places')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'The Indigo Road Hospitality Group', '1426 Meeting St, Charleston, SC 29405, USA', 'Restaurant', 'on_premise', 32.8158, -79.9506, '(843) 297-8385', 'https://www.theindigoroad.com/?y_source=1_ODE4NDQwODUtNzE1LWxvY2F0aW9uLndlYnNpdGU%3D')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'The Palm Restaurant', '2625 Main St, Dallas, TX 75226, USA', 'Restaurant', 'on_premise', 32.7838, -96.7854, '(469) 837-2562', 'https://www.palmastateofmind.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'The Ritz-Carlton Yacht Collection', '100 NE 3rd Ave, Fort Lauderdale, FL 33301, USA', 'Hotel', 'on_premise', 26.1237, -80.1403, '(833) 999-7292', 'https://www.ritzcarltonyachtcollection.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Troon Golf', '465 Scenic Ranch Cir, McKinney, TX 75069, USA', 'Concessions', 'on_premise', 33.1385, -96.5940, '(972) 886-4700', 'http://www.heritageranchgolf.com/')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'United Clubs Lounges', '2400 Aviation Dr, Dallas, TX 75261, USA', 'Concessions', 'on_premise', 32.8928, -97.0372, NULL, 'https://www.united.com/en/us/fly/travel/airport/united-club-and-lounges/locations.html')
  ;

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'Vail Resorts', 'Vail, CO 81657, USA', 'Resort', 'on_premise', 39.6061, -106.3550, '(970) 754-8245', 'https://www.vail.com/')
  RETURNING id INTO acc_id;
  INSERT INTO account_contacts (organization_id, account_id, name, role, email) VALUES (org, acc_id, 'Chelsie Miller Zoller', 'Senior Manager of Beverage', NULL);

  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)
  VALUES (org, uid, 'W Hotel', '2440 Victory Park Ln, Dallas, TX 75219, USA', 'Hotel', 'on_premise', 32.7887, -96.8093, '(214) 397-4100', 'https://www.marriott.com/en-us/hotels/dalwh-w-dallas/overview/?scid=f2ae0541-1279-4f24-b197-a979c79310b0')
  ;

  RAISE NOTICE 'Inserted %s target accounts', 67;
END $$;
