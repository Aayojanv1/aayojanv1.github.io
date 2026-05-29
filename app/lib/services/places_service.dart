import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

class Restaurant {
  final String name;
  final String? cuisine;
  final double lat;
  final double lon;
  final double distanceMeters;
  final String? phone;
  final String? website;
  final String? openingHours;
  final String type;

  Restaurant({
    required this.name,
    this.cuisine,
    required this.lat,
    required this.lon,
    required this.distanceMeters,
    this.phone,
    this.website,
    this.openingHours,
    this.type = 'restaurant',
  });

  String get distanceFormatted {
    if (distanceMeters < 1000) {
      return '${distanceMeters.round()}m';
    }
    return '${(distanceMeters / 1000).toStringAsFixed(1)}km';
  }
}

class PlacesService {
  Future<List<Restaurant>> findNearbyRestaurants({
    required double lat,
    required double lon,
    int radiusMeters = 3000,
  }) {
    final query = '''
[out:json][timeout:25];
(
  node["amenity"="restaurant"](around:$radiusMeters,$lat,$lon);
  way["amenity"="restaurant"](around:$radiusMeters,$lat,$lon);
  node["amenity"="fast_food"](around:$radiusMeters,$lat,$lon);
  way["amenity"="fast_food"](around:$radiusMeters,$lat,$lon);
);
out center body;
''';

    return _runQuery(
      query,
      originLat: lat,
      originLon: lon,
      defaultType: 'restaurant',
    );
  }

  Future<List<Restaurant>> findNearbyCaterers({
    required double lat,
    required double lon,
    int radiusMeters = 5000,
  }) {
    final query = '''
[out:json][timeout:25];
(
  node["shop"="catering"](around:$radiusMeters,$lat,$lon);
  way["shop"="catering"](around:$radiusMeters,$lat,$lon);
  node["amenity"="restaurant"](around:$radiusMeters,$lat,$lon);
  way["amenity"="restaurant"](around:$radiusMeters,$lat,$lon);
  node["amenity"="fast_food"](around:$radiusMeters,$lat,$lon);
  way["amenity"="fast_food"](around:$radiusMeters,$lat,$lon);
);
out center body;
''';

    return _runQuery(
      query,
      originLat: lat,
      originLon: lon,
      defaultType: 'caterer',
    );
  }

  Future<List<Restaurant>> _runQuery(
    String query, {
    required double originLat,
    required double originLon,
    required String defaultType,
  }) async {
    final response = await http.post(
      Uri.parse('https://overpass-api.de/api/interpreter'),
      body: {'data': query},
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to fetch places: ${response.statusCode}');
    }

    final data = json.decode(response.body) as Map<String, dynamic>;
    final elements = data['elements'] as List<dynamic>? ?? const [];
    final results = <Restaurant>[];
    final seen = <String>{};

    for (final element in elements) {
      final tags = element['tags'] as Map<String, dynamic>?;
      if (tags == null || tags['name'] == null) {
        continue;
      }

      double elemLat;
      double elemLon;
      if (element['type'] == 'way') {
        elemLat = (element['center']?['lat'] ?? 0).toDouble();
        elemLon = (element['center']?['lon'] ?? 0).toDouble();
      } else {
        elemLat = (element['lat'] ?? 0).toDouble();
        elemLon = (element['lon'] ?? 0).toDouble();
      }

      final name = tags['name'].toString();
      final dedupeKey = '${name.toLowerCase()}-${elemLat.toStringAsFixed(4)}-${elemLon.toStringAsFixed(4)}';
      if (!seen.add(dedupeKey)) {
        continue;
      }

      final distance = _calculateDistance(originLat, originLon, elemLat, elemLon);
      final type = tags['shop'] == 'catering' || tags['catering'] == 'yes'
          ? 'caterer'
          : defaultType;

      results.add(
        Restaurant(
          name: name,
          cuisine: tags['cuisine'],
          lat: elemLat,
          lon: elemLon,
          distanceMeters: distance,
          phone: tags['phone'] ?? tags['contact:phone'],
          website: tags['website'] ?? tags['contact:website'],
          openingHours: tags['opening_hours'],
          type: type,
        ),
      );
    }

    results.sort((a, b) => a.distanceMeters.compareTo(b.distanceMeters));
    return results;
  }

  double _calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const earthRadius = 6371000.0;
    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);
    final a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  double _toRadians(double degrees) => degrees * (3.141592653589793 / 180);
}
