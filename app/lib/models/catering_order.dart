class CateringOrder {
  final String id;
  final String serviceType;
  final String eventType;
  final int guestCount;
  final int perPlateBudget;
  final List<String> menuItems;
  final String pincode;
  final String area;
  final String summary;
  final DateTime placedAt;

  CateringOrder({
    required this.id,
    required this.serviceType,
    required this.eventType,
    required this.guestCount,
    required this.perPlateBudget,
    required this.menuItems,
    required this.pincode,
    required this.area,
    required this.summary,
    required this.placedAt,
  });

  factory CateringOrder.fromJson(Map<String, dynamic> json) {
    return CateringOrder(
      id: json['id'] as String? ?? '',
      serviceType: json['serviceType'] as String? ?? '',
      eventType: json['eventType'] as String? ?? '',
      guestCount: (json['guestCount'] as num?)?.toInt() ?? 0,
      perPlateBudget: (json['perPlateBudget'] as num?)?.toInt() ?? 0,
      menuItems: (json['menuItems'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      pincode: json['pincode'] as String? ?? '',
      area: json['area'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      placedAt: DateTime.tryParse(json['placedAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}
