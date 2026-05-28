import '../models/caterer.dart';
import '../models/catering_order.dart';

const List<Caterer> seedCaterers = [
  Caterer(
    id: 'c1',
    name: 'Bhojohori Manna Caterers',
    ownerName: 'Subroto Das',
    phone: '9830012345',
    address: 'Plot 5A, Action Area I',
    pincode: '700156',
    specialties: ['Wedding', 'Party', 'Religious'],
    cuisineSpecialties: ['Bengali', 'Multi-cuisine'],
    serviceTypes: ['full'],
    tags: ['Bengali Cuisine', 'Multi-course'],
    priceRange: '₹₹₹',
    logo: '🪷',
    rating: 4.8,
    turnaround: '2–3 hrs',
    reviewCount: 286,
    reviewsSummary:
        'Guests rave about polished service, smooth coordination, and rich mains.',
  ),
  Caterer(
    id: 'c2',
    name: 'Kolkata Dawat',
    ownerName: 'Md. Irfan Ali',
    phone: '9736054321',
    address: 'EE-12, Action Area II',
    pincode: '700157',
    specialties: ['Party', 'Corporate', 'Wedding'],
    cuisineSpecialties: ['Mughlai', 'Kolkata Biryani', 'North Indian'],
    serviceTypes: ['full', 'bulk'],
    tags: ['Budget-friendly', 'Mughlai & Bengali'],
    priceRange: '₹₹',
    logo: '🍚',
    rating: 4.6,
    turnaround: '1–2 hrs',
    reviewCount: 194,
    reviewsSummary:
        'Popular for dependable delivery slots, biryani trays, and generous portions.',
  ),
  Caterer(
    id: 'c3',
    name: 'Ananda Bhojan Events',
    ownerName: 'Priya Chakraborty',
    phone: '9674011223',
    address: 'Eco Park Gate 2, Sector IV',
    pincode: '700160',
    specialties: ['Wedding', 'Religious'],
    cuisineSpecialties: ['Bengali', 'Vegetarian Only', 'Jain'],
    serviceTypes: ['full'],
    tags: ['Luxury', 'Live counters', 'Veg specialist'],
    priceRange: '₹₹₹₹',
    logo: '🎊',
    rating: 4.9,
    turnaround: '3–4 hrs',
    reviewCount: 321,
    reviewsSummary:
        'Known for elegant presentation, premium setups, and crowd-pleasing veg menus.',
  ),
  Caterer(
    id: 'c4',
    name: 'Thakurbarir Ranna',
    ownerName: 'Goutam Banerjee',
    phone: '9800167890',
    address: 'K-7 Rajarhat Main Road',
    pincode: '700135',
    specialties: ['Wedding', 'Religious', 'Party'],
    cuisineSpecialties: ['Bengali', 'Vegetarian Only'],
    serviceTypes: ['full', 'bulk'],
    tags: ['Authentic Bengali', 'Vegetarian'],
    priceRange: '₹₹',
    logo: '🏛️',
    rating: 4.7,
    turnaround: '2–3 hrs',
    reviewCount: 172,
    reviewsSummary:
        'Reviewers love the comfort-food flavors and reliable family-style service.',
  ),
  Caterer(
    id: 'c5',
    name: 'Biryani & Beyond',
    ownerName: 'Rajesh Sharma',
    phone: '9051022334',
    address: 'Silicon Valley Tower 3',
    pincode: '700156',
    specialties: ['Party', 'Corporate'],
    cuisineSpecialties: ['Kolkata Biryani', 'Mughlai', 'North Indian'],
    serviceTypes: ['bulk'],
    tags: ['Kolkata Biryani', 'Non-veg specialist'],
    priceRange: '₹₹',
    logo: '🍖',
    rating: 4.5,
    turnaround: '1–2 hrs',
    reviewCount: 147,
    reviewsSummary:
        'Frequently praised for quick dispatches and flavorful non-veg boxes.',
  ),
  Caterer(
    id: 'c6',
    name: 'Sanmilani Grand Caterers',
    ownerName: 'Debabrata Roy',
    phone: '9339044556',
    address: 'New Town Connector, Block D',
    pincode: '700157',
    specialties: ['Wedding', 'Party', 'Corporate', 'Religious'],
    cuisineSpecialties: [
      'Bengali',
      'North Indian',
      'Continental',
      'Multi-cuisine',
    ],
    serviceTypes: ['full', 'bulk'],
    tags: ['Premium', 'Full-service', 'Pan-Bengali'],
    priceRange: '₹₹₹',
    logo: '👑',
    rating: 4.8,
    turnaround: '2–4 hrs',
    reviewCount: 264,
    reviewsSummary:
        'Highly rated for versatile menus, steady staffing, and polished event execution.',
  ),
];

class CatererDb {
  const CatererDb({this.caterers = seedCaterers});

  final List<Caterer> caterers;

  List<Caterer> findMatchingCaterers(CateringOrder order) {
    final desiredEvent = _eventSignalFromOrder(order.eventType);
    final cuisineSignals = _inferCuisineSignals(order.menuItems);

    final ranked =
        caterers.map((caterer) {
          final specialtyScore =
              caterer.specialties.any(
                (specialty) => specialty.toLowerCase() == desiredEvent,
              )
              ? 3
              : caterer.specialties.any(
                  (specialty) => specialty.toLowerCase() == 'party',
                )
              ? 2
              : 0;
          final proximityScore = _pincodeScore(order.pincode, caterer.pincode);
          final cuisineScore = _cuisineScore(caterer, cuisineSignals);
          return _RankedCaterer(
            caterer: caterer,
            proximityScore: proximityScore,
            cuisineScore: cuisineScore,
            specialtyScore: specialtyScore,
          );
        }).toList()..sort((a, b) {
          final scoreDiff = b.totalScore.compareTo(a.totalScore);
          if (scoreDiff != 0) {
            return scoreDiff;
          }
          return b.caterer.rating.compareTo(a.caterer.rating);
        });

    final localPool = ranked
        .where((entry) => entry.proximityScore > 0)
        .toList();
    final resultPool = localPool.isNotEmpty ? localPool : ranked;

    return resultPool
        .map(
          (entry) => entry.caterer.copyWith(
            matchReason: _buildMatchReason(
              caterer: entry.caterer,
              order: order,
              cuisineSignals: cuisineSignals,
              proximityScore: entry.proximityScore,
            ),
          ),
        )
        .toList();
  }

  static String _buildMatchReason({
    required Caterer caterer,
    required CateringOrder order,
    required Set<String> cuisineSignals,
    required int proximityScore,
  }) {
    final parts = <String>[];

    if (proximityScore >= 3) {
      parts.add('Closest option to ${order.pincode} for fast coordination.');
    } else if (proximityScore == 2) {
      parts.add('Strong nearby fit for ${order.area}.');
    } else if (proximityScore == 1) {
      parts.add('Can comfortably serve your Newtown area location.');
    }

    if (cuisineSignals.isNotEmpty) {
      final matches = cuisineSignals.where(
        (signal) => caterer.cuisineSpecialties.any(
          (cuisine) => cuisine.toLowerCase().contains(signal),
        ),
      );
      if (matches.isNotEmpty) {
        parts.add(
          'Menu lines up well with ${matches.take(2).join(' & ')} flavours.',
        );
      }
    }

    if (caterer.specialties.any(
      (specialty) =>
          specialty.toLowerCase() == _eventSignalFromOrder(order.eventType),
    )) {
      parts.add('Experienced with this kind of celebration.');
    }

    if (parts.isEmpty) {
      parts.add('Well-rated all-rounder with flexible menu planning.');
    }

    return parts.join(' ');
  }

  static int _pincodeScore(String requestedPincode, String catererPincode) {
    if (requestedPincode == catererPincode) {
      return 3;
    }
    if (requestedPincode.length >= 5 &&
        catererPincode.length >= 5 &&
        requestedPincode.substring(0, 5) == catererPincode.substring(0, 5)) {
      return 2;
    }
    if (requestedPincode.length >= 3 &&
        catererPincode.length >= 3 &&
        requestedPincode.substring(0, 3) == catererPincode.substring(0, 3)) {
      return 1;
    }
    return 0;
  }

  static int _cuisineScore(Caterer caterer, Set<String> cuisineSignals) {
    if (cuisineSignals.isEmpty) {
      return 1;
    }

    final searchable = [
      ...caterer.cuisineSpecialties,
      ...caterer.tags,
      ...caterer.specialties,
    ].map((entry) => entry.toLowerCase()).toList();

    if (searchable.any((entry) => entry.contains('multi-cuisine'))) {
      return 2;
    }

    return cuisineSignals
        .where((signal) => searchable.any((entry) => entry.contains(signal)))
        .length;
  }

  static Set<String> _inferCuisineSignals(List<String> menuItems) {
    final signals = <String>{};
    for (final item in menuItems) {
      final normalized = item.toLowerCase();
      if (normalized.contains('tikka') ||
          normalized.contains('kebab') ||
          normalized.contains('biryani') ||
          normalized.contains('dal makhani')) {
        signals.add('north indian');
        signals.add('mughlai');
      }
      if (normalized.contains('bbq') ||
          normalized.contains('smoked') ||
          normalized.contains('grilled') ||
          normalized.contains('ribs')) {
        signals.add('multi-cuisine');
      }
      if (normalized.contains('bruschetta') ||
          normalized.contains('pizza') ||
          normalized.contains('pasta') ||
          normalized.contains('risotto') ||
          normalized.contains('lasagna') ||
          normalized.contains('tiramisu')) {
        signals.add('continental');
      }
      if (normalized.contains('dim sum') ||
          normalized.contains('sushi') ||
          normalized.contains('pad thai') ||
          normalized.contains('ramen') ||
          normalized.contains('gyoza') ||
          normalized.contains('mochi')) {
        signals.add('asian');
      }
      if (normalized.contains('pancakes') ||
          normalized.contains('waffles') ||
          normalized.contains('croissant') ||
          normalized.contains('omelette') ||
          normalized.contains('french toast')) {
        signals.add('continental');
        signals.add('vegetarian');
      }
      if (normalized.contains('burger') ||
          normalized.contains('fries') ||
          normalized.contains('wings') ||
          normalized.contains('tacos') ||
          normalized.contains('sliders')) {
        signals.add('multi-cuisine');
      }
      if (normalized.contains('paneer') ||
          normalized.contains('corn') ||
          normalized.contains('caprese') ||
          normalized.contains('fruit') ||
          normalized.contains('edamame')) {
        signals.add('vegetarian');
      }
    }
    return signals;
  }

  static String _eventSignalFromOrder(String eventType) {
    final normalized = eventType.toLowerCase();
    if (normalized.contains('wedding')) {
      return 'wedding';
    }
    if (normalized.contains('religious')) {
      return 'religious';
    }
    if (normalized.contains('corporate')) {
      return 'corporate';
    }
    return 'party';
  }
}

class _RankedCaterer {
  const _RankedCaterer({
    required this.caterer,
    required this.proximityScore,
    required this.cuisineScore,
    required this.specialtyScore,
  });

  final Caterer caterer;
  final int proximityScore;
  final int cuisineScore;
  final int specialtyScore;

  int get totalScore =>
      proximityScore * 2 +
      cuisineScore * 2 +
      specialtyScore * 3 +
      caterer.rating.round();
}
