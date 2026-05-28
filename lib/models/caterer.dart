class Caterer {
  final String id;
  final String name;
  final String ownerName;
  final String phone;
  final String address;
  final String pincode;
  final List<String> specialties;
  final List<String> cuisineSpecialties;
  final List<String> serviceTypes;
  final List<String> tags;
  final String priceRange;
  final String logo;
  final double rating;
  final String turnaround;
  final int reviewCount;
  final String reviewsSummary;
  final String matchReason;

  const Caterer({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.phone,
    required this.address,
    required this.pincode,
    required this.specialties,
    required this.cuisineSpecialties,
    required this.serviceTypes,
    required this.tags,
    required this.priceRange,
    required this.logo,
    required this.rating,
    required this.turnaround,
    this.reviewCount = 0,
    this.reviewsSummary = '',
    this.matchReason = '',
  });

  Caterer copyWith({
    String? ownerName,
    String? phone,
    String? address,
    String? pincode,
    List<String>? specialties,
    List<String>? cuisineSpecialties,
    List<String>? serviceTypes,
    List<String>? tags,
    String? priceRange,
    String? logo,
    double? rating,
    String? turnaround,
    int? reviewCount,
    String? reviewsSummary,
    String? matchReason,
  }) {
    return Caterer(
      id: id,
      name: name,
      ownerName: ownerName ?? this.ownerName,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      pincode: pincode ?? this.pincode,
      specialties: specialties ?? this.specialties,
      cuisineSpecialties: cuisineSpecialties ?? this.cuisineSpecialties,
      serviceTypes: serviceTypes ?? this.serviceTypes,
      tags: tags ?? this.tags,
      priceRange: priceRange ?? this.priceRange,
      logo: logo ?? this.logo,
      rating: rating ?? this.rating,
      turnaround: turnaround ?? this.turnaround,
      reviewCount: reviewCount ?? this.reviewCount,
      reviewsSummary: reviewsSummary ?? this.reviewsSummary,
      matchReason: matchReason ?? this.matchReason,
    );
  }
}
