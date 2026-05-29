class MenuItem {
  final String name;
  final String category;
  final int pricePerPlate;
  final String emoji;

  const MenuItem({
    required this.name,
    required this.category,
    required this.pricePerPlate,
    required this.emoji,
  });
}

class PartyMenu {
  final String partyType;
  final List<MenuItem> items;
  final String description;

  const PartyMenu({
    required this.partyType,
    required this.items,
    required this.description,
  });
}
