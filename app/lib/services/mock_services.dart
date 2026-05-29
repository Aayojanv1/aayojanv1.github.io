import 'dart:convert';
import 'dart:math';
import '../services/places_service.dart';

/// Mock service that simulates Gemini responses without hitting the API
class MockGeminiService {
  Future<String> rankRestaurants({
    required String mood,
    required String restaurantList,
  }) async {
    await Future.delayed(const Duration(seconds: 2));

    final lines = restaurantList
        .split('\n')
        .where((l) => l.trim().startsWith('-'))
        .toList();
    final random = Random();

    final venues = lines.map((line) {
      final parts = line.replaceFirst('- ', '').split(' | ');
      String extract(String prefix, String fallback) {
        for (final part in parts.skip(1)) {
          if (part.startsWith(prefix)) {
            return part.replaceFirst(prefix, '').trim();
          }
        }
        return fallback;
      }

      return <String, String>{
        'name': parts.isNotEmpty ? parts.first.trim() : 'Venue',
        'type': extract('Type: ', 'restaurant'),
        'cuisine': extract('Cuisine: ', 'mixed'),
        'distance': extract(
          'Distance: ',
          '${(random.nextDouble() * 4 + 0.5).toStringAsFixed(1)}km',
        ),
      };
    }).toList();

    final restaurants =
        venues.where((venue) => venue['type'] == 'restaurant').toList()
          ..shuffle(random);
    final caterers =
        venues.where((venue) => venue['type'] == 'caterer').toList()
          ..shuffle(random);

    final selected = <Map<String, String>>[
      ...restaurants.take(3),
      ...caterers.take(2),
    ];

    if (selected.length < 5) {
      final extras = [...restaurants.skip(3), ...caterers.skip(2)];
      for (final extra in extras) {
        if (selected.length == 5) break;
        selected.add(extra);
      }
    }

    final reasons = [
      'Perfect for your $mood celebration with crowd-pleasing flavors.',
      'Great fit for hosting a lively party with dependable service and standout dishes.',
      'A strong party pick thanks to its menu variety and guest-friendly portions.',
      'Loved for event-ready service that keeps big groups happy.',
      'Ideal when you want a stress-free party spread with memorable food.',
    ];

    final reviewSnippets = [
      'Amazing spread! Everyone at our event kept going back for seconds.',
      'Reliable service and beautifully presented dishes for group orders.',
      'The party menu was a huge hit and delivery was perfectly on time.',
      'Great portions, tasty food, and smooth coordination for our gathering.',
      'Exactly what we needed for hosting guests without the hassle.',
    ];

    final imageIds = [493, 292, 312, 429, 326, 488, 674, 225, 431, 835];

    final menuHighlights = {
      'indian': 'Butter Chicken, Biryani, Naan',
      'chinese': 'Hakka Noodles, Chili Paneer, Fried Rice',
      'italian': 'Wood-Fired Pizza, Alfredo Pasta, Tiramisu',
      'japanese': 'Sushi Rolls, Gyoza, Teriyaki Bowls',
      'bbq': 'Smoked Ribs, Kebabs, Grilled Veggies',
      'vegan': 'Buddha Bowls, Avocado Toasts, Smoothies',
      'mexican': 'Tacos, Nachos, Quesadillas',
      'thai': 'Pad Thai, Satay, Green Curry',
      'french': 'Mini Quiches, Croissants, Canapes',
      'korean': 'Korean Wings, Bibimbap, Kimchi Pancakes',
      'asian': 'Dim Sum, Stir Fry Noodles, Sushi Platters',
      'dessert': 'Cupcakes, Pastries, Ice Cream',
      'kebab': 'Seekh Kebabs, Shawarma, Hummus Platters',
      'mixed': 'Party Wraps, Sliders, Dessert Cups',
      'continental': 'Canapes, Pasta Bake, Cheese Platters',
    };

    final priceRanges = {
      'restaurant': ['₹450-700/person', '₹500-800/person', '₹650-900/person'],
      'caterer': ['₹550-850/person', '₹700-1,000/person', '₹900-1,200/person'],
    };

    final results = <Map<String, dynamic>>[];
    for (int i = 0; i < selected.length; i++) {
      final venue = selected[i];
      final type = venue['type'] ?? 'restaurant';
      final cuisine = venue['cuisine'] ?? 'mixed';
      final rating = 4.0 + random.nextDouble() * 0.9;
      final reviewCount = 30 + random.nextInt(470);

      results.add({
        'name': venue['name'],
        'reason': reasons[i],
        'cuisine': cuisine,
        'distance': venue['distance'],
        'rating': double.parse(rating.toStringAsFixed(1)),
        'reviewCount': reviewCount,
        'reviewSnippet': reviewSnippets[i],
        'imageUrl':
            'https://picsum.photos/id/${imageIds[random.nextInt(imageIds.length)]}/200/150',
        'type': type,
        'priceRange': priceRanges[type]![i % priceRanges[type]!.length],
        'menuHighlight': menuHighlights[cuisine] ?? menuHighlights['mixed'],
      });
    }

    return jsonEncode(results);
  }
}

/// Mock service that returns fake nearby restaurants and caterers
class MockPlacesService {
  Future<List<Restaurant>> findNearbyRestaurants({
    required double lat,
    required double lon,
    int radiusMeters = 5000,
  }) async {
    await Future.delayed(const Duration(seconds: 1));

    final mockRestaurants = [
      Restaurant(
        name: 'Spice Garden',
        cuisine: 'indian',
        lat: lat + 0.005,
        lon: lon + 0.003,
        distanceMeters: 450,
        openingHours: '11:00-23:00',
      ),
      Restaurant(
        name: 'Dragon Palace',
        cuisine: 'chinese',
        lat: lat + 0.01,
        lon: lon - 0.005,
        distanceMeters: 890,
        openingHours: '12:00-22:00',
      ),
      Restaurant(
        name: 'Bella Italia',
        cuisine: 'italian',
        lat: lat - 0.008,
        lon: lon + 0.01,
        distanceMeters: 1200,
        openingHours: '11:30-23:30',
      ),
      Restaurant(
        name: 'Sushi Zen',
        cuisine: 'japanese',
        lat: lat + 0.015,
        lon: lon + 0.008,
        distanceMeters: 1650,
        openingHours: '12:00-21:30',
      ),
      Restaurant(
        name: 'The Grill House',
        cuisine: 'bbq',
        lat: lat - 0.012,
        lon: lon - 0.009,
        distanceMeters: 1900,
        openingHours: '17:00-23:00',
      ),
      Restaurant(
        name: 'Green Bowl',
        cuisine: 'vegan',
        lat: lat + 0.02,
        lon: lon + 0.012,
        distanceMeters: 2100,
        openingHours: '09:00-21:00',
      ),
      Restaurant(
        name: 'Taco Fiesta',
        cuisine: 'mexican',
        lat: lat - 0.018,
        lon: lon + 0.015,
        distanceMeters: 2400,
        openingHours: '11:00-22:00',
      ),
      Restaurant(
        name: 'Bangkok Street',
        cuisine: 'thai',
        lat: lat + 0.022,
        lon: lon - 0.018,
        distanceMeters: 2800,
        openingHours: '11:30-22:30',
      ),
      Restaurant(
        name: 'Café Parisien',
        cuisine: 'french',
        lat: lat - 0.025,
        lon: lon + 0.02,
        distanceMeters: 3100,
        openingHours: '08:00-22:00',
      ),
      Restaurant(
        name: 'Seoul Kitchen',
        cuisine: 'korean',
        lat: lat + 0.028,
        lon: lon - 0.022,
        distanceMeters: 3400,
        openingHours: '12:00-23:00',
      ),
      Restaurant(
        name: 'Biryani Blues',
        cuisine: 'indian',
        lat: lat - 0.015,
        lon: lon - 0.025,
        distanceMeters: 3600,
        openingHours: '11:00-23:00',
      ),
      Restaurant(
        name: 'Pizza Corner',
        cuisine: 'italian',
        lat: lat + 0.03,
        lon: lon + 0.025,
        distanceMeters: 3900,
        openingHours: '10:00-23:00',
      ),
      Restaurant(
        name: 'Noodle Bar',
        cuisine: 'asian',
        lat: lat - 0.032,
        lon: lon + 0.028,
        distanceMeters: 4100,
        openingHours: '11:00-21:00',
      ),
      Restaurant(
        name: 'Sweet Bliss Bakery',
        cuisine: 'dessert',
        lat: lat + 0.035,
        lon: lon - 0.03,
        distanceMeters: 4400,
        openingHours: '08:00-20:00',
      ),
      Restaurant(
        name: 'Kebab King',
        cuisine: 'kebab',
        lat: lat - 0.038,
        lon: lon + 0.032,
        distanceMeters: 4700,
        openingHours: '12:00-00:00',
      ),
      Restaurant(
        name: 'Royal Catering Co.',
        cuisine: 'indian',
        lat: lat + 0.012,
        lon: lon + 0.018,
        distanceMeters: 1450,
        openingHours: '09:00-20:00',
        type: 'caterer',
      ),
      Restaurant(
        name: 'Party Platters Express',
        cuisine: 'mixed',
        lat: lat - 0.02,
        lon: lon + 0.008,
        distanceMeters: 2250,
        openingHours: '08:00-19:00',
        type: 'caterer',
      ),
      Restaurant(
        name:
            'Chef'
            's Table Catering',
        cuisine: 'continental',
        lat: lat + 0.026,
        lon: lon + 0.004,
        distanceMeters: 2950,
        openingHours: '09:00-21:00',
        type: 'caterer',
      ),
      Restaurant(
        name:
            'Mama'
            's Kitchen Catering',
        cuisine: 'italian',
        lat: lat - 0.028,
        lon: lon - 0.014,
        distanceMeters: 3350,
        openingHours: '10:00-20:00',
        type: 'caterer',
      ),
      Restaurant(
        name: 'Wok & Roll Catering',
        cuisine: 'asian',
        lat: lat + 0.034,
        lon: lon - 0.016,
        distanceMeters: 4250,
        openingHours: '10:00-21:00',
        type: 'caterer',
      ),
    ];

    return mockRestaurants;
  }
}
