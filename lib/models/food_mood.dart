class PartyTheme {
  final String label;
  final String emoji;
  final String description;
  final List<String> cuisineKeywords;
  final int suggestedGuests;

  const PartyTheme({
    required this.label,
    required this.emoji,
    required this.description,
    required this.cuisineKeywords,
    this.suggestedGuests = 20,
  });

  static const List<PartyTheme> themes = [
    PartyTheme(
      label: 'BBQ Bash',
      emoji: '🔥',
      description: 'Smoky grills & outdoor vibes',
      cuisineKeywords: ['bbq', 'grill', 'steak', 'kebab', 'tandoori'],
      suggestedGuests: 25,
    ),
    PartyTheme(
      label: 'Bollywood Night',
      emoji: '💃',
      description: 'Spicy Indian feast & music',
      cuisineKeywords: ['indian', 'biryani', 'tandoori', 'chaat', 'curry'],
      suggestedGuests: 30,
    ),
    PartyTheme(
      label: 'Cocktail Party',
      emoji: '🍸',
      description: 'Elegant bites & drinks',
      cuisineKeywords: [
        'continental',
        'finger_food',
        'seafood',
        'french',
        'tapas',
      ],
      suggestedGuests: 20,
    ),
    PartyTheme(
      label: 'Kids Birthday',
      emoji: '🎂',
      description: 'Fun food for little ones',
      cuisineKeywords: ['pizza', 'burger', 'cake', 'ice_cream', 'snack'],
      suggestedGuests: 15,
    ),
    PartyTheme(
      label: 'Italian Night',
      emoji: '🍝',
      description: 'Pasta, pizza & vino',
      cuisineKeywords: ['italian', 'pizza', 'pasta', 'risotto', 'gelato'],
      suggestedGuests: 20,
    ),
    PartyTheme(
      label: 'Asian Feast',
      emoji: '🥢',
      description: 'Sushi, dim sum & stir-fry',
      cuisineKeywords: ['chinese', 'japanese', 'thai', 'korean', 'sushi'],
      suggestedGuests: 20,
    ),
    PartyTheme(
      label: 'Brunch Party',
      emoji: '🥂',
      description: 'Mimosas & morning bites',
      cuisineKeywords: ['brunch', 'cafe', 'bakery', 'continental', 'organic'],
      suggestedGuests: 12,
    ),
    PartyTheme(
      label: 'Game Night',
      emoji: '🎮',
      description: 'Finger food & snack platters',
      cuisineKeywords: ['fast_food', 'pizza', 'burger', 'wings', 'nachos'],
      suggestedGuests: 10,
    ),
  ];
}
