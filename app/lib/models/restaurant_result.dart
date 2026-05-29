import 'dart:convert';

class RestaurantResult {
  final String name;
  final String reason;
  final String cuisine;
  final String distance;
  final int rank;
  final double rating;
  final int reviewCount;
  final String reviewSnippet;
  final String imageUrl;
  final String type;
  final String priceRange;
  final String menuHighlight;

  RestaurantResult({
    required this.name,
    required this.reason,
    required this.cuisine,
    required this.distance,
    required this.rank,
    this.rating = 4.0,
    this.reviewCount = 0,
    this.reviewSnippet = '',
    this.imageUrl = '',
    this.type = 'restaurant',
    this.priceRange = '',
    this.menuHighlight = '',
  });

  factory RestaurantResult.fromJson(Map<String, dynamic> json, int rank) {
    return RestaurantResult(
      name: json['name'] ?? 'Unknown',
      reason: json['reason'] ?? '',
      cuisine: json['cuisine'] ?? 'Restaurant',
      distance: json['distance'] ?? '',
      rank: rank,
      rating: (json['rating'] as num?)?.toDouble() ?? 4.0,
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 50,
      reviewSnippet: json['reviewSnippet'] ?? '',
      imageUrl: json['imageUrl'] ?? '',
      type: json['type'] ?? 'restaurant',
      priceRange: json['priceRange'] ?? '',
      menuHighlight: json['menuHighlight'] ?? '',
    );
  }

  static List<RestaurantResult> parseResults(String jsonString) {
    try {
      var cleaned = jsonString.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned
            .replaceAll(RegExp(r'^```\w*\n?'), '')
            .replaceAll(RegExp(r'\n?```$'), '');
      }
      final List<dynamic> list = json.decode(cleaned);
      return list.asMap().entries.map((e) {
        return RestaurantResult.fromJson(
          e.value as Map<String, dynamic>,
          e.key + 1,
        );
      }).toList();
    } catch (_) {
      return [];
    }
  }
}
