import '../models/party_menu.dart';

const List<String> kPartyTypes = [
  'BBQ Bash',
  'Bollywood Night',
  'Kids Birthday',
  'Cocktail Party',
  'Italian Night',
  'Asian Feast',
  'Brunch Party',
  'Game Night',
];

const List<PartyMenu> kPartyMenus = [
  PartyMenu(
    partyType: 'BBQ Bash',
    description:
        'A smoky, crowd-pleasing spread with grilled favourites, hearty mains, and easy sides.',
    items: [
      MenuItem(
        name: 'Tandoori Chicken',
        category: 'Starters',
        pricePerPlate: 80,
        emoji: '🍗',
      ),
      MenuItem(
        name: 'Seekh Kebab',
        category: 'Starters',
        pricePerPlate: 70,
        emoji: '🔥',
      ),
      MenuItem(
        name: 'Paneer Tikka',
        category: 'Starters',
        pricePerPlate: 60,
        emoji: '🧀',
      ),
      MenuItem(
        name: 'Grilled Corn',
        category: 'Starters',
        pricePerPlate: 40,
        emoji: '🌽',
      ),
      MenuItem(
        name: 'BBQ Ribs',
        category: 'Main Course',
        pricePerPlate: 150,
        emoji: '🍖',
      ),
      MenuItem(
        name: 'Smoked Chicken',
        category: 'Main Course',
        pricePerPlate: 120,
        emoji: '🍗',
      ),
      MenuItem(
        name: 'Grilled Fish',
        category: 'Main Course',
        pricePerPlate: 130,
        emoji: '🐟',
      ),
      MenuItem(
        name: 'Veg Platter',
        category: 'Main Course',
        pricePerPlate: 90,
        emoji: '🥗',
      ),
      MenuItem(
        name: 'Coleslaw',
        category: 'Sides',
        pricePerPlate: 30,
        emoji: '🥬',
      ),
      MenuItem(
        name: 'Garlic Bread',
        category: 'Sides',
        pricePerPlate: 35,
        emoji: '🥖',
      ),
      MenuItem(
        name: 'Baked Beans',
        category: 'Sides',
        pricePerPlate: 25,
        emoji: '🫘',
      ),
      MenuItem(
        name: 'Corn Salad',
        category: 'Sides',
        pricePerPlate: 30,
        emoji: '🥗',
      ),
      MenuItem(
        name: 'Brownie',
        category: 'Desserts',
        pricePerPlate: 50,
        emoji: '🍫',
      ),
      MenuItem(
        name: 'Ice Cream',
        category: 'Desserts',
        pricePerPlate: 40,
        emoji: '🍨',
      ),
      MenuItem(
        name: 'Fruit Salad',
        category: 'Desserts',
        pricePerPlate: 35,
        emoji: '🍓',
      ),
      MenuItem(
        name: 'Lemonade',
        category: 'Drinks',
        pricePerPlate: 25,
        emoji: '🍋',
      ),
      MenuItem(
        name: 'Iced Tea',
        category: 'Drinks',
        pricePerPlate: 30,
        emoji: '🧋',
      ),
      MenuItem(
        name: 'Mocktail',
        category: 'Drinks',
        pricePerPlate: 45,
        emoji: '🍹',
      ),
    ],
  ),
  PartyMenu(
    partyType: 'Bollywood Night',
    description:
        'High-energy desi comfort food with festive snacks, rich mains, and classic mithai.',
    items: [
      MenuItem(
        name: 'Chicken Tikka',
        category: 'Starters',
        pricePerPlate: 75,
        emoji: '🍢',
      ),
      MenuItem(
        name: 'Samosa',
        category: 'Starters',
        pricePerPlate: 30,
        emoji: '🥟',
      ),
      MenuItem(
        name: 'Aloo Tikki',
        category: 'Starters',
        pricePerPlate: 35,
        emoji: '🥔',
      ),
      MenuItem(
        name: 'Pani Puri',
        category: 'Starters',
        pricePerPlate: 25,
        emoji: '🫓',
      ),
      MenuItem(
        name: 'Butter Chicken',
        category: 'Main Course',
        pricePerPlate: 120,
        emoji: '🍛',
      ),
      MenuItem(
        name: 'Biryani',
        category: 'Main Course',
        pricePerPlate: 100,
        emoji: '🍚',
      ),
      MenuItem(
        name: 'Dal Makhani',
        category: 'Main Course',
        pricePerPlate: 70,
        emoji: '🥘',
      ),
      MenuItem(
        name: 'Paneer Tikka Masala',
        category: 'Main Course',
        pricePerPlate: 90,
        emoji: '🧀',
      ),
      MenuItem(name: 'Naan', category: 'Bread', pricePerPlate: 20, emoji: '🫓'),
      MenuItem(name: 'Roti', category: 'Bread', pricePerPlate: 15, emoji: '🥙'),
      MenuItem(
        name: 'Garlic Naan',
        category: 'Bread',
        pricePerPlate: 25,
        emoji: '🧄',
      ),
      MenuItem(
        name: 'Paratha',
        category: 'Bread',
        pricePerPlate: 30,
        emoji: '🥞',
      ),
      MenuItem(
        name: 'Gulab Jamun',
        category: 'Desserts',
        pricePerPlate: 35,
        emoji: '🍮',
      ),
      MenuItem(
        name: 'Rasgulla',
        category: 'Desserts',
        pricePerPlate: 30,
        emoji: '🍡',
      ),
      MenuItem(
        name: 'Kulfi',
        category: 'Desserts',
        pricePerPlate: 40,
        emoji: '🍦',
      ),
      MenuItem(
        name: 'Jalebi',
        category: 'Desserts',
        pricePerPlate: 25,
        emoji: '🧡',
      ),
      MenuItem(
        name: 'Masala Chai',
        category: 'Drinks',
        pricePerPlate: 20,
        emoji: '☕',
      ),
      MenuItem(
        name: 'Lassi',
        category: 'Drinks',
        pricePerPlate: 35,
        emoji: '🥛',
      ),
      MenuItem(
        name: 'Thandai',
        category: 'Drinks',
        pricePerPlate: 40,
        emoji: '🥤',
      ),
    ],
  ),
  PartyMenu(
    partyType: 'Kids Birthday',
    description:
        'Fun finger foods, kid-favourite mains, and dessert treats that keep the energy high.',
    items: [
      MenuItem(
        name: 'Mini Pizza',
        category: 'Starters',
        pricePerPlate: 60,
        emoji: '🍕',
      ),
      MenuItem(
        name: 'Chicken Nuggets',
        category: 'Starters',
        pricePerPlate: 50,
        emoji: '🍗',
      ),
      MenuItem(
        name: 'French Fries',
        category: 'Starters',
        pricePerPlate: 35,
        emoji: '🍟',
      ),
      MenuItem(
        name: 'Cheese Sticks',
        category: 'Starters',
        pricePerPlate: 45,
        emoji: '🧀',
      ),
      MenuItem(
        name: 'Burger',
        category: 'Main Course',
        pricePerPlate: 80,
        emoji: '🍔',
      ),
      MenuItem(
        name: 'Pasta',
        category: 'Main Course',
        pricePerPlate: 70,
        emoji: '🍝',
      ),
      MenuItem(
        name: 'Mac & Cheese',
        category: 'Main Course',
        pricePerPlate: 65,
        emoji: '🧀',
      ),
      MenuItem(
        name: 'Hot Dog',
        category: 'Main Course',
        pricePerPlate: 55,
        emoji: '🌭',
      ),
      MenuItem(
        name: 'Cupcake',
        category: 'Desserts',
        pricePerPlate: 40,
        emoji: '🧁',
      ),
      MenuItem(
        name: 'Cake Slice',
        category: 'Desserts',
        pricePerPlate: 60,
        emoji: '🎂',
      ),
      MenuItem(
        name: 'Ice Cream Sundae',
        category: 'Desserts',
        pricePerPlate: 50,
        emoji: '🍨',
      ),
      MenuItem(
        name: 'Candy Bar',
        category: 'Desserts',
        pricePerPlate: 30,
        emoji: '🍬',
      ),
      MenuItem(
        name: 'Milkshake',
        category: 'Drinks',
        pricePerPlate: 45,
        emoji: '🥤',
      ),
      MenuItem(
        name: 'Juice Box',
        category: 'Drinks',
        pricePerPlate: 25,
        emoji: '🧃',
      ),
      MenuItem(
        name: 'Soda',
        category: 'Drinks',
        pricePerPlate: 20,
        emoji: '🥤',
      ),
    ],
  ),
  PartyMenu(
    partyType: 'Cocktail Party',
    description:
        'Elegant small plates, premium mains, and polished drinks for a sophisticated evening.',
    items: [
      MenuItem(
        name: 'Bruschetta',
        category: 'Starters',
        pricePerPlate: 65,
        emoji: '🍅',
      ),
      MenuItem(
        name: 'Shrimp Cocktail',
        category: 'Starters',
        pricePerPlate: 90,
        emoji: '🍤',
      ),
      MenuItem(
        name: 'Cheese Board',
        category: 'Starters',
        pricePerPlate: 80,
        emoji: '🧀',
      ),
      MenuItem(
        name: 'Mini Quiche',
        category: 'Starters',
        pricePerPlate: 55,
        emoji: '🥧',
      ),
      MenuItem(
        name: 'Grilled Salmon',
        category: 'Main Course',
        pricePerPlate: 180,
        emoji: '🐟',
      ),
      MenuItem(
        name: 'Lamb Chops',
        category: 'Main Course',
        pricePerPlate: 160,
        emoji: '🍖',
      ),
      MenuItem(
        name: 'Risotto',
        category: 'Main Course',
        pricePerPlate: 100,
        emoji: '🍚',
      ),
      MenuItem(
        name: 'Stuffed Mushrooms',
        category: 'Main Course',
        pricePerPlate: 75,
        emoji: '🍄',
      ),
      MenuItem(
        name: 'Tiramisu',
        category: 'Desserts',
        pricePerPlate: 70,
        emoji: '🍰',
      ),
      MenuItem(
        name: 'Crème Brûlée',
        category: 'Desserts',
        pricePerPlate: 65,
        emoji: '🍮',
      ),
      MenuItem(
        name: 'Chocolate Mousse',
        category: 'Desserts',
        pricePerPlate: 60,
        emoji: '🍫',
      ),
      MenuItem(
        name: 'Wine',
        category: 'Drinks',
        pricePerPlate: 100,
        emoji: '🍷',
      ),
      MenuItem(
        name: 'Cocktail',
        category: 'Drinks',
        pricePerPlate: 80,
        emoji: '🍸',
      ),
      MenuItem(
        name: 'Sparkling Water',
        category: 'Drinks',
        pricePerPlate: 30,
        emoji: '💧',
      ),
    ],
  ),
  PartyMenu(
    partyType: 'Italian Night',
    description:
        'Comforting Italian classics with balanced courses, creamy mains, and café-style drinks.',
    items: [
      MenuItem(
        name: 'Bruschetta',
        category: 'Starters',
        pricePerPlate: 55,
        emoji: '🍅',
      ),
      MenuItem(
        name: 'Caprese Salad',
        category: 'Starters',
        pricePerPlate: 60,
        emoji: '🥗',
      ),
      MenuItem(
        name: 'Garlic Bread',
        category: 'Starters',
        pricePerPlate: 35,
        emoji: '🥖',
      ),
      MenuItem(
        name: 'Arancini',
        category: 'Starters',
        pricePerPlate: 50,
        emoji: '🍘',
      ),
      MenuItem(
        name: 'Margherita Pizza',
        category: 'Main Course',
        pricePerPlate: 90,
        emoji: '🍕',
      ),
      MenuItem(
        name: 'Pasta Alfredo',
        category: 'Main Course',
        pricePerPlate: 85,
        emoji: '🍝',
      ),
      MenuItem(
        name: 'Lasagna',
        category: 'Main Course',
        pricePerPlate: 100,
        emoji: '🍲',
      ),
      MenuItem(
        name: 'Risotto',
        category: 'Main Course',
        pricePerPlate: 95,
        emoji: '🍚',
      ),
      MenuItem(
        name: 'Tiramisu',
        category: 'Desserts',
        pricePerPlate: 65,
        emoji: '🍰',
      ),
      MenuItem(
        name: 'Panna Cotta',
        category: 'Desserts',
        pricePerPlate: 55,
        emoji: '🍮',
      ),
      MenuItem(
        name: 'Gelato',
        category: 'Desserts',
        pricePerPlate: 45,
        emoji: '🍨',
      ),
      MenuItem(
        name: 'Espresso',
        category: 'Drinks',
        pricePerPlate: 30,
        emoji: '☕',
      ),
      MenuItem(
        name: 'Italian Soda',
        category: 'Drinks',
        pricePerPlate: 35,
        emoji: '🥤',
      ),
      MenuItem(
        name: 'Limoncello Mocktail',
        category: 'Drinks',
        pricePerPlate: 50,
        emoji: '🍋',
      ),
    ],
  ),
  PartyMenu(
    partyType: 'Asian Feast',
    description:
        'A flavour-packed spread with shareable starters, noodle-and-rice mains, and fun drinks.',
    items: [
      MenuItem(
        name: 'Dim Sum',
        category: 'Starters',
        pricePerPlate: 70,
        emoji: '🥟',
      ),
      MenuItem(
        name: 'Spring Rolls',
        category: 'Starters',
        pricePerPlate: 45,
        emoji: '🥢',
      ),
      MenuItem(
        name: 'Edamame',
        category: 'Starters',
        pricePerPlate: 35,
        emoji: '🫘',
      ),
      MenuItem(
        name: 'Gyoza',
        category: 'Starters',
        pricePerPlate: 60,
        emoji: '🥟',
      ),
      MenuItem(
        name: 'Sushi Platter',
        category: 'Main Course',
        pricePerPlate: 150,
        emoji: '🍣',
      ),
      MenuItem(
        name: 'Pad Thai',
        category: 'Main Course',
        pricePerPlate: 90,
        emoji: '🍜',
      ),
      MenuItem(
        name: 'Kung Pao Chicken',
        category: 'Main Course',
        pricePerPlate: 100,
        emoji: '🍗',
      ),
      MenuItem(
        name: 'Ramen',
        category: 'Main Course',
        pricePerPlate: 85,
        emoji: '🍜',
      ),
      MenuItem(
        name: 'Mochi',
        category: 'Desserts',
        pricePerPlate: 45,
        emoji: '🍡',
      ),
      MenuItem(
        name: 'Matcha Cake',
        category: 'Desserts',
        pricePerPlate: 55,
        emoji: '🍵',
      ),
      MenuItem(
        name: 'Fried Ice Cream',
        category: 'Desserts',
        pricePerPlate: 50,
        emoji: '🍨',
      ),
      MenuItem(
        name: 'Green Tea',
        category: 'Drinks',
        pricePerPlate: 20,
        emoji: '🍵',
      ),
      MenuItem(
        name: 'Bubble Tea',
        category: 'Drinks',
        pricePerPlate: 50,
        emoji: '🧋',
      ),
      MenuItem(
        name: 'Sake',
        category: 'Drinks',
        pricePerPlate: 70,
        emoji: '🍶',
      ),
    ],
  ),
  PartyMenu(
    partyType: 'Brunch Party',
    description:
        'A cheerful late-morning menu with breakfast favourites, fresh drinks, and bakery bites.',
    items: [
      MenuItem(
        name: 'Avocado Toast',
        category: 'Starters',
        pricePerPlate: 65,
        emoji: '🥑',
      ),
      MenuItem(
        name: 'Eggs Benedict',
        category: 'Starters',
        pricePerPlate: 80,
        emoji: '🍳',
      ),
      MenuItem(
        name: 'Fruit Bowl',
        category: 'Starters',
        pricePerPlate: 45,
        emoji: '🍓',
      ),
      MenuItem(
        name: 'Croissant',
        category: 'Starters',
        pricePerPlate: 40,
        emoji: '🥐',
      ),
      MenuItem(
        name: 'Pancakes',
        category: 'Main Course',
        pricePerPlate: 60,
        emoji: '🥞',
      ),
      MenuItem(
        name: 'Waffles',
        category: 'Main Course',
        pricePerPlate: 55,
        emoji: '🧇',
      ),
      MenuItem(
        name: 'Omelette',
        category: 'Main Course',
        pricePerPlate: 50,
        emoji: '🍳',
      ),
      MenuItem(
        name: 'French Toast',
        category: 'Main Course',
        pricePerPlate: 45,
        emoji: '🍞',
      ),
      MenuItem(
        name: 'Muffin',
        category: 'Desserts',
        pricePerPlate: 35,
        emoji: '🧁',
      ),
      MenuItem(
        name: 'Danish Pastry',
        category: 'Desserts',
        pricePerPlate: 40,
        emoji: '🥐',
      ),
      MenuItem(
        name: 'Scone',
        category: 'Desserts',
        pricePerPlate: 30,
        emoji: '🍪',
      ),
      MenuItem(
        name: 'Mimosa Mocktail',
        category: 'Drinks',
        pricePerPlate: 50,
        emoji: '🍹',
      ),
      MenuItem(
        name: 'Fresh Juice',
        category: 'Drinks',
        pricePerPlate: 40,
        emoji: '🧃',
      ),
      MenuItem(
        name: 'Cappuccino',
        category: 'Drinks',
        pricePerPlate: 35,
        emoji: '☕',
      ),
      MenuItem(
        name: 'Smoothie',
        category: 'Drinks',
        pricePerPlate: 45,
        emoji: '🥤',
      ),
    ],
  ),
  PartyMenu(
    partyType: 'Game Night',
    description:
        'Easy-to-share comfort food with snackable bites, handheld mains, and fun desserts.',
    items: [
      MenuItem(
        name: 'Nachos',
        category: 'Starters',
        pricePerPlate: 50,
        emoji: '🧀',
      ),
      MenuItem(
        name: 'Wings',
        category: 'Starters',
        pricePerPlate: 70,
        emoji: '🍗',
      ),
      MenuItem(
        name: 'Loaded Fries',
        category: 'Starters',
        pricePerPlate: 55,
        emoji: '🍟',
      ),
      MenuItem(
        name: 'Onion Rings',
        category: 'Starters',
        pricePerPlate: 40,
        emoji: '🧅',
      ),
      MenuItem(
        name: 'Pizza',
        category: 'Main Course',
        pricePerPlate: 90,
        emoji: '🍕',
      ),
      MenuItem(
        name: 'Burger',
        category: 'Main Course',
        pricePerPlate: 80,
        emoji: '🍔',
      ),
      MenuItem(
        name: 'Tacos',
        category: 'Main Course',
        pricePerPlate: 65,
        emoji: '🌮',
      ),
      MenuItem(
        name: 'Sliders',
        category: 'Main Course',
        pricePerPlate: 75,
        emoji: '🍔',
      ),
      MenuItem(
        name: 'Brownie',
        category: 'Desserts',
        pricePerPlate: 40,
        emoji: '🍫',
      ),
      MenuItem(
        name: 'Cookie Platter',
        category: 'Desserts',
        pricePerPlate: 35,
        emoji: '🍪',
      ),
      MenuItem(
        name: 'Churros',
        category: 'Desserts',
        pricePerPlate: 45,
        emoji: '🥨',
      ),
      MenuItem(
        name: 'Soda',
        category: 'Drinks',
        pricePerPlate: 20,
        emoji: '🥤',
      ),
      MenuItem(
        name: 'Energy Drink',
        category: 'Drinks',
        pricePerPlate: 35,
        emoji: '⚡',
      ),
      MenuItem(
        name: 'Milkshake',
        category: 'Drinks',
        pricePerPlate: 45,
        emoji: '🥤',
      ),
    ],
  ),
];

PartyMenu? partyMenuForType(String partyType) {
  for (final menu in kPartyMenus) {
    if (menu.partyType.toLowerCase() == partyType.toLowerCase()) {
      return menu;
    }
  }
  return null;
}
