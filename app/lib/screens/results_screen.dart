import 'package:flutter/material.dart';
import '../models/food_mood.dart';
import '../models/restaurant_result.dart';

class ResultsScreen extends StatefulWidget {
  final PartyTheme theme;
  final List<RestaurantResult> results;
  final VoidCallback onStartOver;

  const ResultsScreen({
    super.key,
    required this.theme,
    required this.results,
    required this.onStartOver,
  });

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this)
      ..addListener(() {
        if (!_tabController.indexIsChanging) {
          setState(() {});
        }
      });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<RestaurantResult> get _filteredResults {
    switch (_tabController.index) {
      case 1:
        return widget.results
            .where((result) => result.type.toLowerCase() == 'restaurant')
            .toList();
      case 2:
        return widget.results
            .where((result) => result.type.toLowerCase() == 'caterer')
            .toList();
      default:
        return widget.results;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final filteredResults = _filteredResults;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: widget.onStartOver,
                        icon: const Icon(Icons.arrow_back_rounded),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Colors.grey.shade200),
                          ),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.primaryContainer.withValues(
                            alpha: 0.3,
                          ),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              widget.theme.emoji,
                              style: const TextStyle(fontSize: 18),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              widget.theme.label,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Text(
                    "Radhuni's Party Picks 🎯",
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${filteredResults.length} options for your "${widget.theme.label}" party theme',
                    style: TextStyle(
                      fontSize: 14,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: TabBar(
                      controller: _tabController,
                      dividerColor: Colors.transparent,
                      indicator: BoxDecoration(
                        color: colorScheme.primary,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      labelColor: Colors.white,
                      unselectedLabelColor: colorScheme.onSurface.withValues(
                        alpha: 0.7,
                      ),
                      tabs: const [
                        Tab(text: 'All'),
                        Tab(text: 'Restaurants'),
                        Tab(text: 'Caterers'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: filteredResults.isEmpty
                  ? Center(
                      child: Text(
                        'No matches in this filter yet.',
                        style: TextStyle(
                          fontSize: 15,
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      itemCount: filteredResults.length,
                      itemBuilder: (context, index) => _RestaurantCard(
                        result: filteredResults[index],
                        colorScheme: colorScheme,
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: FilledButton.icon(
                onPressed: widget.onStartOver,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try Another Theme'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RestaurantCard extends StatelessWidget {
  final RestaurantResult result;
  final ColorScheme colorScheme;

  const _RestaurantCard({required this.result, required this.colorScheme});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(20),
                ),
                child: Container(
                  height: 130,
                  width: double.infinity,
                  color: _getCuisineColor().withValues(alpha: 0.15),
                  child: result.imageUrl.isNotEmpty
                      ? Image.network(
                          result.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => _FoodPlaceholder(
                            cuisine: result.cuisine,
                            color: _getCuisineColor(),
                          ),
                          loadingBuilder: (_, child, progress) {
                            if (progress == null) return child;
                            return _FoodPlaceholder(
                              cuisine: result.cuisine,
                              color: _getCuisineColor(),
                            );
                          },
                        )
                      : _FoodPlaceholder(
                          cuisine: result.cuisine,
                          color: _getCuisineColor(),
                        ),
                ),
              ),
              Positioned(
                top: 10,
                left: 10,
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: _getRankColors(),
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      '#${result.rank}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 10,
                right: 10,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            color: Color(0xFFFFD700),
                            size: 16,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            result.rating.toStringAsFixed(1),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    _TypeBadge(type: result.type, dark: true),
                  ],
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        result.name,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${result.reviewCount} reviews',
                      style: TextStyle(
                        fontSize: 12,
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _TypeBadge(type: result.type),
                    _Tag(
                      icon: Icons.restaurant,
                      label: result.cuisine,
                      color: colorScheme.primary,
                    ),
                    _Tag(
                      icon: Icons.location_on,
                      label: result.distance,
                      color: colorScheme.secondary,
                    ),
                    _Tag(
                      icon: Icons.payments_rounded,
                      label: result.priceRange,
                      color: const Color(0xFF2E7D32),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    ...List.generate(5, (i) {
                      final filled = result.rating - i;
                      return Icon(
                        filled >= 1
                            ? Icons.star_rounded
                            : filled >= 0.5
                            ? Icons.star_half_rounded
                            : Icons.star_border_rounded,
                        color: const Color(0xFFFFB300),
                        size: 18,
                      );
                    }),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: colorScheme.primaryContainer.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('💡', style: TextStyle(fontSize: 14)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          result.reason,
                          style: TextStyle(
                            fontSize: 13,
                            color: colorScheme.onSurface.withValues(alpha: 0.7),
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (result.menuHighlight.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF8E1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.local_dining_rounded,
                          size: 16,
                          color: Color(0xFFFF8F00),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Menu highlight: ${result.menuHighlight}',
                            style: TextStyle(
                              fontSize: 12,
                              color: colorScheme.onSurface.withValues(
                                alpha: 0.75,
                              ),
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (result.reviewSnippet.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.format_quote_rounded,
                          size: 16,
                          color: Colors.grey.shade400,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            result.reviewSnippet,
                            style: TextStyle(
                              fontSize: 12,
                              fontStyle: FontStyle.italic,
                              color: colorScheme.onSurface.withValues(
                                alpha: 0.6,
                              ),
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getCuisineColor() {
    switch (result.cuisine.toLowerCase()) {
      case 'indian':
        return const Color(0xFFFF6B35);
      case 'chinese':
      case 'asian':
        return const Color(0xFFE53935);
      case 'italian':
        return const Color(0xFF43A047);
      case 'japanese':
        return const Color(0xFFEC407A);
      case 'mexican':
        return const Color(0xFFFFA726);
      case 'thai':
        return const Color(0xFF7B1FA2);
      case 'french':
      case 'continental':
        return const Color(0xFF1565C0);
      case 'korean':
        return const Color(0xFFD32F2F);
      case 'bbq':
        return const Color(0xFF5D4037);
      case 'vegan':
        return const Color(0xFF2E7D32);
      case 'dessert':
        return const Color(0xFFE91E63);
      default:
        return const Color(0xFF6C63FF);
    }
  }

  List<Color> _getRankColors() {
    switch (result.rank) {
      case 1:
        return [const Color(0xFFFFD700), const Color(0xFFFFA000)];
      case 2:
        return [const Color(0xFFC0C0C0), const Color(0xFF9E9E9E)];
      case 3:
        return [const Color(0xFFCD7F32), const Color(0xFFA0522D)];
      default:
        return [const Color(0xFF6C63FF), const Color(0xFF5A52E0)];
    }
  }
}

class _FoodPlaceholder extends StatelessWidget {
  final String cuisine;
  final Color color;

  const _FoodPlaceholder({required this.cuisine, required this.color});

  String get _emoji {
    switch (cuisine.toLowerCase()) {
      case 'indian':
        return '🍛';
      case 'chinese':
      case 'asian':
        return '🥡';
      case 'italian':
        return '🍝';
      case 'japanese':
        return '🍣';
      case 'mexican':
        return '🌮';
      case 'thai':
        return '🍜';
      case 'french':
      case 'continental':
        return '🥐';
      case 'korean':
        return '🥘';
      case 'bbq':
        return '🥩';
      case 'vegan':
        return '🥗';
      case 'dessert':
        return '🍰';
      case 'kebab':
        return '🥙';
      default:
        return '🍽️';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color.withValues(alpha: 0.1), color.withValues(alpha: 0.25)],
        ),
      ),
      child: Center(child: Text(_emoji, style: const TextStyle(fontSize: 48))),
    );
  }
}

class _Tag extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _Tag({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  final String type;
  final bool dark;

  const _TypeBadge({required this.type, this.dark = false});

  @override
  Widget build(BuildContext context) {
    final isCaterer = type.toLowerCase() == 'caterer';
    final color = isCaterer ? const Color(0xFF6C63FF) : const Color(0xFFFF6B35);
    final background = dark
        ? Colors.black.withValues(alpha: 0.68)
        : color.withValues(alpha: 0.1);
    final foreground = dark ? Colors.white : color;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isCaterer ? Icons.room_service_rounded : Icons.restaurant_rounded,
            size: 14,
            color: foreground,
          ),
          const SizedBox(width: 4),
          Text(
            isCaterer ? 'Caterer' : 'Restaurant',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: foreground,
            ),
          ),
        ],
      ),
    );
  }
}
